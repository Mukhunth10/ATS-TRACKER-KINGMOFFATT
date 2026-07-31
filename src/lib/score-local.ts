import { SKILL_BY_KEY, labelForKey } from "./bim-taxonomy";
import type { AiResult } from "./score-ai";

/**
 * Free, local LLM screening via Ollama.
 *
 * Runs an open-source instruct model on the user's own machine through Ollama's
 * HTTP API. Candidate data never leaves the machine — the private, GDPR-friendly
 * alternative to a cloud screener, at zero cost.
 *
 * Produces the same AiResult shape as the cloud screener, so the rest of the app
 * displays it identically. Role-driven: it screens against whatever the role
 * actually asks for (BIM software, BIM coordination, building-services design,
 * planning …), never assuming a software job unless the role says so.
 *
 * Quality is tuned three ways rather than by fine-tuning (which would need a
 * labelled dataset and a GPU):
 *   1. Decoding — a large context window so long CVs aren't silently truncated,
 *      deterministic sampling so scores are reproducible, and JSON-schema
 *      constrained output so the result is always well-formed.
 *   2. Prompt — a weighted, role-adaptive rubric, explicit calibration bands,
 *      and a hidden "reason first" step that lifts small-model accuracy.
 *   3. Grounding — the rule-based evidence (proven vs keyword-only vs missing)
 *      is handed to the model as a scaffold to corroborate, not invent.
 */

const DEFAULT_URL = "http://localhost:11434";

// A strong, laptop-friendly default. Qwen2.5-Instruct leads its size class at
// instruction-following and structured extraction — ideal for rubric scoring.
// Override with LOCAL_AI_MODEL (e.g. "qwen2.5:14b-instruct" on a bigger machine,
// or "llama3.1:8b").
const DEFAULT_MODEL = "qwen2.5:7b-instruct";

export function localAiConfigured(): boolean {
  // Local screening is considered "on" whenever it's explicitly enabled or a
  // model is named. The URL and model both have sensible defaults.
  return (
    Boolean(process.env.LOCAL_AI_MODEL) ||
    process.env.LOCAL_AI === "on" ||
    process.env.LOCAL_AI_ENABLED === "true"
  );
}

function modelName(): string {
  return process.env.LOCAL_AI_MODEL || DEFAULT_MODEL;
}

function baseUrl(): string {
  return (process.env.LOCAL_AI_URL || DEFAULT_URL).replace(/\/$/, "");
}

/** A larger window than Ollama's 2048 default so full CVs are never truncated. */
function numCtx(): number {
  const n = Number(process.env.LOCAL_AI_NUM_CTX);
  return Number.isFinite(n) && n >= 2048 ? n : 8192;
}

/** Quick liveness check so the UI can show whether local screening will work. */
export async function localAiAvailable(): Promise<boolean> {
  if (!localAiConfigured()) return false;
  try {
    const res = await fetch(`${baseUrl()}/api/tags`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Compact rule-based signals, handed to the model as grounding. Optional. */
export interface RuleSignals {
  yearsDetected?: number;
  yearsRequired?: number;
  demonstrated?: string[];
  listedOnly?: string[];
  missingMustHave?: string[];
  semantic?: string[];
}

const SYSTEM = `You are a rigorous, fair technical recruiter screening ONE candidate CV against
ONE specific role in the construction / built-environment industry (this may be a
software-for-BIM role, a BIM coordination role, a building-services design role, a
planning role, and so on). Screen against the role in front of you — never assume
it is a software job unless the role says so.

Judge on GENUINE, DEMONSTRATED evidence. A skill shown in a real project the
candidate did counts far more than the same word sitting in a keyword list. Quote
or paraphrase concrete evidence from the CV; never invent a skill that is not
there. If the CV is too thin to judge, say so and score low rather than guessing.

Weight your overall 0-100 score roughly like this, adapting to what the role asks:
  • Must-have coverage, PROVEN in projects            ~40 pts
  • Relevant hands-on experience & depth for THIS role ~25 pts
  • Seniority / years vs. what the role requires       ~15 pts
  • Domain & standards relevance (e.g. ISO 19650, IFC,
    discipline knowledge, tools the role names)        ~12 pts
  • Trajectory, stability, growth                      ~8 pts

Calibration — be honest and spread your scores; do NOT cluster everyone in the 60s:
  • 85-100  exceptional, clearly exceeds the bar
  • 70-84   strong, advance with confidence
  • 55-69   plausible but with real gaps — worth a call
  • 35-54   weak fit, likely reject
  • 0-34    clearly not a fit / too little evidence

You will be given automated rule-based signals as a starting scaffold. Treat them
as hints to VERIFY against the CV text, not as ground truth — correct them where
the CV disagrees.

Think first, then score: fill the "reasoning" field with your evidence-based
analysis BEFORE deciding the number, so the score follows the evidence.`;

/**
 * JSON schema Ollama constrains generation to (structured outputs). "reasoning"
 * comes first on purpose: the model generates it before committing to a score,
 * which improves calibration. We don't surface it in the UI.
 */
const LOCAL_SCHEMA = {
  type: "object",
  properties: {
    reasoning: { type: "string" },
    score: { type: "integer" },
    summary: { type: "string" },
    seniorityAssessment: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    bimEvidence: {
      type: "array",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["skill", "evidence"],
      },
    },
    recommendation: { type: "string", enum: ["advance", "maybe", "reject"] },
  },
  required: [
    "reasoning",
    "score",
    "summary",
    "seniorityAssessment",
    "strengths",
    "gaps",
    "bimEvidence",
    "recommendation",
  ],
} as const;

function label(k: string): string {
  return k.startsWith("custom:") ? labelForKey(k) : (SKILL_BY_KEY.get(k)?.label ?? k);
}

function signalsBlock(s?: RuleSignals): string {
  if (!s) return "";
  const list = (a?: string[]) => (a && a.length ? a.map(label).join(", ") : "none");
  return `Automated rule-based pre-screen (VERIFY against the CV; correct where it disagrees):
- Years detected: ${s.yearsDetected ?? "unknown"} (role requires ${s.yearsRequired ?? "?"})
- Proven in projects: ${list(s.demonstrated)}
- Listed as keyword only (no supporting project): ${list(s.listedOnly)}
- Missing must-haves: ${list(s.missingMustHave)}
- Near/meaning matches to confirm: ${list(s.semantic)}

`;
}

function buildPrompt(
  resumeText: string,
  job: {
    title: string;
    seniority: string;
    minYears: number;
    description: string;
    mustHave: string[];
    niceToHave: string[];
  },
  signals?: RuleSignals,
): string {
  return `<role>
Title: ${job.title}
Seniority: ${job.seniority}
Minimum years: ${job.minYears}
Must-have skills: ${job.mustHave.map(label).join(", ") || "none specified"}
Nice-to-have skills: ${job.niceToHave.map(label).join(", ") || "none specified"}
Description: ${job.description || "(none)"}
</role>

${signalsBlock(signals)}<cv>
${resumeText}
</cv>

Screen this candidate against the role. Return a JSON object matching the schema.`;
}

/** Pulls the first balanced JSON object out of a model response (fallback path). */
function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON");
  }
}

/** Coerces a loose model object into a well-formed AiResult (drops "reasoning"). */
function normalise(obj: Record<string, unknown>): AiResult {
  const asArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String).filter(Boolean) : typeof v === "string" && v ? [v] : [];
  const rec = ["advance", "maybe", "reject"];
  const recommendation = rec.includes(String(obj.recommendation))
    ? (obj.recommendation as AiResult["recommendation"])
    : "maybe";

  return {
    score: Math.max(0, Math.min(100, Math.round(Number(obj.score) || 0))),
    summary: String(obj.summary ?? "").slice(0, 2000) || "No summary produced.",
    seniorityAssessment: String(obj.seniorityAssessment ?? ""),
    strengths: asArr(obj.strengths),
    gaps: asArr(obj.gaps),
    bimEvidence: Array.isArray(obj.bimEvidence)
      ? (obj.bimEvidence as unknown[])
          .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
          .map((e) => ({ skill: String(e.skill ?? ""), evidence: String(e.evidence ?? "") }))
          .filter((e) => e.skill || e.evidence)
      : [],
    recommendation,
  };
}

async function callOllama(model: string, prompt: string): Promise<string> {
  const res = await fetch(`${baseUrl()}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      system: SYSTEM,
      prompt,
      // Structured outputs: constrain generation to the schema, not just "valid
      // JSON". Far more reliable than free-form + parsing.
      format: LOCAL_SCHEMA,
      stream: false,
      options: {
        // Deterministic, reproducible scoring — the same CV always scores the same.
        temperature: 0,
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.05,
        seed: 42,
        // The fix that matters most: fit the whole CV + role + rubric in context
        // so nothing is silently dropped.
        num_ctx: numCtx(),
        num_predict: 1024,
      },
    }),
    // Local models on CPU can be slow, especially the first token after a load.
    signal: AbortSignal.timeout(240_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 404) {
      throw new Error(
        `Model "${model}" isn't pulled. Run:  ollama pull ${model}`,
      );
    }
    throw new Error(
      `Local model error (${res.status}). Is Ollama running? ${body.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as { response?: string };
  if (!data.response) throw new Error("Empty response from local model");
  return data.response;
}

export async function scoreByLocalAi(
  resumeText: string,
  job: {
    title: string;
    track: string;
    seniority: string;
    minYears: number;
    description: string;
    mustHave: string[];
    niceToHave: string[];
  },
  signals?: RuleSignals,
): Promise<AiResult> {
  const model = modelName();
  const prompt = buildPrompt(resumeText, job, signals);

  let lastErr: unknown;
  // One retry: a small model occasionally emits a stray token that breaks the
  // JSON even under a schema; a second deterministic pass almost always fixes it.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await callOllama(model, prompt);
      return normalise(extractJson(response) as Record<string, unknown>);
    } catch (err) {
      lastErr = err;
      // Don't retry configuration errors (model missing, server down).
      if (err instanceof Error && /isn't pulled|Ollama running|error \(/.test(err.message)) {
        throw err;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Local screening failed");
}

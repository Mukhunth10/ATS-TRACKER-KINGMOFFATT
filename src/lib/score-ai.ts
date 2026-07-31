import Anthropic from "@anthropic-ai/sdk";
import { SKILL_BY_KEY } from "./bim-taxonomy";

export interface AiResult {
  score: number;
  summary: string;
  strengths: string[];
  gaps: string[];
  bimEvidence: { skill: string; evidence: string }[];
  recommendation: "advance" | "maybe" | "reject";
  seniorityAssessment: string;
}

/** Screening rubric. Kept out of the per-request string so the cache prefix is stable. */
const RUBRIC = `You are screening candidates for BIM (Building Information Modelling) software
development roles at an AEC technology company. You are evaluating people who
BUILD software for the BIM ecosystem — not people who model buildings in it.

That distinction is the single most important judgement you make. A candidate with
ten years of Revit modelling and no code is a weak fit for these roles. A candidate
who has shipped a Revit API add-in, written an IFC parser, or built on Autodesk
Platform Services is a strong fit even with fewer total years.

Score 0-100 against this rubric:

  BIM-specific engineering depth (40 pts)
    Evidence of programming against BIM platforms: Revit API / Navisworks API /
    Tekla Open API / Archicad API, IFC toolchains (IfcOpenShell, xBIM), Autodesk
    Platform Services, Speckle, Dynamo Zero-Touch nodes, Rhino.Inside.
    Reward shipped, named artifacts over listed keywords.

  General software engineering strength (25 pts)
    Language depth (C#/.NET and Python dominate this space), architecture,
    testing, CI/CD, code they own end-to-end.

  Standards and interoperability literacy (15 pts)
    IFC schema fluency, COBie, BCF, ISO 19650, geometry/BRep understanding.
    Genuine interop work is rare and valuable — weight it accordingly.

  Domain context (10 pts)
    Has worked with or inside AEC firms; understands what a clash, a discipline
    model, or a federated model actually is.

  Trajectory and role fit (10 pts)
    Seniority match, stability, evidence of growth.

Scoring discipline:
  - Cite concrete evidence from the resume. Never infer a skill that is not there.
  - Keyword lists with no supporting project are weak evidence; say so.
  - Be calibrated: 80+ means genuinely strong, 50 means borderline, below 35 means
    clearly not a fit. Do not cluster everyone in the 60s.
  - If the resume is too thin to judge, say that in the summary and score low with
    a "maybe" recommendation rather than guessing.`;

const SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "0-100 overall fit score" },
    summary: {
      type: "string",
      description: "2-3 sentence verdict a hiring manager can read in isolation",
    },
    seniorityAssessment: {
      type: "string",
      description: "Actual seniority observed vs. what the role asks for",
    },
    strengths: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    bimEvidence: {
      type: "array",
      description: "Specific BIM-development evidence quoted or paraphrased from the resume",
      items: {
        type: "object",
        properties: {
          skill: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["skill", "evidence"],
        additionalProperties: false,
      },
    },
    recommendation: { type: "string", enum: ["advance", "maybe", "reject"] },
  },
  required: [
    "score",
    "summary",
    "seniorityAssessment",
    "strengths",
    "gaps",
    "bimEvidence",
    "recommendation",
  ],
  additionalProperties: false,
} as const;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function scoreByAi(
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
): Promise<AiResult> {
  const client = new Anthropic();

  const label = (k: string) => SKILL_BY_KEY.get(k)?.label ?? k;

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: SCHEMA },
    },
    // Rubric is the stable prefix; the varying role + resume follow it so the
    // cached portion is reused across every screening call.
    system: [{ type: "text", text: RUBRIC, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `<role>
Title: ${job.title}
Track: ${job.track}
Seniority: ${job.seniority}
Minimum years: ${job.minYears}
Must-have skills: ${job.mustHave.map(label).join(", ") || "none specified"}
Nice-to-have skills: ${job.niceToHave.map(label).join(", ") || "none specified"}

${job.description || "(no additional description)"}
</role>

<resume>
${resumeText}
</resume>

Screen this candidate against the role above.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw new Error(`No text block in response (stop_reason: ${response.stop_reason})`);
  }

  return JSON.parse(text.text) as AiResult;
}

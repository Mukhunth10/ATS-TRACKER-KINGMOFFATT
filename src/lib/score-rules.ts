import {
  detectTermHits,
  detectYears,
  evidenceOf,
  semanticPhrase,
  SKILLS,
  SKILL_BY_KEY,
  parseKeyword,
  labelForKey,
  type CustomKeyword,
  type Evidence,
} from "./bim-taxonomy";
import { semanticMatch } from "./semantic";

/** A skill only listed in a keyword dump is worth half a skill actually used. */
const LISTED_CREDIT = 0.5;

/**
 * A semantic (meaning) match is a softer signal than an exact word — embeddings
 * match related concepts, so they occasionally over-fire ("produced drawings" is
 * genuinely near "AutoCAD"). It is worth partial credit and always flagged for a
 * human to confirm, never full credit like a keyword hit.
 */
const SEMANTIC_CREDIT = 0.5;

/** Weight given to a recruiter-typed keyword when they don't set one. */
export const DEFAULT_KEYWORD_WEIGHT = 3;

export interface RuleDetail {
  matched: string[];
  /** Skills backed by an accomplishment line, not just a keyword list. */
  demonstrated: string[];
  /** Skills that appear only as bare keywords. */
  listedOnly: string[];
  /** Skills found by meaning rather than a matching word (semantic layer). */
  semantic: string[];
  /** Resume line that earned credit, per skill — shown to the reviewer. */
  evidence: Record<string, string>;
  missingMustHave: string[];
  matchedNiceToHave: string[];
  yearsDetected: number;
  yearsRequired: number;
}

export interface RuleResult {
  score: number;
  detail: RuleDetail;
}

export interface JobCriteria {
  /** Keys from the built-in library. */
  mustHave: string[];
  niceToHave: string[];
  /** Raw keyword strings the recruiter typed, e.g. "Primavera P6 | P6". */
  customMustHave?: string[];
  customNiceToHave?: string[];
  minYears: number;
}

/** One resolved hit, however it was found. */
interface Hit {
  key: string;
  evidence: Evidence;
  snippet: string;
  /** True when found by meaning rather than a matching word. */
  semantic: boolean;
}

function resolveVocabulary(job: JobCriteria) {
  const customMust = (job.customMustHave ?? [])
    .map((raw) => parseKeyword(raw, "must"))
    .filter((k): k is CustomKeyword => k !== null);
  const customNice = (job.customNiceToHave ?? [])
    .map((raw) => parseKeyword(raw, "nice"))
    .filter((k): k is CustomKeyword => k !== null);

  const vocabulary = [...SKILLS, ...customMust, ...customNice];
  const mustKeys = [...job.mustHave, ...customMust.map((k) => k.key)];
  const niceKeys = [...job.niceToHave, ...customNice.map((k) => k.key)];
  const custom = [...customMust, ...customNice];

  const weightOf = (key: string): number =>
    SKILL_BY_KEY.get(key)?.weight ??
    custom.find((k) => k.key === key)?.weight ??
    DEFAULT_KEYWORD_WEIGHT;

  return { vocabulary, mustKeys, niceKeys, custom, weightOf };
}

/** Turns a resolved set of hits into the final score + detail. Shared by both
 *  the keyword-only and semantic paths so the maths never diverges. */
function scoreFromHits(
  hits: Hit[],
  job: JobCriteria,
  mustKeys: string[],
  niceKeys: string[],
  weightOf: (k: string) => number,
  yearsDetected: number,
): RuleResult {
  const byKey = new Map<string, Hit>(hits.map((h) => [h.key, h]));

  const credit = (key: string): number => {
    const h = byKey.get(key);
    if (!h) return 0;
    // Meaning-matches are capped below exact matches — softer signal, lower credit.
    if (h.semantic) return SEMANTIC_CREDIT;
    return h.evidence === "demonstrated" ? 1 : LISTED_CREDIT;
  };

  // --- Must-haves (60 pts): weight × evidence credit ---
  const mustWeightTotal = mustKeys.reduce((sum, key) => sum + weightOf(key), 0);
  const mustWeightHit = mustKeys.reduce((sum, key) => sum + weightOf(key) * credit(key), 0);
  const mustPoints = mustWeightTotal === 0 ? 60 : (mustWeightHit / mustWeightTotal) * 60;

  // --- Nice-to-haves (20 pts): flat, but still evidence-weighted ---
  const niceCredit = niceKeys.reduce((sum, key) => sum + credit(key), 0);
  const nicePoints = niceKeys.length === 0 ? 20 : (niceCredit / niceKeys.length) * 20;

  // --- Experience (20 pts) ---
  let yearsPoints: number;
  if (job.minYears === 0) yearsPoints = 20;
  else if (yearsDetected >= job.minYears) yearsPoints = 20;
  else yearsPoints = (yearsDetected / job.minYears) * 20;

  return {
    score: Math.round(mustPoints + nicePoints + yearsPoints),
    detail: {
      matched: hits.map((h) => h.key),
      // demonstrated/listed are keyword hits only; semantic hits are their own
      // category so the reviewer can tell an exact match from a meaning-match.
      demonstrated: hits.filter((h) => !h.semantic && h.evidence === "demonstrated").map((h) => h.key),
      listedOnly: hits.filter((h) => !h.semantic && h.evidence === "listed").map((h) => h.key),
      semantic: hits.filter((h) => h.semantic).map((h) => h.key),
      evidence: Object.fromEntries(hits.map((h) => [h.key, h.snippet])),
      missingMustHave: mustKeys.filter((key) => !byKey.has(key)),
      matchedNiceToHave: niceKeys.filter((key) => byKey.has(key)),
      yearsDetected,
      yearsRequired: job.minYears,
    },
  };
}

/**
 * Keyword-only scoring — synchronous, deterministic, no model. Kept for callers
 * that don't want the (async) semantic layer, and as the guaranteed fallback.
 */
export function scoreByRules(resumeText: string, job: JobCriteria): RuleResult {
  const { vocabulary, mustKeys, niceKeys, weightOf } = resolveVocabulary(job);
  const hits: Hit[] = detectTermHits(resumeText, vocabulary).map((h) => ({
    key: h.key,
    evidence: h.evidence,
    snippet: h.snippet,
    semantic: false,
  }));
  return scoreFromHits(hits, job, mustKeys, niceKeys, weightOf, detectYears(resumeText));
}

/**
 * Full scoring: keyword matching, then a semantic pass over the required skills
 * a keyword search missed. A skill counts as present if some CV sentence *means*
 * the same thing, even with no shared words — so "coordinated M&E models and ran
 * clash checks" satisfies a "Revit MEP, clash detection" requirement. The matched
 * sentence is scored for evidence strength the same way keyword hits are.
 *
 * Fail-open: if the embedding model is unavailable, this returns exactly what the
 * keyword scorer would.
 */
export async function scoreCandidate(resumeText: string, job: JobCriteria): Promise<RuleResult> {
  const { vocabulary, mustKeys, niceKeys, custom, weightOf } = resolveVocabulary(job);

  const keywordHits: Hit[] = detectTermHits(resumeText, vocabulary).map((h) => ({
    key: h.key,
    evidence: h.evidence,
    snippet: h.snippet,
    semantic: false,
  }));
  const foundKeys = new Set(keywordHits.map((h) => h.key));

  // Semantic pass only over role-relevant skills the keywords missed — no point
  // embedding skills already found, or skills this role doesn't ask for.
  const relevant = [...new Set([...mustKeys, ...niceKeys])].filter((k) => !foundKeys.has(k));
  const phrases = relevant.map((key) => {
    const s = SKILL_BY_KEY.get(key);
    const c = custom.find((x) => x.key === key);
    const label = labelForKey(key);
    const aliases = s?.aliases ?? c?.aliases ?? [];
    return { key, phrase: semanticPhrase(key, label, aliases) };
  });

  const semantic = await semanticMatch(resumeText, phrases);


  const semanticHits: Hit[] = [...semantic.entries()].map(([key, hit]) => ({
    key,
    evidence: evidenceOf(hit.sentence),
    snippet: hit.sentence,
    semantic: true,
  }));

  return scoreFromHits(
    [...keywordHits, ...semanticHits],
    job,
    mustKeys,
    niceKeys,
    weightOf,
    detectYears(resumeText),
  );
}

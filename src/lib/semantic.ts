import "server-only";

/**
 * Semantic matching by meaning, not words.
 *
 * A local embedding model turns text into vectors where similar *meanings* sit
 * close together — so "coordinated mechanical and electrical models and ran
 * clash checks" lands near "Revit MEP, clash detection" despite sharing no
 * keywords. Runs entirely on this machine (free, offline, no API).
 *
 * This is semantic *similarity*, the right tool for CV↔role matching. It is not
 * RAG (retrieve-then-generate) — that's the paid Claude screening layer, which
 * remains the deepest matcher. This free layer sits between plain keywords and
 * that.
 *
 * Accuracy levers (all in .env): the model (bge-small default, bge-base for
 * more), and the similarity threshold. Everything here is fail-open: if the
 * model can't load, semantic matching is skipped and keyword scoring stands.
 */

type Extractor = (
  texts: string[],
  opts: { pooling: "mean"; normalize: boolean },
) => Promise<{ tolist(): number[][] }>;

let extractorPromise: Promise<Extractor | null> | null = null;

function enabled(): boolean {
  return (process.env.SEMANTIC_MATCHING ?? "on").toLowerCase() !== "off";
}

export function semanticThreshold(): number {
  const t = Number(process.env.SEMANTIC_THRESHOLD);
  return Number.isFinite(t) && t > 0 && t < 1 ? t : 0.62;
}

/** Loads the model once, lazily. Returns null if it can't (then we fall back). */
async function getExtractor(): Promise<Extractor | null> {
  if (!enabled()) return null;
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        const { pipeline } = await import("@huggingface/transformers");
        const model = process.env.SEMANTIC_MODEL || "Xenova/bge-small-en-v1.5";
        const pipe = await pipeline("feature-extraction", model);
        return (async (texts, opts) => pipe(texts, opts)) as Extractor;
      } catch (err) {
        console.error("semantic model failed to load; using keyword matching only", err);
        return null;
      }
    })();
  }
  return extractorPromise;
}

/**
 * BGE models are asymmetric: the short thing you're searching *for* (the skill)
 * should carry a retrieval instruction; the passages (CV sentences) should not.
 * Skipping this measurably hurts accuracy.
 */
const QUERY_PREFIX = "Represent this sentence for searching relevant passages: ";

async function embed(texts: string[], asQuery: boolean): Promise<number[][] | null> {
  const extractor = await getExtractor();
  if (!extractor || texts.length === 0) return null;
  const input = asQuery ? texts.map((t) => QUERY_PREFIX + t) : texts;
  try {
    const out = await extractor(input, { pooling: "mean", normalize: true });
    return out.tolist();
  } catch (err) {
    console.error("embedding failed", err);
    return null;
  }
}

/** Vectors are L2-normalised, so cosine similarity is just the dot product. */
function cosine(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/**
 * Splits a CV into overlapping chunks. Sentences alone lose context ("Ran it in
 * Navisworks" needs the sentence before it), so we also emit sliding windows of
 * two sentences. More chunks = more chances to match a meaning.
 */
function chunk(text: string): string[] {
  const sentences = text
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12 && s.length <= 400);

  const chunks = new Set<string>(sentences);
  for (let i = 0; i < sentences.length - 1; i++) {
    chunks.add(`${sentences[i]} ${sentences[i + 1]}`);
  }
  return [...chunks].slice(0, 400); // cap work on a very long CV
}

export interface SemanticHit {
  score: number;
  /** The CV sentence that best matched — shown to the reviewer as evidence. */
  sentence: string;
}

/** Skill-phrase embeddings are the same for every CV, so cache them in memory. */
const phraseCache = new Map<string, number[]>();

/**
 * For each query phrase, finds the best-matching CV chunk and its similarity.
 * Only returns phrases whose best match clears the threshold. Empty map when
 * semantic matching is off or the model is unavailable — callers then rely on
 * keyword matching alone.
 */
export async function semanticMatch(
  cvText: string,
  phrases: { key: string; phrase: string }[],
): Promise<Map<string, SemanticHit>> {
  const result = new Map<string, SemanticHit>();
  if (!enabled() || phrases.length === 0) return result;

  const chunks = chunk(cvText);
  if (chunks.length === 0) return result;

  const chunkVecs = await embed(chunks, false);
  if (!chunkVecs) return result; // model unavailable — fall back to keywords

  // Embed any phrases we haven't seen before (query side).
  const missing = phrases.filter((p) => !phraseCache.has(p.phrase));
  if (missing.length > 0) {
    const vecs = await embed(
      missing.map((p) => p.phrase),
      true,
    );
    if (vecs) missing.forEach((p, i) => phraseCache.set(p.phrase, vecs[i]));
  }

  const threshold = semanticThreshold();
  for (const p of phrases) {
    const pv = phraseCache.get(p.phrase);
    if (!pv) continue;

    let best = -1;
    let bestChunk = "";
    for (let i = 0; i < chunkVecs.length; i++) {
      const sim = cosine(pv, chunkVecs[i]);
      if (sim > best) {
        best = sim;
        bestChunk = chunks[i];
      }
    }
    if (best >= threshold) {
      result.set(p.key, { score: best, sentence: bestChunk });
    }
  }

  return result;
}

/**
 * Skill taxonomy for BIM software development hiring.
 *
 * Weights reflect how strongly a signal predicts fit for a *developer* role in
 * the BIM space — not general BIM literacy. Someone who models in Revit all day
 * is not the same hire as someone who writes Revit API add-ins, so the API and
 * language categories carry more weight than the authoring tools themselves.
 *
 * `aliases` exist because resumes spell these a dozen ways ("Autodesk Forge"
 * became "APS" in 2023; "IfcOpenShell" shows up as "ifc open shell").
 */

export type SkillCategory =
  | "api"
  | "language"
  | "authoring"
  | "standards"
  | "coordination"
  | "visualization"
  | "data"
  | "practice";

export interface Skill {
  key: string;
  label: string;
  category: SkillCategory;
  weight: number; // 1-5, higher = stronger signal for a BIM dev role
  aliases: string[];
}

export const CATEGORY_LABELS: Record<SkillCategory, string> = {
  api: "BIM APIs & SDKs",
  language: "Languages & Runtimes",
  authoring: "Authoring Platforms",
  standards: "Standards & Interop",
  coordination: "Coordination & CDE",
  visualization: "3D / Web Visualization",
  data: "Data & Infrastructure",
  practice: "Engineering Practice",
};

export const SKILLS: Skill[] = [
  // --- BIM APIs & SDKs: the strongest single predictor for these roles ---
  { key: "revit-api", label: "Revit API", category: "api", weight: 5, aliases: ["revit api", "revitapi", "revit add-in", "revit addin", "revit plugin", "revit plug-in", "autodesk.revit.db"] },
  { key: "aps-forge", label: "Autodesk Platform Services (Forge)", category: "api", weight: 5, aliases: ["autodesk platform services", "forge api", "autodesk forge", "aps api", "design automation api", "model derivative"] },
  { key: "navisworks-api", label: "Navisworks API", category: "api", weight: 4, aliases: ["navisworks api", "navisworks .net", "clash detection api"] },
  { key: "ifc-sdk", label: "IFC SDKs (IfcOpenShell / xBIM)", category: "api", weight: 5, aliases: ["ifcopenshell", "ifc open shell", "xbim", "ifc sdk", "ifc toolkit", "ifc parser"] },
  { key: "tekla-api", label: "Tekla Open API", category: "api", weight: 4, aliases: ["tekla open api", "tekla api", "tekla structures api"] },
  { key: "archicad-api", label: "Archicad API", category: "api", weight: 3, aliases: ["archicad api", "graphisoft api", "gdl scripting", "archicad add-on"] },
  { key: "bentley-api", label: "Bentley / MicroStation SDK", category: "api", weight: 3, aliases: ["microstation sdk", "bentley sdk", "openbuildings", "itwin", "itwin.js", "mdl"] },
  { key: "speckle", label: "Speckle", category: "api", weight: 4, aliases: ["speckle", "speckle connector", "specklepy"] },

  // --- Languages & runtimes ---
  { key: "csharp", label: "C# / .NET", category: "language", weight: 5, aliases: ["c#", "csharp", ".net", "dotnet", "asp.net", "wpf", "winforms"] },
  { key: "python", label: "Python", category: "language", weight: 4, aliases: ["python", "python3", "pythonnet", "pyrevit"] },
  { key: "cpp", label: "C++", category: "language", weight: 3, aliases: ["c++", "cpp"] },
  { key: "typescript", label: "TypeScript / JavaScript", category: "language", weight: 3, aliases: ["typescript", "javascript", "node.js", "nodejs", "react"] },
  { key: "dynamo", label: "Dynamo", category: "language", weight: 4, aliases: ["dynamo", "dynamo bim", "dynamobim", "zero touch node"] },
  { key: "grasshopper", label: "Grasshopper / Rhino.Inside", category: "language", weight: 4, aliases: ["grasshopper", "rhino.inside", "rhinocommon", "rhinoscript", "ghpython"] },

  // --- Authoring platforms (context, not the differentiator) ---
  { key: "revit", label: "Autodesk Revit", category: "authoring", weight: 3, aliases: ["revit"] },
  { key: "archicad", label: "Archicad", category: "authoring", weight: 2, aliases: ["archicad", "graphisoft"] },
  { key: "tekla", label: "Tekla Structures", category: "authoring", weight: 2, aliases: ["tekla"] },
  { key: "civil3d", label: "Civil 3D / Infraworks", category: "authoring", weight: 2, aliases: ["civil 3d", "civil3d", "infraworks"] },
  { key: "rhino", label: "Rhino 3D", category: "authoring", weight: 2, aliases: ["rhino 3d", "rhino3d", "rhinoceros"] },

  // --- Standards & interoperability ---
  { key: "ifc", label: "IFC / openBIM", category: "standards", weight: 5, aliases: ["ifc", "ifc4", "ifc2x3", "openbim", "buildingsmart", "industry foundation classes"] },
  { key: "cobie", label: "COBie", category: "standards", weight: 3, aliases: ["cobie"] },
  { key: "bcf", label: "BCF (BIM Collaboration Format)", category: "standards", weight: 3, aliases: ["bcf", "bim collaboration format"] },
  { key: "iso19650", label: "ISO 19650", category: "standards", weight: 3, aliases: ["iso 19650", "iso19650", "bs 1192", "information management"] },
  { key: "lod", label: "LOD / LOIN", category: "standards", weight: 2, aliases: ["level of development", "lod 300", "lod 400", "loin", "level of information need"] },

  // --- Coordination & common data environments ---
  { key: "navisworks", label: "Navisworks", category: "coordination", weight: 3, aliases: ["navisworks", "navis works"] },
  { key: "solibri", label: "Solibri", category: "coordination", weight: 3, aliases: ["solibri", "model checker"] },
  { key: "acc", label: "BIM 360 / Autodesk Construction Cloud", category: "coordination", weight: 3, aliases: ["bim 360", "bim360", "autodesk construction cloud", "acc docs"] },
  { key: "revizto", label: "Revizto", category: "coordination", weight: 2, aliases: ["revizto"] },

  // --- 3D / web visualization ---
  { key: "threejs", label: "Three.js / WebGL", category: "visualization", weight: 3, aliases: ["three.js", "threejs", "webgl", "webgpu", "babylon.js"] },
  { key: "forge-viewer", label: "APS Viewer", category: "visualization", weight: 3, aliases: ["forge viewer", "aps viewer", "autodesk viewer"] },
  { key: "gamengine", label: "Unity / Unreal", category: "visualization", weight: 2, aliases: ["unity3d", "unity", "unreal engine", "twinmotion"] },
  { key: "geometry", label: "Computational Geometry", category: "visualization", weight: 4, aliases: ["computational geometry", "mesh processing", "brep", "b-rep", "tessellation", "opencascade", "nurbs"] },

  // --- Data & infrastructure ---
  { key: "sql", label: "SQL / Relational Databases", category: "data", weight: 2, aliases: ["sql", "postgresql", "postgres", "sql server", "mysql"] },
  { key: "graphdb", label: "Graph Databases / RDF", category: "data", weight: 3, aliases: ["neo4j", "graph database", "rdf", "sparql", "knowledge graph", "linked data"] },
  { key: "cloud", label: "Cloud (Azure / AWS)", category: "data", weight: 2, aliases: ["azure", "aws", "amazon web services", "gcp", "kubernetes", "docker"] },

  // --- Engineering practice ---
  { key: "testing", label: "Automated Testing", category: "practice", weight: 2, aliases: ["unit test", "unit testing", "nunit", "xunit", "pytest", "test-driven"] },
  { key: "cicd", label: "CI/CD", category: "practice", weight: 2, aliases: ["ci/cd", "continuous integration", "github actions", "azure devops", "jenkins"] },
  { key: "aec-domain", label: "AEC Domain Experience", category: "practice", weight: 4, aliases: ["aec", "architecture engineering construction", "structural engineering", "mep", "quantity takeoff", "construction technology", "conteh"] },
];

export const SKILL_BY_KEY = new Map(SKILLS.map((s) => [s.key, s]));

/** Every searchable term for a skill, longest-first so "revit api" wins over "revit". */
function terms(skill: { label: string; aliases: string[] }): string[] {
  return [skill.label.toLowerCase(), ...skill.aliases].sort((a, b) => b.length - a.length);
}

/**
 * A keyword a recruiter typed for a role, turned into something the engine can
 * score. Written as "Primavera P6" or "Primavera P6 | P6 | Oracle Primavera" —
 * pipes declare alternative spellings, exactly like the built-in aliases.
 */
export interface CustomKeyword {
  key: string;
  label: string;
  aliases: string[];
  weight: number;
  tier: "must" | "nice";
}

/** Prefix marks a key as recruiter-defined rather than from the built-in library. */
export const CUSTOM_PREFIX = "custom:";

export function parseKeyword(raw: string, tier: "must" | "nice", weight = 3): CustomKeyword | null {
  const parts = raw
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const [label, ...aliases] = parts;
  return {
    key: CUSTOM_PREFIX + label.toLowerCase(),
    label,
    aliases: aliases.map((a) => a.toLowerCase()),
    weight,
    tier,
  };
}

/** Display label for any key, built-in or custom. */
export function labelForKey(key: string): string {
  if (key.startsWith(CUSTOM_PREFIX)) return key.slice(CUSTOM_PREFIX.length);
  return SKILL_BY_KEY.get(key)?.label ?? key;
}

/**
 * A short natural-language phrase describing a skill, for the semantic matcher
 * to embed. Richer than the bare label — the aliases add the vocabulary a CV
 * might actually use — so the meaning is well anchored in vector space.
 */
export function semanticPhrase(key: string, label: string, aliases: string[]): string {
  const extra = aliases.slice(0, 3).join(", ");
  return extra ? `${label} (${extra})` : label;
}

/**
 * Verbs that indicate the candidate personally did the work, rather than
 * listing a tool they have been near. This is the core of the "modeller vs
 * developer" distinction the whole product exists to make.
 */
const ACTION_VERBS = new RegExp(
  "\\b(" +
    [
      // Software / design
      "built", "build", "building", "developed", "develop", "developing",
      "architected", "designed", "implemented", "implement", "shipped",
      "created", "wrote", "writing", "written", "authored", "automated",
      "automating", "engineered", "programmed", "coded", "scripted",
      "integrated", "integrating", "migrated", "refactored", "optimised",
      "optimized", "deployed", "rewrote", "extended", "published", "contributed",
      // Construction, planning and commercial — a Planning Engineer writes
      // "prepared the EOT claim", never "shipped" it. Omitting these verbs
      // silently marked genuine site experience as unproven.
      "prepared", "produced", "supervised", "managed", "executed", "coordinated",
      "planned", "scheduled", "estimated", "surveyed", "inspected",
      "commissioned", "installed", "constructed", "erected", "drafted",
      "detailed", "modelled", "modeled", "analysed", "analyzed", "calculated",
      "certified", "negotiated", "procured", "tendered", "audited", "resolved",
      "achieved", "completed", "oversaw", "overseen", "directed", "headed",
      "administered", "monitored", "controlled", "reviewed", "approved",
      // Generic leadership / delivery
      "led", "delivered", "introduced", "maintained", "reduced", "improved",
    ].join("|") +
    ")\\b",
  "i",
);

/**
 * Genuine hedges — phrases where the candidate is distancing themselves from
 * ownership of the work. Deliberately narrow: "used" and "worked with" are NOT
 * here, because "an add-in used by 400 modellers" is a claim of impact, not a
 * hedge. Over-broad matching here silently demotes real builders.
 */
const PASSIVE_CONTEXT =
  /\b(familiar with|exposure to|assisted|assisting|supported the|knowledge of|awareness of|basic (?:knowledge|understanding)|trained in|learning|coursework|academic exposure)\b/i;

export type Evidence = "demonstrated" | "listed";

/**
 * Judges whether a line of text demonstrates ownership of work or merely
 * mentions it — the same test the keyword detector applies, exposed so a
 * semantically-matched sentence gets scored on the same basis.
 */
export function evidenceOf(sentence: string): Evidence {
  return ACTION_VERBS.test(sentence) && !PASSIVE_CONTEXT.test(sentence)
    ? "demonstrated"
    : "listed";
}

export interface SkillHit {
  key: string;
  /** "demonstrated" = appears in an accomplishment; "listed" = a bare keyword. */
  evidence: Evidence;
  /** The resume line the decision came from, for display to the reviewer. */
  snippet: string;
}

/**
 * Finds which taxonomy skills appear in a resume, and — critically — whether
 * each one is *demonstrated* or merely *listed*.
 *
 * A skills-section keyword dump earns partial credit. A line like "built a
 * Revit API add-in used by 400 modellers" earns full credit. This is what stops
 * a candidate from out-ranking a real developer by keyword-stuffing.
 *
 * Matching is boundary-aware so "aps" doesn't fire inside "maps"; terms with
 * regex-special characters (C++, C#, three.js) are escaped rather than
 * special-cased.
 */
export function detectSkillHits(text: string): SkillHit[] {
  return detectTermHits(text, SKILLS);
}

/**
 * The generic engine. Works on any term list, so a role can be scored against
 * the built-in library, against keywords a recruiter typed for a Site Engineer
 * or Quantity Surveyor role, or both at once. Nothing here is BIM-specific.
 */
export function detectTermHits(
  text: string,
  vocabulary: { key: string; label: string; aliases: string[] }[],
): SkillHit[] {
  const lines = text.split(/\r?\n|(?<=\.)\s+/);
  const hits: SkillHit[] = [];

  for (const skill of vocabulary) {
    let best: SkillHit | null = null;

    for (const term of terms(skill)) {
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // \b fails on trailing symbols like "c#" and "c++", so anchor on a
      // non-word-continuation lookaround instead.
      const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");

      for (const line of lines) {
        if (!pattern.test(line)) continue;

        // A line that both claims action and hedges ("assisted the team that
        // built X") is treated as listed — the hedge is the honest signal.
        const demonstrated = ACTION_VERBS.test(line) && !PASSIVE_CONTEXT.test(line);
        const hit: SkillHit = {
          key: skill.key,
          evidence: demonstrated ? "demonstrated" : "listed",
          snippet: line.trim().slice(0, 200),
        };

        // Keep the strongest evidence found anywhere in the resume.
        if (!best || (best.evidence === "listed" && demonstrated)) best = hit;
        if (demonstrated) break;
      }

      if (best?.evidence === "demonstrated") break;
    }

    if (best) hits.push(best);
  }

  return hits;
}

/** Back-compatible key-only view, for callers that don't need evidence. */
export function detectSkills(text: string): string[] {
  return detectSkillHits(text).map((h) => h.key);
}

/** Pulls the largest plausible "N years" claim out of a resume. */
export function detectYears(text: string): number {
  const matches = text.matchAll(/(\d{1,2})\+?\s*(?:\+)?\s*years?/gi);
  let max = 0;
  for (const m of matches) {
    const n = parseInt(m[1], 10);
    // Anything above 45 is almost certainly a date fragment, not a tenure claim.
    if (n <= 45 && n > max) max = n;
  }
  return max;
}

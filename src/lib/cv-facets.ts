/**
 * Lightweight, offline extraction of three recruiter-facing facets from a CV:
 * work authorisation, highest degree, and a location hint. Pure regex/keyword
 * work — no model, no cost — so it runs on every row without slowing the list.
 *
 * IMPORTANT: these are *hints read off the CV text*, not verified facts. Work
 * authorisation especially MUST be confirmed with a proper right-to-work check;
 * a keyword is not a legal status. Treat every facet as "worth a look", never as
 * an automated gate — same rule the rest of the tool follows.
 */

export type WorkAuth = "right" | "sponsor" | "unknown";
export type DegreeLevel = "phd" | "master" | "bachelor" | "diploma" | "none";
export type LodLevel = 100 | 200 | 300 | 350 | 400 | 500;
export type BimRole = "manager" | "lead" | "coordinator" | "none";
export type Region = "uk" | "ireland" | "germany" | "europe";

export const DEGREE_RANK: Record<DegreeLevel, number> = {
  none: 0,
  diploma: 1,
  bachelor: 2,
  master: 3,
  phd: 4,
};

export const DEGREE_LABEL: Record<DegreeLevel, string> = {
  phd: "PhD",
  master: "Master’s",
  bachelor: "Bachelor’s",
  diploma: "Diploma",
  none: "No degree found",
};

export const WORK_AUTH_LABEL: Record<WorkAuth, string> = {
  right: "Right to work",
  sponsor: "Needs sponsorship",
  unknown: "Not stated",
};

export const LOD_LEVELS: LodLevel[] = [100, 200, 300, 350, 400, 500];

export const BIM_ROLE_RANK: Record<BimRole, number> = {
  none: 0,
  coordinator: 1,
  lead: 2,
  manager: 3,
};

export const BIM_ROLE_LABEL: Record<BimRole, string> = {
  manager: "BIM Manager",
  lead: "BIM Lead",
  coordinator: "BIM Coordinator",
  none: "No BIM role found",
};

export const REGION_LABEL: Record<Region, string> = {
  uk: "UK",
  ireland: "Ireland",
  germany: "Germany",
  europe: "Europe",
};

export const TENURE_THRESHOLDS = [1, 2, 3, 5, 7, 10];

/**
 * Expands a rank-based "X or higher" filter into the concrete set of stored
 * string values at or above that rank — for building a SQL `IN (...)` filter
 * against the persisted (string) column, since the rank itself isn't stored.
 */
export function degreesAtOrAbove(min: DegreeLevel): DegreeLevel[] {
  const threshold = DEGREE_RANK[min];
  return (Object.keys(DEGREE_RANK) as DegreeLevel[]).filter((d) => DEGREE_RANK[d] >= threshold);
}

export function bimRolesAtOrAbove(min: BimRole): BimRole[] {
  const threshold = BIM_ROLE_RANK[min];
  return (Object.keys(BIM_ROLE_RANK) as BimRole[]).filter((r) => BIM_ROLE_RANK[r] >= threshold);
}

export interface CvFacets {
  workAuth: WorkAuth;
  degree: DegreeLevel;
  /** Highest LOD (Level of Development) figure mentioned, e.g. 500 for "LOD 500". */
  lodMax: LodLevel | null;
  /** Most senior BIM job title mentioned (Manager > Lead > Coordinator). */
  bimRole: BimRole;
  /** Digital engineering / digital delivery / BIM management practice mentioned. */
  digitalEngineering: boolean;
  /** Project regions mentioned — UK/Ireland/Germany also imply "europe". */
  regions: Region[];
  /** Longest single stint at one employer, in years — a loyalty/stability hint. */
  longestTenureYears: number | null;
}

// Phrases that indicate the candidate needs visa sponsorship (checked first, as
// it's the more consequential and usually explicit signal).
const NEEDS_SPONSOR =
  /\b(require|requires|requiring|need|needs|needing|seeking|would need)\s+(?:a\s+)?(?:visa\s+)?sponsorship\b|\bsponsorship\s+(?:is\s+)?(?:required|needed)\b|\bvisa\s+sponsorship\s+(?:required|needed)\b/i;

// Phrases that indicate an existing right to work / no sponsorship needed.
const HAS_RIGHT =
  /\b(right to work|authori[sz]ed to work|eligible to work|permitted to work|legally able to work|no sponsorship (?:required|needed)|do not require sponsorship|don't require sponsorship|settled status|pre-settled status|indefinite leave to remain|\bilr\b|permanent resident|permanent residency|stamp\s?4|work permit|green card|citizen(?:ship)?)\b/i;

export function detectWorkAuth(text: string): WorkAuth {
  if (NEEDS_SPONSOR.test(text)) return "sponsor";
  if (HAS_RIGHT.test(text)) return "right";
  return "unknown";
}

const DEGREE_PATTERNS: [DegreeLevel, RegExp][] = [
  ["phd", /\b(ph\.?\s?d\.?|doctorate|doctoral|dphil)\b/i],
  [
    "master",
    /\b(m\.?\s?sc|m\.?\s?eng|m\.?\s?tech|m\.?\s?b\.?\s?a|m\.?\s?phil|master['’]?s?|postgraduate|pg\s?dip(?:loma)?)\b/i,
  ],
  [
    "bachelor",
    /\b(b\.?\s?sc|b\.?\s?eng|b\.?\s?tech|b\.?\s?e\.?\b|b\.?\s?a\.?\b|b\.?\s?arch|bachelor['’]?s?|(?:hons|honours)\s+degree|degree\s+in)\b/i,
  ],
  ["diploma", /\b(diploma|hnd|higher national|foundation degree)\b/i],
];

/** Highest degree level mentioned anywhere in the CV. */
export function detectDegree(text: string): DegreeLevel {
  for (const [level, re] of DEGREE_PATTERNS) {
    if (re.test(text)) return level; // patterns are ordered highest → lowest
  }
  return "none";
}

// Matches "LOD 500", "LOD500", "Level of Development 350", "LOIN 300" etc. —
// the number can sit a few words after the LOD/LOIN term itself.
const LOD_MENTION = /\b(?:lod|level of development|loin|level of information need)\D{0,20}?(100|200|300|350|400|500)\b/gi;

/** Highest LOD figure mentioned anywhere in the CV, or null if none found. */
export function detectMaxLod(text: string): LodLevel | null {
  let max: LodLevel | null = null;
  for (const m of text.matchAll(LOD_MENTION)) {
    const level = Number(m[1]) as LodLevel;
    if (max === null || level > max) max = level;
  }
  return max;
}

// Ordered highest → lowest, same convention as DEGREE_PATTERNS. Covers common
// real-world title phrasing, not just the literal words "BIM Lead"/"BIM
// Manager" — "Head of BIM", "Lead BIM Coordinator", "BIM Delivery Manager"
// etc. all show up in practice.
const BIM_ROLE_PATTERNS: [BimRole, RegExp][] = [
  [
    "manager",
    /\b(?:bim|digital engineering)\s+(?:delivery\s+)?manager\b|\bhead\s+of\s+bim\b|\bmanager[\s,/-]+bim\b/i,
  ],
  [
    "lead",
    /\b(?:bim|digital engineering)\s+(?:team\s+)?lead(?:er)?\b|\blead\s+bim\s+(?:engineer|coordinator|modell?er)\b|\blead[\s,/-]+bim\b|\bsenior\s+bim\s+lead\b/i,
  ],
  ["coordinator", /\bbim\s+coordinat(?:or|ion)\b/i],
];

/** Most senior BIM job title mentioned in the CV — a title hint, not a verified role. */
export function detectBimRole(text: string): BimRole {
  for (const [role, re] of BIM_ROLE_PATTERNS) {
    if (re.test(text)) return role;
  }
  return "none";
}

// "Digital engineering" as a practice/methodology mention (BEP ownership,
// CDE/ISO 19650 management, digital delivery, digital twin work) — distinct
// from the BIM_ROLE title check above, since a candidate can demonstrate the
// practice without ever holding a title that says so.
const DIGITAL_ENGINEERING =
  /\b(digital engineering|digital delivery|digital construction|digital twin|bim management|bim execution plan|\bbep\b|common data environment|\bcde\b|iso\s?19650)\b/i;

/** Whether the CV shows digital engineering / BIM management practice. */
export function detectDigitalEngineering(text: string): boolean {
  return DIGITAL_ENGINEERING.test(text);
}

// UK/Ireland/Germany are matched individually AND folded into "europe" so a
// single "Europe" filter catches all continental experience at once; "europe"
// also has its own pattern for CVs that only say "Europe"/"EU" or name other
// European countries without matching the three named ones.
const REGION_PATTERNS: [Region, RegExp][] = [
  [
    "uk",
    /\b(united kingdom|u\.?k\.?|england|scotland|wales|northern ireland|london|manchester|birmingham|glasgow|edinburgh|leeds|bristol)\b/i,
  ],
  ["ireland", /\b(ireland|irish|dublin|cork|galway|limerick)\b/i],
  [
    "germany",
    /\b(germany|german|berlin|munich|münchen|frankfurt|hamburg|stuttgart|cologne|köln|düsseldorf)\b/i,
  ],
  [
    "europe",
    /\b(europe(?:an)?|\beu\b|france|french|paris|netherlands|dutch|amsterdam|belgium|belgian|brussels|spain|spanish|madrid|barcelona|italy|italian|milan|rome|poland|polish|warsaw|portugal|portuguese|lisbon|austria|austrian|vienna|switzerland|swiss|zurich|denmark|danish|copenhagen|sweden|swedish|stockholm|norway|norwegian|oslo|finland|finnish|helsinki)\b/i,
  ],
];

/** Project regions mentioned in the CV. UK/Ireland/Germany also add "europe". */
export function detectRegions(text: string): Region[] {
  const found = new Set<Region>();
  for (const [region, re] of REGION_PATTERNS) {
    if (re.test(text)) {
      found.add(region);
      if (region !== "europe") found.add("europe");
    }
  }
  return [...found];
}

// Matches employment-style date ranges: "2018 - 2026", "2015–2019", "2019 to
// Present", "2020 - current" etc. Deliberately loose about the separator and
// the "still there" wording since CVs are inconsistent about both.
const TENURE_RANGE =
  /\b((?:19|20)\d{2})\s*(?:-|–|—|to)\s*((?:19|20)\d{2}|present|current|now|ongoing|(?:to|till)\s+date)\b/gi;

/**
 * Longest single stint at one employer, in years — a loyalty/stability hint,
 * not a verified employment history. Can't reliably tell an employment date
 * range apart from an education one, so this is a "worth a look" signal like
 * every other facet here, most useful alongside the CV itself.
 */
export function detectLongestTenureYears(text: string): number | null {
  const currentYear = new Date().getFullYear();
  let max = 0;
  for (const m of text.matchAll(TENURE_RANGE)) {
    const start = Number(m[1]);
    const endRaw = m[2].toLowerCase();
    const end = /present|current|now|ongoing|date/.test(endRaw) ? currentYear : Number(endRaw);
    const span = end - start;
    if (span > 0 && span <= 50 && span > max) max = span;
  }
  return max > 0 ? max : null;
}

export function extractFacets(resumeText: string): CvFacets {
  return {
    workAuth: detectWorkAuth(resumeText),
    degree: detectDegree(resumeText),
    lodMax: detectMaxLod(resumeText),
    bimRole: detectBimRole(resumeText),
    digitalEngineering: detectDigitalEngineering(resumeText),
    regions: detectRegions(resumeText),
    longestTenureYears: detectLongestTenureYears(resumeText),
  };
}

/** Shape of the Candidate columns these facets are persisted into. */
export interface CandidateFacetColumns {
  workAuth: WorkAuth;
  degree: DegreeLevel;
  lodMax: LodLevel | null;
  bimRole: BimRole;
  digitalEngineering: boolean;
  regions: string;
  longestTenureYears: number | null;
}

/**
 * Computes facets and shapes them for a Prisma `create`/`update` on Candidate
 * in one call — every upload path needs exactly this, so the JSON-stringify
 * of `regions` lives in one place rather than three.
 */
export function facetsForCandidate(resumeText: string): CandidateFacetColumns {
  const facets = extractFacets(resumeText);
  return { ...facets, regions: JSON.stringify(facets.regions) };
}

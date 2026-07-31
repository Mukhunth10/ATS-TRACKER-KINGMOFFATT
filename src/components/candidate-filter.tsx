"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ScoreRing, SkillChip, STAGES, inputBase } from "./ui";
import { StageSelect } from "./stage-select";
import {
  DEGREE_RANK,
  DEGREE_LABEL,
  WORK_AUTH_LABEL,
  LOD_LEVELS,
  BIM_ROLE_RANK,
  BIM_ROLE_LABEL,
  REGION_LABEL,
  TENURE_THRESHOLDS,
  type WorkAuth,
  type DegreeLevel,
  type LodLevel,
  type BimRole,
  type Region,
} from "@/lib/cv-facets";

export interface FilterRow {
  id: string;
  name: string;
  email: string;
  stage: string;
  ruleScore: number;
  aiScore: number | null;
  years: number;
  proven: number;
  missing: string[];
  /** Portal the application arrived through. Optional so a row written before
   *  source tracking existed renders instead of crashing the list. */
  source?: string | null;
  /** Assessment result, when one has been reviewed. */
  assessScore?: number | null;
  assessMin?: number | null;
  /** Work authorisation + degree, detected from the CV (hints, not verified). */
  workAuth?: WorkAuth;
  degree?: DegreeLevel;
  /** Highest LOD figure mentioned, most senior BIM title, digital engineering
   *  practice mention, and project regions — all detected from the CV text. */
  lodMax?: LodLevel | null;
  bimRole?: BimRole;
  digitalEngineering?: boolean;
  regions?: Region[];
  /** Longest single stint at one employer, in years — a loyalty/stability hint. */
  longestTenureYears?: number | null;
  /** Candidate location, when known — used by the location filter. */
  location?: string | null;
  /** Lowercased resume text, for keyword search. */
  haystack: string;
}

type SortKey = "score" | "name" | "proven" | "assessment";

/**
 * The screen recruiters spend their day in.
 *
 * Filtering happens in the browser because the whole list for one role is
 * already on the page — a round trip per keystroke would feel sluggish for no
 * benefit. Past a few thousand applicants on a single role this should move to
 * a server query.
 */
export function CandidateFilter({
  rows,
  aiEnabled,
}: {
  rows: FilterRow[];
  aiEnabled: boolean;
}) {
  const [minScore, setMinScore] = useState(0);
  const [stage, setStage] = useState("all");
  const [source, setSource] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("score");
  const [workAuth, setWorkAuth] = useState("all"); // all | right | sponsor | unknown
  const [minDegree, setMinDegree] = useState("all"); // all | bachelor | master | phd
  const [location, setLocation] = useState("");
  const [minLod, setMinLod] = useState("all"); // all | 100 | 200 | 300 | 350 | 400 | 500
  const [minBimRole, setMinBimRole] = useState("all"); // all | coordinator | lead | manager
  const [digitalOnly, setDigitalOnly] = useState(false);
  const [region, setRegion] = useState("all"); // all | uk | ireland | germany | europe
  const [minTenure, setMinTenure] = useState("all"); // all | 1 | 2 | 3 | 5 | 7 | 10

  const sources = useMemo(
    () =>
      [
        ...new Set(
          rows.flatMap((r) => (r.source ?? "direct").split(",").map((s) => s.trim())),
        ),
      ].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    // Space-separated terms are ANDed, so "revit primavera" finds CVs with both.
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

    const loc = location.trim().toLowerCase();

    const result = rows.filter((r) => {
      if ((r.aiScore ?? r.ruleScore) < minScore) return false;
      if (stage !== "all" && r.stage !== stage) return false;
      if (source !== "all" && !(r.source ?? "direct").includes(source)) return false;
      if (workAuth !== "all" && (r.workAuth ?? "unknown") !== workAuth) return false;
      if (minDegree !== "all") {
        const rank = DEGREE_RANK[r.degree ?? "none"];
        if (rank < DEGREE_RANK[minDegree as DegreeLevel]) return false;
      }
      if (minLod !== "all" && (r.lodMax ?? 0) < Number(minLod)) return false;
      if (minBimRole !== "all") {
        const rank = BIM_ROLE_RANK[r.bimRole ?? "none"];
        if (rank < BIM_ROLE_RANK[minBimRole as BimRole]) return false;
      }
      if (digitalOnly && !r.digitalEngineering) return false;
      if (region !== "all" && !(r.regions ?? []).includes(region as Region)) return false;
      if (minTenure !== "all" && (r.longestTenureYears ?? 0) < Number(minTenure)) return false;
      if (loc) {
        // Match the candidate's location field first, then fall back to any
        // mention of the place in the CV body.
        const where = `${r.location ?? ""} ${r.haystack}`.toLowerCase();
        if (!where.includes(loc)) return false;
      }
      if (terms.length > 0) {
        const hay = `${r.name} ${r.email} ${r.haystack}`.toLowerCase();
        if (!terms.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    return result.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "proven") return b.proven - a.proven;
      if (sort === "assessment") {
        // Quality first; a candidate with no assessment sinks below any who has
        // one. Working time (fewer minutes = faster) breaks ties on quality —
        // exactly "who did it well in the least time".
        const qa = a.assessScore ?? -1;
        const qb = b.assessScore ?? -1;
        if (qb !== qa) return qb - qa;
        return (a.assessMin ?? Infinity) - (b.assessMin ?? Infinity);
      }
      return (b.aiScore ?? b.ruleScore) - (a.aiScore ?? a.ruleScore);
    });
  }, [
    rows,
    minScore,
    stage,
    source,
    query,
    sort,
    workAuth,
    minDegree,
    location,
    minLod,
    minBimRole,
    digitalOnly,
    region,
    minTenure,
  ]);

  const control =
    "rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink transition-colors duration-150 focus:border-primary focus:outline-none";

  const hasFilters =
    minScore > 0 ||
    stage !== "all" ||
    source !== "all" ||
    query !== "" ||
    workAuth !== "all" ||
    minDegree !== "all" ||
    location !== "" ||
    minLod !== "all" ||
    minBimRole !== "all" ||
    digitalOnly ||
    region !== "all" ||
    minTenure !== "all";

  const clearAll = () => {
    setMinScore(0);
    setStage("all");
    setSource("all");
    setQuery("");
    setWorkAuth("all");
    setMinDegree("all");
    setLocation("");
    setMinLod("all");
    setMinBimRole("all");
    setDigitalOnly(false);
    setRegion("all");
    setMinTenure("all");
  };

  return (
    <div className="space-y-3">
      {/* --- Filter bar --- */}
      <div className="rounded-xl border border-line bg-surface p-3 shadow-card">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Full width on phones so the search box is never squeezed into a
              stub next to the dropdowns; shares the row from tablet up. */}
          <div className="relative w-full sm:w-auto sm:min-w-56 sm:flex-1">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="none"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle"
            >
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="m14 14 3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email, or any word in the CV…"
              aria-label="Search candidates"
              className={`${inputBase} py-1.5 pl-9`}
            />
          </div>

          <label className="flex min-h-11 items-center gap-2 text-sm">
            <span className="text-ink-muted">Min score</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-24 accent-[var(--primary)]"
              aria-label="Minimum score"
            />
            <span className="tabular w-7 text-right font-medium">{minScore}</span>
          </label>

          <select
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            aria-label="Filter by stage"
            className={`${control} capitalize`}
          >
            <option value="all">All stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>

          {sources.length > 1 && (
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              aria-label="Filter by source"
              className={control}
            >
              <option value="all">All sources</option>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort by"
            className={control}
          >
            <option value="score">Sort: CV score</option>
            <option value="assessment">Sort: test result</option>
            <option value="proven">Sort: proven skills</option>
            <option value="name">Sort: name</option>
          </select>

          {hasFilters && (
            <button
              onClick={clearAll}
              className="rounded-lg px-2.5 py-1.5 text-sm text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
            >
              Clear
            </button>
          )}

          <span className="tabular ml-auto text-sm text-ink-muted">
            {filtered.length} of {rows.length}
          </span>
        </div>

        {/* Second row: recruiter facets — work authorisation, degree, location.
            Read from the CV text as hints; verify before acting on them. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 border-t border-line pt-2.5">
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Work auth</span>
            <select
              value={workAuth}
              onChange={(e) => setWorkAuth(e.target.value)}
              aria-label="Filter by work authorisation"
              className={control}
            >
              <option value="all">Any</option>
              <option value="right">Right to work</option>
              <option value="sponsor">Needs sponsorship</option>
              <option value="unknown">Not stated</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Degree</span>
            <select
              value={minDegree}
              onChange={(e) => setMinDegree(e.target.value)}
              aria-label="Filter by minimum degree"
              className={control}
            >
              <option value="all">Any</option>
              <option value="bachelor">Bachelor’s or higher</option>
              <option value="master">Master’s or higher</option>
              <option value="phd">PhD</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Location</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Dublin"
              aria-label="Filter by location"
              className={`${control} w-32`}
            />
          </label>

          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">LOD</span>
            <select
              value={minLod}
              onChange={(e) => setMinLod(e.target.value)}
              aria-label="Filter by minimum LOD level"
              className={control}
            >
              <option value="all">Any</option>
              {LOD_LEVELS.map((l) => (
                <option key={l} value={l}>
                  LOD {l}+
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">BIM role</span>
            <select
              value={minBimRole}
              onChange={(e) => setMinBimRole(e.target.value)}
              aria-label="Filter by minimum BIM role"
              className={control}
            >
              <option value="all">Any</option>
              <option value="coordinator">Coordinator or higher</option>
              <option value="lead">Lead or higher</option>
              <option value="manager">Manager</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Region</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              aria-label="Filter by project region"
              className={control}
            >
              <option value="all">Any</option>
              <option value="uk">UK</option>
              <option value="ireland">Ireland</option>
              <option value="germany">Germany</option>
              <option value="europe">Europe (any)</option>
            </select>
          </label>

          <label className="flex min-h-11 items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={digitalOnly}
              onChange={(e) => setDigitalOnly(e.target.checked)}
              className="accent-[var(--primary)]"
            />
            <span className="text-ink-muted">Digital engineering</span>
          </label>

          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Tenure</span>
            <select
              value={minTenure}
              onChange={(e) => setMinTenure(e.target.value)}
              aria-label="Filter by minimum tenure at one employer"
              className={control}
            >
              <option value="all">Any</option>
              {TENURE_THRESHOLDS.map((t) => (
                <option key={t} value={t}>
                  {t}+ yrs at one employer
                </option>
              ))}
            </select>
          </label>

          <span className="text-xs text-ink-subtle">
            Detected from the CV — verify before relying on it.
          </span>
        </div>
      </div>

      {/* --- Results --- */}
      <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {filtered.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-ink-muted">
            No candidates match these filters.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((r, i) => (
              <li
                key={r.id}
                className="rise"
                style={{ animationDelay: `${Math.min(i * 25, 200)}ms` }}
              >
                <div className="group flex items-center gap-3 px-3 py-3 transition-colors duration-150 hover:bg-surface-hover sm:gap-4 sm:px-4">
                  <ScoreRing
                    score={r.aiScore ?? r.ruleScore}
                    label={r.aiScore !== null ? "AI score" : "Score"}
                    size={40}
                  />

                  <Link href={`/applications/${r.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium transition-colors group-hover:text-primary">
                      {r.name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-muted">
                      <span className="truncate">{r.email}</span>
                      {r.years > 0 && (
                        <>
                          <span aria-hidden className="text-ink-subtle">
                            ·
                          </span>
                          <span className="tabular">{r.years} yrs</span>
                        </>
                      )}
                      <span aria-hidden className="text-ink-subtle">
                        ·
                      </span>
                      <span className="tabular text-success">
                        {r.proven} proven
                      </span>
                      {r.location && (
                        <>
                          <span aria-hidden className="text-ink-subtle">·</span>
                          <span className="truncate text-ink-muted">{r.location}</span>
                        </>
                      )}
                    </p>

                    {/* Facet badges — work authorisation, degree, LOD, BIM role,
                        digital engineering, region and tenure, all read off
                        the CV. Neutral styling: these are hints, not verdicts. */}
                    {(r.workAuth && r.workAuth !== "unknown") ||
                    (r.degree && r.degree !== "none") ||
                    r.lodMax ||
                    (r.bimRole && r.bimRole !== "none") ||
                    r.digitalEngineering ||
                    (r.regions && r.regions.length > 0) ||
                    r.longestTenureYears ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        {r.workAuth === "right" && (
                          <span className="rounded-md bg-success-soft px-1.5 py-0.5 text-2xs font-medium text-success ring-1 ring-success-border ring-inset">
                            {WORK_AUTH_LABEL.right}
                          </span>
                        )}
                        {r.workAuth === "sponsor" && (
                          <span className="rounded-md bg-warn-soft px-1.5 py-0.5 text-2xs font-medium text-warn ring-1 ring-warn-border ring-inset">
                            {WORK_AUTH_LABEL.sponsor}
                          </span>
                        )}
                        {r.degree && r.degree !== "none" && (
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-ink-muted ring-1 ring-line ring-inset">
                            {DEGREE_LABEL[r.degree]}
                          </span>
                        )}
                        {r.bimRole && r.bimRole !== "none" && (
                          <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-2xs font-medium text-primary ring-1 ring-inset">
                            {BIM_ROLE_LABEL[r.bimRole]}
                          </span>
                        )}
                        {r.lodMax && (
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-ink-muted ring-1 ring-line ring-inset">
                            LOD {r.lodMax}
                          </span>
                        )}
                        {r.digitalEngineering && (
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-ink-muted ring-1 ring-line ring-inset">
                            Digital engineering
                          </span>
                        )}
                        {(r.regions ?? [])
                          .filter((rg) => rg !== "europe" || (r.regions ?? []).length === 1)
                          .map((rg) => (
                            <span
                              key={rg}
                              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-ink-muted ring-1 ring-line ring-inset"
                            >
                              {REGION_LABEL[rg]}
                            </span>
                          ))}
                        {r.longestTenureYears && (
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-ink-muted ring-1 ring-line ring-inset">
                            {r.longestTenureYears}y at one employer
                          </span>
                        )}
                      </div>
                    ) : null}

                    {r.missing.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1">
                        <span className="text-xs text-ink-subtle">missing</span>
                        {r.missing.slice(0, 3).map((k) => (
                          <SkillChip key={k} skillKey={k} tone="bad" />
                        ))}
                        {r.missing.length > 3 && (
                          <span className="text-xs text-ink-subtle">
                            +{r.missing.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>

                  <div className="flex shrink-0 items-center gap-3">
                    {r.assessScore != null && (
                      <span
                        className="hidden rounded-md bg-success-soft px-2 py-0.5 text-xs font-medium text-success ring-1 ring-success-border ring-inset sm:inline"
                        title="Technical test result"
                      >
                        Test {r.assessScore}
                        {r.assessMin != null ? ` · ${r.assessMin}m` : ""}
                      </span>
                    )}
                    {aiEnabled && r.aiScore !== null && (
                      <span className="hidden rounded-md bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary sm:inline">
                        AI
                      </span>
                    )}
                    <span className="hidden rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-muted md:inline">
                      {r.source ?? "direct"}
                    </span>
                    <StageSelect applicationId={r.id} stage={r.stage} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

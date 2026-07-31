"use client";

import { useState, useRef } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ScoreRing, SkillChip, STAGES, inputBase } from "./ui";
import { StageSelect } from "./stage-select";
import {
  DEGREE_LABEL,
  WORK_AUTH_LABEL,
  LOD_LEVELS,
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
}

type SortKey = "score" | "name" | "proven" | "assessment";

export interface CurrentFilters {
  minScore: number;
  stage: string;
  source: string;
  q: string;
  sort: SortKey;
  workAuth: string;
  minDegree: string;
  location: string;
  minLod: string;
  minBimRole: string;
  digital: boolean;
  region: string;
  minTenure: string;
}

const DEFAULTS: CurrentFilters = {
  minScore: 0,
  stage: "all",
  source: "all",
  q: "",
  sort: "score",
  workAuth: "all",
  minDegree: "all",
  location: "",
  minLod: "all",
  minBimRole: "all",
  digital: false,
  region: "all",
  minTenure: "all",
};

/**
 * The screen recruiters spend their day in.
 *
 * Filtering, sorting and pagination all happen server-side (the job page
 * builds a Prisma query from the URL's search params) — this component is a
 * thin controller that reflects the current URL and pushes updates to it,
 * plus the read-only list of whichever page of results the server already
 * picked out. It never holds the full applicant list in the browser, which is
 * what lets a role with thousands of applicants stay fast.
 */
export function CandidateFilter({
  rows,
  aiEnabled,
  totalCount,
  filteredCount,
  page,
  pageSize,
  sources,
  filters,
}: {
  rows: FilterRow[];
  aiEnabled: boolean;
  totalCount: number;
  filteredCount: number;
  page: number;
  pageSize: number;
  sources: string[];
  filters: CurrentFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Free-text inputs are debounced so typing doesn't fire a navigation per
  // keystroke — everything else (selects, checkboxes, range) is a discrete
  // choice and navigates immediately.
  const [query, setQuery] = useState(filters.q);
  const [location, setLocation] = useState(filters.location);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last query string this component actually asked the router for.
  // Two navigations issued close together (e.g. type a search term, then hit
  // Clear before the first has finished loading) can have their RSC
  // responses land out of order — whichever request happens to be slower
  // (a filtered search usually is, since it scans resumeText) can resolve
  // *after* a faster later one and silently overwrite the URL with stale
  // params. This watchdog re-asserts the most recent request if that happens,
  // rather than trusting the router to always apply pushes in call order.
  const lastRequested = useRef(searchParams.toString());

  // Resyncs the two debounced text fields whenever the server-provided
  // filters change for a reason other than typing here — the browser back
  // button, the "Clear" button, or another tab editing the same URL.
  // Adjusting state during render (React's sanctioned pattern for this)
  // rather than in a useEffect, which would commit a stale render first and
  // then force an extra one.
  const [syncedFrom, setSyncedFrom] = useState({ q: filters.q, location: filters.location });
  if (syncedFrom.q !== filters.q || syncedFrom.location !== filters.location) {
    setSyncedFrom({ q: filters.q, location: filters.location });
    setQuery(filters.q);
    setLocation(filters.location);
  }

  function navigate(updates: Partial<CurrentFilters & { page: number }>) {
    // Cancels any pending debounced text-input navigation that hasn't fired
    // yet — otherwise it would fire after this one and overwrite it.
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    const params = new URLSearchParams(searchParams.toString());
    const merged = { ...filters, ...updates };

    const set = (key: string, value: string | number | boolean, fallback: string | number | boolean) => {
      if (value === fallback || value === "") params.delete(key);
      else params.set(key, String(value));
    };
    set("minScore", merged.minScore, DEFAULTS.minScore);
    set("stage", merged.stage, DEFAULTS.stage);
    set("source", merged.source, DEFAULTS.source);
    set("q", merged.q, DEFAULTS.q);
    set("sort", merged.sort, DEFAULTS.sort);
    set("workAuth", merged.workAuth, DEFAULTS.workAuth);
    set("minDegree", merged.minDegree, DEFAULTS.minDegree);
    set("location", merged.location, DEFAULTS.location);
    set("minLod", merged.minLod, DEFAULTS.minLod);
    set("minBimRole", merged.minBimRole, DEFAULTS.minBimRole);
    if (merged.digital) params.set("digital", "1");
    else params.delete("digital");
    set("region", merged.region, DEFAULTS.region);
    set("minTenure", merged.minTenure, DEFAULTS.minTenure);

    // Any filter change starts back at page 1 — an explicit page update
    // (Prev/Next) is the only case that should keep a non-default page.
    const nextPage = "page" in updates ? updates.page! : 1;
    if (nextPage <= 1) params.delete("page");
    else params.set("page", String(nextPage));

    const queryString = params.toString();
    const target = `${pathname}?${queryString}`;
    lastRequested.current = queryString;
    router.push(target);

    // Watchdog: if a slower, earlier-issued navigation's response lands after
    // this one and clobbers the URL, put back what was actually asked for
    // last — but only if nothing even newer has been requested since (in
    // which case that newer call owns its own watchdog and this one backs off).
    setTimeout(() => {
      if (lastRequested.current !== queryString) return;
      const current = window.location.search.replace(/^\?/, "");
      if (current !== queryString) router.replace(target);
    }, 1500);
  }

  function debouncedNavigate(updates: Partial<CurrentFilters>) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => navigate(updates), 350);
  }

  const control =
    "rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm text-ink transition-colors duration-150 focus:border-primary focus:outline-none";

  const hasFilters =
    filters.minScore > 0 ||
    filters.stage !== "all" ||
    filters.source !== "all" ||
    filters.q !== "" ||
    filters.workAuth !== "all" ||
    filters.minDegree !== "all" ||
    filters.location !== "" ||
    filters.minLod !== "all" ||
    filters.minBimRole !== "all" ||
    filters.digital ||
    filters.region !== "all" ||
    filters.minTenure !== "all";

  const clearAll = () => {
    setQuery("");
    setLocation("");
    // Routed through navigate() (with all fields reset to their defaults) so
    // it cancels any pending debounced navigation the same way every other
    // filter change does, rather than duplicating that logic here.
    navigate({ ...DEFAULTS });
  };

  const pageStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, filteredCount);
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));

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
              onChange={(e) => {
                setQuery(e.target.value);
                debouncedNavigate({ q: e.target.value });
              }}
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
              defaultValue={filters.minScore}
              onChange={(e) => debouncedNavigate({ minScore: Number(e.target.value) })}
              className="w-24 accent-[var(--primary)]"
              aria-label="Minimum score"
            />
            <span className="tabular w-7 text-right font-medium">{filters.minScore}</span>
          </label>

          <select
            value={filters.stage}
            onChange={(e) => navigate({ stage: e.target.value })}
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
              value={filters.source}
              onChange={(e) => navigate({ source: e.target.value })}
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
            value={filters.sort}
            onChange={(e) => navigate({ sort: e.target.value as SortKey })}
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
            {filteredCount} of {totalCount}
          </span>
        </div>

        {/* Second row: recruiter facets — work authorisation, degree, location.
            Read from the CV text as hints; verify before acting on them. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2.5 border-t border-line pt-2.5">
          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Work auth</span>
            <select
              value={filters.workAuth}
              onChange={(e) => navigate({ workAuth: e.target.value })}
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
              value={filters.minDegree}
              onChange={(e) => navigate({ minDegree: e.target.value })}
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
              onChange={(e) => {
                setLocation(e.target.value);
                debouncedNavigate({ location: e.target.value });
              }}
              placeholder="e.g. Dublin"
              aria-label="Filter by location"
              className={`${control} w-32`}
            />
          </label>

          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">LOD</span>
            <select
              value={filters.minLod}
              onChange={(e) => navigate({ minLod: e.target.value })}
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
              value={filters.minBimRole}
              onChange={(e) => navigate({ minBimRole: e.target.value })}
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
              value={filters.region}
              onChange={(e) => navigate({ region: e.target.value })}
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
              checked={filters.digital}
              onChange={(e) => navigate({ digital: e.target.checked })}
              className="accent-[var(--primary)]"
            />
            <span className="text-ink-muted">Digital engineering</span>
          </label>

          <label className="flex items-center gap-1.5 text-sm">
            <span className="text-ink-muted">Tenure</span>
            <select
              value={filters.minTenure}
              onChange={(e) => navigate({ minTenure: e.target.value })}
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
        {rows.length === 0 ? (
          <p className="px-6 py-14 text-center text-sm text-ink-muted">
            No candidates match these filters.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((r, i) => (
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

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm">
            <span className="text-ink-muted">
              {pageStart}-{pageEnd} of {filteredCount}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate({ page: page - 1 })}
                disabled={page <= 1}
                className="rounded-lg px-2.5 py-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
              >
                ← Prev
              </button>
              <span className="tabular text-ink-subtle">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => navigate({ page: page + 1 })}
                disabled={page >= totalPages}
                className="rounded-lg px-2.5 py-1 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

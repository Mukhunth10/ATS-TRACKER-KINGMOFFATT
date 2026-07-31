import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma, parseJson } from "@/lib/db";
import type { RuleDetail } from "@/lib/score-rules";
import { isAiConfigured } from "@/lib/score-ai";
import { localAiConfigured, localAiAvailable } from "@/lib/score-local";
import { ScreenJobButton } from "@/components/screen-job-button";
import { Card, SectionTitle, SkillChip, STAGES } from "@/components/ui";
import { CandidateFilter, type FilterRow } from "@/components/candidate-filter";
import { UploadResume } from "@/components/upload-resume";
import { KeywordEditor } from "@/components/keyword-editor";
import { LiveJob } from "@/components/live-job";
import { ActivityTimeline } from "@/components/activity-timeline";
import { ApplyLinkPanel } from "@/components/apply-link";
import { requirePageUser } from "@/lib/auth";
import {
  degreesAtOrAbove,
  bimRolesAtOrAbove,
  type WorkAuth,
  type DegreeLevel,
  type LodLevel,
  type BimRole,
  type Region,
} from "@/lib/cv-facets";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
// Pipeline board shows a role's whole shape at a glance, not a full export —
// cap each stage column so it stays fast whether a role has 10 or 10,000
// applicants, and say so when a column is truncated rather than pretending
// it isn't.
const PIPELINE_CAP = 20;

type SortKey = "score" | "name" | "proven" | "assessment";

/** Reads one string value out of Next's searchParams (string | string[] | undefined). */
function param(
  sp: Record<string, string | string[] | undefined>,
  key: string,
  fallback: string,
): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? fallback;
}

export default async function JobPage(props: PageProps<"/jobs/[id]">) {
  // Page-level guard: never rely on the route guard alone.
  await requirePageUser();

  const { id } = await props.params;
  const sp = await props.searchParams;

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) notFound();

  // --- Filter state, read from the URL so it survives refresh/back and the
  // filter bar can be a plain form instead of holding state itself. ---
  const minScore = Number(param(sp, "minScore", "0")) || 0;
  const stage = param(sp, "stage", "all");
  const source = param(sp, "source", "all");
  const query = param(sp, "q", "").trim();
  const sort = param(sp, "sort", "score") as SortKey;
  const workAuth = param(sp, "workAuth", "all");
  const minDegree = param(sp, "minDegree", "all") as DegreeLevel | "all";
  const location = param(sp, "location", "").trim();
  const minLod = param(sp, "minLod", "all");
  const minBimRole = param(sp, "minBimRole", "all") as BimRole | "all";
  const digitalOnly = param(sp, "digital", "") === "1";
  const region = param(sp, "region", "all") as Region | "all";
  const minTenure = param(sp, "minTenure", "all");
  const page = Math.max(1, Number(param(sp, "page", "1")) || 1);

  // --- Build the filtered query server-side, in raw SQL rather than Prisma's
  // query builder, specifically so "sort by score" can be a true
  // COALESCE(aiScore, ruleScore) ORDER BY. AI screening only ever runs on a
  // capped shortlist of the highest rule-scorers (see screenJob in
  // actions.ts) — an unscreened candidate can easily have a higher rule score
  // than a screened one's AI score, so a two-column Prisma orderBy (aiScore
  // desc, then ruleScore desc as a tiebreak) is NOT equivalent to a coalesce
  // sort: it would rank every screened row above every unscreened one
  // regardless of the actual numbers. Every value below is bound as a query
  // parameter via Prisma.sql/Prisma.join, never string-concatenated, so this
  // stays injection-safe despite being raw SQL.
  //
  // This client-side-filtering approach is fine for a few hundred
  // applicants; it stops being fine at a few thousand, which is exactly the
  // scale this is for.
  const whereFragments: Prisma.Sql[] = [Prisma.sql`a."jobId" = ${id}`];

  if (minScore > 0) {
    whereFragments.push(Prisma.sql`COALESCE(a."aiScore", a."ruleScore") >= ${minScore}`);
  }
  if (stage !== "all") whereFragments.push(Prisma.sql`a."stage" = ${stage}`);
  if (source !== "all") whereFragments.push(Prisma.sql`a."source" ILIKE ${`%${source}%`}`);
  if (workAuth !== "all") whereFragments.push(Prisma.sql`c."workAuth" = ${workAuth}`);
  if (minDegree !== "all") {
    whereFragments.push(Prisma.sql`c."degree" IN (${Prisma.join(degreesAtOrAbove(minDegree))})`);
  }
  if (minLod !== "all") whereFragments.push(Prisma.sql`c."lodMax" >= ${Number(minLod)}`);
  if (minBimRole !== "all") {
    whereFragments.push(Prisma.sql`c."bimRole" IN (${Prisma.join(bimRolesAtOrAbove(minBimRole))})`);
  }
  if (digitalOnly) whereFragments.push(Prisma.sql`c."digitalEngineering" = true`);
  // regions is a JSON string, e.g. ["uk","europe"] — a quoted-substring check
  // is an approximation, not real JSON containment, but it's exact for this
  // fixed, small set of region keys (none is a substring of another).
  if (region !== "all") whereFragments.push(Prisma.sql`c."regions" LIKE ${`%"${region}"%`}`);
  if (minTenure !== "all") {
    whereFragments.push(Prisma.sql`c."longestTenureYears" >= ${Number(minTenure)}`);
  }
  if (location) {
    whereFragments.push(
      Prisma.sql`(c."location" ILIKE ${`%${location}%`} OR c."resumeText" ILIKE ${`%${location}%`})`,
    );
  }
  // Space-separated terms are ANDed, so "revit primavera" needs both present.
  for (const term of query.toLowerCase().split(/\s+/).filter(Boolean)) {
    whereFragments.push(
      Prisma.sql`(c."name" ILIKE ${`%${term}%`} OR c."email" ILIKE ${`%${term}%`} OR c."resumeText" ILIKE ${`%${term}%`})`,
    );
  }
  const whereClause = Prisma.join(whereFragments, " AND ");

  const orderByClause =
    sort === "name"
      ? Prisma.sql`c."name" ASC`
      : sort === "proven"
        ? Prisma.sql`a."provenCount" DESC`
        : sort === "assessment"
          ? Prisma.sql`ast."qualityScore" DESC NULLS LAST, ast."durationMin" ASC NULLS LAST`
          : Prisma.sql`COALESCE(a."aiScore", a."ruleScore") DESC`;

  const fromClause = Prisma.sql`FROM "Application" a
    JOIN "Candidate" c ON a."candidateId" = c.id
    LEFT JOIN "Assessment" ast ON ast."applicationId" = a.id`;

  const [
    totalApplicants,
    unscreened,
    countRows,
    idRows,
    sourceRows,
    stageCounts,
    stageItems,
    activities,
  ] = await Promise.all([
    prisma.application.count({ where: { jobId: id } }),
    prisma.application.count({ where: { jobId: id, aiScore: null } }),
    prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`SELECT COUNT(*)::bigint AS count ${fromClause} WHERE ${whereClause}`,
    ),
    prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT a.id ${fromClause} WHERE ${whereClause}
        ORDER BY ${orderByClause}
        LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    ),
    prisma.application.findMany({
      where: { jobId: id },
      select: { source: true },
      distinct: ["source"],
    }),
    prisma.application.groupBy({ by: ["stage"], where: { jobId: id }, _count: true }),
    Promise.all(
      STAGES.map((s) =>
        prisma.$queryRaw<{ id: string; ruleScore: number; aiScore: number | null; name: string }[]>(
          Prisma.sql`SELECT a.id, a."ruleScore", a."aiScore", c.name
            FROM "Application" a JOIN "Candidate" c ON a."candidateId" = c.id
            WHERE a."jobId" = ${id} AND a.stage = ${s}
            ORDER BY COALESCE(a."aiScore", a."ruleScore") DESC
            LIMIT ${PIPELINE_CAP}`,
        ),
      ),
    ),
    prisma.activity.findMany({ where: { jobId: id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const filteredCount = Number(countRows[0]?.count ?? 0);
  const orderedIds = idRows.map((r) => r.id);
  const pageAppsUnordered =
    orderedIds.length > 0
      ? await prisma.application.findMany({
          where: { id: { in: orderedIds } },
          include: { candidate: true, assessment: true },
        })
      : [];
  const appById = new Map(pageAppsUnordered.map((a) => [a.id, a]));
  // findMany({ where: { id: { in } } }) doesn't preserve input order, so
  // re-sort to the order the raw query actually computed.
  const pageApps = orderedIds.map((oid) => appById.get(oid)).filter((a) => a !== undefined);

  const mustHave = parseJson<string[]>(job.mustHave, []);
  const niceToHave = parseJson<string[]>(job.niceToHave, []);
  const customMustHave = parseJson<string[]>(job.customMustHave, []);
  const customNiceToHave = parseJson<string[]>(job.customNiceToHave, []);

  const localReady = localAiConfigured() && (await localAiAvailable());
  const aiEnabled = localReady || isAiConfigured();
  const aiProvider: "local" | "claude" = localReady ? "local" : "claude";

  // With no criteria at all the maths hands everyone full marks for skills,
  // which reads as "all candidates are perfect". Warn rather than mislead.
  const noCriteria =
    mustHave.length === 0 &&
    niceToHave.length === 0 &&
    customMustHave.length === 0 &&
    customNiceToHave.length === 0;

  const sources = [
    ...new Set(sourceRows.flatMap((r) => r.source.split(",").map((s) => s.trim()))),
  ].sort();

  const rows: FilterRow[] = pageApps.map((app) => {
    const detail = parseJson<Partial<RuleDetail>>(app.ruleDetail, {});
    return {
      id: app.id,
      name: app.candidate.name,
      email: app.candidate.email,
      stage: app.stage,
      ruleScore: app.ruleScore,
      aiScore: app.aiScore,
      years: detail.yearsDetected ?? 0,
      proven: app.provenCount,
      missing: detail.missingMustHave ?? [],
      source: app.source,
      // Only a reviewed assessment counts for ranking — a sent-but-not-scored
      // one has no result yet.
      assessScore: app.assessment?.status === "reviewed" ? app.assessment.qualityScore : null,
      assessMin: app.assessment?.status === "reviewed" ? app.assessment.durationMin : null,
      workAuth: (app.candidate.workAuth as WorkAuth | null) ?? "unknown",
      degree: (app.candidate.degree as DegreeLevel | null) ?? "none",
      lodMax: app.candidate.lodMax as LodLevel | null,
      bimRole: (app.candidate.bimRole as BimRole | null) ?? "none",
      digitalEngineering: app.candidate.digitalEngineering,
      regions: parseJson<Region[]>(app.candidate.regions, []),
      longestTenureYears: app.candidate.longestTenureYears,
      location: app.candidate.location ?? null,
    };
  });

  const stageCountByName = new Map(stageCounts.map((s) => [s.stage, s._count]));
  const byStage = STAGES.map((s, i) => ({
    stage: s,
    total: stageCountByName.get(s) ?? 0,
    items: stageItems[i],
  }));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-ink-muted hover:text-ink">
          ← All roles
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{job.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {job.track} · {job.location} · {job.seniority} · {job.minYears}+ years
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right text-sm text-ink-muted">
            <span>{totalApplicants} applicants</span>
            <LiveJob jobId={job.id} />
          </div>
        </div>
        {job.description && (
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-muted">
            {job.description}
          </p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {(mustHave.length > 0 || customMustHave.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-ink-muted">Must have</span>
              {mustHave.map((k) => (
                <SkillChip key={k} skillKey={k} tone="good" />
              ))}
              {customMustHave.map((k) => (
                <SkillChip key={k} skillKey={k.split("|")[0].trim()} tone="good" />
              ))}
            </div>
          )}
          {(niceToHave.length > 0 || customNiceToHave.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-ink-muted">Nice to have</span>
              {niceToHave.map((k) => (
                <SkillChip key={k} skillKey={k} />
              ))}
              {customNiceToHave.map((k) => (
                <SkillChip key={k} skillKey={k.split("|")[0].trim()} />
              ))}
            </div>
          )}
        </div>
      </div>

      {noCriteria && (
        <div className="rounded-lg border border-warn-border bg-warn-soft p-4 text-sm text-warn">
          <strong>This role has no screening criteria.</strong> With nothing to match
          against, every candidate scores near 100 and the ranking is meaningless. Add
          keywords under <em>Screening criteria</em> to make the scores mean something.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <div>
            <SectionTitle
              action={
                aiEnabled && unscreened > 0 ? (
                  <ScreenJobButton
                    jobId={job.id}
                    pendingCount={unscreened}
                    provider={aiProvider}
                  />
                ) : undefined
              }
            >
              Ranked candidates
            </SectionTitle>
            {totalApplicants === 0 ? (
              <Card className="p-10 text-center text-sm text-ink-muted">
                No candidates yet. Upload a resume to get started.
              </Card>
            ) : (
              <CandidateFilter
                aiEnabled={aiEnabled}
                rows={rows}
                totalCount={totalApplicants}
                filteredCount={filteredCount}
                page={page}
                pageSize={PAGE_SIZE}
                sources={sources}
                filters={{
                  minScore,
                  stage,
                  source,
                  q: query,
                  sort,
                  workAuth,
                  minDegree,
                  location,
                  minLod,
                  minBimRole,
                  digital: digitalOnly,
                  region,
                  minTenure,
                }}
              />
            )}
          </div>

          <div>
            <SectionTitle>Pipeline</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {byStage.map(({ stage: s, total, items }) => (
                <Card key={s} className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-muted capitalize">{s}</span>
                    <span className="text-xs text-ink-subtle">{total}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((a) => (
                      <Link
                        key={a.id}
                        href={`/applications/${a.id}`}
                        className="block truncate rounded bg-surface-2 px-2 py-1.5 text-xs hover:bg-surface-2"
                      >
                        {a.name}
                        <span className="ml-1 text-ink-subtle">{a.aiScore ?? a.ruleScore}</span>
                      </Link>
                    ))}
                    {items.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-ink-subtle">Empty</p>
                    )}
                    {total > PIPELINE_CAP && (
                      <p className="px-2 py-1 text-2xs text-ink-subtle">
                        +{total - PIPELINE_CAP} more
                      </p>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <SectionTitle>Add candidates</SectionTitle>
            <Card className="p-4">
              <UploadResume jobId={job.id} />
            </Card>
          </div>

          <div>
            <SectionTitle>Public apply link</SectionTitle>
            <Card className="p-4">
              <ApplyLinkPanel jobId={job.id} token={job.applyToken} open={job.applyOpen} />
            </Card>
          </div>

          <div>
            <SectionTitle>Screening criteria</SectionTitle>
            <Card className="p-4">
              <KeywordEditor
                jobId={job.id}
                mustHave={customMustHave}
                niceToHave={customNiceToHave}
                minYears={job.minYears}
              />
            </Card>
          </div>

          <div>
            <SectionTitle>Activity</SectionTitle>
            <Card className="p-4">
              <ActivityTimeline activities={activities} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

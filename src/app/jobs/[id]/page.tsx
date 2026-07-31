import Link from "next/link";
import { notFound } from "next/navigation";
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
import { extractFacets } from "@/lib/cv-facets";

export const dynamic = "force-dynamic";

export default async function JobPage(props: PageProps<"/jobs/[id]">) {
  // Page-level guard: never rely on the route guard alone.
  await requirePageUser();

  const { id } = await props.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      applications: {
        include: { candidate: true, assessment: true },
        // Rank by AI verdict where it exists, baseline otherwise. SQLite sorts
        // NULLs first on DESC, so unscored rows are re-sorted below in JS.
        orderBy: [{ ruleScore: "desc" }],
      },
    },
  });

  if (!job) notFound();

  // Recent process history for this role (Workday-style audit trail). Capped —
  // the timeline is a "what just happened" view, not a full export.
  const activities = await prisma.activity.findMany({
    where: { jobId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const mustHave = parseJson<string[]>(job.mustHave, []);
  const niceToHave = parseJson<string[]>(job.niceToHave, []);

  const localReady = localAiConfigured() && (await localAiAvailable());
  const aiEnabled = localReady || isAiConfigured();
  const aiProvider: "local" | "claude" = localReady ? "local" : "claude";
  const unscreened = job.applications.filter((a) => a.aiScore === null).length;
  const customMustHave = parseJson<string[]>(job.customMustHave, []);
  const customNiceToHave = parseJson<string[]>(job.customNiceToHave, []);

  // With no criteria at all the maths hands everyone full marks for skills,
  // which reads as "all candidates are perfect". Warn rather than mislead.
  const noCriteria =
    mustHave.length === 0 &&
    niceToHave.length === 0 &&
    customMustHave.length === 0 &&
    customNiceToHave.length === 0;

  const ranked = [...job.applications].sort(
    (a, b) => (b.aiScore ?? b.ruleScore) - (a.aiScore ?? a.ruleScore),
  );

  // Flattened for the client filter — resume text is included so the search box
  // can match any word in the CV, not just the candidate's name.
  const rows: FilterRow[] = ranked.map((app) => {
    const detail = parseJson<Partial<RuleDetail>>(app.ruleDetail, {});
    // Work authorisation and degree read off the CV text — hints for the
    // recruiter to filter and then verify, never an automated gate.
    const facets = extractFacets(app.candidate.resumeText);
    return {
      id: app.id,
      name: app.candidate.name,
      email: app.candidate.email,
      stage: app.stage,
      ruleScore: app.ruleScore,
      aiScore: app.aiScore,
      years: detail.yearsDetected ?? 0,
      proven: detail.demonstrated?.length ?? 0,
      missing: detail.missingMustHave ?? [],
      source: app.source,
      // Only a reviewed assessment counts for ranking — a sent-but-not-scored
      // one has no result yet.
      assessScore: app.assessment?.status === "reviewed" ? app.assessment.qualityScore : null,
      assessMin: app.assessment?.status === "reviewed" ? app.assessment.durationMin : null,
      workAuth: facets.workAuth,
      degree: facets.degree,
      lodMax: facets.lodMax,
      bimRole: facets.bimRole,
      digitalEngineering: facets.digitalEngineering,
      regions: facets.regions,
      longestTenureYears: facets.longestTenureYears,
      location: app.candidate.location ?? null,
      haystack: app.candidate.resumeText.toLowerCase(),
    };
  });

  const byStage = STAGES.map((stage) => ({
    stage,
    items: ranked.filter((a) => a.stage === stage),
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
            <span>{job.applications.length} applicants</span>
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
            {ranked.length === 0 ? (
              <Card className="p-10 text-center text-sm text-ink-muted">
                No candidates yet. Upload a resume to get started.
              </Card>
            ) : (
              <CandidateFilter aiEnabled={aiEnabled} rows={rows} />
            )}
          </div>

          <div>
            <SectionTitle>Pipeline</SectionTitle>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {byStage.map(({ stage, items }) => (
                <Card key={stage} className="p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-muted capitalize">
                      {stage}
                    </span>
                    <span className="text-xs text-ink-subtle">{items.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((a) => (
                      <Link
                        key={a.id}
                        href={`/applications/${a.id}`}
                        className="block truncate rounded bg-surface-2 px-2 py-1.5 text-xs hover:bg-surface-2"
                      >
                        {a.candidate.name}
                        <span className="ml-1 text-ink-subtle">
                          {a.aiScore ?? a.ruleScore}
                        </span>
                      </Link>
                    ))}
                    {items.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-ink-subtle">Empty</p>
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, parseJson } from "@/lib/db";
import type { RuleDetail } from "@/lib/score-rules";
import type { AiResult } from "@/lib/score-ai";
import { isAiConfigured } from "@/lib/score-ai";
import { localAiConfigured, localAiAvailable } from "@/lib/score-local";
import { Card, ScoreRing, SectionTitle, SkillChip } from "@/components/ui";
import { StageSelect } from "@/components/stage-select";
import { ScreenButton } from "@/components/screen-button";
import { NoteForm } from "@/components/note-form";
import { AssessmentPanel, type AssessmentView } from "@/components/assessment-panel";
import { DangerActions } from "@/components/danger-actions";
import { ActivityTimeline } from "@/components/activity-timeline";
import { requirePageUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Turns a stored video reference into a URL a reviewer can play.
 *   local:<key> → the authenticated in-app streaming route
 *   r2:<key>    → a short-lived presigned GET (URLs never stored stale)
 *   anything else → a link the candidate pasted; opened externally, not inlined
 */
async function resolveVideo(ref: string): Promise<{ url: string; isFile: boolean }> {
  if (!ref) return { url: "", isFile: false };
  if (ref.startsWith("local:")) {
    return { url: `/api/recording/${encodeURIComponent(ref.slice(6))}`, isFile: true };
  }
  if (ref.startsWith("r2:")) {
    const { presignGet } = await import("@/lib/storage");
    return { url: await presignGet(ref.slice(3)), isFile: true };
  }
  return { url: ref, isFile: false };
}

const RECOMMENDATION_STYLE: Record<string, string> = {
  advance: "bg-emerald-50 text-success ring-emerald-200",
  maybe: "bg-warn-soft text-amber-800 ring-amber-200",
  reject: "bg-rose-50 text-danger ring-rose-200",
};

export default async function ApplicationPage(props: PageProps<"/applications/[id]">) {
  // Page-level guard: never rely on the route guard alone.
  await requirePageUser();

  const { id } = await props.params;

  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      candidate: true,
      job: true,
      notes: { orderBy: { createdAt: "desc" } },
      assessment: true,
    },
  });

  if (!app) notFound();

  const activities = await prisma.activity.findMany({
    where: { applicationId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Shape the assessment for the client panel; dates are pre-formatted on the
  // server so the panel needn't ship a date library, and the stored video
  // reference is resolved to something playable here (R2 presign is async and
  // must run server-side).
  const a = app.assessment;
  const video = a ? await resolveVideo(a.videoUrl) : { url: "", isFile: false };
  const assessmentView: AssessmentView | null = a
    ? {
        status: a.status as AssessmentView["status"],
        title: a.title,
        token: a.token,
        sentAt: a.sentAt.toLocaleString(),
        submittedAt: a.submittedAt?.toLocaleString() ?? null,
        videoUrl: video.url,
        videoIsFile: video.isFile,
        consentAt: a.consentAt?.toLocaleString() ?? null,
        consentScreen: a.consentScreen,
        consentCamera: a.consentCamera,
        consentNoticeVersion: a.consentNoticeVersion,
        attentionAwaySec: a.attentionAwaySec,
        attentionEvents: a.attentionEvents,
        proctorTabHiddenSec: a.proctorTabHiddenSec,
        proctorTabSwitches: a.proctorTabSwitches,
        proctorPastes: a.proctorPastes,
        proctorCopies: a.proctorCopies,
        proctorFullscreenExits: a.proctorFullscreenExits,
        proctorMultiFace: a.proctorMultiFace,
        proctorLog: a.proctorLog,
        outputUrl: a.outputUrl,
        candidateNote: a.candidateNote,
        qualityScore: a.qualityScore,
        durationMin: a.durationMin,
        reviewNotes: a.reviewNotes,
        elapsedMin: a.submittedAt
          ? Math.max(0, Math.round((a.submittedAt.getTime() - a.sentAt.getTime()) / 60000))
          : null,
      }
    : null;

  const rules = parseJson<Partial<RuleDetail>>(app.ruleDetail, {});
  const ai = app.aiDetail ? parseJson<AiResult | null>(app.aiDetail, null) : null;
  const mustHave = parseJson<string[]>(app.job.mustHave, []);

  // AI screening is the only feature that costs money. When no key is set it is
  // hidden entirely rather than shown as a dead button, so nobody on the HR
  // team clicks something that cannot work.
  // Screening is available if either provider is: free local Ollama, or Claude.
  const localReady = localAiConfigured() && (await localAiAvailable());
  const aiEnabled = localReady || isAiConfigured();
  const aiProvider = localReady ? "local" : isAiConfigured() ? "claude" : "none";

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/jobs/${app.jobId}`} className="text-sm text-ink-muted hover:text-ink">
          ← {app.job.title}
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{app.candidate.name}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {app.candidate.email}
              {app.candidate.phone ? ` · ${app.candidate.phone}` : ""}
              {app.candidate.resumeFile ? ` · ${app.candidate.resumeFile}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ScoreRing score={app.ruleScore} label="score" size={56} />
            {(aiEnabled || app.aiScore !== null) && (
              <ScoreRing score={app.aiScore} label="AI" size={56} />
            )}
            <StageSelect applicationId={app.id} stage={app.stage} />
          </div>
        </div>

        {app.stage === "rejected" && app.dispositionReason && (
          <div className="mt-4 rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger">
            <span className="font-semibold">Declined</span> — {app.dispositionReason}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* --- Evidence: the primary signal, computed offline --- */}
          <div>
            <SectionTitle>Evidence</SectionTitle>
            <Card className="space-y-5 p-5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span>
                  <span className="text-ink-muted">Experience: </span>
                  <span className="font-medium">{rules.yearsDetected ?? 0} yrs</span>
                  <span className="text-ink-subtle"> / {app.job.minYears} required</span>
                </span>
                <span>
                  <span className="text-ink-muted">Demonstrated skills: </span>
                  <span className="font-medium">{rules.demonstrated?.length ?? 0}</span>
                </span>
                <span>
                  <span className="text-ink-muted">Listed only: </span>
                  <span className="font-medium">{rules.listedOnly?.length ?? 0}</span>
                </span>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  Must-have coverage
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {mustHave.map((k) => (
                    <SkillChip
                      key={k}
                      skillKey={k}
                      tone={
                        rules.missingMustHave?.includes(k)
                          ? "bad"
                          : rules.demonstrated?.includes(k)
                            ? "good"
                            : "neutral"
                      }
                    />
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-subtle">
                  Green = proven in a project. Grey = listed as a keyword only (half
                  credit). Red = absent.
                </p>
              </div>

              {(rules.demonstrated?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-success uppercase">
                    Proven in projects
                  </p>
                  <ul className="space-y-2">
                    {rules.demonstrated!.map((k) => (
                      <li key={k} className="border-l-2 border-success-border pl-3 text-sm">
                        <SkillChip skillKey={k} tone="good" />
                        <p className="mt-1 text-ink-muted">{rules.evidence?.[k]}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Meaning-matches: found by semantic similarity, not exact words.
                  A softer signal — shown with its evidence for a human to confirm. */}
              {(rules.semantic?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-primary uppercase">
                    Matched by meaning — please confirm
                  </p>
                  <ul className="space-y-2">
                    {rules.semantic!.map((k) => (
                      <li key={k} className="border-l-2 border-primary/40 pl-3 text-sm">
                        <SkillChip skillKey={k} />
                        <p className="mt-1 text-ink-muted">{rules.evidence?.[k]}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-subtle">
                    Found by similar meaning, not the exact words — counts for partial
                    credit. Read the lines above to confirm the skill is really there.
                  </p>
                </div>
              )}

              {(rules.listedOnly?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    Listed but not demonstrated
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {rules.listedOnly!.map((k) => (
                      <SkillChip key={k} skillKey={k} />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-subtle">
                    These appear as keywords with no supporting project. Worth probing in
                    a screening call.
                  </p>
                </div>
              )}
            </Card>
          </div>

          {/* --- AI verdict (only when a key is configured) --- */}
          {(aiEnabled || ai) && (
          <div>
            <SectionTitle>AI screening</SectionTitle>
            {ai ? (
              <Card className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm leading-relaxed text-ink">{ai.summary}</p>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${
                      RECOMMENDATION_STYLE[ai.recommendation] ?? RECOMMENDATION_STYLE.maybe
                    }`}
                  >
                    {ai.recommendation}
                  </span>
                </div>

                <div className="rounded-md bg-surface-2 p-3 text-sm text-ink-muted">
                  <span className="font-medium text-ink">Seniority read: </span>
                  {ai.seniorityAssessment}
                </div>

                {ai.bimEvidence?.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                      BIM development evidence
                    </p>
                    <ul className="space-y-2">
                      {ai.bimEvidence.map((e, i) => (
                        <li key={i} className="border-l-2 border-line pl-3 text-sm">
                          <span className="font-medium">{e.skill}</span>
                          <p className="text-ink-muted">{e.evidence}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-success uppercase">
                      Strengths
                    </p>
                    <ul className="space-y-1.5 text-sm text-ink-muted">
                      {ai.strengths.map((s, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-success">+</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-danger uppercase">
                      Gaps
                    </p>
                    <ul className="space-y-1.5 text-sm text-ink-muted">
                      {ai.gaps.map((g, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-danger">−</span>
                          {g}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {app.aiScoredAt && (
                  <p className="border-t border-line pt-3 text-xs text-ink-subtle">
                    Screened {app.aiScoredAt.toLocaleString()}
                  </p>
                )}
              </Card>
            ) : (
              <Card className="p-5 text-sm text-ink-muted">
                Not screened yet. The evidence breakdown above is free and offline; AI
                screening adds a written verdict at a per-candidate cost.
              </Card>
            )}
          </div>
          )}

          {/* --- Resume text --- */}
          <div>
            <SectionTitle>Resume</SectionTitle>
            <Card className="p-5">
              <pre className="max-h-96 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap text-ink-muted">
                {app.candidate.resumeText}
              </pre>
            </Card>
          </div>
        </div>

        {/* --- Sidebar --- */}
        <div className="space-y-6">
          <div>
            <SectionTitle>Technical assessment</SectionTitle>
            <Card className="p-4">
              <AssessmentPanel applicationId={app.id} assessment={assessmentView} />
            </Card>
          </div>

          {aiEnabled && (
            <div>
              <SectionTitle>AI screening</SectionTitle>
              <Card className="p-4">
                <ScreenButton
                  applicationId={app.id}
                  alreadyScored={app.aiScore !== null}
                  provider={aiProvider}
                />
                <p className="mt-2 text-xs text-ink-subtle">
                  {aiProvider === "local"
                    ? "Running on your local model — free and private, nothing leaves this machine."
                    : "Uses the Claude API — roughly $0.04–0.08 per run."}
                </p>
              </Card>
            </div>
          )}

          <div>
            <SectionTitle>Notes</SectionTitle>
            <Card className="space-y-4 p-4">
              <NoteForm applicationId={app.id} />
              {app.notes.length > 0 && (
                <ul className="space-y-3 border-t border-line pt-3">
                  {app.notes.map((n) => (
                    <li key={n.id} className="text-sm">
                      <p className="whitespace-pre-wrap text-ink">{n.body}</p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        {n.author} · {n.createdAt.toLocaleString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div>
            <SectionTitle>Activity</SectionTitle>
            <Card className="p-4">
              <ActivityTimeline activities={activities} />
            </Card>
          </div>

          <div>
            <SectionTitle>Data &amp; privacy</SectionTitle>
            <Card className="p-4">
              <DangerActions
                candidateId={app.candidateId}
                candidateName={app.candidate.name}
                applicationId={app.id}
                hasRecording={Boolean(a?.videoUrl)}
              />
              <p className="mt-3 border-t border-line pt-3 text-xs text-ink-subtle">
                Use these to honour a candidate's request to withdraw consent or delete
                their data. Deletion is permanent and removes their recordings too.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useActionState, useState, useTransition } from "react";
import {
  sendAssessment,
  reviewAssessment,
  type ActionState,
} from "@/app/assessments/actions";
import { btnPrimary, btnSecondary, inputBase, ScoreRing } from "./ui";

/** Uploads a staff test file (authed) and returns its stored reference. */
async function uploadTestFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "zip";
  const target = await fetch(`/api/assessment-file?ext=${encodeURIComponent(ext)}`).then((r) =>
    r.json(),
  );
  if (target.error) throw new Error(target.error);

  const res = await fetch(target.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return target.ref;
}

export interface AssessmentView {
  status: "sent" | "submitted" | "reviewed";
  title: string;
  token: string;
  sentAt: string;
  submittedAt: string | null;
  videoUrl: string;
  /** True when videoUrl is an in-app/R2 recording we can embed; false for a
   *  pasted external link, which we only link out to. */
  videoIsFile: boolean;
  /** Consent record — proof of what the candidate agreed to. */
  consentAt: string | null;
  consentScreen: boolean;
  consentCamera: boolean;
  consentNoticeVersion: string;
  /** Proctoring result — all reviewer aids, never a verdict. */
  attentionAwaySec: number;
  attentionEvents: number;
  proctorTabHiddenSec: number;
  proctorTabSwitches: number;
  proctorPastes: number;
  proctorCopies: number;
  proctorFullscreenExits: number;
  proctorMultiFace: number;
  /** JSON array of {t, type} events for the timeline. */
  proctorLog: string;
  outputUrl: string;
  candidateNote: string;
  qualityScore: number | null;
  durationMin: number | null;
  reviewNotes: string;
  /** Wall-clock minutes from send to submit — includes idle time, shown as context. */
  elapsedMin: number | null;
}

/** The link a candidate opens. Origin comes from the browser so it is correct
 *  whether the app runs on localhost or a real host. */
function useSubmissionLink(token: string) {
  const [origin, setOrigin] = useState("");
  if (typeof window !== "undefined" && !origin) setOrigin(window.location.origin);
  return `${origin}/assess/${token}`;
}

function CopyLink({ token }: { token: string }) {
  const link = useSubmissionLink(token);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input readOnly value={link} className={`${inputBase} font-mono text-xs`} />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* clipboard blocked — the field is selectable as a fallback */
          }
        }}
        className={`${btnSecondary} shrink-0`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

/** Human-readable labels + tone for each proctor event type. */
const EVENT_META: Record<string, { label: string; strong: boolean }> = {
  tab_hidden: { label: "Left the test tab / window", strong: true },
  tab_visible: { label: "Returned to the tab", strong: false },
  paste: { label: "Pasted content into the page", strong: true },
  copy: { label: "Copied from the page", strong: false },
  fullscreen_exit: { label: "Left fullscreen", strong: true },
  look_away: { label: "Looked away (sustained)", strong: true },
  multi_face: { label: "A second face appeared", strong: true },
};

function mmss(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

/**
 * The proctoring summary for a submitted assessment: headline flags plus a
 * scrubbable timeline the reviewer reads against the recording. Every number is
 * a "worth a look" prompt, never a pass/fail — leaving fullscreen or glancing
 * away can be perfectly innocent, so a human decides.
 */
function ProctorReview({ assessment }: { assessment: AssessmentView }) {
  const events = (() => {
    try {
      const parsed = JSON.parse(assessment.proctorLog || "[]");
      return Array.isArray(parsed)
        ? (parsed as { t: number; type: string }[]).filter((e) => EVENT_META[e?.type])
        : [];
    } catch {
      return [];
    }
  })();

  const flags: { label: string; n: number; extra?: string }[] = [
    {
      label: "Left the tab/window",
      n: assessment.proctorTabSwitches,
      extra:
        assessment.proctorTabHiddenSec > 0
          ? `${Math.max(1, Math.round(assessment.proctorTabHiddenSec / 60))} min away`
          : undefined,
    },
    { label: "Looked away", n: assessment.attentionEvents,
      extra: assessment.attentionAwaySec > 0
        ? `${Math.max(1, Math.round(assessment.attentionAwaySec / 60))} min total` : undefined },
    { label: "Second face in frame", n: assessment.proctorMultiFace },
    { label: "Pasted into the page", n: assessment.proctorPastes },
    { label: "Left fullscreen", n: assessment.proctorFullscreenExits },
  ].filter((f) => f.n > 0);

  if (flags.length === 0) {
    return assessment.videoIsFile ? (
      <p className="text-xs text-ink-subtle">
        Proctoring: no tab-switches, pastes, extra faces or sustained look-aways flagged.
      </p>
    ) : null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-warn-border bg-warn-soft p-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        {flags.map((f) => (
          <span
            key={f.label}
            className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-warn ring-1 ring-warn-border ring-inset"
          >
            {f.label}: <span className="tabular">{f.n}</span>
            {f.extra ? <span className="font-normal text-ink-subtle">· {f.extra}</span> : null}
          </span>
        ))}
      </div>

      {events.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium text-ink-muted hover:text-ink">
            Timeline — {events.length} event{events.length === 1 ? "" : "s"} (scrub the
            recording to these times)
          </summary>
          <ol className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
            {events.map((e, i) => {
              const meta = EVENT_META[e.type];
              return (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="tabular w-11 shrink-0 font-mono text-ink-subtle">
                    {mmss(Math.max(0, Math.round(e.t)))}
                  </span>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      meta.strong ? "bg-warn" : "bg-line-strong"
                    }`}
                    aria-hidden
                  />
                  <span className={meta.strong ? "text-ink" : "text-ink-muted"}>
                    {meta.label}
                  </span>
                </li>
              );
            })}
          </ol>
        </details>
      )}

      <p className="text-xs text-ink-muted">
        These are prompts to <strong>watch the recording</strong>, not a verdict. A
        second monitor, a glance at the keyboard, or a brief tab change can be innocent —
        you decide.
      </p>
    </div>
  );
}

export function AssessmentPanel({
  applicationId,
  assessment,
}: {
  applicationId: string;
  assessment: AssessmentView | null;
}) {
  if (!assessment) {
    return <SendForm applicationId={applicationId} />;
  }

  return (
    <div className="space-y-4">
      {/* Candidate link — always available so it can be re-sent */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-ink-muted">
          Candidate submission link — send this to them
        </p>
        <CopyLink token={assessment.token} />
      </div>

      {assessment.status === "sent" && (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-muted">
          Sent {assessment.sentAt}. Waiting for the candidate to submit.
        </p>
      )}

      {/* What the candidate returned */}
      {assessment.status !== "sent" && (
        <div className="space-y-3 rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium text-success">Submitted</span>
            {assessment.submittedAt && (
              <span className="text-ink-muted">{assessment.submittedAt}</span>
            )}
            {assessment.elapsedMin !== null && (
              <span className="text-ink-subtle">
                {assessment.elapsedMin} min from send to submit
              </span>
            )}
          </div>
          {/* An in-browser recording plays inline; a pasted link opens out. */}
          {assessment.videoUrl && assessment.videoIsFile && (
            <video
              src={assessment.videoUrl}
              controls
              preload="metadata"
              className="w-full rounded-lg border border-line bg-black"
            />
          )}
          <div className="flex flex-wrap gap-2">
            {assessment.videoUrl && !assessment.videoIsFile && (
              <a
                href={assessment.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={btnSecondary}
              >
                ▶ Watch recording
              </a>
            )}
            {assessment.outputUrl && (
              <a
                href={assessment.outputUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={btnSecondary}
              >
                Open output file
              </a>
            )}
          </div>
          {assessment.candidateNote && (
            <p className="text-sm text-ink-muted">
              <span className="font-medium text-ink">Candidate note: </span>
              {assessment.candidateNote}
            </p>
          )}
          {/* Proctoring aids — framed so no one mistakes them for an auto-verdict. */}
          <ProctorReview assessment={assessment} />
          {assessment.consentAt && (
            <p className="border-t border-line pt-2 text-xs text-ink-subtle">
              Consent recorded {assessment.consentAt} — screen:{" "}
              {assessment.consentScreen ? "yes" : "no"}, camera:{" "}
              {assessment.consentCamera ? "yes" : "no"} (notice v
              {assessment.consentNoticeVersion || "?"}).
            </p>
          )}
        </div>
      )}

      {/* Reviewer's verdict */}
      {assessment.status === "reviewed" && assessment.qualityScore !== null && (
        <div className="flex items-start gap-4 rounded-lg border border-line p-4">
          <ScoreRing score={assessment.qualityScore} label="Quality" size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              Quality {assessment.qualityScore}/100
              {assessment.durationMin !== null && (
                <span className="ml-2 font-normal text-ink-muted">
                  · {assessment.durationMin} min working time
                </span>
              )}
            </p>
            {assessment.reviewNotes && (
              <p className="mt-1 text-sm whitespace-pre-wrap text-ink-muted">
                {assessment.reviewNotes}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Review form appears once the candidate has submitted */}
      {assessment.status !== "sent" && (
        <ReviewForm
          applicationId={applicationId}
          defaults={{
            qualityScore: assessment.qualityScore,
            durationMin: assessment.durationMin,
            reviewNotes: assessment.reviewNotes,
          }}
          reviewed={assessment.status === "reviewed"}
        />
      )}

      {/* Re-send / replace */}
      <details className="text-sm">
        <summary className="cursor-pointer text-ink-muted hover:text-ink">
          Resend or replace this assessment
        </summary>
        <div className="mt-3">
          <SendForm applicationId={applicationId} resend defaultTitle={assessment.title} />
        </div>
      </details>
    </div>
  );
}

function SendForm({
  applicationId,
  resend = false,
  defaultTitle = "Revit modelling test",
}: {
  applicationId: string;
  resend?: boolean;
  defaultTitle?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<ActionState>({});

  // Upload the chosen file (if any) before sending, so a big .zip goes to
  // storage directly rather than through the server action's 1MB limit.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("testFile");

    setState({});
    try {
      if (file instanceof File && file.size > 0) {
        setUploading(true);
        const ref = await uploadTestFile(file);
        setUploading(false);
        fd.set("testUrl", ref); // the stored reference replaces the link field
      }
    } catch (err) {
      setUploading(false);
      setState({ error: err instanceof Error ? err.message : "File upload failed" });
      return;
    }
    fd.delete("testFile");

    startTransition(async () => {
      const result = await sendAssessment(applicationId, {}, fd);
      setState(result);
      if (result.ok) form.reset();
    });
  }

  const busy = pending || uploading;

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {!resend && (
        <p className="text-sm text-ink-muted">
          Send a technical test with a private link the candidate opens without an account.
        </p>
      )}
      <div>
        <label className="mb-1 block text-sm font-medium">Test title</label>
        <input name="title" defaultValue={defaultTitle} className={inputBase} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Instructions</label>
        <textarea
          name="instructions"
          rows={3}
          placeholder="e.g. Model the attached floor plan to LOD 300 in Revit. Set up sheets and a schedule."
          className={inputBase}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Test file</label>
        <input
          type="file"
          name="testFile"
          className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-fg hover:file:bg-primary-hover"
        />
        <p className="mt-1 text-xs text-ink-subtle">
          Upload the .zip / .rvt directly (stored on your own storage), or paste a link
          below instead.
        </p>
        <input
          name="testUrl"
          type="url"
          placeholder="…or a Drive / Dropbox / WeTransfer link"
          className={`${inputBase} mt-2`}
        />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">{state.ok}</p>}
      <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
        {uploading
          ? "Uploading file…"
          : pending
            ? "Preparing…"
            : resend
              ? "Resend (resets the clock)"
              : "Create assessment"}
      </button>
    </form>
  );
}

function ReviewForm({
  applicationId,
  defaults,
  reviewed,
}: {
  applicationId: string;
  defaults: { qualityScore: number | null; durationMin: number | null; reviewNotes: string };
  reviewed: boolean;
}) {
  const action = reviewAssessment.bind(null, applicationId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-line p-4">
      <p className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        {reviewed ? "Update review" : "Score this submission"}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Quality (0–100)</label>
          <input
            name="qualityScore"
            type="number"
            min={0}
            max={100}
            required
            defaultValue={defaults.qualityScore ?? ""}
            className={inputBase}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Working time (min)</label>
          <input
            name="durationMin"
            type="number"
            min={0}
            defaultValue={defaults.durationMin ?? ""}
            placeholder="from the video"
            className={inputBase}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          name="reviewNotes"
          rows={2}
          defaultValue={defaults.reviewNotes}
          placeholder="What was strong, what was missing…"
          className={inputBase}
        />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">{state.ok}</p>}
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : reviewed ? "Update review" : "Save review"}
      </button>
    </form>
  );
}

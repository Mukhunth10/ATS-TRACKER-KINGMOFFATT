"use client";

import { useActionState, useState } from "react";
import { submitAssessment, type ActionState } from "@/app/assessments/actions";
import { btnPrimary, inputBase } from "@/components/ui";
import { Recorder } from "./recorder";
import type { AssessmentSignals } from "./proctor";

const EMPTY_SIGNALS: AssessmentSignals = {
  awaySec: 0,
  events: 0,
  tabHiddenSec: 0,
  tabSwitches: 0,
  pastes: 0,
  copies: 0,
  fullscreenExits: 0,
  multiFace: 0,
  timeline: [],
};

export function SubmitForm({
  token,
  submitted,
  noticeVersion,
  defaults,
}: {
  token: string;
  submitted: boolean;
  noticeVersion: string;
  defaults: { videoUrl: string; outputUrl: string; candidateNote: string };
}) {
  const action = submitAssessment.bind(null, token);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});

  // Granular consent — screen and camera are separate purposes and ticked
  // separately (GDPR: consent must not be bundled). The recorder only appears
  // once both, plus the notice acknowledgement, are given.
  const [ackNotice, setAckNotice] = useState(false);
  const [consentScreen, setConsentScreen] = useState(false);
  const [consentCamera, setConsentCamera] = useState(false);
  const allConsented = ackNotice && consentScreen && consentCamera;

  const [videoUrl, setVideoUrl] = useState(defaults.videoUrl);
  const [recorded, setRecorded] = useState(false);
  const [signals, setSignals] = useState<AssessmentSignals>(EMPTY_SIGNALS);

  const check = "mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]";

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-lg border border-line p-4">
        <p className="text-sm font-medium">Your consent</p>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={ackNotice}
            onChange={(e) => setAckNotice(e.target.checked)}
            className={check}
          />
          <span className="text-sm text-ink">
            I have read the privacy notice above and understand how my data will be used.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={consentScreen}
            onChange={(e) => setConsentScreen(e.target.checked)}
            className={check}
          />
          <span className="text-sm text-ink">
            I consent to my <strong>screen</strong> being recorded during this assessment.
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={consentCamera}
            onChange={(e) => setConsentCamera(e.target.checked)}
            className={check}
          />
          <span className="text-sm text-ink">
            I consent to my <strong>camera</strong> (my face) being recorded during this
            assessment and reviewed by the hiring team.
          </span>
        </label>

        {!allConsented && (
          <p className="text-xs text-ink-subtle">
            Recording becomes available once you have given all three consents above. You
            are free to decline — see the notice for how to be assessed another way.
          </p>
        )}

        {allConsented && (
          <div className="pt-1">
            <Recorder
              token={token}
              onUploaded={(ref, stats) => {
                setVideoUrl(ref);
                setRecorded(true);
                setSignals(stats);
              }}
            />
          </div>
        )}
      </div>

      <form action={formAction} className="space-y-4">
        {/* Consent is submitted alongside the work, so it is recorded server-side. */}
        <input type="hidden" name="consentScreen" value={consentScreen ? "1" : ""} />
        <input type="hidden" name="consentCamera" value={consentCamera ? "1" : ""} />
        <input type="hidden" name="noticeVersion" value={noticeVersion} />
        <input type="hidden" name="attentionAwaySec" value={signals.awaySec} />
        <input type="hidden" name="attentionEvents" value={signals.events} />
        <input type="hidden" name="proctorTabHiddenSec" value={signals.tabHiddenSec} />
        <input type="hidden" name="proctorTabSwitches" value={signals.tabSwitches} />
        <input type="hidden" name="proctorPastes" value={signals.pastes} />
        <input type="hidden" name="proctorCopies" value={signals.copies} />
        <input type="hidden" name="proctorFullscreenExits" value={signals.fullscreenExits} />
        <input type="hidden" name="proctorMultiFace" value={signals.multiFace} />
        <input type="hidden" name="proctorLog" value={JSON.stringify(signals.timeline)} />

        <div>
          <label htmlFor="videoUrl" className="mb-1.5 block text-sm font-medium">
            Screen &amp; camera recording <span className="text-danger">*</span>
          </label>
          <input
            id="videoUrl"
            name="videoUrl"
            required
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="Recorded above, or paste a link"
            readOnly={recorded}
            className={`${inputBase} ${recorded ? "bg-surface-2 text-ink-muted" : ""}`}
          />
          <p className="mt-1 text-xs text-ink-subtle">
            {recorded
              ? "Your recording is attached."
              : "Record above after consenting, or paste a link set to “anyone with the link can view”."}
          </p>
        </div>

        <div>
          <label htmlFor="outputUrl" className="mb-1.5 block text-sm font-medium">
            Your finished file
          </label>
          <input
            id="outputUrl"
            name="outputUrl"
            type="url"
            defaultValue={defaults.outputUrl}
            placeholder="Link to your Revit (.rvt) file"
            className={inputBase}
          />
        </div>

        <div>
          <label htmlFor="candidateNote" className="mb-1.5 block text-sm font-medium">
            Anything you'd like us to know
          </label>
          <textarea
            id="candidateNote"
            name="candidateNote"
            rows={3}
            defaultValue={defaults.candidateNote}
            placeholder="Optional — assumptions you made, parts you'd refine with more time…"
            className={inputBase}
          />
        </div>

        {state.error && (
          <p
            role="alert"
            className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-danger-border ring-inset"
          >
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success ring-1 ring-success-border ring-inset">
            {state.ok}
          </p>
        )}

        <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
          {pending ? "Submitting…" : submitted ? "Update submission" : "Submit assessment"}
        </button>
      </form>
    </div>
  );
}

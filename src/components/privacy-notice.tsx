import type { PrivacyConfig } from "@/lib/privacy";

/**
 * Candidate-facing privacy notice, shown before consent on the assessment page.
 *
 * Covers the Article 13 essentials: who is processing, what, why, the legal
 * basis, how long, who it's shared with, and the candidate's rights. It is
 * generated from the deploying company's configured details. It is a template —
 * the organisation is responsible for having it reviewed and for the underlying
 * lawful basis and DPIA.
 */
export function PrivacyNotice({
  cfg,
  aiEnabled,
  r2Enabled,
}: {
  cfg: PrivacyConfig;
  aiEnabled: boolean;
  r2Enabled: boolean;
}) {
  return (
    <details className="rounded-lg border border-line bg-surface-2 p-4 text-sm">
      <summary className="cursor-pointer font-medium text-ink">
        Privacy notice — how {cfg.company} uses your data (please read)
      </summary>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-muted">
        <p>
          <strong className="text-ink">Who:</strong> {cfg.company} (“we”) is the
          controller of the personal data you provide in this assessment.
        </p>
        <p>
          <strong className="text-ink">What we collect:</strong> your submitted files and
          notes; a recording of your screen while you complete the task; and a recording
          of your webcam (your face) during the task, shown in the corner of the same
          recording.
        </p>
        <p>
          <strong className="text-ink">Why:</strong> to assess your suitability for the
          role you applied for. The webcam recording is reviewed by a member of our hiring
          team to confirm you completed the task unaided.
        </p>
        <p>
          <strong className="text-ink">Activity &amp; attention checks:</strong> while you
          work, your browser records a few things to help our team review fairly: whether
          you are facing the screen, whether a second face appears, when the test tab or
          window loses focus, when you leave fullscreen, and when you paste into the page.
          These all run on your own device and are logged with timestamps.{" "}
          <strong className="text-ink">
            None of this rejects you automatically — it only prompts a member of our team
            to watch that part of the recording, and a person makes every decision.
          </strong>{" "}
          Looking at a second monitor or your keyboard, or a brief interruption, is
          expected and is not held against you.
        </p>
        <p>
          <strong className="text-ink">Legal basis:</strong> we rely on your consent for
          the screen and camera recording. You can decline; if you would prefer not to be
          recorded, contact us at the address below to discuss an alternative way to be
          assessed, at no disadvantage.
        </p>
        <p>
          <strong className="text-ink">Who sees it:</strong> our hiring team.
          {r2Enabled
            ? " Recordings are stored with our cloud storage provider (Cloudflare) as our processor."
            : " Recordings are stored on our own systems."}
          {aiEnabled
            ? " Your CV (not this recording) may be analysed by Anthropic’s AI as our processor to summarise your experience."
            : ""}
        </p>
        <p>
          <strong className="text-ink">How long:</strong> we keep this data for{" "}
          {cfg.retention}, then delete it.
        </p>
        <p>
          <strong className="text-ink">Your rights:</strong> you can ask us to access,
          correct, or delete your data, or withdraw your consent at any time (withdrawing
          is as easy as giving it — just email us). Withdrawing consent does not affect
          processing already carried out. You may also complain to your data protection
          authority.
        </p>
        <p>
          <strong className="text-ink">Contact:</strong>{" "}
          <a href={`mailto:${cfg.contactEmail}`} className="text-primary hover:underline">
            {cfg.contactEmail}
          </a>
        </p>
      </div>
    </details>
  );
}

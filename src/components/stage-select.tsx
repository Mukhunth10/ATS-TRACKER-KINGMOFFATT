"use client";

import { useState, useTransition } from "react";
import { moveStage } from "@/app/actions";
import { STAGES, STAGE_STYLE, DISPOSITION_REASONS, btnPrimary, btnGhost, inputBase } from "./ui";

/**
 * Inline pipeline-stage control.
 *
 * Deliberately not optimistic: the round trip is a single indexed update, and a
 * stage that snaps back after appearing to change would be worse than a brief
 * dimmed state.
 *
 * Declining a candidate opens a small prompt for a Workday-style disposition
 * reason first — rejections stay consistent, reportable and auditable, and a
 * misclick can be cancelled before it's recorded.
 */
export function StageSelect({
  applicationId,
  stage,
}: {
  applicationId: string;
  stage: string;
}) {
  const [pending, startTransition] = useTransition();
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState<string>(DISPOSITION_REASONS[0]);
  const [otherReason, setOtherReason] = useState("");

  function commit(next: string, dispositionReason?: string) {
    startTransition(() => moveStage(applicationId, next, dispositionReason));
  }

  return (
    <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
      <select
        value={stage}
        disabled={pending}
        aria-label="Pipeline stage"
        onChange={(e) => {
          const next = e.target.value;
          if (next === "rejected") {
            setAskReason(true);
          } else {
            commit(next);
          }
        }}
        className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ring-inset transition-opacity duration-150 focus:outline-none ${
          STAGE_STYLE[stage] ?? STAGE_STYLE.applied
        } ${pending ? "opacity-50" : ""}`}
      >
        {STAGES.map((s) => (
          <option key={s} value={s} className="bg-surface text-ink capitalize">
            {s}
          </option>
        ))}
      </select>

      {askReason && (
        <div
          role="dialog"
          aria-label="Reason for declining"
          className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-line bg-surface p-3 shadow-lift"
        >
          <p className="mb-2 text-xs font-semibold text-ink">Reason for declining</p>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${inputBase} mb-2 text-sm capitalize`}
          >
            {DISPOSITION_REASONS.map((r) => (
              <option key={r} value={r} className="bg-surface text-ink">
                {r}
              </option>
            ))}
          </select>
          {reason === "Other" && (
            <input
              autoFocus
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder="Short reason (recorded)"
              className={`${inputBase} mb-2 text-sm`}
            />
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className={`${btnGhost} px-2 py-1 text-xs`}
              onClick={() => {
                setAskReason(false);
                setOtherReason("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`${btnPrimary} px-3 py-1 text-xs`}
              disabled={reason === "Other" && !otherReason.trim()}
              onClick={() => {
                const finalReason = reason === "Other" ? otherReason.trim() : reason;
                setAskReason(false);
                setOtherReason("");
                commit("rejected", finalReason);
              }}
            >
              Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

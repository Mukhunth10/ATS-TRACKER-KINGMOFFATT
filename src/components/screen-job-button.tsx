"use client";

import { useActionState } from "react";
import { screenJob, type ActionState } from "@/app/actions";
import { btnSecondary } from "./ui";

/**
 * Agentic batch screen: screens every unscreened candidate on the role in one
 * click. The autonomous "evaluate the whole shortlist" step — slow on a local
 * model, so it runs candidates one at a time and reports the tally.
 */
export function ScreenJobButton({
  jobId,
  pendingCount,
  provider,
}: {
  jobId: string;
  pendingCount: number;
  provider: "local" | "claude";
}) {
  const action = screenJob.bind(null, jobId);
  const [state, formAction, running] = useActionState<ActionState>(action, {});

  if (pendingCount === 0 && !state.ok) return null;

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <button type="submit" disabled={running} className={btnSecondary}>
        {running
          ? `Screening ${pendingCount}…`
          : `Screen all ${pendingCount} with ${provider === "local" ? "local AI" : "Claude"}`}
      </button>
      {running && (
        <span className="text-xs text-ink-muted">
          Running one at a time — this can take a while.
        </span>
      )}
      {state.error && <span className="text-sm text-danger">{state.error}</span>}
      {state.ok && !running && <span className="text-sm text-success">{state.ok}</span>}
    </form>
  );
}

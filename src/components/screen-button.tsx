"use client";

import { useActionState } from "react";
import { screenWithAi, type ActionState } from "@/app/actions";
import { btnPrimary } from "./ui";

export function ScreenButton({
  applicationId,
  alreadyScored,
  provider,
}: {
  applicationId: string;
  alreadyScored: boolean;
  provider: "local" | "claude" | "none";
}) {
  const action = screenWithAi.bind(null, applicationId);
  const [state, formAction, pending] = useActionState<ActionState>(action, {});

  const label = provider === "local" ? "local AI" : "Claude";

  return (
    <form action={formAction} className="space-y-2">
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending
          ? "Reading the CV…"
          : alreadyScored
            ? `Re-screen with ${label}`
            : `Screen with ${label}`}
      </button>
      {pending && (
        <p className="text-center text-xs text-ink-muted">
          {provider === "local"
            ? "Your local model is reading the whole CV. On CPU this can take a minute or two."
            : "Claude is reading the whole CV against the rubric. This takes 20–60 seconds."}
        </p>
      )}
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && !pending && <p className="text-sm text-success">{state.ok}</p>}
    </form>
  );
}

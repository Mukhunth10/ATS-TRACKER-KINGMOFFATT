"use client";

import { useActionState, useRef } from "react";
import { changeOwnPassword, type PasswordState } from "./actions";
import { btnPrimary, inputBase } from "@/components/ui";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<PasswordState, FormData>(
    async (prev, fd) => {
      const res = await changeOwnPassword(prev, fd);
      if (res.ok) formRef.current?.reset();
      return res;
    },
    {},
  );

  return (
    <form ref={formRef} action={action} className="max-w-sm space-y-4">
      <div>
        <label htmlFor="current" className="mb-1.5 block text-sm font-medium">
          Current password
        </label>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className={inputBase}
        />
      </div>
      <div>
        <label htmlFor="next" className="mb-1.5 block text-sm font-medium">
          New password
        </label>
        <input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className={inputBase}
        />
        <p className="mt-1 text-xs text-ink-subtle">At least 8 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className={inputBase}
        />
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-danger-border ring-inset">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success ring-1 ring-success-border ring-inset">
          {state.ok}
        </p>
      )}

      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}

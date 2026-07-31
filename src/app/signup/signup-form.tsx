"use client";

import { useActionState } from "react";
import { btnPrimary, inputBase } from "@/components/ui";
import { signup, type SignupState } from "./actions";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<SignupState, FormData>(signup, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="code" className="mb-1.5 block text-sm font-medium">
          Invite code
        </label>
        <input
          id="code"
          name="code"
          required
          autoFocus
          placeholder="Given to you by your admin"
          className={inputBase}
        />
      </div>

      <div>
        <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
          Full name
        </label>
        <input id="name" name="name" required autoComplete="name" className={inputBase} />
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          placeholder="you@company.com"
          className={inputBase}
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
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

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}

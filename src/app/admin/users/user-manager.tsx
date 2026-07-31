"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createUser,
  resetPassword,
  setRole,
  setDisabled,
  type AdminState,
} from "./actions";
import { btnPrimary, btnSecondary, btnGhost, inputBase } from "@/components/ui";

interface Row {
  id: string;
  name: string;
  email: string;
  role: string;
  disabled: boolean;
}

/** Copyable one-time password panel. */
function TempPassword({ pw }: { pw: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-success-border bg-success-soft p-2">
      <code className="flex-1 font-mono text-sm text-ink">{pw}</code>
      <button
        type="button"
        className={`${btnSecondary} px-2 py-1 text-xs`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(pw);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* field is selectable as a fallback */
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function UserManager({
  users,
  currentUserId,
}: {
  users: Row[];
  currentUserId: string;
}) {
  const [createState, createAction, creating] = useActionState<AdminState, FormData>(
    createUser,
    {},
  );
  const [pending, startTransition] = useTransition();
  // Temp password + message per row, from reset/role/disable actions.
  const [rowMsg, setRowMsg] = useState<Record<string, AdminState>>({});

  const run = (userId: string, fn: () => Promise<AdminState>) =>
    startTransition(async () => {
      const res = await fn();
      setRowMsg((m) => ({ ...m, [userId]: res }));
    });

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
        <p className="mb-3 text-sm font-medium">Add a team member</p>
        <form action={createAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input name="name" placeholder="Full name" required className={inputBase} />
          <input
            name="email"
            type="email"
            placeholder="name@company.com"
            required
            className={inputBase}
          />
          <select name="role" defaultValue="recruiter" className={inputBase}>
            <option value="recruiter">Recruiter</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={creating} className={btnPrimary}>
            {creating ? "Creating…" : "Create"}
          </button>
        </form>
        {createState.error && (
          <p className="mt-2 text-sm text-danger">{createState.error}</p>
        )}
        {createState.ok && (
          <div className="mt-2">
            <p className="text-sm text-success">{createState.ok}</p>
            {createState.tempPassword && <TempPassword pw={createState.tempPassword} />}
          </div>
        )}
      </div>

      {/* List */}
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const msg = rowMsg[u.id];
          return (
            <li key={u.id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {u.name}
                    {isSelf && <span className="ml-2 text-xs text-ink-subtle">(you)</span>}
                    {u.disabled && (
                      <span className="ml-2 rounded bg-danger-soft px-1.5 py-0.5 text-2xs font-medium text-danger ring-1 ring-danger-border ring-inset">
                        disabled
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-ink-muted">{u.email}</p>
                </div>

                {/* Role */}
                <select
                  value={u.role}
                  disabled={isSelf || pending}
                  onChange={(e) => run(u.id, () => setRole(u.id, e.target.value))}
                  aria-label={`Role for ${u.name}`}
                  className={`${inputBase} w-auto py-1.5 text-sm capitalize disabled:opacity-60`}
                >
                  <option value="recruiter">Recruiter</option>
                  <option value="admin">Admin</option>
                </select>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(u.id, () => resetPassword(u.id))}
                  className={`${btnSecondary} px-3 py-1.5 text-sm`}
                >
                  Reset password
                </button>

                {!isSelf && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => run(u.id, () => setDisabled(u.id, !u.disabled))}
                    className={`${btnGhost} px-3 py-1.5 text-sm ${
                      u.disabled ? "text-success" : "text-danger"
                    }`}
                  >
                    {u.disabled ? "Enable" : "Disable"}
                  </button>
                )}
              </div>

              {msg?.error && <p className="mt-2 text-sm text-danger">{msg.error}</p>}
              {msg?.ok && (
                <div className="mt-2">
                  <p className="text-sm text-success">{msg.ok}</p>
                  {msg.tempPassword && <TempPassword pw={msg.tempPassword} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";
import { createJob, type ActionState } from "@/app/actions";
import { SKILLS, CATEGORY_LABELS, type SkillCategory } from "@/lib/bim-taxonomy";

const GROUPED = Object.entries(
  SKILLS.reduce<Record<string, typeof SKILLS>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {}),
) as [SkillCategory, typeof SKILLS][];

const field =
  "w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

export function NewRoleForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createJob, {});

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
      >
        New role
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgb(15_23_42_/_0.5)] p-3 sm:p-6">
      <div className="my-auto w-full max-w-2xl rounded-xl bg-surface shadow-modal">
        <div className="flex items-center justify-between border-b border-line px-4 py-4 sm:px-6">
          <h2 className="font-semibold">New role</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-sm text-ink-muted hover:text-ink"
          >
            Close
          </button>
        </div>

        <form action={formAction} className="space-y-4 px-4 py-5 sm:px-6">
          <div>
            <label className="mb-1 block text-sm font-medium">Title</label>
            <input
              name="title"
              required
              placeholder="Senior Revit API Developer"
              className={field}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Track</label>
              <input name="track" placeholder="Revit API / C#" className={field} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Location</label>
              <input name="location" placeholder="Chennai (Hybrid)" className={field} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Seniority</label>
              <select name="seniority" defaultValue="mid" className={field}>
                <option value="junior">Junior</option>
                <option value="mid">Mid</option>
                <option value="senior">Senior</option>
                <option value="lead">Lead</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Minimum years</label>
              <input
                name="minYears"
                type="number"
                min={0}
                max={40}
                defaultValue={3}
                className={field}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Description</label>
            <textarea
              name="description"
              rows={3}
              placeholder="What this person will actually build."
              className={field}
            />
          </div>

          <div className="rounded-md border border-line p-3">
            <p className="mb-1 text-sm font-medium">Your own keywords</p>
            <p className="mb-3 text-xs text-ink-muted">
              Type anything — one per line. Works for any construction role, not just
              BIM. Use <code className="rounded bg-surface-2 px-1">|</code> to list
              alternative spellings, e.g.{" "}
              <code className="rounded bg-surface-2 px-1">Primavera P6 | P6</code>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-success">
                  Must have
                </label>
                <textarea
                  name="customMustHave"
                  rows={5}
                  placeholder={"Primavera P6 | P6\nquantity takeoff\nRCC detailing"}
                  className={`${field} font-mono text-xs`}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-muted">
                  Nice to have
                </label>
                <textarea
                  name="customNiceToHave"
                  rows={5}
                  placeholder={"NEBOSH\nFIDIC\nSAP2000"}
                  className={`${field} font-mono text-xs`}
                />
              </div>
            </div>
          </div>

          <div className="rounded-md border border-line p-3">
            <p className="mb-1 text-sm font-medium">Built-in BIM library</p>
            <p className="mb-3 text-xs text-ink-muted">
              Optional. Pre-weighted BIM/software skills — ignore this section entirely
              for non-BIM roles.
            </p>
            <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
              {GROUPED.map(([category, skills]) => (
                <div key={category}>
                  <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                    {CATEGORY_LABELS[category]}
                  </p>
                  <div className="space-y-1">
                    {skills.map((s) => (
                      <div key={s.key} className="flex items-center gap-3 text-sm">
                        <span className="flex-1 truncate">{s.label}</span>
                        <label className="flex items-center gap-1 text-xs text-ink-muted">
                          <input type="checkbox" name="mustHave" value={s.key} />
                          must
                        </label>
                        <label className="flex items-center gap-1 text-xs text-ink-muted">
                          <input type="checkbox" name="niceToHave" value={s.key} />
                          nice
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          {state.ok && <p className="text-sm text-success">{state.ok}</p>}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-4 py-2 text-sm text-ink-muted hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

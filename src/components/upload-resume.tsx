"use client";

import { useActionState, useState } from "react";
import { uploadResume, type ActionState } from "@/app/actions";

const field =
  "w-full rounded-md border border-line-strong px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary";

/** Common intake channels worldwide. Free text, so any unlisted portal works. */
const SOURCES = [
  "LinkedIn",
  "Indeed",
  "Careers page",
  "Referral",
  "Agency",
  "Email",
  "Glassdoor",
  "Dice",
  "direct",
];

export function UploadResume({ jobId }: { jobId: string }) {
  const action = uploadResume.bind(null, jobId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const [count, setCount] = useState(0);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium">CVs</label>
        <input
          type="file"
          name="resume"
          accept=".pdf,.docx,.txt,.md"
          multiple
          required
          onChange={(e) => setCount(e.target.files?.length ?? 0)}
          className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-fg hover:file:bg-primary-hover"
        />
        <p className="mt-1.5 text-xs text-ink-muted">
          Select many at once. PDF, DOCX, TXT or MD. Scanned image PDFs will not parse.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Came from</label>
        <input
          name="source"
          list="source-options"
          defaultValue="LinkedIn"
          placeholder="LinkedIn, Indeed, jobs.ie…"
          className={field}
        />
        <datalist id="source-options">
          {SOURCES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {count <= 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-muted hover:text-ink">
            Override parsed contact details
          </summary>
          <div className="mt-2 space-y-2">
            <input name="name" placeholder="Full name" className={field} />
            <input name="email" type="email" placeholder="Email" className={field} />
          </div>
        </details>
      )}

      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">{state.ok}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-50"
      >
        {pending
          ? `Parsing and scoring ${count || ""} CV${count === 1 ? "" : "s"}…`
          : count > 1
            ? `Import ${count} CVs`
            : "Add candidate"}
      </button>
    </form>
  );
}

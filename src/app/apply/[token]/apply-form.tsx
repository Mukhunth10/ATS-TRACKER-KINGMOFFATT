"use client";

import { useState } from "react";
import { btnPrimary, inputBase } from "@/components/ui";

/**
 * The public application form. It uploads the CV via a plain fetch to the API
 * route rather than a Server Action, because Server Actions carrying a file
 * fail ALPN negotiation over HTTP/2 (through the tunnel/host). A normal
 * multipart POST is reliable everywhere.
 */
export function ApplyForm({ token }: { token: string }) {
  const [fileName, setFileName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);

    // XHR rather than fetch: it's the same reliable path the recorder uses for
    // uploads, and it avoids a headless/HTTP-2 negotiation quirk that can hit a
    // multipart fetch.
    const body = new FormData(e.currentTarget);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/apply/${token}`);
    xhr.onload = () => {
      setPending(false);
      let data: { ok?: string; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* fall through to generic message */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        setDone(data.ok || "Your application has been received.");
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    };
    xhr.onerror = () => {
      setPending(false);
      setError("Couldn't submit — please check your connection and try again.");
    };
    xhr.send(body);
  }

  if (done) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success ring-1 ring-success-border">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
            <path d="M5 13l4 4L19 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="font-medium text-ink">Application received</p>
        <p className="mt-1 text-sm text-ink-muted">{done}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Full name <span className="text-danger">*</span>
          </label>
          <input id="name" name="name" required autoComplete="name" className={inputBase} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email <span className="text-danger">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={inputBase}
          />
        </div>
      </div>

      <div>
        <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
          Phone <span className="text-ink-subtle">(optional)</span>
        </label>
        <input id="phone" name="phone" type="tel" autoComplete="tel" className={inputBase} />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Your CV <span className="text-danger">*</span>
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-line-strong bg-surface-2 px-3 py-3 text-sm hover:border-primary">
          <span className={fileName ? "text-ink" : "text-ink-subtle"}>
            {fileName || "Choose a PDF, DOCX, TXT or MD file"}
          </span>
          <span className="rounded-md bg-surface px-2 py-1 text-xs font-medium ring-1 ring-line-strong">
            Browse
          </span>
          <input
            type="file"
            name="cv"
            required
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            className="hidden"
          />
        </label>
      </div>

      <label className="flex cursor-pointer items-start gap-2.5">
        <input type="checkbox" name="consent" value="1" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" />
        <span className="text-sm text-ink-muted">
          I consent to my details and CV being processed to consider me for this role, as
          described in the privacy note below.
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-danger-border ring-inset">
          {error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${btnPrimary} w-full`}>
        {pending ? "Submitting…" : "Submit application"}
      </button>
    </form>
  );
}

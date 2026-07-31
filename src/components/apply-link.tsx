"use client";

import { useState, useTransition } from "react";
import { setApplyOpen } from "@/app/actions";
import { btnSecondary, inputBase } from "./ui";

/**
 * The recruiter's control for a role's public "Apply" page: the shareable link
 * to paste into a job ad, plus a switch to stop accepting applications without
 * breaking the link.
 */
export function ApplyLinkPanel({
  jobId,
  token,
  open,
}: {
  jobId: string;
  token: string;
  open: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(open);
  const [pending, startTransition] = useTransition();

  // Full public URL, correct whether on localhost or a deployed host.
  const link = typeof window !== "undefined" ? `${window.location.origin}/apply/${token}` : "";

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">
        Share this link on job ads or LinkedIn. Candidates upload their own CV and land
        straight in this pipeline as “careers page”.
      </p>
      <div className="flex items-center gap-2">
        <input readOnly value={link} className={`${inputBase} font-mono text-xs`} />
        <button
          type="button"
          className={`${btnSecondary} shrink-0`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
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

      <label className="flex items-center justify-between gap-3 text-sm">
        <span className="text-ink-muted">
          {isOpen ? "Accepting applications" : "Applications closed"}
        </span>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const next = !isOpen;
              setIsOpen(next);
              await setApplyOpen(jobId, next);
            })
          }
          role="switch"
          aria-checked={isOpen}
          aria-label="Accept applications"
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            isOpen ? "bg-primary" : "bg-line-strong"
          } ${pending ? "opacity-60" : ""}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              isOpen ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </label>
    </div>
  );
}

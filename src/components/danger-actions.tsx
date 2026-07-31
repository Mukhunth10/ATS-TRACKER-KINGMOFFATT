"use client";

import { useState, useTransition } from "react";
import { deleteCandidate, deleteRecording } from "@/app/actions";

/**
 * GDPR data-subject actions. Destructive, so each needs an explicit confirm —
 * erasure is irreversible and must not happen on a stray click.
 */
export function DangerActions({
  candidateId,
  candidateName,
  hasRecording,
  applicationId,
}: {
  candidateId: string;
  candidateName: string;
  hasRecording: boolean;
  applicationId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingRec, setConfirmingRec] = useState(false);

  return (
    <div className="space-y-3">
      {hasRecording && (
        <div>
          {confirmingRec ? (
            <div className="space-y-2 rounded-lg border border-danger-border bg-danger-soft p-3">
              <p className="text-sm text-danger">
                Delete this candidate's recording and clear its consent record? This can't
                be undone.
              </p>
              <div className="flex gap-2">
                <button
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteRecording(applicationId);
                      setConfirmingRec(false);
                    })
                  }
                  className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Deleting…" : "Delete recording"}
                </button>
                <button
                  onClick={() => setConfirmingRec(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-hover"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingRec(true)}
              className="text-sm text-ink-muted hover:text-danger"
            >
              Delete recording (withdraw consent)
            </button>
          )}
        </div>
      )}

      <div>
        {confirmingDelete ? (
          <div className="space-y-2 rounded-lg border border-danger-border bg-danger-soft p-3">
            <p className="text-sm text-danger">
              Permanently delete <strong>{candidateName}</strong> and all their data —
              every application, note, assessment and recording, across all roles? This
              fulfils a right-to-erasure request and cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteCandidate(candidateId);
                  })
                }
                className="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete everything"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:bg-surface-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-sm text-ink-muted hover:text-danger"
          >
            Delete candidate &amp; all data
          </button>
        )}
      </div>
    </div>
  );
}

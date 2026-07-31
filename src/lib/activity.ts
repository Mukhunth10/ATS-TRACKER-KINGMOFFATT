import { prisma } from "./db";
import { emitJobChange } from "./events";

/**
 * Records one line of process history and, in the same breath, nudges anyone
 * watching that job's live stream. Every meaningful action goes through here, so
 * the audit trail and the real-time board stay in step.
 */
export async function logActivity(a: {
  jobId?: string | null;
  applicationId?: string | null;
  actor: string;
  type: string;
  detail: string;
}): Promise<void> {
  await prisma.activity.create({
    data: {
      jobId: a.jobId ?? null,
      applicationId: a.applicationId ?? null,
      actor: a.actor,
      type: a.type,
      detail: a.detail,
    },
  });
  emitJobChange(a.jobId ?? null);
}

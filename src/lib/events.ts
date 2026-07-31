import { EventEmitter } from "node:events";

/**
 * In-process event bus for real-time updates.
 *
 * When a mutation happens (someone moves a candidate, a screening finishes), we
 * emit the affected job id; SSE connections subscribed to that job push a nudge
 * to the browser, which re-fetches. This is the collaborative "live pipeline"
 * that makes the tool feel like Workday's real-time board.
 *
 * Honest limit: this bus lives in one Node process, so it works on a single
 * server (which is how this app is deployed). Running multiple instances behind
 * a load balancer would need a shared pub/sub (e.g. Redis) — not required at
 * this scale, but that's the line where this pattern stops working as-is.
 *
 * Survives Next.js dev hot-reload by hanging off globalThis.
 */
const globalForBus = globalThis as unknown as { atsBus?: EventEmitter };

export const bus =
  globalForBus.atsBus ??
  (() => {
    const e = new EventEmitter();
    // Many SSE clients may subscribe; lift the default 10-listener warning cap.
    e.setMaxListeners(1000);
    return e;
  })();

if (process.env.NODE_ENV !== "production") globalForBus.atsBus = bus;

/** Notify anyone watching this job that its data changed. */
export function emitJobChange(jobId: string | null | undefined): void {
  if (jobId) bus.emit(`job:${jobId}`, Date.now());
}

/**
 * In-process login throttle — brute-force protection with no dependencies.
 *
 * Tracks failed attempts per key (we key by email AND by client IP) in a sliding
 * window. Too many failures inside the window locks that key for a cool-off. A
 * successful login clears the key.
 *
 * Honest limit: this state lives in one Node process, which is exactly how this
 * app is deployed (a single instance). Behind a load balancer you'd move this to
 * a shared store (Redis). Also, it's a throttle, not a CAPTCHA — it raises the
 * cost of guessing a lot without ever locking a legitimate user out for long.
 */

const MAX_FAILURES = 5; // failures allowed inside the window before locking
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCK_MS = 15 * 60 * 1000; // lock duration once tripped

interface Entry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

const globalForLimiter = globalThis as unknown as { atsLoginLimiter?: Map<string, Entry> };
const store: Map<string, Entry> = globalForLimiter.atsLoginLimiter ?? new Map();
if (process.env.NODE_ENV !== "production") globalForLimiter.atsLoginLimiter = store;

// Opportunistic cleanup so the map can't grow forever on a long-lived process.
function sweep(now: number) {
  if (store.size < 5000) return;
  for (const [k, e] of store) {
    if (e.lockedUntil < now && now - e.windowStart > WINDOW_MS) store.delete(k);
  }
}

/** Is this key currently allowed to attempt a login? */
export function checkThrottle(key: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const e = store.get(key);
  if (e && e.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((e.lockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Record a failed attempt; locks the key once it crosses the threshold. */
export function noteFailure(key: string): void {
  const now = Date.now();
  sweep(now);
  const e = store.get(key);

  if (!e || now - e.windowStart > WINDOW_MS) {
    store.set(key, { failures: 1, windowStart: now, lockedUntil: 0 });
    return;
  }

  e.failures += 1;
  if (e.failures >= MAX_FAILURES) {
    e.lockedUntil = now + LOCK_MS;
    e.failures = 0;
    e.windowStart = now;
  }
}

/** A successful login clears any accumulated failures for these keys. */
export function noteSuccess(...keys: string[]): void {
  for (const k of keys) store.delete(k);
}

/** Human-friendly cool-off text for the UI. */
export function retryAfterText(seconds: number): string {
  const mins = Math.ceil(seconds / 60);
  return mins <= 1 ? "a minute" : `${mins} minutes`;
}

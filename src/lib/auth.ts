import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "ats_session";
// Long-lived so staff sign in once and then just open the app — the cookie is
// persistent (survives closing the browser). Sign out (or an admin disabling the
// account) revokes it immediately. Shorten this if you want tighter re-auth.
const SESSION_DAYS = 30;

/**
 * scrypt from Node's standard library — deliberately chosen over bcrypt/argon2
 * so there is no native module to compile. Native deps are the usual reason a
 * Windows install fails, and this tool has to be installable by whoever
 * inherits it.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;

  const derived = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(key, "hex");

  // Length check first: timingSafeEqual throws on a length mismatch.
  if (expected.length !== derived.length) return false;
  // Constant-time compare so response timing cannot leak the hash.
  return timingSafeEqual(expected, derived);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

/** Issues a session row and sets the cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({ data: { token, userId, expiresAt } });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true, // not readable from JavaScript, so XSS cannot steal it
    sameSite: "lax", // blocks the cookie on cross-site POSTs (CSRF)
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Returns the signed-in user, or null. Expired sessions are deleted on sight
 * rather than merely rejected, so the table cannot grow without bound.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // A disabled account is treated as signed-out, and its sessions are cleared so
  // an admin disabling someone takes effect on their next request.
  if (session.user.disabled) {
    await prisma.session.deleteMany({ where: { userId: session.user.id } }).catch(() => {});
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;

  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  jar.delete(SESSION_COOKIE);
}

/**
 * Guard for Server Actions and API routes.
 *
 * The route guard in proxy.ts is not sufficient on its own: Server Actions are
 * reachable by direct POST and API routes by direct fetch, so every entry point
 * must check for itself. Throwing rather than returning null means a forgotten
 * check fails closed.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not authenticated");
  return user;
}

/**
 * Guard for pages. Redirects to /login instead of throwing.
 *
 * Every data page calls this. A route guard alone is not enough — during
 * development this app served the full candidate list anonymously because the
 * guard file sat in the wrong directory and silently never ran. Pages that
 * check for themselves cannot fail that way.
 */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Server-Action/API admin guard. Throws for non-admins (fails closed). */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("Admins only");
  return user;
}

/** Page admin guard. Sends non-admins back to the dashboard rather than 500. */
export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

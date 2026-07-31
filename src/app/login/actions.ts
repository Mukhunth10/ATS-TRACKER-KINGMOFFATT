"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, destroySession } from "@/lib/auth";
import { checkThrottle, noteFailure, noteSuccess, retryAfterText } from "@/lib/rate-limit";

export type LoginState = { error?: string };

/** Best-effort client IP from the proxy headers (Render/cloudflared set these). */
async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  // Throttle by email and by IP — either being locked stops the attempt, so a
  // guesser can't spread the load across many emails from one machine.
  const ip = await clientIp();
  const emailKey = `email:${email}`;
  // Only throttle by IP when we actually have one (behind a proxy/tunnel). On
  // direct access with no forwarded header every request looks like "unknown",
  // so throttling that shared bucket would lock everyone out at once.
  const keys = ip && ip !== "unknown" ? [emailKey, `ip:${ip}`] : [emailKey];
  for (const key of keys) {
    const { allowed, retryAfterSec } = checkThrottle(key);
    if (!allowed) {
      return {
        error: `Too many attempts. Try again in ${retryAfterText(retryAfterSec)}.`,
      };
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });

  // Deliberately identical message whether the email is unknown or the password
  // is wrong — distinguishing them lets an attacker enumerate valid accounts.
  const invalid = { error: "Incorrect email or password." };
  if (!user) {
    keys.forEach(noteFailure);
    return invalid;
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    keys.forEach(noteFailure);
    return invalid;
  }

  if (user.disabled) {
    return { error: "This account has been disabled. Contact your administrator." };
  }

  noteSuccess(...keys);
  await createSession(user.id);

  // redirect throws a control-flow exception, so nothing after it runs.
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

import { NextResponse } from "next/server";
import { getSessionUser } from "./auth";

/**
 * Guard for API route handlers.
 *
 * Returns a 401 Response when there is no valid session, or null to continue.
 * Routes return a status rather than throwing, so an API client gets a usable
 * 401 instead of an opaque 500.
 *
 * Usage at the top of every handler:
 *   const denied = await denyAnonymous();
 *   if (denied) return denied;
 */
export async function denyAnonymous(): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return null;
}

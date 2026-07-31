import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * First line of defence: bounce anonymous visitors to /login before a page
 * renders. In Next.js 16 this file is `proxy.ts` exporting `proxy` — the
 * `middleware.ts` / `middleware` naming was removed.
 *
 * This only checks that a session cookie EXISTS; it does not validate it,
 * because the proxy runs before the database is reachable in some deployments.
 * Real validation happens in every page, Server Action and API route via
 * requireUser(). Treat this as a redirect for humans, not as the security
 * boundary.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Login page and Next's own assets must stay reachable, or the user can never
  // get far enough to sign in.
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    // Candidates have no account. The assessment page (and its submit action,
    // which POSTs to the same /assess/<token> path) authenticates by the secret
    // token in the URL, not a session cookie, so it must stay reachable. The
    // recording-upload API under /api/assess/<token> is token-gated the same way.
    pathname.startsWith("/assess") ||
    pathname.startsWith("/api/assess") ||
    // Public "Apply" page: candidates upload their CV via a per-role token in
    // the URL. The submit action POSTs to this same /apply/<token> path, so it
    // must stay reachable without a session.
    pathname.startsWith("/apply") ||
    pathname.startsWith("/api/apply") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.get(SESSION_COOKIE)) {
    // API callers get a 401 rather than an HTML redirect they cannot follow.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except static assets and image optimisation.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

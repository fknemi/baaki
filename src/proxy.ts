import { NextRequest, NextResponse } from "next/server";

// Verified: this matches the cookie set by /api/auth/demo and /api/auth/session
const SESSION_COOKIE = "baaki_session";

/** Publicly reachable without a session. */
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/", // email-link, reset, verify
  "/pay/", // customer payment links
  "/print/", // public A4 documents
  "/api/auth/", // session / logout / me
  "/api/pay/", // customer link backend
  "/api/cron/", // cron jobs use CRON_SECRET, not session
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/") return NextResponse.next();

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasCookie = req.cookies.has(SESSION_COOKIE);

  if (!hasCookie) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
        { status: 401 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Cookie present — pass pathname via header so (app)/layout can preserve
  // ?next=<path> if the session turns out to be stale.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.woff2?$).*)",
  ],
};

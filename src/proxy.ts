import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "baaki_session";

/** Publicly reachable without a session. Everything else requires auth. */
const PUBLIC_PREFIXES = [
  "/",                      // landing page
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/",                 // email-link, reset, verify
  "/pay/",                  // customer payment links
  "/print/",                // public A4 documents
  "/api/auth/",             // session / logout / me
  "/api/pay/",              // customer link backend
  "/api/cron/",             // cron jobs use CRON_SECRET, not session
];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Exact match for "/" — landing is public
  if (pathname === "/") return NextResponse.next();

  // Any prefix match → public
  if (PUBLIC_PREFIXES.some((p) => p !== "/" && pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Everything else requires a session cookie
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.woff2?$).*)",
  ],
};

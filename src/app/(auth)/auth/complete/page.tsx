"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/auth/friendly-error";

/**
 * Resolve post-auth destination, preferring:
 *   1. ?next= on this URL (rare for /auth/complete but possible)
 *   2. localStorage.nextAfterAuth (saved by login page's handleEmailLink)
 *   3. /dashboard (fallback — never "/" which is the marketing landing)
 * Only same-origin absolute paths are allowed — open-redirect guard.
 */
function resolveNext(): string {
  if (typeof window === "undefined") return "/dashboard";

  const isValid = (p: string | null | undefined): p is string =>
    !!p && p.startsWith("/") && !p.startsWith("//");

  const fromUrl = new URLSearchParams(window.location.search).get("next");
  if (isValid(fromUrl)) return fromUrl;

  const fromStorage = window.localStorage.getItem("nextAfterAuth");
  window.localStorage.removeItem("nextAfterAuth");
  if (isValid(fromStorage)) return fromStorage;

  return "/dashboard";
}

export default function CompletePage() {
  const router = useRouter();
  const ran = useRef(false);
  const [status, setStatus] = useState("Verifying link…");
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const finish = useCallback(
    async (emailToUse: string) => {
      try {
        await signInWithEmailLink(
          getFirebaseAuth(),
          emailToUse,
          window.location.href,
        );
        window.localStorage.removeItem("emailForSignIn");
        setStatus("Signed in. Redirecting…");
        router.push(resolveNext());
        router.refresh();
      } catch (e) {
        const code = (e as { code?: string })?.code ?? "";
        setError(friendlyError(code));
      }
    },
    [router],
  );

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!isSignInWithEmailLink(getFirebaseAuth(), window.location.href)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount check; ref-guarded so it cannot re-trigger
      setStatus("This is not a valid sign-in link.");
      return;
    }

    const stored = window.localStorage.getItem("emailForSignIn");
    if (stored) {
      finish(stored);
    } else {
      // Link opened on a different device/browser.
      setNeedEmail(true);
      setStatus("Confirm the email this link was sent to.");
    }
  }, [finish]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Card className="w-full max-w-sm space-y-4 p-6">
        <p className="text-sm">{status}</p>

        {needEmail && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              finish(email);
            }}
          >
            <Input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" className="w-full">
              Complete sign-in
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}

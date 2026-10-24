"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase";

/**
 * Resolve the post-auth destination, preferring (in order):
 *   1. ?next= from the current URL (immediate intent)
 *   2. localStorage.nextAfterAuth (email-link flow persists it before leaving origin)
 *   3. /dashboard (fallback)
 * Only same-origin absolute paths are allowed — guards against open redirects.
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

export function SessionBridge() {
  const router = useRouter();

  useEffect(() => {
    const unsub = onIdTokenChanged(getFirebaseAuth(), async (user) => {
      if (!user) return;
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        if (res.ok) {
          router.replace(resolveNext());
          router.refresh();
        }
      } catch (err) {
        console.error("Session exchange failed:", err);
      }
    });
    return unsub;
  }, [router]);

  return null;
}

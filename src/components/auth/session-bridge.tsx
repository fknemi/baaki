"use client";

import { useEffect } from "react";
import { onIdTokenChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import { getFirebaseAuth } from "@/lib/firebase";

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
        if (res.ok) router.replace("/dashboard");
      } catch (err) {
        console.error("Session exchange failed:", err);
      }
    });
    return unsub;
  }, [router]);

  return null;
}

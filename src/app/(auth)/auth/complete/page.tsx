"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isSignInWithEmailLink, signInWithEmailLink } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function CompletePage() {
  const router = useRouter();
  const ran = useRef(false); // guards React Strict Mode double-run
  const [status, setStatus] = useState("Verifying link…");
  const [needEmail, setNeedEmail] = useState(false);
  const [email, setEmail] = useState("");

  async function finish(emailToUse: string) {
    try {
      await signInWithEmailLink(auth, emailToUse, window.location.href);
      window.localStorage.removeItem("emailForSignIn");
      setStatus("Signed in. Redirecting…");
      router.push("/");
    } catch (e: any) {
      setStatus(`Sign-in failed: ${e.code ?? e.message}`);
    }
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!isSignInWithEmailLink(auth, window.location.href)) {
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
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-sm p-6 space-y-4">
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

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { applyActionCode } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<VerifyFallback />}>
        <VerifyEmailForm />
      </Suspense>
    </main>
  );
}

function VerifyFallback() {
  return (
    <Card className="w-full max-w-sm p-6">
      <p className="text-muted-foreground text-sm">Verifying your email…</p>
    </Card>
  );
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");
  const ran = useRef(false);

  const [status, setStatus] = useState<"verifying" | "success" | "invalid">("verifying");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!oobCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount check; oobCode never changes mid-mount
      setStatus("invalid");
      return;
    }

    applyActionCode(getFirebaseAuth(), oobCode)
      .then(() => {
        getFirebaseAuth().currentUser?.reload();
        setStatus("success");
        sessionStorage.setItem("auth-flash", "Email verified! You're all set.");
        setTimeout(() => router.push("/"), 2000);
      })
      .catch(() => {
        setStatus("invalid");
      });
  }, [oobCode, router]);

  if (status === "verifying") return <VerifyFallback />;

  if (status === "success") {
    return (
      <Card className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-semibold">Email verified!</h1>
        <p className="text-muted-foreground text-sm">
          Your email has been verified. Redirecting you now…
        </p>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm space-y-4 p-6">
      <h1 className="text-xl font-semibold">Link invalid or expired</h1>
      <p className="text-muted-foreground text-sm">
        This verification link has already been used or has expired.
      </p>
      <Link href="/">
        <Button className="w-full">Go to app</Button>
      </Link>
    </Card>
  );
}

"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/auth/friendly-error";
import { useEffect, useState } from "react";

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={<ResetPasswordFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}

function ResetPasswordFallback() {
  return (
    <Card className="w-full max-w-sm p-6">
      <p className="text-muted-foreground text-sm">Verifying link…</p>
    </Card>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get("oobCode");

  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"verifying" | "ready" | "invalid">("verifying");

  useEffect(() => {
    if (!oobCode) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount check; oobCode never changes mid-mount
      setStatus("invalid");
      return;
    }
    verifyPasswordResetCode(getFirebaseAuth(), oobCode)
      .then((resolvedEmail) => {
        setEmail(resolvedEmail);
        setStatus("ready");
      })
      .catch(() => {
        setStatus("invalid");
      });
  }, [oobCode]);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await confirmPasswordReset(getFirebaseAuth(), oobCode!, password);
      sessionStorage.setItem("auth-flash", "Password updated. Sign in with your new password.");
      router.push("/login");
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      setError(friendlyError(code));
    } finally {
      setBusy(false);
    }
  }

  if (status === "verifying") return <ResetPasswordFallback />;

  if (status === "invalid") {
    return (
      <Card className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-xl font-semibold">Link invalid or expired</h1>
        <p className="text-muted-foreground text-sm">
          This reset link has already been used or has expired.
        </p>
        <Link href="/forgot-password">
          <Button className="w-full">Request a new link</Button>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Set new password</h1>
        <Link href="/login" className="text-muted-foreground text-xs underline">
          Back to sign in
        </Link>
      </div>

      {email && (
        <p className="text-muted-foreground text-sm">
          Setting a new password for <strong>{email}</strong>.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="password"
          required
          minLength={6}
          placeholder="New password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          type="password"
          required
          minLength={6}
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <Button type="submit" className="w-full" disabled={busy}>
          Update password
        </Button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </Card>
  );
}

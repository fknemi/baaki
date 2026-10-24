"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  signInWithPopup,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function friendlyError(code: string): string {
  switch (code) {
    case "auth/email-already-in-use":
      return "That email is already registered. Sign in instead.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection.";
    default:
      return "Something went wrong. Try again.";
  }
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
      router.push("/");
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      setError(friendlyError(code));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim() });
      }
      await sendEmailVerification(cred.user, {
        url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      });
      await signOut(getFirebaseAuth());
      sessionStorage.setItem(
        "auth-flash",
        "Account created! Check your email to verify your address.",
      );
      router.push("/login");
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      setError(friendlyError(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Create account</h1>
          <Link href="/login" className="text-muted-foreground text-xs underline">
            Have an account?
          </Link>
        </div>

        <Button className="w-full" onClick={handleGoogle} disabled={busy}>
          Continue with Google
        </Button>

        <div className="text-muted-foreground text-center text-xs">or</div>

        <form onSubmit={handleSignUp} className="space-y-3">
          <Input
            placeholder="Your name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            required
            minLength={6}
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            Create account
          </Button>
        </form>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </Card>
    </main>
  );
}

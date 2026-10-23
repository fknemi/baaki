"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function friendlyError(code: string): string {
    switch (code) {
        case "auth/invalid-email":
            return "That doesn't look like a valid email address.";
        case "auth/user-not-found":
            return "No account found with that email.";
        case "auth/too-many-requests":
            return "Too many attempts. Wait a minute and try again.";
        case "auth/network-request-failed":
            return "Network error. Check your connection.";
        default:
            return "Something went wrong. Try again.";
    }
}

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit(ev: React.FormEvent) {
        ev.preventDefault();
        setError(null);
        setBusy(true);
        try {
            await sendPasswordResetEmail(auth, email, {
                url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
                handleCodeInApp: true,
            });
            setSent(true);
        } catch (e: any) {
            setError(friendlyError(e.code));
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <Card className="w-full max-w-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">Reset password</h1>
                    <Link href="/login" className="text-xs text-muted-foreground underline">
                        Back to sign in
                    </Link>
                </div>

                {sent ? (
                    <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                            We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link to set a new password.
                        </p>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => { setSent(false); setEmail(""); }}
                        >
                            Send another link
                        </Button>
                        <Link href="/login">
                            <Button className="w-full">Back to sign in</Button>
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Enter your email and we'll send you a link to reset your password.
                        </p>
                        <Input
                            type="email"
                            required
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <Button type="submit" className="w-full" disabled={busy}>
                            Send reset link
                        </Button>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </form>
                )}
            </Card>
        </main>
    );
}

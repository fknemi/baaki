"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/auth/friendly-error";
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

            await sendPasswordResetEmail(getFirebaseAuth(), email, {
                url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
                handleCodeInApp: true,
            });
            setSent(true);
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
                    <h1 className="text-xl font-semibold">Reset password</h1>
                    <Link href="/login" className="text-muted-foreground text-xs underline">
                        Back to sign in
                    </Link>
                </div>

                {sent ? (
                    <div className="space-y-4">
                        <p className="text-muted-foreground text-sm">
                            We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow
                            the link to set a new password.
                        </p>
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                                setSent(false);
                                setEmail("");
                            }}
                        >
                            Send another link
                        </Button>
                        <Link href="/login">
                            <Button className="w-full">Back to sign in</Button>
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-3">
                        <p className="text-muted-foreground text-sm">
                            Enter your email and we&apos;ll send you a link to reset your password.
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

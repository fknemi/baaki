"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function friendlyError(code: string): string {
    switch (code) {
        case "auth/expired-action-code":
            return "This reset link has expired. Request a new one.";
        case "auth/invalid-action-code":
            return "This reset link is invalid or already used. Request a new one.";
        case "auth/weak-password":
            return "Password must be at least 6 characters.";
        case "auth/network-request-failed":
            return "Network error. Check your connection.";
        default:
            return "Something went wrong. Try again.";
    }
}

export default function ResetPasswordPage() {
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
            setStatus("invalid");
            return;
        }
        verifyPasswordResetCode(auth, oobCode)
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
            await confirmPasswordReset(auth, oobCode!, password);
            sessionStorage.setItem("auth-flash", "Password updated. Sign in with your new password.");
            router.push("/login");
        } catch (e: any) {
            setError(friendlyError(e.code));
        } finally {
            setBusy(false);
        }
    }

    if (status === "verifying") {
        return (
            <main className="min-h-screen flex items-center justify-center p-6">
                <Card className="w-full max-w-sm p-6">
                    <p className="text-sm text-muted-foreground">Verifying link…</p>
                </Card>
            </main>
        );
    }

    if (status === "invalid") {
        return (
            <main className="min-h-screen flex items-center justify-center p-6">
                <Card className="w-full max-w-sm p-6 space-y-4">
                    <h1 className="text-xl font-semibold">Link invalid or expired</h1>
                    <p className="text-sm text-muted-foreground">
                        This reset link has already been used or has expired.
                    </p>
                    <Link href="/forgot-password">
                        <Button className="w-full">Request a new link</Button>
                    </Link>
                </Card>
            </main>
        );
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <Card className="w-full max-w-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">Set new password</h1>
                    <Link href="/login" className="text-xs text-muted-foreground underline">
                        Back to sign in
                    </Link>
                </div>

                {email && (
                    <p className="text-sm text-muted-foreground">
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
        </main>
    );
}

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
import { auth, googleProvider } from "@/lib/firebase";
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
            await signInWithPopup(auth, googleProvider);
            router.push("/");
        } catch (e: any) {
            setError(friendlyError(e.code));
        } finally {
            setBusy(false);
        }
    }

    async function handleSignUp(ev: React.FormEvent) {
        ev.preventDefault();
        setError(null);
        setBusy(true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, password);
            if (name.trim()) {
                await updateProfile(cred.user, { displayName: name.trim() });
            }
            await sendEmailVerification(cred.user, {
                url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
            });
            await signOut(auth);
            sessionStorage.setItem("auth-flash", "Account created! Check your email to verify your address.");
            router.push("/login");
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
                    <h1 className="text-xl font-semibold">Create account</h1>
                    <Link href="/login" className="text-xs text-muted-foreground underline">
                        Have an account?
                    </Link>
                </div>

                <Button className="w-full" onClick={handleGoogle} disabled={busy}>
                    Continue with Google
                </Button>

                <div className="text-center text-xs text-muted-foreground">or</div>

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

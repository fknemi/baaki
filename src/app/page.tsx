"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, sendEmailVerification, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";

export default function Home() {
    const router = useRouter();
    const [user, setUser] = useState<User | null | undefined>(undefined);
    const [verificationSent, setVerificationSent] = useState(false);
    const [dismissedBanner, setDismissedBanner] = useState(false);

    useEffect(() => onAuthStateChanged(auth, setUser), []);

    useEffect(() => {
        if (user === null) router.push("/login");
    }, [user, router]);

    async function resendVerification() {
        if (!user) return;
        await sendEmailVerification(user, {
            url: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
        });
        setVerificationSent(true);
    }

    if (user === undefined) return <p className="p-8">Loading…</p>;
    if (user === null) return null;

    const showBanner = !user.emailVerified && !dismissedBanner;

    return (
        <main className="p-8 space-y-4">
            {showBanner && (
                <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
                    <span>
                        {verificationSent
                            ? "Verification email sent! Check your inbox."
                            : "Please verify your email address to secure your account."}
                    </span>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                        {!verificationSent && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="border-yellow-400 text-yellow-800 hover:bg-yellow-100 h-7 text-xs"
                                onClick={resendVerification}
                            >
                                Resend email
                            </Button>
                        )}
                        <button
                            className="text-yellow-600 hover:text-yellow-900 text-lg leading-none"
                            onClick={() => setDismissedBanner(true)}
                            aria-label="Dismiss"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <p>
                    Signed in as {user.email}
                    {user.emailVerified && (
                        <span className="ml-2 text-xs text-green-600">✓ Verified</span>
                    )}
                </p>
                <SignOutButton />
            </div>
        </main>
    );
}

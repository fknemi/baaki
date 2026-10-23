"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { applyActionCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function VerifyEmailPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const oobCode = searchParams.get("oobCode");
    const ran = useRef(false);

    const [status, setStatus] = useState<"verifying" | "success" | "invalid">("verifying");

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;

        if (!oobCode) {
            setStatus("invalid");
            return;
        }

        applyActionCode(auth, oobCode)
            .then(() => {
                // Reload the user so emailVerified updates
                auth.currentUser?.reload();
                setStatus("success");
                sessionStorage.setItem("auth-flash", "Email verified! You're all set.");
                setTimeout(() => router.push("/"), 2000);
            })
            .catch(() => {
                setStatus("invalid");
            });
    }, [oobCode, router]);

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <Card className="w-full max-w-sm p-6 space-y-4">
                {status === "verifying" && (
                    <p className="text-sm text-muted-foreground">Verifying your email…</p>
                )}

                {status === "success" && (
                    <>
                        <h1 className="text-xl font-semibold">Email verified!</h1>
                        <p className="text-sm text-muted-foreground">
                            Your email has been verified. Redirecting you now…
                        </p>
                    </>
                )}

                {status === "invalid" && (
                    <>
                        <h1 className="text-xl font-semibold">Link invalid or expired</h1>
                        <p className="text-sm text-muted-foreground">
                            This verification link has already been used or has expired.
                        </p>
                        <Link href="/">
                            <Button className="w-full">Go to app</Button>
                        </Link>
                    </>
                )}
            </Card>
        </main>
    );
}

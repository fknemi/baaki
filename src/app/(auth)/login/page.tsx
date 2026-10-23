"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    signInWithPopup,
    sendSignInLinkToEmail,
    signInWithEmailAndPassword,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const actionCodeSettings = {
    url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/complete`,
    handleCodeInApp: true,
};

function friendlyError(code: string): string {
    switch (code) {
        case "auth/invalid-email":
            return "That doesn't look like a valid email address.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Email or password is incorrect.";
        case "auth/too-many-requests":
            return "Too many attempts. Wait a minute and try again.";
        case "auth/network-request-failed":
            return "Network error. Check your connection.";
        case "auth/invalid-phone-number":
            return "That phone number doesn't look valid. Include the country code (e.g. +1).";
        case "auth/invalid-verification-code":
            return "Invalid code. Please check and try again.";
        case "auth/code-expired":
            return "That code expired. Request a new one.";
        case "auth/captcha-check-failed":
            return "Captcha check failed. Refresh and try again.";
        default:
            return "Something went wrong. Try again.";
    }
}

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [linkSent, setLinkSent] = useState(false);
    const [busy, setBusy] = useState(false);

    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [confirmationResult, setConfirmationResult] =
        useState<ConfirmationResult | null>(null);
    const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        const flash = sessionStorage.getItem("auth-flash");
        if (flash) {
            setSuccess(flash);
            sessionStorage.removeItem("auth-flash");
        }
    }, []);

    function clear() {
        setError(null);
        setSuccess(null);
        setLinkSent(false);
    }

    async function handleGoogle() {
        clear();
        setBusy(true);
        try {
            await signInWithPopup(auth, googleProvider);
            router.push("/");
        } catch (e: any) {
            console.error("GOOGLE AUTH ERROR:", e.code, e.message);
            setError(friendlyError(e.code));
        } finally {
            setBusy(false);
        }
    }

    async function handleSignIn(ev: React.FormEvent) {
        ev.preventDefault();
        clear();
        setBusy(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push("/");
        } catch (e: any) {
            setError(friendlyError(e.code));
        } finally {
            setBusy(false);
        }
    }

    async function handleEmailLink() {
        if (!email) {
            setError("Enter your email above first.");
            return;
        }
        clear();
        setBusy(true);
        try {
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            window.localStorage.setItem("emailForSignIn", email);
            setLinkSent(true);
        } catch (e: any) {
            setError(friendlyError(e.code));
        } finally {
            setBusy(false);
        }
    }

    async function handleSendOtp() {
        if (!phone) {
            setError("Enter a phone number with country code (e.g., +15555550100).");
            return;
        }
        clear();
        setBusy(true);

        try {
            if (!recaptchaRef.current) {
                recaptchaRef.current = new RecaptchaVerifier(
                    auth,
                    "recaptcha-container",
                    { size: "invisible" }
                );
            }

            const result = await signInWithPhoneNumber(
                auth,
                phone,
                recaptchaRef.current
            );
            setConfirmationResult(result);
            setOtpSent(true);
            setSuccess("OTP sent! Check your phone.");
        } catch (e: any) {
            console.error("SMS AUTH ERROR:", e.code, e.message);
            setError(friendlyError(e.code));
        } finally {
            setBusy(false);
        }
    }

    async function handleVerifyOtp(ev: React.FormEvent) {
        ev.preventDefault();
        if (!confirmationResult || !otp) return;

        clear();
        setBusy(true);

        try {
            await confirmationResult.confirm(otp);
            router.push("/");
        } catch (e: any) {
            console.error("OTP VERIFY ERROR:", e.code, e.message);
            setError(friendlyError(e.code));
        } finally {
            setBusy(false);
        }
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <Card className="w-full max-w-sm p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">Sign in</h1>
                    <Link href="/signup" className="text-xs text-muted-foreground underline">
                        Need an account?
                    </Link>
                </div>

                {success && <p className="text-sm text-green-600">{success}</p>}

                <Button className="w-full" onClick={handleGoogle} disabled={busy}>
                    Continue with Google
                </Button>

                <div className="text-center text-xs text-muted-foreground">or</div>

                <form onSubmit={handleSignIn} className="space-y-3">
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
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button type="submit" className="w-full" disabled={busy}>
                        Sign in
                    </Button>
                </form>

                <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground underline w-full text-center block"
                >
                    Forgot password?
                </Link>

                <div className="text-center text-xs text-muted-foreground">
                    or sign in without a password
                </div>

                {linkSent ? (
                    <p className="text-sm text-center">
                        Check <strong>{email}</strong> for a sign-in link.
                    </p>
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleEmailLink}
                        disabled={busy}
                    >
                        Email me a sign-in link
                    </Button>
                )}

                <div className="text-center text-xs text-muted-foreground">
                    or sign in with SMS
                </div>

                {!otpSent ? (
                    <div className="space-y-3">
                        <Input
                            type="tel"
                            placeholder="+1 555 555 0100"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            onClick={handleSendOtp}
                            disabled={busy}
                        >
                            Send OTP
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleVerifyOtp} className="space-y-3">
                        <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Enter 6-digit code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            maxLength={6}
                        />
                        <Button type="submit" className="w-full" disabled={busy}>
                            Verify & Sign In
                        </Button>
                    </form>
                )}

                {/* Required container for Firebase reCAPTCHA */}
                <div id="recaptcha-container"></div>

                {error && <p className="text-sm text-red-600">{error}</p>}
            </Card>
        </main>
    );
}

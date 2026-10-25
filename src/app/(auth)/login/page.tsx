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
import { getFirebaseAuth, getGoogleProvider } from "@/lib/firebase";
import { friendlyError } from "@/lib/auth/friendly-error";

const actionCodeSettings = {
  url: `${process.env.NEXT_PUBLIC_APP_URL}/auth/complete`,
  handleCodeInApp: true,
};

// ─── outline icons ───────────────────────────────────────────────────────────

function IconArrowRight({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconCheck({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── shared styles ───────────────────────────────────────────────────────────

const fieldSurface =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]";

const PRIMARY_BTN =
  "flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] px-4 py-3 text-sm font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50";

const SECONDARY_BTN =
  "flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-4 py-3 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50";

const DIVIDER = "flex-1 border-t border-white/10";

/**
 * Read the `next` query param, validated to prevent open redirects.
 * Falls back to /dashboard when absent or malformed.
 */
function readNext(): string {
  if (typeof window === "undefined") return "/dashboard";
  const n = new URLSearchParams(window.location.search).get("next");
  // Only allow same-origin absolute paths (starts with single "/")
  if (!n || !n.startsWith("/") || n.startsWith("//")) return "/dashboard";
  return n;
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
      sessionStorage.removeItem("auth-flash");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount read
      setSuccess(flash);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (cancelled || !r.ok) return;
        const j = await r.json();
        if (j?.data?.business?.id) {
          window.location.href = readNext();
        }
      } catch {
        /* no session — show the form */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function clear() {
    setError(null);
    setSuccess(null);
    setLinkSent(false);
  }

  async function handleDemoLogin() {
    clear();
    setBusy(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Demo login failed");
      }
      router.push(readNext());
      router.refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Demo login failed";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    clear();
    setBusy(true);
    try {
      await signInWithPopup(getFirebaseAuth(), getGoogleProvider());
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      const message = (e as { message?: string })?.message ?? "";
      console.error("GOOGLE AUTH ERROR:", code, message);
      setError(friendlyError(code));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(ev: React.FormEvent) {
    ev.preventDefault();
    clear();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      setError(friendlyError(code));
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
      // Persist the post-auth destination so /auth/complete can honour it
      // after the user clicks the emailed link.
      if (typeof window !== "undefined") {
        window.localStorage.setItem("nextAfterAuth", readNext());
      }
      await sendSignInLinkToEmail(getFirebaseAuth(), email, actionCodeSettings);
      window.localStorage.setItem("emailForSignIn", email);
      setLinkSent(true);
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      setError(friendlyError(code));
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
          getFirebaseAuth(),
          "recaptcha-container",
          { size: "invisible" },
        );
      }
      const result = await signInWithPhoneNumber(
        getFirebaseAuth(),
        phone,
        recaptchaRef.current,
      );
      setConfirmationResult(result);
      setOtpSent(true);
      setSuccess("OTP sent. Check your phone.");
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      const message = (e as { message?: string })?.message ?? "";
      console.error("SMS AUTH ERROR:", code, message);
      setError(friendlyError(code));
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
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      const message = (e as { message?: string })?.message ?? "";
      console.error("OTP VERIFY ERROR:", code, message);
      setError(friendlyError(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-5 rounded-xl border border-white/10 bg-[#192221] p-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-white">Sign in</h1>
          <Link
            href="/signup"
            className="text-xs text-white underline underline-offset-4"
          >
            Need an account?
          </Link>
        </div>

        {success && (
          <p className="flex items-center gap-1.5 text-sm text-white">
            <IconCheck className="h-3.5 w-3.5 shrink-0 text-[#4ADE80]" />
            {success}
          </p>
        )}

        {/* Demo button — top of the card, most prominent */}
        <div className="space-y-2">
          <button
            type="button"
            className={PRIMARY_BTN}
            onClick={handleDemoLogin}
            disabled={busy}
          >
            Try as Sharma Packaging
            <IconArrowRight />
          </button>
          <p className="text-center text-xs text-white italic">
            One-tap demo · no phone number required
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={DIVIDER} />
          <span className="text-xs text-white italic">or sign in properly</span>
          <div className={DIVIDER} />
        </div>

        <button
          type="button"
          className={SECONDARY_BTN}
          onClick={handleGoogle}
          disabled={busy}
        >
          Continue with Google
        </button>

        <div className="text-center text-xs text-white italic">or</div>

        <form onSubmit={handleSignIn} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldSurface}
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={fieldSurface}
          />
          <button type="submit" className={PRIMARY_BTN} disabled={busy}>
            Sign in
          </button>
        </form>

        <Link
          href="/forgot-password"
          className="block w-full text-center text-xs text-white underline underline-offset-4"
        >
          Forgot password?
        </Link>

        <div className="text-center text-xs text-white italic">
          or sign in without a password
        </div>

        {linkSent ? (
          <p className="text-center text-sm text-white">
            Check <strong>{email}</strong> for a sign-in link.
          </p>
        ) : (
          <button
            type="button"
            className={SECONDARY_BTN}
            onClick={handleEmailLink}
            disabled={busy}
          >
            Email me a sign-in link
          </button>
        )}

        <div className="text-center text-xs text-white italic">
          or sign in with SMS
        </div>

        {!otpSent ? (
          <div className="space-y-3">
            <input
              type="tel"
              placeholder="+91 98XXX XXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={fieldSurface}
            />
            <button
              type="button"
              className={SECONDARY_BTN}
              onClick={handleSendOtp}
              disabled={busy}
            >
              Send OTP
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-3">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter 6-digit code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              maxLength={6}
              className={fieldSurface}
            />
            <button type="submit" className={PRIMARY_BTN} disabled={busy}>
              Verify &amp; Sign In
            </button>
          </form>
        )}

        {/* Required container for Firebase reCAPTCHA */}
        <div id="recaptcha-container"></div>

        {error && <p className="text-sm text-[#FF9B8F]">{error}</p>}
      </div>
    </main>
  );
}

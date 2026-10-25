"use client";

import { signOut } from "firebase/auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getFirebaseAuth } from "@/lib/firebase";

export function SignOutButton() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSignOut() {
        if (busy) return;
        setBusy(true);
        setError(null);

        // 1. Clear the server session FIRST — the baaki_session cookie
        //    is the source of truth for every getSession() call across
        //    the app. If we skip this, /api/auth/me keeps returning 200
        //    and the login page bounces the user straight back.
        try {
            const res = await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin",
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message ?? "Sign out failed");
            }
        } catch (e) {
            // Do NOT navigate on failure — the cookie is still valid,
            // so /login would just bounce back to /dashboard. Stay
            // put, surface the error, let the user retry.
            const msg = e instanceof Error ? e.message : "Sign out failed";
            // eslint-disable-next-line no-console
            console.error("SIGN OUT ERROR:", e);
            setError(msg);
            setBusy(false);
            return;
        }

        // 2. Clear the Firebase client session. Best-effort — the
        //    server cookie is already gone, so a Firebase failure here
        //    can't leave the user signed in to the app.
        try {
            await signOut(getFirebaseAuth());
        } catch {
            /* ignore */
        }

        // 3. Clear leftover auth hints in localStorage so a stale
        //    post-auth destination doesn't hijack the next login.
        try {
            window.localStorage.removeItem("nextAfterAuth");
            window.localStorage.removeItem("emailForSignIn");
        } catch {
            /* ignore */
        }

        // 4. HARD navigate — a fresh document request forces the server
        //    to re-render /login against the now-cleared cookie. It also
        //    destroys all client state, which is what actually fixes
        //    the mobile-menu case: body{overflow:hidden} gets reset,
        //    the fullscreen overlay unmounts, and the new page renders
        //    cleanly.
        //
        //    `location.replace` (not `assign`) keeps /login out of the
        //    back-button history — pressing Back after sign-out won't
        //    return to the (now-unauthenticated) dashboard.
        window.location.replace("/login");
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={busy}
            title={error ?? undefined}
        >
            {busy ? "Signing out…" : "Sign out"}
        </Button>
    );
}

"use client";

import { useState } from "react";

export function ResetDemoButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reset() {
    if (
      !window.confirm(
        "Reset demo? This clears all data and restores the pristine seed. You will be signed out.",
      )
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Reset failed");

      // Reseed wiped sessions — get a fresh demo session
      await fetch("/api/auth/demo", { method: "POST" });
      window.location.href = "/dashboard";
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Reset failed");
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={reset}
        disabled={busy}
        className="mt-2 rounded-lg border border-[#FDA29B] bg-[#FEF3F2] px-3 py-2 text-xs font-medium text-[#B42318] hover:bg-[#FEE4E2] disabled:opacity-50"
      >
        {busy ? "Resetting…" : "Reset demo"}
      </button>
      {err && <p className="mt-2 text-xs text-[#B42318]">{err}</p>}
    </>
  );
}

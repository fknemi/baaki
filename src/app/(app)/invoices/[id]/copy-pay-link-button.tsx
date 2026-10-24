"use client";

import { useState } from "react";

export function CopyPayLinkButton({ invoiceId }: { invoiceId: string }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pay-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Failed to create pay link");
      const url: string = j.data.url;

      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Fallback for HTTP on LAN IP where navigator.clipboard is blocked.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title={error ?? undefined}
      className="rounded-lg bg-white px-4 py-3 text-center text-sm font-medium ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA] disabled:opacity-50"
    >
      {busy ? "Creating…" : copied ? "✓ Copied" : "📋 Copy pay link"}
    </button>
  );
}

"use client";

import { useState } from "react";

// ─── outline icons ───────────────────────────────────────────────────────────

function IconCopy({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
      className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-4 text-center text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50"
    >
      {busy ? (
        "Creating…"
      ) : copied ? (
        <>
          <IconCheck />
          Copied
        </>
      ) : (
        <>
          <IconCopy />
          Copy pay link
        </>
      )}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── outline icons ───────────────────────────────────────────────────────────

function IconRupee({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="M6 13h3a6 6 0 0 0 6-6" />
      <path d="M6 13h3a6 6 0 0 1 6 6v2" />
    </svg>
  );
}

const fieldSurface =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]";

export function MarkPaidButton({
  invoiceId,
  outstandingRupees,
}: {
  invoiceId: string;
  outstandingRupees: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(outstandingRupees);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const rupees = Number(amount);
      if (!Number.isFinite(rupees) || rupees <= 0) {
        throw new Error("Enter a positive amount.");
      }
      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          amountPaise: Math.round(rupees * 100),
          reference: reference.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Could not record payment");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    // self-start: without this, an open form below the trigger makes this
    // grid cell taller than its siblings, and in a 2-column grid row
    // (items are stretched by default) that extra height can pull the
    // neighboring button's wrapper taller even though the button itself
    // didn't change. self-start pins this cell to the top of its row so
    // only the trigger button participates in row-height matching.
    <div className="self-start">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-4 text-sm font-medium text-white hover:bg-white/5"
      >
        <IconRupee />
        Record payment
      </button>

      {open && (
        <form
          onSubmit={submit}
          className="mt-2 space-y-2 rounded-lg border border-white/10 bg-[#171717]/20 p-3"
        >
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount ₹"
            className={fieldSurface}
            required
          />
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference (TXN1234, optional)"
            className={fieldSurface}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#0F5C4E] py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
          >
            {busy ? "Recording…" : "Confirm payment"}
          </button>
          {error && <p className="text-xs text-[#FF9B8F]">{error}</p>}
        </form>
      )}
    </div>
  );
}

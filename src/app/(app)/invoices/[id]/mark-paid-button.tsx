"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
      >
        ₹ Record payment
      </button>

      {open && (
        <form
          onSubmit={submit}
          className="mt-2 space-y-2 rounded-lg bg-white p-3 ring-1 ring-[#E4E7EC]"
        >
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount ₹"
            className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm"
            required
          />
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Reference (TXN1234, optional)"
            className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-[#0F5C4E] py-2 text-sm font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
          >
            {busy ? "Recording…" : "Confirm payment"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}

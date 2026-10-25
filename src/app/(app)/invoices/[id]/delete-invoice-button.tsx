"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteInvoiceButton({
  invoiceId,
  invoiceNumber,
}: {
  invoiceId: string;
  invoiceNumber: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Delete failed");
      router.push("/invoices");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-[#B42318]/60 bg-[#B42318]/10 px-4 text-sm font-medium text-[#FF9B8F] hover:bg-[#B42318]/20"
      >
        Delete invoice
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-[#B42318]/60 bg-[#B42318]/10 p-3">
      <p className="text-xs text-white">
        Delete <span className="font-mono font-semibold">{invoiceNumber}</span>?
        This cancels the invoice — the number stays in the serial and the
        cancellation is recorded in the timeline.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={deleting}
          className="flex-1 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50"
        >
          Keep
        </button>
        <button
          type="button"
          onClick={doDelete}
          disabled={deleting}
          className="flex-1 rounded-lg bg-[#B42318] px-3 py-2 text-xs font-medium text-white hover:bg-[#B42318]/90 disabled:opacity-50"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[#FF9B8F]">{error}</p>}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─── outline icons ───────────────────────────────────────────────────────────
// Capped at h-4 (16px) — same fix as the rest of the action grid.

const ICON_STD =
  "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

function IconRupee({ className = ICON_STD }: { className?: string }) {
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

// fieldSurface scales the box AND the text inside together. The control's
// height comes from py-* + text-* + line-height, not a fixed h-*, so the
// input chrome and its text both grow in lockstep at every breakpoint —
// the exact bug flagged for input groups.
const fieldSurface =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark] " +
  "sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm " +
  "md:rounded-xl md:px-3.5 md:py-2.5 md:text-base " +
  "lg:rounded-xl lg:px-4 lg:py-3 lg:text-base " +
  "xl:rounded-xl xl:px-4 xl:py-3 xl:text-lg";

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
    <>
      {/* self-start keeps this trigger pinned to the top of its grid cell.
          The form now lives in a portal (shadcn Dialog), so it can never
          grow this cell — but self-start still keeps the button aligned
          with its row siblings when another cell in the row is taller. */}
      <div className="self-start">
        <button
          onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-center text-sm font-medium text-white hover:bg-white/5 sm:h-11 sm:gap-1.5 sm:rounded-lg sm:px-4 sm:text-sm md:h-12 md:gap-2 md:rounded-xl md:px-4 md:text-base lg:h-12 lg:gap-2 lg:rounded-xl lg:px-5 lg:text-base xl:h-14 xl:gap-2.5 xl:rounded-xl xl:px-6 xl:text-lg"
        >
          <IconRupee />
          Record payment
        </button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          // Clear any stale error from a previous attempt when reopening.
          if (v) setError(null);
        }}
      >
        <DialogContent className="bg-[#192221]! sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-xl">
          <DialogHeader>
            <DialogTitle className="font-sans text-sm sm:text-base md:text-lg lg:text-lg xl:text-xl">
              Record payment
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={submit}
            className="space-y-2 md:space-y-2.5 lg:space-y-3 xl:space-y-3.5"
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
              className="h-9 w-full rounded-lg bg-[#0F5C4E] text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 sm:h-9 sm:rounded-lg sm:text-sm md:h-10 md:rounded-xl md:text-sm lg:h-11 lg:rounded-xl lg:text-base xl:h-12 xl:rounded-xl xl:text-base"
            >
              {busy ? "Recording…" : "Confirm payment"}
            </button>
            {error && (
              <p className="text-xs text-[#FF9B8F] sm:text-xs md:text-sm lg:text-sm xl:text-base">
                {error}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

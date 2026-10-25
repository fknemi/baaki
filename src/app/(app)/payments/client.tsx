"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";
import { StuckBox } from "@/components/domain/stuck-box";

type Proposal = {
  invoiceIds: string[];
  confidence: number;
  flags: string[];
  reason: string;
  split?: number[];
};

type LineRow = {
  lineId: string;
  line: { date: string; description: string; creditPaise: number; ref: string };
  lineHash: string;
  proposals: Proposal[];
  recommended: Proposal | null;
};

type ImportResponse = {
  lines: LineRow[];
  summary: { totalLines: number; matched: number; needsReview: number; duplicates: number };
};

type ConfirmedPayment = {
  id: string;
  amountPaise: number;
  paidOn: string;
  reference: string | null;
  invoiceId: string | null;
  invoiceNumber: string | null;
  customerName: string | null;
};

type OpenInvoice = {
  id: string;
  number: string;
  customerName: string | null;
  outstandingPaise: number;
  dueDate?: string;
};

const FLAG_LABEL: Record<string, string> = {
  part: "Part payment",
  multi: "Covers 2 invoices",
  tdsShortfall: "Possibly TDS — ask for certificate",
  overpayment: "Overpayment",
  unmatched: "Unmatched",
  duplicate: "Duplicate",
};

const FLAG_CLASS: Record<string, string> = {
  part: "border border-[#2563EB]/40 bg-[#2563EB]/10 text-white",
  multi: "border border-[#2563EB]/40 bg-[#2563EB]/10 text-white",
  tdsShortfall: "border border-[#F59E0B]/40 bg-[#F59E0B]/10 text-white",
  overpayment: "border border-[#EF4444]/40 bg-[#EF4444]/10 text-white",
  unmatched: "border border-[#EF4444]/40 bg-[#EF4444]/10 text-white",
  duplicate: "border border-white/10 bg-white/5 text-white",
};

// ─── outline icons ───────────────────────────────────────────────────────────
// Shared ladders. Both capped at 16 px (h-4) on lg/xl so the glyph never
// overpowers the h-11 → h-14 buttons and text-base → text-lg labels it
// sits inside.

const ICON_UPLOAD =
  "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";
const ICON_STD =
  "h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4";

function IconUpload({ className = ICON_UPLOAD }: { className?: string }) {
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
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function IconCheck({ className = ICON_STD }: { className?: string }) {
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

function IconClose({ className = ICON_STD }: { className?: string }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── shared button styles ────────────────────────────────────────────────────

// Hero upload label — full-width CTA. Height and text scale with the page.
const PRIMARY =
  "flex w-full items-center justify-center font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 " +
  "h-11 gap-1.5 rounded-lg bg-[#0F5C4E] px-3 text-sm " +
  "sm:h-11 sm:gap-1.5 sm:rounded-lg sm:px-4 sm:text-sm " +
  "md:h-12 md:gap-2 md:rounded-xl md:px-4 md:text-base " +
  "lg:h-12 lg:gap-2 lg:rounded-xl lg:px-5 lg:text-base " +
  "xl:h-14 xl:gap-2.5 xl:rounded-xl xl:px-6 xl:text-lg";

// Small inline action (Ignore, Change match, Confirm in proposals).
const SECONDARY =
  "flex items-center justify-center font-medium text-white hover:bg-white/5 disabled:opacity-50 " +
  "h-7 gap-1 rounded-lg border border-white/10 bg-[#171717]/20 px-2 text-[10px] " +
  "sm:h-8 sm:gap-1 sm:rounded-lg sm:px-2.5 sm:text-xs " +
  "md:h-9 md:gap-1.5 md:rounded-lg md:px-3 md:text-xs " +
  "lg:h-9 lg:gap-1.5 lg:rounded-lg lg:px-3 lg:text-sm " +
  "xl:h-10 xl:gap-2 xl:rounded-lg xl:px-3.5 xl:text-sm";

// Confirm button inside a proposal (green, louder than SECONDARY).
const CONFIRM_BTN =
  "flex items-center justify-center font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 " +
  "h-7 rounded-lg bg-[#0F5C4E] px-2.5 text-[10px] " +
  "sm:h-8 sm:rounded-lg sm:px-3 sm:text-xs " +
  "md:h-9 md:rounded-lg md:px-3 md:text-xs " +
  "lg:h-9 lg:rounded-lg lg:px-3.5 lg:text-sm " +
  "xl:h-10 xl:rounded-lg xl:px-4 xl:text-sm";

// Card chrome scales radius with the page.
const CARD =
  "rounded-lg border border-white/10 sm:rounded-xl md:rounded-xl lg:rounded-2xl xl:rounded-2xl";

// Every scrollable list uses this pair so the scrollbar doesn't butt
// against the card border.
const SCROLL = "overflow-y-auto pr-1 sm:pr-1 md:pr-1.5 lg:pr-2 xl:pr-2";

export function PaymentsClient() {
  const [data, setData] = useState<ImportResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedPayment[] | null>(null);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(new Set());
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());
  const [changeMatchFor, setChangeMatchFor] = useState<LineRow | null>(null);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[] | null>(null);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  async function reloadConfirmed() {
    const res = await fetch("/api/payments");
    if (!res.ok) {
      setConfirmed([]);
      return;
    }
    const json = await res.json();
    setConfirmed(json.data ?? []);
  }

  useEffect(() => {
    // reloadConfirmed is an async callback — setState fires after its
    // internal awaits, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reloadConfirmed();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const csvText = await file.text();
      const res = await fetch("/api/payments/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Import failed");
      }
      const json = await res.json();
      setData(json.data);
      setConfirmedIds(new Set());
      setIgnoredIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function confirmLine(row: LineRow, proposal: Proposal) {
    setBusy(true);
    setError(null);
    try {
      if (!proposal.split && proposal.invoiceIds.length > 1) {
        throw new Error("Matcher returned a multi-invoice proposal without a split.");
      }
      const finalSplits = proposal.split ?? [row.line.creditPaise];

      const res = await fetch("/api/payments/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": row.lineHash,
        },
        body: JSON.stringify({
          lineHash: row.lineHash,
          line: row.line,
          invoiceIds: proposal.invoiceIds,
          splitAmountsPaise: finalSplits,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Confirm failed");
      }
      setConfirmedIds((prev) => new Set(prev).add(row.lineId));
      await reloadConfirmed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    } finally {
      setBusy(false);
    }
  }

  function ignoreLine(row: LineRow) {
    setIgnoredIds((prev) => new Set(prev).add(row.lineId));
  }

  async function openChangeMatch(row: LineRow) {
    setChangeMatchFor(row);
    if (openInvoices === null) {
      setLoadingInvoices(true);
      try {
        const res = await fetch("/api/invoices?status=sent,part_paid");
        if (res.ok) {
          const json = await res.json();
          setOpenInvoices(json.data ?? []);
        } else {
          setOpenInvoices([]);
        }
      } catch {
        setOpenInvoices([]);
      } finally {
        setLoadingInvoices(false);
      }
    }
  }

  async function pickInvoice(row: LineRow, invoiceId: string) {
    setChangeMatchFor(null);
    await confirmLine(row, {
      invoiceIds: [invoiceId],
      confidence: 1,
      flags: [],
      reason: "Manual match",
    });
  }

  const hasTds = data?.lines.some((r) => r.proposals.some((p) => p.flags.includes("tdsShortfall")));

  const visibleLines = data?.lines.filter((r) => !ignoredIds.has(r.lineId)) ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl space-y-3 px-3 pb-24 pt-14 sm:space-y-4 sm:px-4 sm:pt-16 md:space-y-4 md:px-6 md:pt-20 lg:space-y-5 lg:px-8 lg:pt-24 xl:space-y-5 xl:pt-24">
      <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
        Payments
      </h1>

      <label className={`cursor-pointer ${PRIMARY}`}>
        {busy ? (
          "Processing…"
        ) : (
          <>
            <IconUpload />
            Import bank statement (CSV)
          </>
        )}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
          disabled={busy}
        />
      </label>

      {error && (
        <p className="text-xs text-[#FF9B8F] sm:text-sm md:text-sm lg:text-base xl:text-base">
          {error}
        </p>
      )}

      {data && (
        <div className="rounded-lg border border-white/10 p-2.5 text-xs sm:rounded-xl sm:p-3 sm:text-xs md:rounded-xl md:p-4 md:text-sm lg:rounded-2xl lg:p-4 lg:text-sm xl:rounded-2xl xl:p-5 xl:text-base">
          <div className="grid grid-cols-4 gap-2 text-center sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
            <div>
              <div className="font-semibold text-white text-base sm:text-lg md:text-lg lg:text-xl xl:text-2xl">
                {data.summary.totalLines}
              </div>
              <div className="italic text-white">
                lines
              </div>
            </div>
            <div>
              <div className="font-semibold text-[#4ADE80] text-base sm:text-lg md:text-lg lg:text-xl xl:text-2xl">
                {data.summary.matched}
              </div>
              <div className="italic text-white">
                matched
              </div>
            </div>
            <div>
              <div className="font-semibold text-[#FBBF24] text-base sm:text-lg md:text-lg lg:text-xl xl:text-2xl">
                {data.summary.needsReview}
              </div>
              <div className="italic text-white">
                review
              </div>
            </div>
            <div>
              <div className="font-semibold text-white text-base sm:text-lg md:text-lg lg:text-xl xl:text-2xl">
                {data.summary.duplicates}
              </div>
              <div className="italic text-white">
                dup.
              </div>
            </div>
          </div>
        </div>
      )}

      {hasTds && (
        <StuckBox>
          A shortfall of exactly 2% of the taxable value usually means the customer deducted TDS.
          Ask them for Form 16A or the TDS certificate before writing off the difference.
        </StuckBox>
      )}

      {data && visibleLines.length === 0 && (
        <p className="rounded-lg border border-white/10 p-3 text-xs italic text-white sm:rounded-xl sm:p-4 sm:text-sm md:rounded-xl md:p-5 md:text-sm lg:rounded-2xl lg:p-5 lg:text-base xl:rounded-2xl xl:p-6 xl:text-base">
          {data.lines.length === 0
            ? "No lines found in this statement."
            : "All lines have been confirmed or ignored."}
        </p>
      )}

      {/* Card list — same 1 → 2 → 3 grid as the rest of the app.
          On mobile the proposal lists stack inside each card; on md+
          cards get enough width that the amount and actions can sit on
          one line with the description without wrapping. */}
      {visibleLines.length > 0 && (
        <ul className="grid grid-cols-1 items-start gap-3 sm:gap-3 md:grid-cols-2 md:gap-4 lg:gap-4 xl:grid-cols-3 xl:gap-5">
          {visibleLines.map((row) => {
            const isDone = confirmedIds.has(row.lineId);
            return (
              <li
                key={row.lineId}
                className={`rounded-lg border p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-4 lg:rounded-2xl lg:p-5 xl:rounded-2xl xl:p-5 ${
                  isDone ? "border-[#067647]/60" : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                      {row.line.date} · {row.line.ref}
                    </div>
                    <div className="text-sm font-medium text-white sm:text-sm md:text-base lg:text-base xl:text-lg">
                      {row.line.description}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2">
                    <div className="font-semibold tabular-nums text-white text-sm sm:text-sm md:text-base lg:text-base xl:text-lg">
                      {formatINR(row.line.creditPaise)}
                    </div>
                    {!isDone && (
                      <button
                        onClick={() => ignoreLine(row)}
                        className="flex items-center gap-1 text-[10px] text-white hover:text-[#FF9B8F] sm:gap-1 sm:text-[10px] md:gap-1.5 md:text-xs lg:gap-1.5 lg:text-xs xl:gap-2 xl:text-sm"
                        disabled={busy}
                      >
                        <IconClose />
                        Ignore
                      </button>
                    )}
                  </div>
                </div>

                {isDone ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-white sm:mt-2 sm:gap-1.5 sm:text-xs md:mt-2.5 md:gap-2 md:text-sm lg:mt-3 lg:gap-2 lg:text-sm xl:mt-3 xl:gap-2.5 xl:text-base">
                    <IconCheck />
                    Confirmed. See payments below.
                  </p>
                ) : row.proposals.length === 0 ? (
                  <div className="mt-2 flex items-center justify-between gap-2 sm:mt-2 sm:gap-2 md:mt-2.5 md:gap-2.5 lg:mt-3 lg:gap-3 xl:mt-3 xl:gap-3">
                    <p className="text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                      No proposals.
                    </p>
                    <button
                      onClick={() => openChangeMatch(row)}
                      disabled={busy}
                      className={SECONDARY}
                    >
                      Change match
                    </button>
                  </div>
                ) : (
                  <ul className="mt-2.5 space-y-2 sm:mt-3 sm:space-y-2 md:mt-3 md:space-y-2.5 lg:mt-4 lg:space-y-3 xl:mt-4 xl:space-y-3">
                    {row.proposals.map((p, i) => {
                      const hasFlags = p.flags.length > 0;
                      const canConfirm = p.invoiceIds.length > 0 && !p.flags.includes("duplicate");
                      return (
                        <li
                          key={i}
                          className="rounded-lg border border-white/10 p-2.5 sm:rounded-lg sm:p-3 md:rounded-lg md:p-3 lg:rounded-xl lg:p-3.5 xl:rounded-xl xl:p-4"
                        >
                          <div className="flex flex-col gap-2 sm:flex-col sm:gap-2 md:flex-row md:items-start md:justify-between md:gap-3 lg:flex-row lg:gap-3 xl:flex-row xl:gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                                Confidence {(p.confidence * 100).toFixed(0)}%
                              </div>
                              <div className="mt-1 text-xs text-white sm:mt-1 sm:text-xs md:mt-1 md:text-sm lg:mt-1.5 lg:text-sm xl:mt-2 xl:text-base">
                                {p.reason}
                              </div>
                              {hasFlags && (
                                <div className="mt-2 flex flex-wrap gap-1 sm:mt-2 sm:gap-1 md:mt-2.5 md:gap-1.5 lg:mt-2.5 lg:gap-1.5 xl:mt-3 xl:gap-2">
                                  {p.flags.map((f) => (
                                    <span
                                      key={f}
                                      className={`rounded px-2 py-0.5 text-[10px] font-medium sm:px-2 sm:py-0.5 sm:text-[10px] md:px-2 md:py-0.5 md:text-xs lg:px-2.5 lg:py-0.5 lg:text-xs xl:px-3 xl:py-1 xl:text-sm ${
                                        FLAG_CLASS[f] ?? "border border-white/10 bg-white/5 text-white"
                                      }`}
                                    >
                                      {FLAG_LABEL[f] ?? f}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-row gap-1.5 sm:gap-1.5 md:flex-col md:gap-1 lg:flex-col lg:gap-1.5 xl:flex-col xl:gap-2">
                              {canConfirm && (
                                <button
                                  onClick={() => confirmLine(row, p)}
                                  disabled={busy}
                                  className={CONFIRM_BTN}
                                >
                                  Confirm
                                </button>
                              )}
                              <button
                                onClick={() => openChangeMatch(row)}
                                disabled={busy}
                                className={SECONDARY}
                              >
                                Change match
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {confirmed !== null && (
        <div className={`${CARD} p-3 sm:p-4 md:p-4 lg:p-5 xl:p-5`}>
          <div className="flex items-baseline justify-between gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
            <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
              Confirmed payments
            </h2>
            <span className="text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
              {confirmed.length}
            </span>
          </div>
          {confirmed.length === 0 ? (
            <p className="mt-2 text-xs italic text-white sm:mt-2 sm:text-sm md:mt-3 md:text-sm lg:mt-3 lg:text-base xl:mt-4 xl:text-base">
              No payments confirmed yet.
            </p>
          ) : (
            <ul className={`mt-3 max-h-64 space-y-2 sm:mt-3 sm:max-h-72 sm:space-y-2 md:mt-4 md:max-h-80 md:space-y-2.5 lg:mt-4 lg:max-h-96 lg:space-y-3 xl:mt-5 xl:max-h-96 xl:space-y-3 ${SCROLL}`}>
              {confirmed.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-xs sm:gap-2 sm:text-xs md:gap-3 md:text-sm lg:gap-3 lg:text-sm xl:gap-4 xl:text-base"
                >
                  <div className="min-w-0">
                    <div className="font-medium tabular-nums text-white">
                      {formatINR(p.amountPaise)}
                    </div>
                    <div className="italic text-white">
                      {p.paidOn} · {p.reference ?? "—"}
                    </div>
                  </div>
                  {p.invoiceId && p.invoiceNumber ? (
                    <Link
                      href={`/invoices/${p.invoiceId}`}
                      className="shrink-0 font-mono text-white underline underline-offset-4"
                    >
                      {p.invoiceNumber}
                    </Link>
                  ) : (
                    <span className="shrink-0 italic text-white">
                      unmatched
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {changeMatchFor !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4 md:p-6 lg:p-6 xl:p-8"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChangeMatchFor(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Pick an invoice"
        >
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl sm:max-h-[88vh] sm:rounded-xl sm:p-5 md:max-h-[86vh] md:max-w-lg md:rounded-2xl md:p-6 lg:max-h-[85vh] lg:max-w-xl lg:rounded-2xl lg:p-6 xl:max-h-[85vh] xl:max-w-2xl xl:rounded-3xl xl:p-7">
            <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
                  Pick an invoice
                </h2>
                <p className="mt-1 text-xs italic text-white sm:mt-1 sm:text-sm md:mt-1.5 md:text-sm lg:mt-2 lg:text-base xl:mt-2 xl:text-base">
                  {changeMatchFor.line.date} · {changeMatchFor.line.description} ·{" "}
                  {formatINR(changeMatchFor.line.creditPaise)}
                </p>
              </div>
              <button
                onClick={() => setChangeMatchFor(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white sm:h-8 sm:w-8 md:h-9 md:w-9 md:rounded-lg lg:h-9 lg:w-9 lg:rounded-lg xl:h-10 xl:w-10 xl:rounded-lg"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>
            {loadingInvoices && (
              <p className="mt-4 text-xs italic text-white sm:mt-4 sm:text-sm md:mt-5 md:text-sm lg:mt-5 lg:text-base xl:mt-6 xl:text-base">
                Loading…
              </p>
            )}
            {!loadingInvoices && openInvoices && openInvoices.length === 0 && (
              <p className="mt-4 text-xs italic text-white sm:mt-4 sm:text-sm md:mt-5 md:text-sm lg:mt-5 lg:text-base xl:mt-6 xl:text-base">
                No open invoices.
              </p>
            )}
            {!loadingInvoices && openInvoices && openInvoices.length > 0 && (
              <ul className={`mt-4 max-h-[60vh] space-y-2 sm:mt-4 sm:max-h-[60vh] sm:space-y-2 md:mt-5 md:max-h-[60vh] md:space-y-2.5 lg:mt-5 lg:space-y-3 xl:mt-6 xl:space-y-3 ${SCROLL}`}>
                {openInvoices.map((inv) => (
                  <li key={inv.id}>
                    <button
                      onClick={() =>
                        changeMatchFor && pickInvoice(changeMatchFor, inv.id)
                      }
                      disabled={busy}
                      className="w-full rounded-lg border border-white/10 bg-[#171717]/20 p-2.5 text-left hover:bg-white/5 disabled:opacity-50 sm:rounded-lg sm:p-3 md:rounded-xl md:p-3 lg:rounded-xl lg:p-3.5 xl:rounded-xl xl:p-4"
                    >
                      <div className="flex items-center justify-between gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                            {inv.number}
                          </div>
                          <div className="truncate text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                            {inv.customerName ?? "—"}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs font-semibold tabular-nums text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                          {formatINR(inv.outstandingPaise)}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

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

function IconUpload({ className = "h-4 w-4" }: { className?: string }) {
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

function IconCheck({ className = "h-3 w-3" }: { className?: string }) {
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

function IconClose({ className = "h-3 w-3" }: { className?: string }) {
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

const PRIMARY =
  "flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50";
const SECONDARY =
  "flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50";
const CARD = "rounded-xl border border-white/10";

// Every scrollable list uses this pair so the scrollbar doesn't butt
// against the card border.
const SCROLL = "overflow-y-auto pr-1";

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
    <main className="space-y-4 p-4 pb-24 pt-14">
      <h1 className="text-xl font-semibold text-white">Payments</h1>

      <label className={`cursor-pointer ${PRIMARY}`}>
        {busy ? (
          "Processing…"
        ) : (
          <>
            <IconUpload className="h-4 w-4" />
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

      {error && <p className="text-xs text-[#FF9B8F]">{error}</p>}

      {data && (
        <div className="rounded-lg border border-white/10 p-3 text-xs">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="font-semibold text-white">
                {data.summary.totalLines}
              </div>
              <div className="text-white italic">lines</div>
            </div>
            <div>
              <div className="font-semibold text-[#4ADE80]">
                {data.summary.matched}
              </div>
              <div className="text-white italic">matched</div>
            </div>
            <div>
              <div className="font-semibold text-[#FBBF24]">
                {data.summary.needsReview}
              </div>
              <div className="text-white italic">review</div>
            </div>
            <div>
              <div className="font-semibold text-white">
                {data.summary.duplicates}
              </div>
              <div className="text-white italic">dup.</div>
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
        <p className="rounded-lg border border-white/10 p-4 text-xs text-white italic">
          {data.lines.length === 0
            ? "No lines found in this statement."
            : "All lines have been confirmed or ignored."}
        </p>
      )}

      {visibleLines.length > 0 && (
        <ul className={`max-h-[60vh] space-y-3 ${SCROLL}`}>
          {visibleLines.map((row) => {
            const isDone = confirmedIds.has(row.lineId);
            return (
              <li
                key={row.lineId}
                className={`rounded-xl border p-4 ${
                  isDone ? "border-[#067647]/60" : "border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-white italic">
                      {row.line.date} · {row.line.ref}
                    </div>
                    <div className="text-sm font-medium text-white">
                      {row.line.description}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <div className="font-semibold tabular-nums text-white">
                      {formatINR(row.line.creditPaise)}
                    </div>
                    {!isDone && (
                      <button
                        onClick={() => ignoreLine(row)}
                        className="flex items-center gap-1 text-[10px] text-white hover:text-[#FF9B8F]"
                        disabled={busy}
                      >
                        <IconClose className="h-2.5 w-2.5" />
                        Ignore
                      </button>
                    )}
                  </div>
                </div>

                {isDone ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-white">
                    <IconCheck className="h-3 w-3" />
                    Confirmed. See payments below.
                  </p>
                ) : row.proposals.length === 0 ? (
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-xs text-white italic">No proposals.</p>
                    <button
                      onClick={() => openChangeMatch(row)}
                      disabled={busy}
                      className={SECONDARY}
                    >
                      Change match
                    </button>
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {row.proposals.map((p, i) => {
                      const hasFlags = p.flags.length > 0;
                      const canConfirm = p.invoiceIds.length > 0 && !p.flags.includes("duplicate");
                      return (
                        <li
                          key={i}
                          className="rounded-lg border border-white/10 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs text-white italic">
                                Confidence {(p.confidence * 100).toFixed(0)}%
                              </div>
                              <div className="mt-1 text-xs text-white">
                                {p.reason}
                              </div>
                              {hasFlags && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {p.flags.map((f) => (
                                    <span
                                      key={f}
                                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                                        FLAG_CLASS[f] ?? "border border-white/10 bg-white/5 text-white"
                                      }`}
                                    >
                                      {FLAG_LABEL[f] ?? f}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-col gap-1">
                              {canConfirm && (
                                <button
                                  onClick={() => confirmLine(row, p)}
                                  disabled={busy}
                                  className="rounded-lg bg-[#0F5C4E] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
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
        <div className={`${CARD} p-4`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">
              Confirmed payments
            </h2>
            <span className="text-xs text-white italic">
              {confirmed.length}
            </span>
          </div>
          {confirmed.length === 0 ? (
            <p className="mt-2 text-xs text-white italic">
              No payments confirmed yet.
            </p>
          ) : (
            <ul className={`mt-3 max-h-64 space-y-2 ${SCROLL}`}>
              {confirmed.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium tabular-nums text-white">
                      {formatINR(p.amountPaise)}
                    </div>
                    <div className="text-white italic">
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
                    <span className="shrink-0 text-white italic">
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChangeMatchFor(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Pick an invoice"
        >
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white">
                  Pick an invoice
                </h2>
                <p className="mt-1 text-xs text-white italic">
                  {changeMatchFor.line.date} · {changeMatchFor.line.description} ·{" "}
                  {formatINR(changeMatchFor.line.creditPaise)}
                </p>
              </div>
              <button
                onClick={() => setChangeMatchFor(null)}
                className="shrink-0 text-white/60 hover:text-white"
                aria-label="Close"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            </div>
            {loadingInvoices && (
              <p className="mt-4 text-xs text-white italic">Loading…</p>
            )}
            {!loadingInvoices && openInvoices && openInvoices.length === 0 && (
              <p className="mt-4 text-xs text-white italic">
                No open invoices.
              </p>
            )}
            {!loadingInvoices && openInvoices && openInvoices.length > 0 && (
              <ul className={`mt-4 max-h-[60vh] space-y-2 ${SCROLL}`}>
                {openInvoices.map((inv) => (
                  <li key={inv.id}>
                    <button
                      onClick={() =>
                        changeMatchFor && pickInvoice(changeMatchFor, inv.id)
                      }
                      disabled={busy}
                      className="w-full rounded-lg border border-white/10 bg-[#171717]/20 p-3 text-left hover:bg-white/5 disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-mono text-xs text-white">
                            {inv.number}
                          </div>
                          <div className="truncate text-xs text-white italic">
                            {inv.customerName ?? "—"}
                          </div>
                        </div>
                        <div className="shrink-0 text-xs font-semibold tabular-nums text-white">
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

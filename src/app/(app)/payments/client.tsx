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
  part: "bg-blue-100 text-blue-900",
  multi: "bg-blue-100 text-blue-900",
  tdsShortfall: "bg-amber-100 text-amber-900",
  overpayment: "bg-red-100 text-red-900",
  unmatched: "bg-red-100 text-red-900",
  duplicate: "bg-gray-200 text-gray-900",
};

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
    reloadConfirmed();
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

  const hasTds = data?.lines.some((r) =>
    r.proposals.some((p) => p.flags.includes("tdsShortfall")),
  );

  const visibleLines = data?.lines.filter((r) => !ignoredIds.has(r.lineId)) ?? [];

  return (
    <main className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">Payments</h1>

      <label className="block cursor-pointer rounded-lg bg-[#0F5C4E] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#0F5C4E]/90">
        {busy ? "Processing…" : "📥 Import bank statement (CSV)"}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFile}
          disabled={busy}
        />
      </label>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {data && (
        <div className="rounded-lg bg-white p-3 text-xs ring-1 ring-[#E4E7EC]">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <div className="font-semibold">{data.summary.totalLines}</div>
              <div className="text-muted-foreground">lines</div>
            </div>
            <div>
              <div className="font-semibold text-[#067647]">{data.summary.matched}</div>
              <div className="text-muted-foreground">matched</div>
            </div>
            <div>
              <div className="font-semibold text-[#B54708]">{data.summary.needsReview}</div>
              <div className="text-muted-foreground">review</div>
            </div>
            <div>
              <div className="font-semibold text-[#5A6170]">{data.summary.duplicates}</div>
              <div className="text-muted-foreground">dup.</div>
            </div>
          </div>
        </div>
      )}

      {hasTds && (
        <StuckBox>
          A shortfall of exactly 2% of the taxable value usually means the
          customer deducted TDS. Ask them for Form 16A or the TDS certificate
          before writing off the difference.
        </StuckBox>
      )}

      {data && visibleLines.length === 0 && (
        <p className="rounded-lg bg-white p-4 text-xs text-muted-foreground ring-1 ring-[#E4E7EC]">
          {data.lines.length === 0
            ? "No lines found in this statement."
            : "All lines have been confirmed or ignored."}
        </p>
      )}

      {visibleLines.length > 0 && (
        <ul className="space-y-3">
          {visibleLines.map((row) => {
            const isDone = confirmedIds.has(row.lineId);
            return (
              <li
                key={row.lineId}
                className={`rounded-xl bg-white p-4 ring-1 ${
                  isDone ? "ring-[#067647]" : "ring-[#E4E7EC]"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {row.line.date} · {row.line.ref}
                    </div>
                    <div className="text-sm font-medium">
                      {row.line.description}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <div className="tabular-nums font-semibold">
                      {formatINR(row.line.creditPaise)}
                    </div>
                    {!isDone && (
                      <button
                        onClick={() => ignoreLine(row)}
                        className="text-[10px] text-[#5A6170] hover:text-[#B42318]"
                        disabled={busy}
                      >
                        ✕ Ignore
                      </button>
                    )}
                  </div>
                </div>

                {isDone ? (
                  <p className="mt-2 text-xs text-[#067647]">
                    ✓ Confirmed. See payments below.
                  </p>
                ) : row.proposals.length === 0 ? (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs italic text-muted-foreground">
                      No proposals.
                    </p>
                    <button
                      onClick={() => openChangeMatch(row)}
                      disabled={busy}
                      className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA]"
                    >
                      Change match
                    </button>
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {row.proposals.map((p, i) => {
                      const hasFlags = p.flags.length > 0;
                      const canConfirm =
                        p.invoiceIds.length > 0 && !p.flags.includes("duplicate");
                      return (
                        <li
                          key={i}
                          className="rounded-lg border border-[#E4E7EC] p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="text-xs text-muted-foreground">
                                Confidence {(p.confidence * 100).toFixed(0)}%
                              </div>
                              <div className="mt-1 text-xs">{p.reason}</div>
                              {hasFlags && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {p.flags.map((f) => (
                                    <span
                                      key={f}
                                      className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                                        FLAG_CLASS[f] ?? "bg-gray-100"
                                      }`}
                                    >
                                      {FLAG_LABEL[f] ?? f}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="ml-3 flex shrink-0 flex-col gap-1">
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
                                className="rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs font-medium hover:bg-[#F7F8FA] disabled:opacity-50"
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
        <div className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
          <h2 className="text-sm font-semibold">Confirmed payments</h2>
          {confirmed.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              No payments confirmed yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {confirmed.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-medium tabular-nums">
                      {formatINR(p.amountPaise)}
                    </div>
                    <div className="text-muted-foreground">
                      {p.paidOn} · {p.reference ?? "—"}
                    </div>
                  </div>
                  {p.invoiceId && p.invoiceNumber ? (
                    <Link
                      href={`/invoices/${p.invoiceId}`}
                      className="font-mono text-[#175CD3] hover:underline"
                    >
                      {p.invoiceNumber}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">unmatched</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {changeMatchFor !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChangeMatchFor(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Pick an invoice"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Pick an invoice</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {changeMatchFor.line.date} · {changeMatchFor.line.description} ·{" "}
                  {formatINR(changeMatchFor.line.creditPaise)}
                </p>
              </div>
              <button
                onClick={() => setChangeMatchFor(null)}
                className="text-[#5A6170] hover:text-[#1A1D23]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {loadingInvoices && (
              <p className="mt-4 text-xs text-muted-foreground">Loading…</p>
            )}
            {!loadingInvoices && openInvoices && openInvoices.length === 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                No open invoices.
              </p>
            )}
            {!loadingInvoices && openInvoices && openInvoices.length > 0 && (
              <ul className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
                {openInvoices.map((inv) => (
                  <li key={inv.id}>
                    <button
                      onClick={() =>
                        changeMatchFor && pickInvoice(changeMatchFor, inv.id)
                      }
                      disabled={busy}
                      className="w-full rounded-lg border border-[#E4E7EC] p-3 text-left hover:bg-[#F7F8FA] disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-mono text-[#175CD3]">
                            {inv.number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {inv.customerName ?? "—"}
                          </div>
                        </div>
                        <div className="tabular-nums text-xs font-semibold">
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

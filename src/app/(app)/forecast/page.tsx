"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { StuckBox } from "@/components/domain/stuck-box";
import { Checkbox } from "@/components/ui/checkbox";
import type { ForecastRow } from "@/lib/domain/forecast";

type ForecastData = {
  rows: ForecastRow[];
  breachWeek: number | null;
  gapPaise: number;
  openingCashPaise: number;
  safetyBufferPaise: number;
  lowestPointPaise: number;
  gapInvoiceIds: string[];
  whatIfTargets: {
    topCustomerId: string | null;
    topExpenseId: string | null;
  };
};

type Chase = {
  invoiceId: string;
  customerName: string;
  amountPaise: number;
  daysOverdue: number;
  reason: string;
};

// ─── outline icons ───────────────────────────────────────────────────────────

function IconAlert({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconClose({ className = "h-3.5 w-3.5" }: { className?: string }) {
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

function IconChart({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

function IconTable({ className = "h-3.5 w-3.5" }: { className?: string }) {
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
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="9" x2="9" y2="21" />
    </svg>
  );
}

// ─── shared styles ───────────────────────────────────────────────────────────

const CARD = "rounded-xl border border-white/10 p-4";
const CARD_SM = "rounded-xl border border-white/10 p-3";

// Narrow, local helper: the previous code did `e.message` on a `catch`
// variable typed `unknown`, which doesn't compile under `strict`. This
// doesn't assume anything about files I haven't seen — it only inspects
// the error value caught right here.
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong loading the forecast.";
}

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [chase, setChase] = useState<Chase[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [whatIf, setWhatIf] = useState<string[]>([]);
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const qs = whatIf.length > 0 ? `?whatIf=${whatIf.join(",")}` : "";

    Promise.all([
      fetch(`/api/forecast${qs}`, { signal: controller.signal }).then((r) =>
        r.json(),
      ),
      fetch("/api/chase?topN=20", { signal: controller.signal }).then((r) =>
        r.json(),
      ),
    ])
      .then(([f, c]) => {
        if (f.error) setError(f.error.message);
        else {
          setData(f.data);
          setError(null);
        }
        if (c.data) setChase(c.data);
      })
      .catch((e: unknown) => {
        // AbortError fires when a newer request superseded this one —
        // that's expected, not a real failure, so don't surface it.
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError(errorMessage(e));
      });

    return () => controller.abort();
  }, [whatIf]);

  // Focus + Escape handling for the week-detail modal. Runs only while
  // the modal is open; cleans itself up when it closes or unmounts.
  useEffect(() => {
    if (openWeek === null) return;

    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenWeek(null);
        return;
      }
      if (e.key !== "Tab") return;

      const container = dialogRef.current;
      if (!container) return;
      const focusable = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [openWeek]);

  if (error) {
    return (
      <main className="space-y-3 p-4 text-sm text-white">
        <p>{error}</p>
        <button
          onClick={() => setError(null)}
          className="rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-1.5 text-xs text-white hover:bg-white/5"
        >
          Retry
        </button>
      </main>
    );
  }
  if (!data) return <main className="p-4 text-sm text-white">Loading…</main>;

  const gapSet = new Set(data.gapInvoiceIds);
  const gapCoverers = chase.filter((c) => gapSet.has(c.invoiceId));
  const visibleGapCoverers = gapCoverers.slice(0, 5);
  const hiddenGapCoverers = gapCoverers.length - visibleGapCoverers.length;

  const toggle = (id: string) => {
    setWhatIf((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  // Find the clicked week by its own `week` field rather than assuming
  // array index `week - 1` lines up with it. If the rows are ever sparse
  // or reordered, index arithmetic silently points at the wrong week;
  // this doesn't.
  const weekRow =
    openWeek !== null
      ? (data.rows.find((r) => r.week === openWeek) ?? null)
      : null;
  const { topCustomerId, topExpenseId } = data.whatIfTargets;

  return (
    <main className="space-y-4 p-4 pb-24 pt-14">
      <h1 className="text-xl font-semibold text-white">Cash forecast</h1>

      <section className={CARD_SM}>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-[10px] text-white italic">Opening</div>
            <div className="mt-0.5 font-semibold tabular-nums text-white">
              {formatINR(data.openingCashPaise)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-white italic">Lowest</div>
            <div className="mt-0.5 font-semibold tabular-nums text-[#FF9B8F]">
              {formatINR(data.lowestPointPaise)}
              {data.breachWeek !== null && (
                <span className="text-[10px] text-white italic">
                  {" "}
                  (W{data.breachWeek})
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-white italic">Buffer</div>
            <div className="mt-0.5 font-semibold tabular-nums text-white">
              {formatINR(data.safetyBufferPaise)}
            </div>
          </div>
        </div>
      </section>

      {data.breachWeek !== null && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-[#B42318]/40 bg-[#B42318]/10 p-3 text-xs font-medium text-white"
        >
          <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF9B8F]" />
          <span>
            Cash goes below buffer in week {data.breachWeek} · gap{" "}
            {formatINR(data.gapPaise)}
          </span>
        </div>
      )}

      {showTable ? (
        <section className={CARD_SM}>
          <div className="max-h-80 overflow-y-auto pr-1">
            <table className="w-full text-[10px] tabular-nums">
              <thead className="sticky top-0 bg-[#192221]">
                <tr className="text-white italic">
                  <th className="pb-1 text-left">Wk</th>
                  <th className="pb-1 text-right">Opening</th>
                  <th className="pb-1 text-right">In</th>
                  <th className="pb-1 text-right">Out</th>
                  <th className="pb-1 text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const breach =
                    data.breachWeek !== null && r.week === data.breachWeek;
                  return (
                    <tr
                      key={r.week}
                      className={
                        breach
                          ? "bg-[#B42318]/10 text-[#FF9B8F]"
                          : "text-white"
                      }
                    >
                      <td className="py-0.5">{r.week}</td>
                      <td className="py-0.5 text-right">
                        {formatINR(r.openingPaise)}
                      </td>
                      <td className="py-0.5 text-right">
                        {formatINR(r.inflowPaise)}
                      </td>
                      <td className="py-0.5 text-right">
                        {formatINR(r.outflowPaise)}
                      </td>
                      <td className="py-0.5 text-right font-medium">
                        {formatINR(r.closingPaise)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <ForecastChart
          rows={data.rows}
          safetyBufferPaise={data.safetyBufferPaise}
          breachWeek={data.breachWeek}
          onWeekClick={setOpenWeek}
        />
      )}

      <button
        onClick={() => setShowTable((s) => !s)}
        aria-pressed={showTable}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5"
      >
        {showTable ? (
          <>
            <IconChart />
            Chart view
          </>
        ) : (
          <>
            <IconTable />
            Table view
          </>
        )}
      </button>

      <StuckBox>
        What-if is a preview only — nothing is saved until you take action.
        Reset returns you to the actual forecast.
      </StuckBox>

      <section className={CARD}>
        <h2 className="text-sm font-semibold text-white">What-if</h2>
        <div className="mt-3 space-y-2 text-xs">
          <label
            className={`flex cursor-pointer items-center gap-2 ${
              !topCustomerId ? "opacity-50" : ""
            }`}
          >
            <Checkbox
              checked={whatIf.some((w) => w.startsWith("delayCustomer"))}
              onCheckedChange={() =>
                topCustomerId && toggle(`delayCustomer:${topCustomerId}:30`)
              }
              disabled={!topCustomerId}
              className="bg-transparent border-white/20"
            />
            <span className="text-white">Delay biggest customer 30 days</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={whatIf.some((w) => w.startsWith("addInflow"))}
              onCheckedChange={() => toggle("addInflow:2026-11-15:200000000")}
              className="bg-transparent border-white/20"
            />
            <span className="text-white">
              Simulate big order +₹20,00,000
            </span>
          </label>
          <label
            className={`flex cursor-pointer items-center gap-2 ${
              !topExpenseId ? "opacity-50" : ""
            }`}
          >
            <Checkbox
              checked={whatIf.some((w) => w.startsWith("delayExpense"))}
              onCheckedChange={() =>
                topExpenseId && toggle(`delayExpense:${topExpenseId}:14`)
              }
              disabled={!topExpenseId}
              className="bg-transparent border-white/20"
            />
            <span className="text-white">
              Delay biggest supplier payment 14 days
            </span>
          </label>
          {whatIf.length > 0 && (
            <button
              onClick={() => setWhatIf([])}
              className="mt-2 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-1.5 text-xs text-white hover:bg-white/5"
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {gapCoverers.length > 0 && (
        <section className={CARD}>
          <h2 className="text-sm font-semibold text-white">
            Invoices that would cover week-{data.breachWeek} gap
          </h2>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {visibleGapCoverers.map((c) => (
              <li key={c.invoiceId}>
                <Link
                  href={`/invoices/${c.invoiceId}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#171717]/20 p-2 hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-white">
                      {c.customerName}
                    </div>
                    <div className="text-[10px] text-white italic">
                      {c.daysOverdue > 0
                        ? `${c.daysOverdue} days overdue`
                        : "not yet due"}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs font-semibold tabular-nums text-white">
                    {formatINR(c.amountPaise)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {hiddenGapCoverers > 0 && (
            <p className="mt-2 text-[10px] text-white italic">
              +{hiddenGapCoverers} more invoice
              {hiddenGapCoverers === 1 ? "" : "s"} not shown
            </p>
          )}
        </section>
      )}

      {weekRow && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenWeek(null);
          }}
        >
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label={`Week ${weekRow.week} detail`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-white">
                  Week {weekRow.week}
                </h2>
                <p className="mt-1 text-xs text-white italic">
                  {weekRow.weekStart} – {weekRow.weekEnd} · opening{" "}
                  {formatINR(weekRow.openingPaise)}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                onClick={() => setOpenWeek(null)}
                className="shrink-0 text-white/60 hover:text-white"
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-white italic">Inflows</span>
                <span className="font-medium tabular-nums text-[#4ADE80]">
                  +{formatINR(weekRow.inflowPaise)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-white italic">Outflows</span>
                <span className="font-medium tabular-nums text-[#FF9B8F]">
                  −{formatINR(weekRow.outflowPaise)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-2 border-t border-white/10 pt-2">
                <span className="font-medium text-white">Closing</span>
                <span className="font-semibold tabular-nums text-white">
                  {formatINR(weekRow.closingPaise)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

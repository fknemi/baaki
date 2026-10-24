"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { StuckBox } from "@/components/domain/stuck-box";
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

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [chase, setChase] = useState<Chase[]>([]);
  const [showTable, setShowTable] = useState(false);
  const [whatIf, setWhatIf] = useState<string[]>([]);
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const qs = whatIf.length > 0 ? `?whatIf=${whatIf.join(",")}` : "";
    Promise.all([
      fetch(`/api/forecast${qs}`).then((r) => r.json()),
      fetch("/api/chase?topN=20").then((r) => r.json()),
    ])
      .then(([f, c]) => {
        if (f.error) setError(f.error.message);
        else setData(f.data);
        if (c.data) setChase(c.data);
      })
      .catch((e) => setError(e.message));
  }, [whatIf]);

  if (error) return <main className="p-4 text-sm text-[#B42318]">{error}</main>;
  if (!data) return <main className="p-4 text-sm text-[#5A6170]">Loading…</main>;

  // Gap coverers — by ID set, not by brittle string matching
  const gapSet = new Set(data.gapInvoiceIds);
  const gapCoverers = chase.filter((c) => gapSet.has(c.invoiceId));

  const toggle = (id: string) => {
    setWhatIf((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const weekRow = openWeek !== null ? data.rows[openWeek - 1] : null;
  const { topCustomerId, topExpenseId } = data.whatIfTargets;

  return (
    <main className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">Cash forecast</h1>

      <section className="rounded-xl bg-white p-3 ring-1 ring-[#E4E7EC]">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="text-[10px] text-[#5A6170]">Opening</div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {formatINR(data.openingCashPaise)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#5A6170]">Lowest</div>
            <div className="mt-0.5 font-semibold tabular-nums text-[#B42318]">
              {formatINR(data.lowestPointPaise)}
              {data.breachWeek !== null && (
                <span className="text-[10px] text-[#5A6170]">
                  {" "}
                  (W{data.breachWeek})
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#5A6170]">Buffer</div>
            <div className="mt-0.5 font-semibold tabular-nums">
              {formatINR(data.safetyBufferPaise)}
            </div>
          </div>
        </div>
      </section>

      {data.breachWeek !== null && (
        <div
          role="alert"
          className="rounded-xl bg-[#FEF3F2] p-3 text-xs font-medium text-[#B42318] ring-1 ring-[#FDA29B]"
        >
          ⚠ Cash goes below buffer in week {data.breachWeek} · gap{" "}
          {formatINR(data.gapPaise)}
        </div>
      )}

      {showTable ? (
        <section className="rounded-xl bg-white p-3 ring-1 ring-[#E4E7EC]">
          <table className="w-full text-[10px] tabular-nums">
            <thead>
              <tr className="text-[#5A6170]">
                <th className="text-left">Wk</th>
                <th className="text-right">Opening</th>
                <th className="text-right">In</th>
                <th className="text-right">Out</th>
                <th className="text-right">Closing</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const breach =
                  data.breachWeek !== null && r.week === data.breachWeek;
                return (
                  <tr
                    key={r.week}
                    className={breach ? "bg-[#FEF3F2] text-[#B42318]" : ""}
                  >
                    <td>{r.week}</td>
                    <td className="text-right">
                      {formatINR(r.openingPaise)}
                    </td>
                    <td className="text-right">
                      {formatINR(r.inflowPaise)}
                    </td>
                    <td className="text-right">
                      {formatINR(r.outflowPaise)}
                    </td>
                    <td className="text-right font-medium">
                      {formatINR(r.closingPaise)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
        className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-xs font-medium hover:bg-[#F7F8FA]"
      >
        {showTable ? "Chart view ↹" : "Table view ↹"}
      </button>

      <StuckBox>
        What-if is a preview only — nothing is saved until you take action.
        Reset returns you to the actual forecast.
      </StuckBox>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h2 className="text-sm font-semibold">What-if</h2>
        <div className="mt-3 space-y-2 text-xs">
          <label
            className={`flex items-center gap-2 ${
              !topCustomerId ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={whatIf.some((w) => w.startsWith("delayCustomer"))}
              onChange={() =>
                topCustomerId &&
                toggle(`delayCustomer:${topCustomerId}:30`)
              }
              disabled={!topCustomerId}
            />
            <span>Delay biggest customer 30 days</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={whatIf.some((w) => w.startsWith("addInflow"))}
              onChange={() => toggle("addInflow:2026-11-15:200000000")}
            />
            <span>Simulate big order +₹20,00,000</span>
          </label>
          <label
            className={`flex items-center gap-2 ${
              !topExpenseId ? "opacity-50" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={whatIf.some((w) => w.startsWith("delayExpense"))}
              onChange={() =>
                topExpenseId && toggle(`delayExpense:${topExpenseId}:14`)
              }
              disabled={!topExpenseId}
            />
            <span>Delay biggest supplier payment 14 days</span>
          </label>
          {whatIf.length > 0 && (
            <button
              onClick={() => setWhatIf([])}
              className="mt-2 rounded-lg border border-[#E4E7EC] px-3 py-1.5 text-xs hover:bg-[#F7F8FA]"
            >
              Reset
            </button>
          )}
        </div>
      </section>

      {gapCoverers.length > 0 && (
        <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
          <h2 className="text-sm font-semibold">
            Invoices that would cover week-{data.breachWeek} gap
          </h2>
          <ul className="mt-3 space-y-2">
            {gapCoverers.slice(0, 5).map((c) => (
              <li key={c.invoiceId}>
                <Link
                  href={`/invoices/${c.invoiceId}`}
                  className="flex items-center justify-between rounded-lg border border-[#E4E7EC] p-2 hover:bg-[#F7F8FA]"
                >
                  <div>
                    <div className="text-xs font-medium">
                      {c.customerName}
                    </div>
                    <div className="text-[10px] text-[#5A6170]">
                      {c.daysOverdue > 0
                        ? `${c.daysOverdue} days overdue`
                        : "not yet due"}
                    </div>
                  </div>
                  <div className="text-xs font-semibold tabular-nums">
                    {formatINR(c.amountPaise)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {weekRow && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpenWeek(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label={`Week ${weekRow.week} detail`}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Week {weekRow.week} ({weekRow.weekStart} →{" "}
                  {weekRow.weekEnd})
                </h2>
                <p className="mt-1 text-xs text-[#5A6170]">
                  Opening {formatINR(weekRow.openingPaise)}
                </p>
              </div>
              <button
                onClick={() => setOpenWeek(null)}
                className="text-[#5A6170] hover:text-[#1A1D23]"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5A6170]">Inflows</span>
                <span className="font-medium tabular-nums text-[#067647]">
                  +{formatINR(weekRow.inflowPaise)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A6170]">Outflows</span>
                <span className="font-medium tabular-nums text-[#B42318]">
                  −{formatINR(weekRow.outflowPaise)}
                </span>
              </div>
              <div className="mt-2 flex justify-between border-t border-[#E4E7EC] pt-2">
                <span className="font-medium">Closing</span>
                <span className="font-semibold tabular-nums">
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

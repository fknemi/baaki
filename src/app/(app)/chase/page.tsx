"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";
import { AgeingBar, type AgeingBucket } from "@/components/charts/ageing-bar";

type Chase = {
  invoiceId: string;
  customerName: string;
  amountPaise: number;
  daysOverdue: number;
  score: number;
  reason: string;
};

type Sort = "score" | "amount";

// ─── outline icon ────────────────────────────────────────────────────────────

function IconArrowRight({ className = "h-3 w-3" }: { className?: string }) {
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
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

const PILL_ACTIVE = "rounded-lg px-3 py-1.5 text-xs font-medium bg-white text-[#111]";
const PILL_INACTIVE =
  "rounded-lg px-3 py-1.5 text-xs font-medium border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5";

export default function ChasePage() {
  const [data, setData] = useState<Chase[] | null>(null);
  const [ageing, setAgeing] = useState<AgeingBucket[] | null>(null);
  const [sort, setSort] = useState<Sort>("score");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/chase?topN=20").then((r) => r.json()),
      fetch("/api/dashboard").then((r) => r.json()),
    ])
      .then(([chaseJ, dashJ]) => {
        if (chaseJ.error) {
          setError(chaseJ.error.message);
          return;
        }
        setData(chaseJ.data);
        // Ageing is a nice-to-have here; if the dashboard call fails we
        // just don't render the bar rather than blocking the chase list.
        setAgeing(dashJ?.data?.ageing ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <main className="p-4 text-sm text-white">{error}</main>;
  if (!data) return <main className="p-4 text-sm text-white">Loading…</main>;

  const sorted = [...data].sort((a, b) => {
    if (sort === "amount") return b.amountPaise - a.amountPaise;
    return b.score - a.score;
  });

  const maxScore = Math.max(...sorted.map((c) => c.score), 1);

  return (
    <main className="space-y-4 p-4 pb-24 pt-14">
      <h1 className="text-xl font-semibold text-white">Chase these first</h1>

      <p className="rounded-lg border border-white/10 p-2 text-[10px] text-white italic">
        Amount 40% · Days overdue 30% · Reliability 15% · Cash-gap help 15%
      </p>

      {ageing && ageing.length > 0 && <AgeingBar buckets={ageing} />}

      <div className="flex gap-2">
        <button
          onClick={() => setSort("score")}
          aria-pressed={sort === "score"}
          className={sort === "score" ? PILL_ACTIVE : PILL_INACTIVE}
        >
          By score
        </button>
        <button
          onClick={() => setSort("amount")}
          aria-pressed={sort === "amount"}
          className={sort === "amount" ? PILL_ACTIVE : PILL_INACTIVE}
        >
          By amount
        </button>
      </div>

      {sorted.length === 0 ? (
        <p className="rounded-lg border border-white/10 p-4 text-xs text-white italic">
          Nothing to chase right now.
        </p>
      ) : (
        <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {sorted.map((c, i) => {
            const pct = Math.round((c.score / maxScore) * 100);
            return (
              <li key={c.invoiceId} className="rounded-xl border border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-white italic">#{i + 1}</div>
                    <div className="mt-0.5 truncate text-sm font-semibold text-white">
                      {c.customerName}
                    </div>
                    <div className="text-[10px] text-white italic">
                      {formatINR(c.amountPaise)} ·{" "}
                      {c.daysOverdue > 0
                        ? `${c.daysOverdue} days overdue`
                        : "not yet due"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-white italic">score</div>
                    <div className="text-sm font-semibold tabular-nums text-white">
                      {c.score}
                    </div>
                  </div>
                </div>

                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"
                  role="img"
                  aria-label={`Score ${c.score} of ${maxScore}`}
                >
                  <div
                    className="h-full rounded-full bg-[#0F5C4E]"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className="mt-3 text-[10px] leading-relaxed text-white italic">
                  {c.reason}
                </p>

                <Link
                  href={`/invoices/${c.invoiceId}`}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] px-3 py-2 text-center text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
                >
                  Send reminder
                  <IconArrowRight />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";

type Chase = {
  invoiceId: string;
  customerName: string;
  amountPaise: number;
  daysOverdue: number;
  score: number;
  reason: string;
};

type Sort = "score" | "amount";

export default function ChasePage() {
  const [data, setData] = useState<Chase[] | null>(null);
  const [sort, setSort] = useState<Sort>("score");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/chase?topN=20")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message);
        else setData(j.data);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <main className="p-4 text-sm text-[#B42318]">{error}</main>;
  if (!data) return <main className="p-4 text-sm text-[#5A6170]">Loading…</main>;

  const sorted = [...data].sort((a, b) => {
    if (sort === "amount") return b.amountPaise - a.amountPaise;
    return b.score - a.score;
  });

  const maxScore = Math.max(...sorted.map((c) => c.score), 1);

  return (
    <main className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">Chase these first</h1>

      <p className="rounded-lg bg-white p-2 text-[10px] text-[#5A6170] ring-1 ring-[#E4E7EC]">
        Amount 40% · Days overdue 30% · Reliability 15% · Cash-gap help 15%
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => setSort("score")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            sort === "score"
              ? "bg-[#0F5C4E] text-white"
              : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
          }`}
        >
          By score
        </button>
        <button
          onClick={() => setSort("amount")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
            sort === "amount"
              ? "bg-[#0F5C4E] text-white"
              : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
          }`}
        >
          By amount
        </button>
      </div>

      <ul className="space-y-3">
        {sorted.map((c, i) => {
          const pct = Math.round((c.score / maxScore) * 100);
          return (
            <li key={c.invoiceId} className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-[#5A6170]">#{i + 1}</div>
                  <div className="mt-0.5 text-sm font-semibold">{c.customerName}</div>
                  <div className="text-[10px] text-[#5A6170]">
                    {formatINR(c.amountPaise)} ·{" "}
                    {c.daysOverdue > 0 ? `${c.daysOverdue} days overdue` : "not yet due"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-[#5A6170]">score</div>
                  <div className="text-sm font-semibold tabular-nums">{c.score}</div>
                </div>
              </div>

              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-[#F7F8FA]"
                role="img"
                aria-label={`Score ${c.score} of ${maxScore}`}
              >
                <div className="h-full rounded-full bg-[#0F5C4E]" style={{ width: `${pct}%` }} />
              </div>

              <p className="mt-3 text-[10px] leading-relaxed text-[#5A6170]">{c.reason}</p>

              <Link
                href={`/invoices/${c.invoiceId}`}
                className="mt-3 block rounded-lg bg-[#0F5C4E] px-3 py-2 text-center text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
              >
                Send reminder →
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

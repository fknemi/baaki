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
// Capped at h-4 (16 px) on lg/xl — matches the h-11 → h-14 action button
// it sits inside.

const ICON_STD =
  "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

function IconArrowRight({ className = ICON_STD }: { className?: string }) {
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

// Sort pills — shared height/padding/text ladder so active and inactive
// states stay pixel-identical in every dimension except colour.
const PILL_BASE =
  "rounded-lg font-medium transition-colors " +
  "px-3 py-1.5 text-xs " +
  "sm:rounded-lg sm:px-3.5 sm:py-1.5 sm:text-sm " +
  "md:rounded-xl md:px-4 md:py-2 md:text-sm " +
  "lg:rounded-xl lg:px-4 lg:py-2 lg:text-base " +
  "xl:rounded-xl xl:px-5 xl:py-2.5 xl:text-base";
const PILL_ACTIVE = `${PILL_BASE} bg-white text-[#111]`;
const PILL_INACTIVE = `${PILL_BASE} border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5`;

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

  if (error)
    return (
      <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
        {error}
      </main>
    );
  if (!data)
    return (
      <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
        Loading…
      </main>
    );

  const sorted = [...data].sort((a, b) => {
    if (sort === "amount") return b.amountPaise - a.amountPaise;
    return b.score - a.score;
  });

  const maxScore = Math.max(...sorted.map((c) => c.score), 1);

  return (
    <main className="mx-auto w-full max-w-7xl space-y-3 px-3 pb-24 pt-14 sm:space-y-4 sm:px-4 sm:pt-16 md:space-y-4 md:px-6 md:pt-20 lg:space-y-5 lg:px-8 lg:pt-24 xl:space-y-5 xl:pt-24">
      <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
        Chase these first
      </h1>

      {/* Scoring formula note. Was a 10 px italic single-liner inside a
          p-2 strip — barely legible on md+, and squashed against the edges
          on md. Grows into a proper readable sentence. */}
      <p className="rounded-lg border border-white/10 px-2 py-2 text-[10px] italic text-white sm:rounded-lg sm:px-3 sm:py-2 sm:text-[11px] md:rounded-xl md:px-4 md:py-2.5 md:text-xs lg:rounded-xl lg:px-4 lg:py-3 lg:text-sm xl:rounded-xl xl:px-5 xl:py-3 xl:text-sm">
        Amount 40% · Days overdue 30% · Reliability 15% · Cash-gap help 15%
      </p>

      {ageing && ageing.length > 0 && <AgeingBar buckets={ageing} />}

      {/* Sort controls. flex-wrap so on a narrow md (where 3-col grid
          would still fit these two pills on one line, but at some point
          they won't) the second pill drops to a second line cleanly. */}
      <div className="flex flex-wrap gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
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
        <p className="rounded-lg border border-white/10 p-3 text-xs italic text-white sm:rounded-xl sm:p-4 sm:text-sm md:rounded-xl md:p-5 md:text-sm lg:rounded-2xl lg:p-5 lg:text-base xl:rounded-2xl xl:p-6 xl:text-base">
          Nothing to chase right now.
        </p>
      ) : (
        // Responsive grid. Was a max-h-[60vh] scrolling vertical stack
        // pinned to whatever the narrow <main> was — meaning on a wide
        // screen the ranking rendered as a 360 px column floating on a
        // huge empty page. 1 → 2 → 3 columns + natural page scroll.
        // items-start pins each card to its own height so one card with
        // a long reason doesn't drag its row siblings taller.
        <ul className="grid grid-cols-1 items-start gap-3 sm:gap-3 md:grid-cols-2 md:gap-4 lg:gap-4 xl:grid-cols-3 xl:gap-5">
          {sorted.map((c, i) => {
            const pct = Math.round((c.score / maxScore) * 100);
            return (
              <li
                key={c.invoiceId}
                className="flex h-full flex-col rounded-lg border border-white/10 p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-4 lg:rounded-2xl lg:p-5 xl:rounded-2xl xl:p-5"
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                      #{i + 1}
                    </div>
                    <div className="mt-0.5 truncate text-sm font-semibold text-white sm:text-base md:text-base lg:text-lg xl:text-lg">
                      {c.customerName}
                    </div>
                    <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                      {formatINR(c.amountPaise)} ·{" "}
                      {c.daysOverdue > 0
                        ? `${c.daysOverdue} days overdue`
                        : "not yet due"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                      score
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-white sm:text-base md:text-base lg:text-lg xl:text-lg">
                      {c.score}
                    </div>
                  </div>
                </div>

                <div
                  className="mt-2 h-2 overflow-hidden rounded-full bg-white/5 sm:mt-2 sm:h-2 md:mt-2.5 md:h-2.5 lg:mt-3 lg:h-2.5 xl:mt-3 xl:h-3"
                  role="img"
                  aria-label={`Score ${c.score} of ${maxScore}`}
                >
                  <div
                    className="h-full rounded-full bg-[#0F5C4E]"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className="mt-3 flex-1 text-[10px] italic leading-relaxed text-white sm:mt-3 sm:text-[11px] md:mt-3 md:text-xs lg:mt-4 lg:text-xs xl:mt-4 xl:text-sm">
                  {c.reason}
                </p>

                <Link
                  href={`/invoices/${c.invoiceId}`}
                  className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] text-center text-xs font-medium text-white hover:bg-[#0F5C4E]/90 sm:mt-3 sm:h-9 sm:gap-1.5 sm:rounded-lg sm:text-sm md:mt-4 md:h-10 md:gap-2 md:rounded-xl md:text-sm lg:mt-4 lg:h-11 lg:gap-2 lg:rounded-xl lg:text-base xl:mt-5 xl:h-12 xl:gap-2.5 xl:rounded-xl xl:text-base"
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

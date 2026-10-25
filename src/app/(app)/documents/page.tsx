"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";

type Inv = {
  id: string;
  number: string;
  status: string;
  customer?: { name: string };
  customerName?: string;
  outstandingPaise?: number;
  dueDate: string;
};

// ─── outline icon ────────────────────────────────────────────────────────────
// Capped at h-4 (16 px) on lg/xl — going to h-5 looked oversized inside
// the "Open" label it sits next to.

const ICON_TINY =
  "h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4";

function IconChevronRight({ className = ICON_TINY }: { className?: string }) {
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
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// Search input — box AND text scale together, so at xl a 56 px tall bar
// doesn't hold 14 px placeholder text (input-group rule from the OCR /
// MarkPaid fixes).
const SEARCH_INPUT =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 text-white " +
  "placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 " +
  "[&::-webkit-search-cancel-button]:invert " +
  "h-9 px-3 text-sm " +
  "sm:h-10 sm:rounded-lg sm:px-3.5 sm:text-base " +
  "md:h-11 md:rounded-xl md:px-4 md:text-base " +
  "lg:h-12 lg:rounded-xl lg:px-4 lg:text-lg " +
  "xl:h-14 xl:rounded-xl xl:px-5 xl:text-lg";

// Row card chrome — rounded-* curve matches every other card in the app.
const ROW_CARD =
  "flex items-center justify-between border border-white/10 hover:bg-white/5 " +
  "gap-3 rounded-lg p-3 " +
  "sm:gap-3 sm:rounded-xl sm:p-4 " +
  "md:gap-4 md:rounded-xl md:p-4 " +
  "lg:gap-4 lg:rounded-2xl lg:p-5 " +
  "xl:gap-5 xl:rounded-2xl xl:p-5";

export default function DocumentsIndexPage() {
  const [invoices, setInvoices] = useState<Inv[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message);
        else setInvoices(j.data ?? []);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return (
      <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
        {error}
      </main>
    );
  if (!invoices)
    return (
      <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
        Loading…
      </main>
    );

  const filtered = invoices.filter((i) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return (
      i.number.toLowerCase().includes(ql) ||
      (i.customer?.name ?? i.customerName ?? "").toLowerCase().includes(ql)
    );
  });

  return (
    <main className="mx-auto w-full max-w-7xl space-y-3 px-3 pb-24 pt-14 sm:space-y-4 sm:px-4 sm:pt-16 md:space-y-4 md:px-6 md:pt-20 lg:space-y-5 lg:px-8 lg:pt-24 xl:space-y-5 xl:pt-24">
      <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
        Documents
      </h1>
      <p className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
        Open any invoice to see its timeline, generate a demand letter, or
        download the evidence pack.
      </p>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search invoice number or customer…"
        className={SEARCH_INPUT}
      />

      {filtered.length === 0 && (
        <p className="rounded-lg border border-white/10 p-3 text-xs italic text-white sm:rounded-xl sm:p-4 sm:text-sm md:rounded-xl md:p-5 md:text-sm lg:rounded-2xl lg:p-5 lg:text-base xl:rounded-2xl xl:p-6 xl:text-base">
          No invoices match your search.
        </p>
      )}

      {/* 1 → 2 → 3 grid. Was a flat vertical stack — on a 1440 px monitor
          each row rendered as a 1400 px-wide strip with a tiny number
          and amount at opposite ends. Cards now cap at ~400 px each so
          the content inside has proper density at every breakpoint. */}
      {filtered.length > 0 && (
        <ul className="grid grid-cols-1 items-start gap-2 sm:gap-2 md:grid-cols-2 md:gap-3 lg:gap-3 xl:grid-cols-3 xl:gap-4">
          {filtered.map((inv) => (
            <li key={inv.id}>
              <Link href={`/documents/${inv.id}`} className={ROW_CARD}>
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                    {inv.number}
                  </div>
                  <div className="truncate text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                    {inv.customer?.name ?? inv.customerName ?? "—"} · due{" "}
                    {inv.dueDate}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base">
                  <div className="font-semibold tabular-nums text-white">
                    {formatINR(inv.outstandingPaise ?? 0)}
                  </div>
                  <div className="flex items-center justify-end gap-0.5 text-[10px] italic text-white sm:gap-0.5 sm:text-[11px] md:gap-1 md:text-xs lg:gap-1 lg:text-xs xl:gap-1.5 xl:text-sm">
                    Open
                    <IconChevronRight />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

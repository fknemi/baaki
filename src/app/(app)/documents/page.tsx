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

function IconChevronRight({ className = "h-3 w-3" }: { className?: string }) {
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

  if (error) return <main className="p-4 text-sm text-white">{error}</main>;
  if (!invoices) return <main className="p-4 text-sm text-white">Loading…</main>;

  const filtered = invoices.filter((i) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return (
      i.number.toLowerCase().includes(ql) ||
      (i.customer?.name ?? i.customerName ?? "").toLowerCase().includes(ql)
    );
  });

  return (
    <main className="space-y-4 p-4 pb-24 pt-14">
      <h1 className="text-xl font-semibold text-white">Documents</h1>
      <p className="text-xs text-white italic">
        Open any invoice to see its timeline, generate a demand letter, or
        download the evidence pack.
      </p>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search invoice number or customer…"
        className="w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [&::-webkit-search-cancel-button]:invert"
      />

      {filtered.length === 0 && (
        <p className="rounded-lg border border-white/10 p-4 text-xs text-white italic">
          No invoices match your search.
        </p>
      )}

      {filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/documents/${inv.id}`}
                className="flex items-center justify-between gap-3 border border-white/10 p-4 hover:bg-white/5"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs text-white">
                    {inv.number}
                  </div>
                  <div className="truncate text-[10px] text-white italic">
                    {inv.customer?.name ?? inv.customerName ?? "—"} · due{" "}
                    {inv.dueDate}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs">
                  <div className="font-semibold tabular-nums text-white">
                    {formatINR(inv.outstandingPaise ?? 0)}
                  </div>
                  <div className="flex items-center justify-end gap-0.5 text-[10px] text-white italic">
                    Open
                    <IconChevronRight className="h-2.5 w-2.5" />
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

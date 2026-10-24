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

  if (error) return <main className="p-4 text-sm text-[#B42318]">{error}</main>;
  if (!invoices) return <main className="p-4 text-sm text-[#5A6170]">Loading…</main>;

  const filtered = invoices.filter((i) => {
    if (!q) return true;
    const ql = q.toLowerCase();
    return (
      i.number.toLowerCase().includes(ql) ||
      (i.customer?.name ?? i.customerName ?? "").toLowerCase().includes(ql)
    );
  });

  return (
    <main className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">Documents</h1>
      <p className="text-xs text-[#5A6170]">
        Open any invoice to see its timeline, generate a demand letter, or
        download the evidence pack.
      </p>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search invoice number or customer…"
        className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
      />

      {filtered.length === 0 && (
        <p className="rounded-lg bg-white p-4 text-xs text-[#5A6170] ring-1 ring-[#E4E7EC]">
          No invoices match your search.
        </p>
      )}

      {filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/documents/${inv.id}`}
                className="flex items-center justify-between rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
              >
                <div className="min-w-0">
                  <div className="font-mono text-xs">{inv.number}</div>
                  <div className="text-[10px] text-[#5A6170]">
                    {inv.customer?.name ?? inv.customerName ?? "—"} · due{" "}
                    {inv.dueDate}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-semibold tabular-nums">
                    {formatINR(inv.outstandingPaise ?? 0)}
                  </div>
                  <div className="text-[10px] text-[#5A6170]">Open ›</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

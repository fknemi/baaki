"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatINR } from "@/lib/domain/money";
import { CustomerEditSheet } from "./edit-sheet";

type Customer = {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string | null;
  placeOfSupplyState: string | null;
  city: string | null;
  phoneMasked: string | null;
  email: string | null;
  creditDays: number;
  preferredLanguage: string;
  avgDaysLate: number;
  pctOnTime: number;
  grade: "A" | "B" | "C" | "NEW";
  gradeReason: string;
  totalOutstandingPaise: number;
};

type Invoice = {
  id: string;
  number: string;
  status: string;
  dueDate: string;
  outstandingPaise: number;
  amountPaidPaise: number;
  daysOverdue: number;
};

const GRADE_COLOR: Record<string, string> = {
  A: "bg-[#067647] text-white",
  B: "bg-[#B54708] text-white",
  C: "bg-[#B42318] text-white",
  NEW: "bg-[#5A6170] text-white",
};

function maskGstin(g: string | null): string {
  if (!g) return "—";
  if (g.length !== 15) return g;
  return g.slice(0, 4) + "*******" + g.slice(11);
}

function langLabel(l: string): string {
  return l === "hi" ? "हिंदी" : "English";
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyingLink, setCopyingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      const [cj, ij] = await Promise.all([
        fetch("/api/customers").then((r) => r.json()),
        fetch(`/api/invoices?customerId=${id}`).then((r) => r.json()),
      ]);
      const found = (cj.data ?? []).find((c: Customer) => c.id === id);
      if (!found) {
        setError("Customer not found.");
        return;
      }
      setCustomer(found);
      setInvoices(ij.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (error)
    return <main className="p-4 text-sm text-[#B42318]">{error}</main>;
  if (!customer)
    return <main className="p-4 text-sm text-[#5A6170]">Loading…</main>;

  const openInvoices = (invoices ?? []).filter(
    (i) =>
      i.status !== "paid" &&
      i.status !== "draft" &&
      i.status !== "cancelled",
  );

  async function copyPayLink() {
    if (openInvoices.length === 0) return;
    setCopyingLink(true);
    setError(null);
    try {
      const first = openInvoices[0];
      const res = await fetch(`/api/invoices/${first.id}/pay-link`, {
        method: "POST",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Failed");
      const url: string = j.data.url;

      try {
        await navigator.clipboard.writeText(url);
      } catch {
        // Fallback for HTTP on LAN IP where navigator.clipboard is blocked.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to copy pay link");
    } finally {
      setCopyingLink(false);
    }
  }

  return (
    <main className="space-y-4 p-4 pb-24">
      <Link href="/customers" className="text-xs text-[#5A6170] underline">
        ← Back
      </Link>

      <header className="rounded-xl bg-white p-5 ring-1 ring-[#E4E7EC]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">{customer.name}</h1>
            <p className="mt-1 font-mono text-xs text-[#5A6170]">
              GSTIN {maskGstin(customer.gstin)}
            </p>
            <p className="mt-1 text-xs text-[#5A6170]">
              {customer.placeOfSupplyState ?? "—"}
              {customer.stateCode ? ` (${customer.stateCode})` : ""}
            </p>
            <p className="mt-1 text-xs text-[#5A6170]">
              Credit {customer.creditDays} days · Language:{" "}
              {langLabel(customer.preferredLanguage)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-lg border border-[#E4E7EC] px-2 py-1 text-xs font-medium text-[#0F5C4E] hover:bg-[#F7F8FA]"
              aria-label="Edit customer"
            >
              ✎ Edit
            </button>
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                GRADE_COLOR[customer.grade] ?? "bg-[#5A6170] text-white"
              }`}
              aria-label={`Grade ${customer.grade}`}
            >
              {customer.grade}
            </span>
          </div>
        </div>
        <p className="mt-3 text-xs text-[#1A1D23]">{customer.gradeReason}</p>
      </header>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h2 className="text-sm font-semibold">Payment record</h2>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-[#5A6170]">On time</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {customer.pctOnTime}%
            </dd>
          </div>
          <div>
            <dt className="text-[#5A6170]">Average late</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {customer.avgDaysLate === 1
                ? "1 day"
                : `${customer.avgDaysLate} days`}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h2 className="text-sm font-semibold">Contact</h2>
        <dl className="mt-2 space-y-1 text-xs">
          {customer.phoneMasked && (
            <div className="flex justify-between">
              <dt className="text-[#5A6170]">Phone</dt>
              <dd className="font-mono">{customer.phoneMasked}</dd>
            </div>
          )}
          {customer.email && (
            <div className="flex justify-between">
              <dt className="text-[#5A6170]">Email</dt>
              <dd className="truncate">{customer.email}</dd>
            </div>
          )}
          {customer.city && (
            <div className="flex justify-between">
              <dt className="text-[#5A6170]">City</dt>
              <dd>{customer.city}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">
            Invoices ({openInvoices.length} open)
          </h2>
          <span className="text-xs tabular-nums text-[#5A6170]">
            {formatINR(customer.totalOutstandingPaise)} owed
          </span>
        </div>
        {openInvoices.length === 0 ? (
          <p className="mt-2 text-xs text-[#5A6170]">No open invoices.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {openInvoices.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/invoices/${i.id}`}
                  className="flex items-center justify-between rounded-lg border border-[#E4E7EC] p-2 hover:bg-[#F7F8FA]"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-xs">{i.number}</div>
                    <div className="text-[10px] text-[#5A6170]">
                      {i.daysOverdue > 0
                        ? `${i.daysOverdue} days overdue`
                        : `Due ${i.dueDate}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <div className="font-semibold tabular-nums">
                      {formatINR(i.outstandingPaise)}
                    </div>
                    {i.amountPaidPaise > 0 && (
                      <div className="text-[10px] text-[#5A6170]">
                        {formatINR(i.amountPaidPaise)} paid
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/invoices/new"
          className="rounded-lg bg-[#0F5C4E] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#0F5C4E]/90"
        >
          + New invoice
        </Link>
        <button
          type="button"
          onClick={copyPayLink}
          disabled={openInvoices.length === 0 || copyingLink}
          title={
            openInvoices.length === 0
              ? "No open invoice to generate a pay link from"
              : undefined
          }
          className="rounded-lg bg-white px-4 py-3 text-center text-sm font-medium ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA] disabled:opacity-50"
        >
          {copyingLink
            ? "Creating…"
            : copied
              ? "✓ Copied"
              : "📋 Copy pay link"}
        </button>
      </div>

      {editing && customer && (
        <CustomerEditSheet
          customer={customer}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await reload();
          }}
        />
      )}
    </main>
  );
}

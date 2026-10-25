// src/app/(app)/invoices/invoices-client.tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { formatINR } from "@/lib/domain/money";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  FilterDrawer,
  EMPTY_FILTERS,
  isEmptyFilters,
  type InvoiceFilters,
} from "./filter-drawer";

type Invoice = {
  id: string;
  number: string;
  customerName?: string | null;
  invoiceDate?: string | null;
  status: string;
  dueDate: string;
  outstandingPaise: number;
  amountPaidPaise: number;
  daysOverdue: number;
};

// ─── fuzzy search ────────────────────────────────────────────────────────────

type FuzzyResult = { score: number; indices: number[] };
type FieldMatch = FuzzyResult | null;

function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  if (!query) return { score: 0, indices: [] };
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  const indices: number[] = [];
  let ti = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const idx = t.indexOf(q[qi], ti);
    if (idx === -1) return null;
    indices.push(idx);
    ti = idx + 1;
  }

  let score = 100;
  score -= indices[0] * 0.5;
  score -= (text.length - q.length) * 0.1;
  for (let i = 1; i < indices.length; i++) {
    const gap = indices[i] - indices[i - 1] - 1;
    score += gap === 0 ? 4 : -gap * 0.5;
  }
  return { score, indices };
}

type InvoiceMatch = {
  matched: boolean;
  score: number;
  number: FieldMatch;
  customerName: FieldMatch;
  statusLine: FieldMatch;
};

function matchInvoice(inv: Invoice, query: string): InvoiceMatch {
  if (!query) {
    return {
      matched: true,
      score: 0,
      number: null,
      customerName: null,
      statusLine: null,
    };
  }

  const statusText = statusLine(inv);
  const invoiceMonth = inv.invoiceDate
    ? format(parseISO(inv.invoiceDate), "MMMM yyyy")
    : "";

  const number = fuzzyMatch(query, inv.number);
  const customerName = inv.customerName
    ? fuzzyMatch(query, inv.customerName)
    : null;
  const status = fuzzyMatch(query, statusText);
  const dueDate = fuzzyMatch(query, inv.dueDate);
  const invoiceDate = inv.invoiceDate
    ? fuzzyMatch(query, inv.invoiceDate)
    : null;
  const invoiceMonthMatch = invoiceMonth
    ? fuzzyMatch(query, invoiceMonth)
    : null;

  const ranked = [
    number,
    customerName,
    status,
    dueDate,
    invoiceDate,
    invoiceMonthMatch,
  ].filter((r): r is FuzzyResult => r !== null);

  if (ranked.length === 0) {
    return {
      matched: false,
      score: 0,
      number: null,
      customerName: null,
      statusLine: null,
    };
  }
  const score = Math.max(...ranked.map((r) => r.score));
  return { matched: true, score, number, customerName, statusLine: status };
}

// ─── filters ─────────────────────────────────────────────────────────────────

function matchesFilters(inv: Invoice, f: InvoiceFilters): boolean {
  if (f.onlyOverdue && !(inv.daysOverdue > 0)) return false;
  if (f.onlyUnpaid && !(inv.outstandingPaise > 0)) return false;

  if (f.dateFrom || f.dateTo) {
    const dateStr =
      f.dateField === "invoice" ? inv.invoiceDate : inv.dueDate;
    if (!dateStr) return false;
    if (f.dateFrom && dateStr < f.dateFrom) return false;
    if (f.dateTo && dateStr > f.dateTo) return false;
  }

  if (f.minPaise != null && inv.outstandingPaise < f.minPaise) return false;
  if (f.maxPaise != null && inv.outstandingPaise > f.maxPaise) return false;

  return true;
}

// ─── highlighting ────────────────────────────────────────────────────────────

function Highlight({
  text,
  indices,
}: {
  text: string;
  indices?: number[] | null;
}) {
  if (!indices || indices.length === 0) return <>{text}</>;
  const set = new Set(indices);

  const groups: { text: string; match: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const match = set.has(i);
    const last = groups[groups.length - 1];
    if (last && last.match === match) {
      last.text += text[i];
    } else {
      groups.push({ text: text[i], match });
    }
  }

  return (
    <>
      {groups.map((g, i) =>
        g.match ? (
          <mark
            key={i}
            className="rounded-sm bg-yellow-400/40 px-[1px] text-black"
          >
            {g.text}
          </mark>
        ) : (
          <span key={i}>{g.text}</span>
        ),
      )}
    </>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function statusLine(inv: Invoice): string {
  if (inv.status === "paid") return "Paid";
  if (inv.status === "draft") return "Draft";
  if (inv.status === "cancelled") return "Cancelled";
  if (inv.status === "disputed") return "Disputed";
  if (inv.daysOverdue > 0) return `${inv.daysOverdue} days overdue`;
  return `Due ${inv.dueDate}`;
}

// ─── component ───────────────────────────────────────────────────────────────

export function InvoicesClient({
  invoices,
  activeLabel,
}: {
  invoices: Invoice[];
  activeLabel: string;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<InvoiceFilters>(EMPTY_FILTERS);

  const filtersActive = !isEmptyFilters(filters);

  const filtered = useMemo(() => {
    let base = invoices;
    if (filtersActive) {
      base = base.filter((inv) => matchesFilters(inv, filters));
    }

    const q = query.trim();
    if (!q) {
      return base.map((inv) => ({
        invoice: inv,
        match: matchInvoice(inv, ""),
      }));
    }
    return base
      .map((inv) => ({ invoice: inv, match: matchInvoice(inv, q) }))
      .filter((r) => r.match.matched)
      .sort((a, b) => b.match.score - a.match.score);
  }, [invoices, query, filters, filtersActive]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const row of filtered) {
      const key = row.invoice.invoiceDate
        ? row.invoice.invoiceDate.slice(0, 7)
        : "undated";
      (map[key] ??= []).push(row);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const emptyMessage = query
    ? filtersActive
      ? "No invoices match your search or filters."
      : "No invoices match your search."
    : filtersActive
      ? "No invoices match your filters."
      : `No ${activeLabel}invoices.`;

  return (
    <div className="flex flex-col w-full items-center justify-center pt-6">
      <div className="w-[90vw]">
        <div className="flex flex-row gap-4">
          <InputGroup className="bg-[#171717]/20! border-white/10 w-full">
            <InputGroupAddon className="bg-[#171717]/20!">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M9.89181 4.9459C9.89181 2.21947 7.67233 0 4.9459 0C2.21947 0 0 2.21947 0 4.9459C0 7.67233 2.21947 9.89181 4.9459 9.89181C6.08964 9.89181 7.13447 9.50232 7.97527 8.84699L11.1283 12L12 11.1283L8.84699 7.97527C9.5218 7.10941 9.88937 6.04366 9.89181 4.9459ZM1.23648 4.9459C1.23648 2.89954 2.89954 1.23648 4.9459 1.23648C6.99227 1.23648 8.65533 2.89954 8.65533 4.9459C8.65533 6.99227 6.99227 8.65533 4.9459 8.65533C2.89954 8.65533 1.23648 6.99227 1.23648 4.9459Z"
                  fill="white"
                  fillOpacity="0.2"
                />
              </svg>
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="placeholder:text-white/30 text-white"
              placeholder="Search number, customer, status, date…"
            />
          </InputGroup>

          <FilterDrawer filters={filters} onChange={setFilters} />
        </div>

        {(query || filtersActive) && filtered.length > 0 && (
          <p className="mt-3 text-[10px] italic text-white">
            {filtered.length} match{filtered.length === 1 ? "" : "es"}
            {filtersActive && ` · ${countActiveFiltersLabel(filters)}`}
          </p>
        )}

        {filtered.length === 0 ? (
          <div className="mt-6 border border-white/10 p-4 text-sm text-white italic">
            {emptyMessage}
            {(query || filtersActive) && (
              <button
                onClick={() => {
                  setQuery("");
                  setFilters(EMPTY_FILTERS);
                }}
                className="ml-2 underline underline-offset-4"
              >
                Clear all
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-8 pt-6">
            {grouped.map(([month, rows]) => (
              <div key={month} className="flex flex-col gap-4">
                <div>
                  <p className="relative flex flex-row w-fit items-center justify-center pb-1 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-[linear-gradient(to_right,rgba(255,255,255,0.1),rgba(255,255,255,0.2))] after:[mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)] after:[-webkit-mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)]">
                    <span className="text-center text-white">
                      {month === "undated"
                        ? "Undated"
                        : format(parseISO(`${month}-01`), "MMMM yyyy")}
                    </span>
                  </p>
                </div>

                <ul className="gap-4 flex flex-col">
                  {rows.map(({ invoice: inv, match }) => (
                    <li key={inv.id}>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="flex flex-row items-start justify-between gap-3 border border-white/10 p-3 transition-colors hover:bg-white/5"
                      >
                        <div className="flex flex-col items-start gap-1 min-w-0">
                          <p className="text-sm italic text-white">
                            <Highlight
                              text={statusLine(inv)}
                              indices={match.statusLine?.indices}
                            />
                          </p>
                          <h2 className="text-base text-white truncate w-full">
                            <Highlight
                              text={inv.number}
                              indices={match.number?.indices}
                            />
                            {inv.customerName && (
                              <>
                                {" · "}
                                <Highlight
                                  text={inv.customerName}
                                  indices={match.customerName?.indices}
                                />
                              </>
                            )}
                          </h2>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 pt-1">
                          <span className="text-base tabular-nums text-white">
                            {formatINR(inv.outstandingPaise ?? 0)}
                          </span>
                          <svg
                            width="6"
                            height="10"
                            viewBox="0 0 6 10"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            aria-hidden="true"
                          >
                            <path
                              d="M1.19663 10L6 5L1.19663 0L0 1.24343L3.6236 5L0 8.75657L1.19663 10Z"
                              fill="white"
                              fillOpacity="0.5"
                            />
                          </svg>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function countActiveFiltersLabel(f: InvoiceFilters): string {
  const parts: string[] = [];
  if (f.dateFrom || f.dateTo) parts.push("date");
  if (f.minPaise != null || f.maxPaise != null) parts.push("amount");
  if (f.onlyOverdue) parts.push("overdue");
  if (f.onlyUnpaid) parts.push("unpaid");
  return parts.join(", ") + " filter" + (parts.length === 1 ? "" : "s");
}

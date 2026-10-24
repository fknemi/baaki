"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";

type Customer = {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string | null;
  placeOfSupplyState: string | null;
  city: string | null;
  creditDays: number;
  preferredLanguage: string;
  avgDaysLate: number;
  pctOnTime: number;
  grade: "A" | "B" | "C" | "NEW";
  gradeReason: string;
  totalOutstandingPaise: number;
};

const GRADE_COLOR: Record<string, string> = {
  A: "bg-[#067647] text-white",
  B: "bg-[#B54708] text-white",
  C: "bg-[#B42318] text-white",
  NEW: "bg-[#5A6170] text-white",
};

type GradeFilter = "all" | "A" | "B" | "C" | "NEW";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");

  useEffect(() => {
    fetch("/api/customers")
      .then((r) => r.json())
      .then((j) => {
        if (j.error) setError(j.error.message);
        else setCustomers(j.data ?? []);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error)
    return <main className="p-4 text-sm text-[#B42318]">{error}</main>;
  if (!customers)
    return <main className="p-4 text-sm text-[#5A6170]">Loading…</main>;

  const filtered = customers.filter((c) => {
    if (gradeFilter !== "all" && c.grade !== gradeFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q) ||
        (c.gstin ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const gradeCounts: Record<GradeFilter, number> = {
    all: customers.length,
    A: customers.filter((c) => c.grade === "A").length,
    B: customers.filter((c) => c.grade === "B").length,
    C: customers.filter((c) => c.grade === "C").length,
    NEW: customers.filter((c) => c.grade === "NEW").length,
  };

  return (
    <main className="space-y-3 p-4 pb-24">
      <h1 className="text-xl font-semibold">Customers</h1>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, city, GSTIN"
        className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm"
      />

      <div className="flex gap-2 overflow-x-auto">
        {(["all", "A", "B", "C", "NEW"] as GradeFilter[]).map((g) => (
          <button
            key={g}
            onClick={() => setGradeFilter(g)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
              gradeFilter === g
                ? "bg-[#0F5C4E] text-white"
                : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
            }`}
          >
            {g === "all" ? "All" : g} ({gradeCounts[g]})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-lg bg-white p-4 text-xs text-[#5A6170] ring-1 ring-[#E4E7EC]">
          {customers.length === 0
            ? "No customers yet."
            : "No customers match your search."}
          {(query || gradeFilter !== "all") && (
            <button
              onClick={() => {
                setQuery("");
                setGradeFilter("all");
              }}
              className="ml-2 underline"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className="block rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        GRADE_COLOR[c.grade] ?? "bg-[#5A6170] text-white"
                      }`}
                      aria-label={`Grade ${c.grade}`}
                    >
                      {c.grade}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {c.name}
                      </div>
                      <div className="text-[10px] text-[#5A6170]">
                        {c.gradeReason}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {formatINR(c.totalOutstandingPaise)}
                    </div>
                    <div className="text-[10px] text-[#5A6170]">
                      Credit {c.creditDays}d
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-[#5A6170]">
                  <span>{c.placeOfSupplyState ?? c.stateCode ?? "—"}</span>
                  {c.stateCode && (
                    <span className="text-[#5A6170]/70">({c.stateCode})</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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

type CustomerMatch = {
  matched: boolean;
  score: number;
  name: FieldMatch;
  gstin: FieldMatch;
  city: FieldMatch;
  placeOfSupplyState: FieldMatch;
};

function matchCustomer(c: Customer, query: string): CustomerMatch {
  if (!query) {
    return {
      matched: true,
      score: 0,
      name: null,
      gstin: null,
      city: null,
      placeOfSupplyState: null,
    };
  }
  const name = fuzzyMatch(query, c.name);
  const gstin = c.gstin ? fuzzyMatch(query, c.gstin) : null;
  const city = c.city ? fuzzyMatch(query, c.city) : null;
  const placeOfSupplyState = c.placeOfSupplyState
    ? fuzzyMatch(query, c.placeOfSupplyState)
    : null;

  const ranked = [name, gstin, city, placeOfSupplyState].filter(
    (r): r is FuzzyResult => r !== null,
  );
  if (ranked.length === 0) {
    return {
      matched: false,
      score: 0,
      name: null,
      gstin: null,
      city: null,
      placeOfSupplyState: null,
    };
  }
  const score = Math.max(...ranked.map((r) => r.score));
  return { matched: true, score, name, gstin, city, placeOfSupplyState };
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

// ─── page ────────────────────────────────────────────────────────────────────

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

  const filtered = useMemo(() => {
    if (!customers) return [];
    const base = customers.filter((c) =>
      gradeFilter === "all" ? true : c.grade === gradeFilter,
    );
    const q = query.trim();
    if (!q) {
      return base.map((c) => ({ customer: c, match: matchCustomer(c, "") }));
    }
    return base
      .map((c) => ({ customer: c, match: matchCustomer(c, q) }))
      .filter((r) => r.match.matched)
      .sort((a, b) => b.match.score - a.match.score);
  }, [customers, query, gradeFilter]);

  const gradeCounts: Record<GradeFilter, number> = useMemo(() => {
    if (!customers) return { all: 0, A: 0, B: 0, C: 0, NEW: 0 };
    return {
      all: customers.length,
      A: customers.filter((c) => c.grade === "A").length,
      B: customers.filter((c) => c.grade === "B").length,
      C: customers.filter((c) => c.grade === "C").length,
      NEW: customers.filter((c) => c.grade === "NEW").length,
    };
  }, [customers]);

  if (error)
    return <main className="p-4 text-sm text-white">{error}</main>;
  if (!customers)
    return <main className="p-4 text-sm text-white">Loading…</main>;

  return (
    <main className="space-y-3 p-4 pb-24 pt-14">
      <h1 className="text-xl font-semibold text-white">Customers</h1>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, city, GSTIN"
        className="w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [&::-webkit-search-cancel-button]:invert"
      />

      <div className="-mx-4 overflow-x-auto">
        <ul className="flex gap-2 px-4 pb-1">
          {(["all", "A", "B", "C", "NEW"] as GradeFilter[]).map((g) => {
            const active = gradeFilter === g;
            return (
              <li key={g}>
                <button
                  onClick={() => setGradeFilter(g)}
                  aria-pressed={active}
                  className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-white text-[#111]"
                      : "border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5"
                  }`}
                >
                  {g === "all" ? "All" : g} ({gradeCounts[g]})
                </button>
              </li>
            );
          })}
          <li aria-hidden="true" className="w-4 shrink-0" />
        </ul>
      </div>

      {query && filtered.length > 0 && (
        <p className="text-[10px] italic text-white">
          {filtered.length} match{filtered.length === 1 ? "" : "es"}
        </p>
      )}

      {filtered.length === 0 && (
        <div className="border border-white/10 p-4 text-xs text-white italic">
          {customers.length === 0
            ? "No customers yet."
            : query
              ? "No customers match your search."
              : "No customers in this grade."}
          {(query || gradeFilter !== "all") && (
            <button
              onClick={() => {
                setQuery("");
                setGradeFilter("all");
              }}
              className="ml-2 underline underline-offset-4"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="space-y-2">
          {filtered.map(({ customer: c, match }) => (
            <li key={c.id}>
              <Link
                href={`/customers/${c.id}`}
                className="block border border-white/10 p-4 hover:bg-white/5"
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
                      <div className="truncate text-sm font-medium text-white">
                        <Highlight text={c.name} indices={match.name?.indices} />
                      </div>
                      <div className="text-[10px] text-white italic">
                        {c.gradeReason}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-white">
                      {formatINR(c.totalOutstandingPaise ?? 0)}
                    </div>
                    <div className="text-[10px] text-white italic">
                      Credit {c.creditDays}d
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] text-white italic">
                  {c.city && (
                    <>
                      <Highlight text={c.city} indices={match.city?.indices} />
                      {" · "}
                    </>
                  )}
                  {c.placeOfSupplyState ? (
                    <Highlight
                      text={c.placeOfSupplyState}
                      indices={match.placeOfSupplyState?.indices}
                    />
                  ) : (
                    !c.city && <>{c.stateCode ?? "—"}</>
                  )}
                  {c.stateCode && c.placeOfSupplyState && (
                    <> ({c.stateCode})</>
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

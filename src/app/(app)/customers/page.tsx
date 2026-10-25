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

// ─── shared chrome ───────────────────────────────────────────────────────────

const SEARCH_INPUT =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 text-white " +
  "placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 " +
  "[&::-webkit-search-cancel-button]:invert " +
  "h-9 px-3 text-sm " +
  "sm:h-10 sm:rounded-lg sm:px-3.5 sm:text-base " +
  "md:h-11 md:rounded-xl md:px-4 md:text-base " +
  "lg:h-12 lg:rounded-xl lg:px-4 lg:text-lg " +
  "xl:h-14 xl:rounded-xl xl:px-5 xl:text-lg";

const CHIP =
  "inline-block whitespace-nowrap rounded-full font-medium transition-colors " +
  "px-3 py-1.5 text-xs " +
  "sm:px-3.5 sm:py-1.5 sm:text-xs " +
  "md:px-4 md:py-2 md:text-sm " +
  "lg:px-4 lg:py-2 lg:text-sm " +
  "xl:px-5 xl:py-2.5 xl:text-base";

const CHIP_ACTIVE = "bg-white text-[#111]";
const CHIP_INACTIVE =
  "border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5";

const ROW_CARD =
  "block border border-white/10 hover:bg-white/5 " +
  "rounded-lg p-3 " +
  "sm:rounded-xl sm:p-4 " +
  "md:rounded-xl md:p-5 " +
  "lg:rounded-2xl lg:p-5 " +
  "xl:rounded-2xl xl:p-6";

// aspect-square  — belt-and-suspenders: keeps 1:1 even if h-* or w-* is
//                  ever dropped from this string in a future edit.
// leading-none   — collapses the line-box to the font-size so items-center
//                  centers the GLYPH (not an oversized line-box whose
//                  baseline sits ~80% down). Without this, the letter
//                  drifts toward the bottom as text-base scales the
//                  line-height to 24px inside a 40px box, and the badge
//                  reads as a squashed pill even though border-radius is
//                  still 9999px.
// text-center    — guards against horizontal mis-centering on very wide
//                  letters (M/W) at lg/xl.
const GRADE_BADGE =
  "inline-flex shrink-0 items-center justify-center rounded-full font-semibold " +
  "aspect-square leading-none text-center " +
  "h-6 w-6 text-xs " +
  "sm:h-7 sm:w-7 sm:text-xs " +
  "md:h-8 md:w-8 md:text-sm " +
  "lg:h-9 lg:w-9 lg:text-sm " +
  "xl:h-10 xl:w-10 xl:text-base";

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
    return (
      <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
        {error}
      </main>
    );
  if (!customers)
    return (
      <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
        Loading…
      </main>
    );

  return (
    <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 sm:max-w-xl sm:space-y-3 sm:px-4 sm:pb-24 sm:pt-16 md:max-w-2xl md:space-y-4 md:px-6 md:pb-28 md:pt-20 lg:max-w-3xl lg:space-y-4 lg:px-6 lg:pb-32 lg:pt-24 xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24">
      <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
        Customers
      </h1>

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, city, GSTIN"
        className={SEARCH_INPUT}
      />

      <div className="-mx-3 overflow-x-auto sm:-mx-4 md:-mx-6 lg:-mx-6 xl:-mx-8">
        <ul className="flex gap-2 px-3 pb-1 sm:gap-2 sm:px-4 md:gap-2.5 md:px-6 lg:gap-2.5 lg:px-6 xl:gap-3 xl:px-8">
          {(["all", "A", "B", "C", "NEW"] as GradeFilter[]).map((g) => {
            const active = gradeFilter === g;
            return (
              <li key={g}>
                <button
                  onClick={() => setGradeFilter(g)}
                  aria-pressed={active}
                  className={`${CHIP} ${active ? CHIP_ACTIVE : CHIP_INACTIVE}`}
                >
                  {g === "all" ? "All" : g} ({gradeCounts[g]})
                </button>
              </li>
            );
          })}
          <li aria-hidden="true" className="w-3 shrink-0 sm:w-4 md:w-4 lg:w-4 xl:w-5" />
        </ul>
      </div>

      {query && filtered.length > 0 && (
        <p className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
          {filtered.length} match{filtered.length === 1 ? "" : "es"}
        </p>
      )}

      {filtered.length === 0 && (
        <div className="rounded-lg border border-white/10 p-3 text-xs italic text-white sm:rounded-xl sm:p-4 sm:text-sm md:rounded-xl md:p-5 md:text-sm lg:rounded-2xl lg:p-5 lg:text-base xl:rounded-2xl xl:p-6 xl:text-base">
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
        <ul className="space-y-2 sm:space-y-2 md:space-y-2.5 lg:space-y-3 xl:space-y-3">
          {filtered.map(({ customer: c, match }) => (
            <li key={c.id}>
              <Link href={`/customers/${c.id}`} className={ROW_CARD}>
                <div className="flex items-start justify-between gap-3 sm:gap-3 md:gap-4 lg:gap-4 xl:gap-5">
                  <div className="flex min-w-0 items-start gap-2 sm:gap-2.5 md:gap-3 lg:gap-3 xl:gap-4">
                    <span
                      className={`${GRADE_BADGE} ${
                        GRADE_COLOR[c.grade] ?? "bg-[#5A6170] text-white"
                      }`}
                      aria-label={`Grade ${c.grade}`}
                    >
                      {c.grade}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
                        <Highlight text={c.name} indices={match.name?.indices} />
                      </div>
                      <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                        {c.gradeReason}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
                      {formatINR(c.totalOutstandingPaise ?? 0)}
                    </div>
                    <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                      Credit {c.creditDays}d
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-[10px] italic text-white sm:mt-2 sm:text-[11px] md:mt-2.5 md:text-xs lg:mt-3 lg:text-xs xl:mt-3 xl:text-sm">
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

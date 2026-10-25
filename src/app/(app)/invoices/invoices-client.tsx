// src/app/(app)/invoices/invoices-client.tsx
"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";
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

/* ── Infinite scroll config ─────────────────────────────────────── */
const INITIAL_MONTHS = 3;
const MONTHS_PER_PAGE = 1;
const LOAD_DELAY_MS = 280;

/* ── Motion timing (mirrors dashboard) ──────────────────────────── */
const BASE = 90;
const STEP = 60;
const ROW_STEP = 55;
const ROW_CAP = 600;
const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/* ─────────────────────────────────────────────────────────────────────
   Sizing comes from the fluid tokens (--inv-u, --inv-fs-*, --inv-gap …)
   and .inv-container / .inv-t-* classes defined in page.tsx. This
   component renders inside <main class="inv-page">, so it inherits them.
   ───────────────────────────────────────────────────────────────────── */
const INVOICES_CSS = `
.inv-root {
    --inv-ease: cubic-bezier(0.16, 1, 0.3, 1);
    --inv-ease-io: cubic-bezier(0.76, 0, 0.24, 1);
    padding-top: calc(var(--inv-u) * 1.1);
    padding-bottom: calc(var(--inv-u) * 2.5);
}

/* ── Search + filter row ── */
.inv-controls {
    display: flex;
    align-items: stretch;
    gap: var(--inv-gap);
    height: var(--inv-control-h);
}
.inv-search {
    flex: 1 1 0%;
    min-width: 0;
    /* max-width stepped up per breakpoint below */
}
.inv-search-group { height: 100%; }
.inv-addon { padding-left: calc(var(--inv-u) * 0.85); }
.inv-input {
    height: 100%;
    font-size: var(--inv-fs-body);
    line-height: 1.3;
    padding-inline: calc(var(--inv-u) * 0.6);
    text-overflow: ellipsis;
}
.inv-ico-search {
    width:  calc(var(--inv-fs-body) * 0.95);
    height: calc(var(--inv-fs-body) * 0.95);
}
.inv-filter { flex: none; display: flex; align-items: stretch; }
.inv-filter > * {
    height: 100%;
    min-width: var(--inv-control-h);
    font-size: var(--inv-fs-body);
}

/* ── Search responsive sizing — Tailwind default breakpoints ─────
   sm  640px  flex-1 still fills naturally; soft cap in case of
              large-ish landscape phones / small tablets
   md  768px  same idea, slightly tighter
   lg 1024px  controls row centres; search stops growing and sits
              inside its max-width; filter stays next to it
   xl 1280px  give back a little width on wide displays
  2xl 1536px  same, a touch wider again
   ─────────────────────────────────────────────────────────────── */
@media (min-width: 640px) {           /* sm  */
    .inv-search { max-width: calc(var(--inv-u) * 44); }
}
@media (min-width: 768px) {           /* md  */
    .inv-search { max-width: calc(var(--inv-u) * 38); }
}
@media (min-width: 1024px) {          /* lg  */
    .inv-search {
        flex: 0 1 auto;
        width: 100%;
        max-width: calc(var(--inv-u) * 28);
    }
}
@media (min-width: 1280px) {          /* xl  */
    .inv-search { max-width: calc(var(--inv-u) * 30); }
}
@media (min-width: 1536px) {          /* 2xl */
    .inv-search { max-width: calc(var(--inv-u) * 32); }
}

/* ── Spacing ── */
.inv-count { margin-top: calc(var(--inv-u) * 1.1); }
.inv-empty {
    margin-top: calc(var(--inv-u) * 2);
    padding: calc(var(--inv-u) * 1.1);
}
.inv-clear { padding-block: 0.25em; }
.inv-list {
    margin-top: calc(var(--inv-u) * 2.2);
    display: flex;
    flex-direction: column;
    gap: var(--inv-section-gap);
}
.inv-group { display: flex; flex-direction: column; gap: calc(var(--inv-gap) * 1.2); }
.inv-rows  { display: flex; flex-direction: column; gap: var(--inv-gap); }

/* ── Invoice card ── */
.inv-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--inv-u) * 0.9);
    padding: var(--inv-row-pad);
}
.inv-card-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--inv-u) * 0.2);
    min-width: 0;
    flex: 1 1 0%;
}
.inv-card-end {
    display: flex;
    flex: none;
    align-items: center;
    gap: calc(var(--inv-u) * 0.6);
}
.inv-ico-chev {
    flex: none;
    height: calc(var(--inv-fs-title) * 0.7);
    width: auto;
    aspect-ratio: 6 / 10;
}

/* ── Skeleton (matches real card height) ── */
.inv-skel-month {
    height: calc(var(--inv-fs-month) * 1.2);
    width: calc(var(--inv-u) * 8);
}
.inv-skel-row {
    width: 100%;
    height: calc(
        var(--inv-row-pad) * 2 +
        var(--inv-fs-meta) * 1.4 +
        var(--inv-fs-title) * 1.3 +
        var(--inv-u) * 0.2 + 2px
    );
}

/* ── Animations ── */
@keyframes inv-drop {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: none; }
}
.inv-drop {
    animation: inv-drop 600ms var(--inv-ease) var(--d, 0ms) backwards;
}

@keyframes inv-row {
    from { opacity: 0; transform: translateX(-16px); }
    to   { opacity: 1; transform: none; }
}
.inv-row {
    animation: inv-row 600ms var(--inv-ease) var(--d, 0ms) backwards;
}

@keyframes inv-frame {
    from { clip-path: inset(0 -1rem 100% -1rem); }
    to   { clip-path: inset(0 -1rem 0 -1rem); }
}
.inv-frame {
    animation: inv-frame 700ms var(--inv-ease-io) var(--d, 0ms) backwards;
}

@keyframes inv-draw {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
}
.inv-draw::after {
    transform-origin: 0 50%;
    animation: inv-draw 700ms var(--inv-ease) var(--d, 0ms) backwards;
}

@keyframes inv-shimmer {
    from { background-position: 100% 0; }
    to   { background-position: 0% 0; }
}
.inv-skel {
    border-radius: 1px;
    background-image: linear-gradient(
        90deg,
        rgba(255,255,255,0.04) 40%,
        rgba(255,255,255,0.12) 50%,
        rgba(255,255,255,0.04) 60%
    );
    background-size: 300% 100%;
    animation: inv-shimmer 1.6s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
    .inv-root *,
    .inv-root *::before,
    .inv-root *::after {
        animation-duration: 0.01ms !important;
        animation-delay: 0ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
`;

function InvoicesStyles() {
    return <style>{INVOICES_CSS}</style>;
}

/** Scrolls the active status tab into view (tabs overflow on phones/tablets). */
export function ActiveTabReveal({
    navId,
    activeKey,
}: {
    navId: string;
    activeKey: string;
}) {
    useEffect(() => {
        const nav = document.getElementById(navId);
        const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
        if (!nav || !el) return;
        const left = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        nav.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
    }, [navId, activeKey]);
    return null;
}

function MonthSkeleton() {
    return (
        <div className="inv-group">
            <div className="inv-skel inv-skel-month" />
            <div className="inv-rows">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="inv-skel inv-skel-row" />
                ))}
            </div>
        </div>
    );
}

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
        const idx = t.indexOf(q[qi] ?? "", ti);
        if (idx === -1) return null;
        indices.push(idx);
        ti = idx + 1;
    }

    let score = 100;
    score -= (indices[0] ?? 0) * 0.5;
    score -= (text.length - q.length) * 0.1;
    for (let i = 1; i < indices.length; i++) {
        const gap = (indices[i] ?? 0) - (indices[i - 1] ?? 0) - 1;
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
            last.text += text[i] ?? "";
        } else {
            groups.push({ text: text[i] ?? "", match });
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
    const [visibleCount, setVisibleCount] = useState(INITIAL_MONTHS);
    const [loadingMore, setLoadingMore] = useState(false);
    const sentinelRef = useRef<HTMLDivElement | null>(null);

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

    useEffect(() => {
        const timeout = setTimeout(() => setVisibleCount(INITIAL_MONTHS), 0);
        return () => clearTimeout(timeout);
    }, [query, filters]);
    const totalMonths = grouped.length;
    const visibleGroups = grouped.slice(0, visibleCount);
    const hasMore = visibleCount < totalMonths;

    useEffect(() => {
        if (!hasMore) return;
        const el = sentinelRef.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && !loadingMore) {
                    setLoadingMore(true);
                }
            },
            { rootMargin: "200px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [hasMore, loadingMore]);

    useEffect(() => {
        if (!loadingMore) return;
        const t = setTimeout(() => {
            setVisibleCount((c) => Math.min(c + MONTHS_PER_PAGE, totalMonths));
            setLoadingMore(false);
        }, LOAD_DELAY_MS);
        return () => clearTimeout(t);
    }, [loadingMore, totalMonths]);

    const emptyMessage = query
        ? filtersActive
            ? "No invoices match your search or filters."
            : "No invoices match your search."
        : filtersActive
            ? "No invoices match your filters."
            : `No ${activeLabel}invoices.`;

    return (
        <div className="inv-root inv-container flex flex-col">
            <InvoicesStyles />

            {/* search + filter — lg:justify-center centres the pair once the
                search stops being flex-1 (handled in CSS @media lg above).
                sm/md: search fills available width up to its soft cap.      */}
            <div className="inv-drop inv-controls lg:justify-center" style={at(BASE)}>
                <div className="inv-search">
                    <InputGroup className="inv-search-group bg-[#171717]/20! border-white/10 w-full">
                        <InputGroupAddon className="inv-addon bg-[#171717]/20!">
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden="true"
                                className="inv-ico-search shrink-0"
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
                            aria-label="Search invoices"
                            className="inv-input placeholder:text-white/30 text-white"
                            placeholder="Search number, customer, status, date…"
                        />
                    </InputGroup>
                </div>

                <div className="inv-filter">
                    <FilterDrawer filters={filters} onChange={setFilters} />
                </div>
            </div>

            {(query || filtersActive) && filtered.length > 0 && (
                <p
                    className="inv-drop inv-count inv-t-meta italic text-white"
                    style={at(BASE + 80)}
                >
                    {filtered.length} match{filtered.length === 1 ? "" : "es"}
                    {filtersActive && ` · ${countActiveFiltersLabel(filters)}`}
                </p>
            )}

            {filtered.length === 0 ? (
                <div
                    className="inv-drop inv-empty inv-t-body border border-white/10 italic text-white"
                    style={at(BASE + 100)}
                >
                    {emptyMessage}
                    {(query || filtersActive) && (
                        <button
                            onClick={() => {
                                setQuery("");
                                setFilters(EMPTY_FILTERS);
                            }}
                            className="inv-clear ml-2 underline underline-offset-4"
                        >
                            Clear all
                        </button>
                    )}
                </div>
            ) : (
                /* margin-top (not padding) so the gap survives the flex
                   column + entrance-animation combination */
                <div className="inv-list">
                    {visibleGroups.map(([month, rows], monthIdx) => {
                        const frameBase =
                            monthIdx < INITIAL_MONTHS
                                ? BASE + 160 + monthIdx * STEP
                                : 0;

                        return (
                            <div key={month} className="inv-group">
                                <div
                                    className="inv-frame"
                                    style={at(frameBase)}
                                >
                                    <p
                                        className="inv-draw relative flex flex-row w-fit items-center justify-center pb-1 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-[linear-gradient(to_right,rgba(255,255,255,0.1),rgba(255,255,255,0.2))] after:[mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)] after:[-webkit-mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)]"
                                        style={at(frameBase + 40)}
                                    >
                                        <span className="inv-t-month text-center text-white">
                                            {month === "undated"
                                                ? "Undated"
                                                : format(parseISO(`${month}-01`), "MMMM yyyy")}
                                        </span>
                                    </p>
                                </div>

                                <ul className="inv-rows">
                                    {rows.map(({ invoice: inv, match }, rowIdx) => (
                                        <li
                                            key={inv.id}
                                            className="inv-row"
                                            style={at(
                                                frameBase +
                                                80 +
                                                Math.min(rowIdx * ROW_STEP, ROW_CAP),
                                            )}
                                        >
                                            <Link
                                                href={`/invoices/${inv.id}`}
                                                className="inv-card border border-white/10 transition-colors hover:bg-white/5"
                                            >
                                                <div className="inv-card-text">
                                                    <p className="inv-t-meta max-w-full truncate italic text-white">
                                                        <Highlight
                                                            text={statusLine(inv)}
                                                            indices={match.statusLine?.indices}
                                                        />
                                                    </p>
                                                    <h2 className="inv-t-title w-full truncate text-white">
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
                                                <div className="inv-card-end">
                                                    <span className="inv-t-title whitespace-nowrap tabular-nums text-white">
                                                        {formatINR(inv.outstandingPaise ?? 0)}
                                                    </span>
                                                    <svg
                                                        width="6"
                                                        height="10"
                                                        viewBox="0 0 6 10"
                                                        fill="none"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                        aria-hidden="true"
                                                        className="inv-ico-chev"
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
                        );
                    })}

                    {hasMore && (
                        <div ref={sentinelRef} className="py-4">
                            {loadingMore && <MonthSkeleton />}
                        </div>
                    )}
                </div>
            )}
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

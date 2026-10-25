// src/app/(app)/dashboard/page.tsx
"use client";

import {
    Fragment,
    useEffect,
    useMemo,
    useState,
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { formatINR, formatINRDelta } from "@/lib/domain/money";
import CountUp from "@/components/count-up";
import { AgeingBar, type AgeingBucket } from "@/components/charts/ageing-bar";
import { useRouter } from "next/navigation";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

type Chase = {
    invoiceId: string;
    customerName: string;
    amountPaise: number;
    daysOverdue: number;
    score: number;
    reason: string;
};

type DashboardData = {
    totalOutstandingPaise: number;
    overduePaise: number;
    overdueCount: number;
    oldestOverdueDays: number;
    expectedThisWeekPaise: number;
    expectedThisMonthPaise: number;
    billsDue30dPaise: number;
    cashInBankPaise: number;
    lowestPointPaise: number;
    breachWeek: number | null;
    bufferWarning: boolean;
    ageing: AgeingBucket[];
    chase: Chase[];
};

type ExpenseItem = {
    id: string;
    label: string;
    category: string;
    amountPaise: number;
    recurrence: string;
    dueDate: string | null;
    paid: boolean;
};

type ExpensesSummary = {
    unpaidCount: number;
    unpaidPaise: number;
    items: ExpenseItem[];
};

type DateOption = { group: string; value: string; label: string };

const SHELL = "w-[92vw] max-w-[1600px]";
const GAP = "gap-3 sm:gap-4 md:gap-5 xl:gap-6";

const CARD_Y = "!py-3 sm:!py-4 md:!py-5 xl:!py-6";
const CARD_BASE = `relative w-full min-w-0 !rounded-none !border-[#fff]/10 !bg-transparent ${CARD_Y}`;
const CARD = `${CARD_BASE} !gap-0`;
const PAD_X = "!px-4 sm:!px-5 md:!px-6 lg:!px-7 xl:!px-8";
const HEADER = `!gap-3 sm:!gap-4 md:!gap-5 xl:!gap-6 ${PAD_X}`;
const FOOTER = `!border-none !bg-transparent !italic text-sm sm:text-base lg:text-lg ${PAD_X}`;

const AMOUNT_XL =
    "font-heading !leading-tight !text-[#fff] tabular-nums whitespace-nowrap " +
    "text-[clamp(1.5rem,7vw,3rem)] md:text-[clamp(2rem,4vw,3.25rem)] lg:text-[clamp(2.25rem,3.5vw,3.75rem)] 2xl:text-[clamp(1.75rem,2vw,2.75rem)]";
const AMOUNT_MD =
    "font-heading !leading-tight !text-[#fff] tabular-nums whitespace-nowrap " +
    "text-[clamp(1.25rem,6vw,2rem)] md:text-[clamp(1.5rem,3vw,2.5rem)] lg:text-[clamp(1.75rem,2.5vw,3rem)]";
const ROW_TEXT = "text-base sm:text-xl lg:text-xl xl:text-2xl 2xl:text-3xl";
const SUB_TEXT = "text-xs sm:text-sm lg:text-base";

const TITLE = "font-heading text-base sm:text-lg md:text-xl lg:text-2xl !text-[#fff]";

const DASH_MASK =
    "after:[mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)] after:[-webkit-mask-image:repeating-linear-gradient(to_right,black_0_4px,transparent_4px_8px)]";
const UNDERLINE =
    "dash-draw after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-[linear-gradient(to_right,rgba(255,255,255,0.1),rgba(255,255,255,0.2))] " +
    DASH_MASK;
const UNDERLINE_RED =
    "dash-draw after:absolute after:right-0 after:bottom-0 after:left-0 after:h-px after:bg-[linear-gradient(to_right,rgba(129,24,24,0.4),rgba(129,24,24,1))] " +
    DASH_MASK;

/* pushed further out so the label no longer touches the right-aligned amount;
   the card reserves matching right padding (pr-16 / pr-20) so nothing overflows */
const SIDE_LABEL = `hidden sm:flex absolute inset-y-0 -right-16 sm:-right-16 md:-right-18 flex-col items-center justify-center whitespace-nowrap ${UNDERLINE}`;
const SIDE_LABEL_TEXT = "text-center text-xs sm:text-sm lg:text-base";

const BILLS_ROW = "relative flex flex-row items-start justify-start gap-3 sm:justify-between sm:gap-4 md:gap-5 min-w-0";

const EXPENSE_ITEMS_MAX = 4;

/* ── Motion timing ────────────────────────────────────────────────
   Every card owns a "slot" in the load sequence. BASE is when the first
   frame starts, STEP is the gap between cards. CONTENT_LAG is how long
   after its frame starts a card's contents (and numbers) resolve.
   Tweak these three and the whole sequence retimes together.          */
const BASE = 90;
const STEP = 80;
const CONTENT_LAG = 280;
const slot = (i: number) => BASE + i * STEP;
const countDelay = (i: number) => slot(i) + CONTENT_LAG + 120;
const at = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/* formatters that round the interpolated paise value to whole paise,
   so the animation reads cleanly without floating-point jitter */
const animatedInr = (v: number) => formatINR(Math.round(v));
const animatedInrDelta = (v: number) => formatINRDelta(Math.round(v));

/* cursor-follow light for clickable cards; writes CSS vars straight to
   the element so nothing re-renders on mouse move */
function trackPointer(e: ReactMouseEvent<HTMLElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
}

const DASH_CSS = `
.dash-root {
    --dash-ease: cubic-bezier(0.16, 1, 0.3, 1);
    --dash-ease-io: cubic-bezier(0.76, 0, 0.24, 1);
}

/* ═══ PAGE LOAD ═══════════════════════════════════════════════════
   1. frames: each card's hairline box unrolls top → bottom, staggered
   2. a bright hairline sweeps across the card's top edge
   3. contents + numbers resolve a beat after their frame
   4. underlines draw, the alert pops, chase rows cascade            */

@keyframes dash-frame {
    from { clip-path: inset(0 -6rem 100% -6rem); }
    to   { clip-path: inset(0 -6rem 0 -6rem); }
}
.dash-in {
    animation: dash-frame 750ms var(--dash-ease-io) var(--d, 0ms) backwards;
}

@keyframes dash-content {
    from { opacity: 0; transform: translateY(10px); filter: blur(6px); }
    to   { opacity: 1; transform: none; filter: blur(0); }
}
.dash-in > * {
    animation: dash-content 700ms var(--dash-ease) calc(var(--d, 0ms) + 280ms) backwards;
}

@keyframes dash-sweep {
    from { background-position: 100% 0; }
    to   { background-position: 0% 0; }
}
.dash-in::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    pointer-events: none;
    background: linear-gradient(90deg, transparent 42%, rgba(255,255,255,0.85) 50%, transparent 58%);
    background-size: 300% 100%;
    background-repeat: no-repeat;
    background-position: 100% 0;
    animation: dash-sweep 1100ms var(--dash-ease-io) calc(var(--d, 0ms) + 180ms) backwards;
}

@keyframes dash-wipe {
    from { clip-path: inset(0 100% 0 0); }
    to   { clip-path: inset(0 0 0 0); }
}
.dash-wipe {
    animation: dash-wipe 900ms var(--dash-ease-io) var(--d, 0ms) backwards;
}

@keyframes dash-drop {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: none; }
}
.dash-drop {
    animation: dash-drop 600ms var(--dash-ease) var(--d, 0ms) backwards;
}

@keyframes dash-draw {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
}
.dash-draw::after {
    transform-origin: 0 50%;
    animation: dash-draw 900ms var(--dash-ease) var(--d, 0ms) backwards;
}
.dash-sep {
    transform-origin: 0 50%;
    animation: dash-draw 700ms var(--dash-ease) var(--d, 0ms) backwards;
}

@keyframes dash-alert {
    0%   { opacity: 0; transform: scale(0.3) rotate(0deg); }
    35%  { opacity: 1; transform: scale(1.3) rotate(-10deg); }
    50%  { transform: scale(1.1) rotate(9deg); }
    65%  { transform: scale(1.05) rotate(-5deg); }
    80%  { transform: scale(1) rotate(2deg); }
    100% { transform: none; }
}
.dash-alert {
    transform-origin: 50% 60%;
    animation: dash-alert 1000ms var(--dash-ease) var(--d, 0ms) backwards;
}

@keyframes dash-row {
    from { opacity: 0; transform: translateX(-16px); }
    to   { opacity: 1; transform: none; }
}
.dash-row {
    animation: dash-row 650ms var(--dash-ease) var(--d, 0ms) backwards;
}

/* top-priority invoice: enters like the others, then pings three times */
@keyframes dash-pulse {
    0%        { box-shadow: 0 0 0 0 rgba(28,108,24,0.55); }
    70%, 100% { box-shadow: 0 0 0 12px rgba(28,108,24,0); }
}
.dash-pulse {
    animation:
        dash-row 650ms var(--dash-ease) var(--d, 0ms) backwards,
        dash-pulse 2.4s ease-out calc(var(--d, 0ms) + 1600ms) 3;
}

/* ═══ LOADING SKELETON ════════════════════════════════════════════ */
@keyframes dash-fade {
    from { opacity: 0; }
    to   { opacity: 1; }
}
@keyframes dash-shimmer {
    from { background-position: 100% 0; }
    to   { background-position: 0% 0; }
}
/* invisible for the first 120ms so fast loads never flash a skeleton */
.dash-skel-wrap {
    animation: dash-fade 400ms ease 120ms backwards;
}
.dash-skel {
    border-radius: 1px;
    background-image: linear-gradient(
        90deg,
        rgba(255,255,255,0.04) 40%,
        rgba(255,255,255,0.12) 50%,
        rgba(255,255,255,0.04) 60%
    );
    background-size: 300% 100%;
    animation: dash-shimmer 1.6s linear infinite;
}

/* ═══ REFRESH (date change) ═══════════════════════════════════════ */
.dash-grid {
    transition: opacity 250ms ease, filter 250ms ease;
}
.dash-grid[data-refreshing="true"] {
    opacity: 0.45;
    filter: saturate(0.6);
    pointer-events: none;
}
@keyframes dash-bar-run {
    from { transform: translateX(-100%); }
    to   { transform: translateX(250%); }
}
.dash-bar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    z-index: 60;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transition: opacity 200ms ease;
}
.dash-bar[data-on="true"] { opacity: 1; }
.dash-bar::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    width: 40%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
    animation: dash-bar-run 1s var(--dash-ease-io) infinite;
}

/* ═══ MICRO-INTERACTIONS ══════════════════════════════════════════ */

/* clickable summary cards: cursor light, lift, arrow nudge, press.
   Hover is read off the (stationary) link, not the card, so the lift
   can never make the pointer lose the hover and flicker. */
.dash-link {
    transition: translate 350ms var(--dash-ease), scale 180ms var(--dash-ease), border-color 250ms ease;
}
.dash-link::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
        380px circle at var(--mx, 50%) var(--my, 50%),
        rgba(255,255,255,0.075),
        transparent 65%
    );
    transition: opacity 300ms ease;
}
.dash-arrow {
    transition: translate 300ms var(--dash-ease);
}
@media (hover: hover) {
    .dash-a:hover > .dash-link {
        translate: 0 -3px;
        border-color: rgba(255,255,255,0.3) !important;
    }
    .dash-a:hover > .dash-link::after { opacity: 1; }
    .dash-a:hover .dash-arrow { translate: 3px -3px; }
}
.dash-a:active > .dash-link { scale: 0.985; translate: 0 0; }
.dash-a:focus-visible {
    outline: 1px solid rgba(255,255,255,0.55);
    outline-offset: 3px;
}

/* chase rows */
.dash-rowlink {
    transition: background-color 200ms ease, border-color 200ms ease, scale 150ms var(--dash-ease);
}
.dash-nudge {
    transition: translate 300ms var(--dash-ease);
}
@media (hover: hover) {
    .dash-rowlink:not(.dash-pulse):hover { border-color: rgba(255,255,255,0.3); }
    .dash-rowlink:hover .dash-nudge { translate: 4px 0; }
    .dash-rowlink:hover .dash-nudge-s { translate: 2px 0; }
}
.dash-rowlink:active { scale: 0.99; }
.dash-rowlink:focus-visible {
    outline: 1px solid rgba(255,255,255,0.55);
    outline-offset: 2px;
}
.dash-nudge-s {
    transition: translate 300ms var(--dash-ease);
}

/* date picker */
.dash-select {
    transition: border-color 200ms ease, background-color 200ms ease, scale 150ms var(--dash-ease);
}
@media (hover: hover) {
    .dash-select:hover {
        border-color: rgba(255,255,255,0.3) !important;
        background-color: rgba(23,23,23,0.55) !important;
    }
}
.dash-select[data-state="open"] { border-color: rgba(255,255,255,0.4) !important; }
.dash-select:active { scale: 0.97; }

/* ═══ REDUCED MOTION ══════════════════════════════════════════════ */
@media (prefers-reduced-motion: reduce) {
    .dash-root *,
    .dash-root *::before,
    .dash-root *::after {
        animation-duration: 0.01ms !important;
        animation-delay: 0ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
`;

function DashStyles() {
    return <style>{DASH_CSS}</style>;
}

/* Holds the number at zero until its card's contents have resolved, then
   hands over to CountUp so the count-in lands in sync with the reveal.
   CountUp is keyed on \`to\`, so on a date change the value re-counts
   without any of the surrounding entrance animations replaying. */
function Amount({
    to,
    formatter,
    delay,
}: {
    to: number;
    formatter: (v: number) => string;
    delay: number;
}) {
    const [live, setLive] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setLive(true), delay);
        return () => clearTimeout(t);
    }, [delay]);
    if (!live) return <>{formatter(0)}</>;
    return (
        <CountUp
            key={to}
            to={to}
            formatter={formatter}
            trigger="load"
            duration={1.2}
        />
    );
}

function CornerArrow() {
    return (
        <span className="absolute top-0 right-0 p-3 sm:p-4 md:p-5 lg:p-6 xl:p-7">
            <svg
                className="dash-arrow size-2 sm:size-2.5 md:size-3 lg:size-3.5"
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
            >
                <path
                    d="M10 9.2688V0H0.731205V2.05973H6.48816L0 8.53759L1.46241 10L7.94027 3.51184V9.2688H10Z"
                    fill="currentColor"
                    className="text-[#E5E5E5]/25 transition-all duration-200 group-hover:text-[#E5E5E5]"
                />
            </svg>
        </span>
    );
}

function DashedSeparator({ delay = 0, animate = true }: { delay?: number; animate?: boolean }) {
    return (
        <svg
            className={animate ? "dash-sep" : ""}
            style={animate ? at(delay) : undefined}
            width="100%"
            height="1"
            viewBox="0 0 100 1"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
        >
            <path d="M0 0.25H100" strokeWidth="0.5" stroke="white" strokeOpacity="0.102" />
        </svg>
    );
}

function Skel({ className = "" }: { className?: string }) {
    return <div className={`dash-skel ${className}`} aria-hidden="true" />;
}

const SKEL_CARD = `relative flex w-full min-w-0 flex-col border border-[#fff]/10 gap-3 sm:gap-4 md:gap-5 xl:gap-6 ${CARD_Y} ${PAD_X}`;

function DashboardSkeleton() {
    return (
        <main
            className="dash-root dash-skel-wrap flex flex-col items-center pt-14 sm:pt-16 md:pt-20 lg:pt-24 pb-8 sm:pb-10 lg:pb-14"
            aria-busy="true"
            aria-label="Loading dashboard"
        >
            <DashStyles />
            <div className={`flex ${SHELL} items-center justify-end`}>
                <Skel className="h-10 w-1/5 min-w-[9.5rem] sm:min-w-[11rem] md:h-11 lg:h-12" />
            </div>

            <div
                className={`mt-3 sm:mt-4 md:mt-5 xl:mt-6 ${SHELL} grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 ${GAP}`}
            >
                {[0, 1].map((i) => (
                    <div key={i} className={SKEL_CARD}>
                        <Skel className="h-5 w-32" />
                        <Skel className="h-10 w-3/4" />
                        <Skel className="h-4 w-1/2" />
                    </div>
                ))}

                <div
                    className={`grid w-full min-w-0 grid-cols-1 sm:grid-cols-2 md:col-span-2 2xl:col-span-2 ${GAP}`}
                >
                    {[0, 1].map((i) => (
                        <div key={i} className={SKEL_CARD}>
                            <Skel className="h-5 w-36" />
                            <Skel className="h-9 w-2/3" />
                        </div>
                    ))}
                </div>

                <div className={`${SKEL_CARD} md:col-span-2 lg:col-span-1 2xl:col-span-2`}>
                    <Skel className="h-5 w-24" />
                    <div className="flex items-center justify-between gap-4">
                        <Skel className="h-6 w-28" />
                        <Skel className="h-6 w-32" />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <Skel className="h-6 w-28" />
                        <Skel className="h-6 w-32" />
                    </div>
                </div>

                <div className={`${SKEL_CARD} md:col-span-2 lg:col-span-1 2xl:col-span-2`}>
                    <Skel className="h-5 w-28" />
                    <Skel className="mx-auto h-8 w-40" />
                    <Skel className="h-10 w-full" />
                    <Skel className="h-10 w-full" />
                </div>

                <div className="md:col-span-2 lg:col-span-1 2xl:col-span-2">
                    <Skel className="h-56 w-full" />
                </div>

                <div className={`${SKEL_CARD} md:col-span-2 lg:col-span-1 2xl:col-span-2`}>
                    <Skel className="h-5 w-40" />
                    {[0, 1, 2, 3].map((i) => (
                        <Skel key={i} className="h-14 w-full" />
                    ))}
                </div>
            </div>
        </main>
    );
}

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [expenses, setExpenses] = useState<ExpensesSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>("today");
    const [reloadKey, setReloadKey] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    /* bumps every time fresh data lands. Used only to decide whether
       entrance animations on rows should play — the card-level entrance
       sequence must NOT replay on a date change (the grid is no longer
       keyed on this), so on subsequent loads we suppress dash-row and
       let just the count-ups re-run. */
    const [dataVersion, setDataVersion] = useState(0);
    const router = useRouter();

    const dateOptions = useMemo<DateOption[]>(() => {
        const out: DateOption[] = [];
        const base = new Date();
        const iso = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${dd}`;
        };
        const shift = (days: number) => {
            const d = new Date(base);
            d.setDate(d.getDate() - days);
            return d;
        };

        out.push({ group: "Recent", value: "today", label: "Today" });
        out.push({ group: "Recent", value: iso(shift(1)), label: `Yesterday (${iso(shift(1))})` });
        out.push({ group: "Recent", value: iso(shift(2)), label: `2 days ago (${iso(shift(2))})` });
        out.push({ group: "Recent", value: iso(shift(3)), label: `3 days ago (${iso(shift(3))})` });

        out.push({ group: "Previous weeks", value: iso(shift(7)), label: `7 days ago (${iso(shift(7))})` });
        out.push({ group: "Previous weeks", value: iso(shift(10)), label: `10 days ago (${iso(shift(10))})` });
        out.push({ group: "Previous weeks", value: iso(shift(14)), label: `14 days ago (${iso(shift(14))})` });
        out.push({ group: "Previous weeks", value: iso(shift(21)), label: `21 days ago (${iso(shift(21))})` });

        const startOfThisMonth = new Date(base.getFullYear(), base.getMonth(), 1);
        const endOfLastMonth = new Date(base.getFullYear(), base.getMonth(), 0);
        const startOfLastMonth = new Date(base.getFullYear(), base.getMonth() - 1, 1);
        const endOf2MonthsAgo = new Date(base.getFullYear(), base.getMonth() - 1, 0);
        const startOf2MonthsAgo = new Date(base.getFullYear(), base.getMonth() - 2, 1);

        out.push({
            group: "Month boundaries",
            value: iso(startOfThisMonth),
            label: `Start of this month (${iso(startOfThisMonth)})`,
        });
        out.push({
            group: "Month boundaries",
            value: iso(endOfLastMonth),
            label: `End of last month (${iso(endOfLastMonth)})`,
        });
        out.push({
            group: "Month boundaries",
            value: iso(startOfLastMonth),
            label: `Start of last month (${iso(startOfLastMonth)})`,
        });
        out.push({
            group: "Month boundaries",
            value: iso(endOf2MonthsAgo),
            label: `End of 2 months ago (${iso(endOf2MonthsAgo)})`,
        });
        out.push({
            group: "Month boundaries",
            value: iso(startOf2MonthsAgo),
            label: `Start of 2 months ago (${iso(startOf2MonthsAgo)})`,
        });

        out.push({ group: "Older", value: iso(shift(30)), label: `30 days ago (${iso(shift(30))})` });
        out.push({ group: "Older", value: iso(shift(45)), label: `45 days ago (${iso(shift(45))})` });
        out.push({ group: "Older", value: iso(shift(60)), label: `60 days ago (${iso(shift(60))})` });
        out.push({ group: "Older", value: iso(shift(90)), label: `90 days ago (${iso(shift(90))})` });

        return out;
    }, []);

    const groupedOptions = useMemo(() => {
        const map = new Map<string, DateOption[]>();
        for (const opt of dateOptions) {
            const arr = map.get(opt.group) ?? [];
            arr.push(opt);
            map.set(opt.group, arr);
        }
        return Array.from(map.entries());
    }, [dateOptions]);

    async function handleDateChange(v: string | null) {
        if (!v) return;
        const isoDate = v === "today" ? null : v;
        try {
            setRefreshing(true);
            const res = await fetch("/api/admin/demo-date", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ date: isoDate }),
            });
            if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                throw new Error(j?.error?.message ?? "Failed to set date");
            }
            setSelectedDate(v);
            setReloadKey((k) => k + 1);
        } catch (e) {
            setRefreshing(false);
            setError(e instanceof Error ? e.message : "Failed to set date");
        }
    }

    useEffect(() => {
        // guards against an older response landing after a newer one
        let cancelled = false;

        fetch("/api/dashboard")
            .then((r) => {
                if (r.status === 401) {
                    router.push(`/login?next=/dashboard`);
                    return null;
                }
                return r.json();
            })
            .then((j) => {
                if (cancelled || !j) return;
                if (j.error) setError(j.error.message);
                else {
                    setData(j.data);
                    setDataVersion((v) => v + 1);
                }
            })
            .catch((e) => {
                if (!cancelled) setError(e.message);
            })
            .finally(() => {
                if (!cancelled) setRefreshing(false);
            });

        fetch("/api/expenses?paid=false")
            .then((r) => r.json())
            .then((j) => {
                if (cancelled) return;
                const list: ExpenseItem[] = Array.isArray(j?.data) ? j.data : [];
                const sorted = [...list].sort((a, b) => {
                    if (a.dueDate === b.dueDate) return 0;
                    if (!a.dueDate) return 1;
                    if (!b.dueDate) return -1;
                    return a.dueDate < b.dueDate ? -1 : 1;
                });
                setExpenses({
                    unpaidCount: list.length,
                    unpaidPaise: list.reduce((s, e) => s + e.amountPaise, 0),
                    items: sorted.slice(0, EXPENSE_ITEMS_MAX),
                });
            })
            .catch(() => {
                if (!cancelled) setExpenses({ unpaidCount: 0, unpaidPaise: 0, items: [] });
            });

        return () => {
            cancelled = true;
        };
    }, [router, reloadKey]);

    if (error)
        return (
            <main className="p-4 text-sm text-[#B42318] sm:p-6 sm:text-base">
                {error}
            </main>
        );
    if (!data) return <DashboardSkeleton />;

    /* first successful data load → entrance animations play;
       any subsequent load (date change) → only count-ups re-run */
    const isFirstLoad = dataVersion <= 1;

    const chasePreview = data.chase.slice(0, 5);
    const hiddenExpenses = expenses
        ? expenses.unpaidCount - expenses.items.length
        : 0;

    return (
        <main className="dash-root flex flex-col items-center pt-14 sm:pt-16 md:pt-20 lg:pt-24 pb-8 sm:pb-10 lg:pb-14">
            <DashStyles />
            <div
                className="dash-bar"
                data-on={refreshing ? "true" : "false"}
                aria-hidden="true"
            />

            <div
                className={`dash-drop flex ${SHELL} items-center justify-end`}
                style={at(0)}
            >
                <Select value={selectedDate} onValueChange={handleDateChange}>
                    <SelectTrigger className="dash-select !border-[#ffff]/10 !bg-[#171717]/20 w-1/5 min-w-[9.5rem] sm:min-w-[11rem] sm:!h-10 sm:!text-sm md:!h-11 md:!text-base lg:!h-12 lg:!text-base">
                        <SelectValue placeholder="Select a Date" />
                    </SelectTrigger>
                    <SelectContent>
                        {groupedOptions.map(([group, opts]) => (
                            <SelectGroup key={group}>
                                <SelectLabel className="sm:text-sm lg:text-base">
                                    {group}
                                </SelectLabel>
                                {opts.map((opt) => (
                                    <SelectItem
                                        key={opt.value}
                                        value={opt.value}
                                        className="sm:text-sm md:text-base"
                                    >
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div
                data-refreshing={refreshing ? "true" : "false"}
                className={`dash-grid mt-3 sm:mt-4 md:mt-5 xl:mt-6 ${SHELL} grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 ${GAP}`}
            >
                {/* Money To Collect — clickable → /follow-ups */}
                <Link
                    href="/follow-ups"
                    className="dash-a group block min-w-0 cursor-pointer"
                    onMouseMove={trackPointer}
                >
                    <Card className={`${CARD} dash-in dash-link`} style={at(slot(0))}>
                        <CornerArrow />
                        <CardHeader className={HEADER}>
                            <CardTitle className={TITLE}>Money To Collect</CardTitle>
                            <CardDescription className={AMOUNT_XL}>
                                <Amount
                                    to={data.totalOutstandingPaise}
                                    formatter={animatedInr}
                                    delay={countDelay(0)}
                                />
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className={FOOTER}>
                            {data.chase.length > 0
                                ? `${data.chase.length} priority invoice${data.chase.length === 1 ? "" : "s"} to chase`
                                : "nothing outstanding"}
                        </CardFooter>
                    </Card>
                </Link>

                {/* Overdue — clickable → /invoices?status=overdue */}
                <Link
                    href="/invoices?status=overdue"
                    className="dash-a group block min-w-0 cursor-pointer"
                    onMouseMove={trackPointer}
                >
                    <Card className={`${CARD} dash-in dash-link`} style={at(slot(1))}>
                        <CornerArrow />
                        <CardHeader className={HEADER}>
                            <CardTitle className={TITLE}>Overdue</CardTitle>
                            <CardDescription className={AMOUNT_XL}>
                                <Amount
                                    to={data.overduePaise}
                                    formatter={animatedInr}
                                    delay={countDelay(1)}
                                />
                            </CardDescription>
                        </CardHeader>
                        <CardFooter className={FOOTER}>
                            {data.overdueCount > 0
                                ? `${data.overdueCount} invoice${data.overdueCount === 1 ? "" : "s"} · oldest ${data.oldestOverdueDays} day${data.oldestOverdueDays === 1 ? "" : "s"}`
                                : "all invoices on time"}
                        </CardFooter>
                    </Card>
                </Link>

                {/* expected this week / month */}
                <div
                    className={`grid w-full min-w-0 grid-cols-1 sm:grid-cols-2 md:col-span-2 2xl:col-span-2 ${GAP}`}
                >
                    <Card className={`${CARD} dash-in`} style={at(slot(2))}>
                        <CardHeader className={HEADER}>
                            <CardTitle className={TITLE}>expected this week</CardTitle>
                            <CardDescription className={AMOUNT_MD}>
                                <Amount
                                    to={data.expectedThisWeekPaise}
                                    formatter={animatedInr}
                                    delay={countDelay(2)}
                                />
                            </CardDescription>
                        </CardHeader>
                    </Card>
                    <Card className={`${CARD} dash-in`} style={at(slot(3))}>
                        <CardHeader className={HEADER}>
                            <CardTitle className={TITLE}>expected this month</CardTitle>
                            <CardDescription className={AMOUNT_MD}>
                                <Amount
                                    to={data.expectedThisMonthPaise}
                                    formatter={animatedInr}
                                    delay={countDelay(3)}
                                />
                            </CardDescription>
                        </CardHeader>
                    </Card>
                </div>

                {/* bills due / cash in bank / lowest point */}
                <Card
                    className={`${CARD_BASE} dash-in !gap-4 sm:!gap-6 md:!gap-8 justify-center pr-0 sm:pr-16 md:pr-20 md:col-span-2 lg:col-span-1 2xl:col-span-2`}
                    style={at(slot(4))}
                >
                    <CardHeader className={HEADER}>
                        <CardTitle className={TITLE}>
                            <div className="relative flex flex-row items-center justify-start gap-2">
                                <h2 className="whitespace-nowrap text-base sm:text-lg md:text-xl lg:text-2xl">
                                    bills due
                                </h2>
                                <p
                                    className={SIDE_LABEL}
                                    style={at(slot(4) + CONTENT_LAG + 220)}
                                >
                                    <span className={SIDE_LABEL_TEXT}>next 30 days</span>
                                </p>
                            </div>
                        </CardTitle>
                        <CardDescription className="font-heading flex flex-col gap-3 sm:gap-4 md:gap-5 xl:gap-6 !leading-tight !text-[#fff]">
                            <div className={BILLS_ROW}>
                                <h2 className={`whitespace-nowrap ${ROW_TEXT}`}>cash in bank</h2>
                                <p className={`whitespace-nowrap tabular-nums ${ROW_TEXT}`}>
                                    <Amount
                                        to={data.cashInBankPaise}
                                        formatter={animatedInr}
                                        delay={countDelay(4)}
                                    />
                                </p>
                            </div>
                            <div className={BILLS_ROW}>
                                <h2 className={`whitespace-nowrap ${ROW_TEXT}`}>lowest point</h2>
                                <p className={`whitespace-nowrap tabular-nums ${ROW_TEXT}`}>
                                    <Amount
                                        to={data.lowestPointPaise}
                                        formatter={animatedInrDelta}
                                        delay={countDelay(4) + 100}
                                    />
                                </p>
                                {data.breachWeek !== null && (
                                    <p
                                        className={SIDE_LABEL}
                                        style={at(slot(4) + CONTENT_LAG + 360)}
                                    >
                                        <span className={SIDE_LABEL_TEXT}>week {data.breachWeek}</span>
                                    </p>
                                )}
                            </div>
                        </CardDescription>
                    </CardHeader>
                    {data.bufferWarning && data.breachWeek !== null && (
                        <CardFooter className={FOOTER}>
                            <p
                                className={`relative flex w-full flex-col items-center justify-center pb-2 sm:pb-3 md:pb-4 ${UNDERLINE_RED}`}
                                style={at(slot(4) + CONTENT_LAG + 700)}
                            >
                                <svg
                                    className="dash-alert h-auto w-2.5 sm:w-3 lg:w-3.5 xl:w-4"
                                    style={at(slot(4) + CONTENT_LAG + 900)}
                                    width="12"
                                    height="11"
                                    viewBox="0 0 12 11"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M5.6049 3.6046V5.60305M5.6049 7.6015H5.60989M10.4662 8.10122L6.46942 1.10665C6.38227 0.952874 6.25589 0.824965 6.10317 0.735975C5.95045 0.646984 5.77686 0.600098 5.60011 0.600098C5.42336 0.600098 5.24977 0.646984 5.09705 0.735975C4.94433 0.824965 4.81795 0.952874 4.7308 1.10665L0.733989 8.10122C0.6459 8.25378 0.59971 8.42692 0.6001 8.60309C0.60049 8.77925 0.647447 8.95219 0.73621 9.10435C0.824974 9.25652 0.952389 9.38252 1.10554 9.46957C1.25869 9.55663 1.43214 9.60164 1.60829 9.60006H9.60192C9.77723 9.59988 9.94941 9.55358 10.1012 9.4658C10.2529 9.37803 10.3789 9.25187 10.4665 9.1C10.5541 8.94813 10.6001 8.77589 10.6001 8.60058C10.6001 8.42526 10.5539 8.25305 10.4662 8.10122Z"
                                        strokeWidth="1.2"
                                        strokeLinecap="round"
                                        stroke="#811818"
                                    />
                                </svg>
                                <span className="w-full text-center text-sm sm:text-base lg:text-lg">
                                    cash runs below buffer in week {data.breachWeek}
                                </span>
                            </p>
                        </CardFooter>
                    )}
                </Card>

                {/* expenses */}
                <Card
                    className={`${CARD_BASE} dash-in !gap-4 sm:!gap-5 md:!gap-6 justify-center md:col-span-2 lg:col-span-1 2xl:col-span-2`}
                    style={at(slot(5))}
                >
                    <CardHeader className={HEADER}>
                        <CardTitle className={TITLE}>
                            <div className="flex flex-row items-end justify-center gap-2">
                                <h2 className="whitespace-nowrap">expenses</h2>
                            </div>
                        </CardTitle>
                        <CardDescription className="flex w-full flex-col items-stretch gap-3 !leading-tight !text-[#fff]">
                            {expenses === null ? (
                                <h2 className={`text-center italic ${SUB_TEXT}`}>loading…</h2>
                            ) : expenses.unpaidCount === 0 ? (
                                <h2 className={`text-center italic ${SUB_TEXT}`}>
                                    no unpaid expenses
                                </h2>
                            ) : (
                                <>
                                    <div className="flex flex-col items-center gap-1 whitespace-nowrap font-heading">
                                        <p className="text-[clamp(1.25rem,6vw,2rem)] md:text-[clamp(1.5rem,3vw,2.5rem)] tabular-nums">
                                            <Amount
                                                to={expenses.unpaidPaise}
                                                formatter={animatedInr}
                                                delay={countDelay(5)}
                                            />
                                        </p>
                                        <h2 className={`${SUB_TEXT} text-white text-sm font-sans italic`}>
                                            {expenses.unpaidCount} unpaid bill
                                            {expenses.unpaidCount === 1 ? "" : "s"}
                                        </h2>
                                    </div>

                                    <ul className="mt-1 flex w-full flex-col divide-y divide-white/10">
                                        {expenses.items.map((e, idx) => (
                                            <li
                                                key={e.id}
                                                className={`${isFirstLoad ? "dash-row" : ""} flex w-full items-start justify-between gap-2 py-2 first:pt-1 last:pb-0`}
                                                style={at(slot(5) + CONTENT_LAG + 200 + idx * 70)}
                                            >
                                                <div className="min-w-0 flex-1 text-left">
                                                    <p className="truncate text-sm font-medium sm:text-base lg:text-lg">
                                                        {e.label}
                                                    </p>
                                                    <p className="truncate text-[10px] italic font-sans sm:text-xs">
                                                        {e.category}
                                                        {e.dueDate ? ` · due ${e.dueDate}` : ""}
                                                    </p>
                                                </div>
                                                <span className="shrink-0 whitespace-nowrap text-sm tabular-nums sm:text-base lg:text-lg font-heading">
                                                    <Amount
                                                        to={e.amountPaise}
                                                        formatter={animatedInr}
                                                        delay={countDelay(5) + 150 + idx * 70}
                                                    />
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    {hiddenExpenses > 0 && (
                                        <p
                                            className={`text-center text-[10px] italic text-white/50 sm:text-xs ${SUB_TEXT}`}
                                        >
                                            +{hiddenExpenses} more not shown
                                        </p>
                                    )}
                                </>
                            )}
                        </CardDescription>
                    </CardHeader>
                </Card>

                {/* ageing — capped height */}
                <div
                    className="dash-wipe min-w-0 self-start overflow-hidden md:col-span-2 lg:col-span-1 2xl:col-span-2 [&>*]:w-full [&>*]:max-h-full lg:max-h-[22rem]"
                    style={at(slot(6))}
                >
                    <AgeingBar buckets={data.ageing} />
                </div>

                {/* chase list */}
                <Card
                    className={`relative w-full min-w-0 overflow-hidden !rounded-none !bg-transparent ${CARD_Y} !gap-0 !ring-0 dash-in md:col-span-2 lg:col-span-1 2xl:col-span-2`}
                    style={at(slot(7))}
                >
                    <CardHeader className={`min-w-0 !grid-cols-[minmax(0,1fr)] ${HEADER}`}>
                        <CardTitle className={TITLE}>Chase These First</CardTitle>
                        <div className="flex w-full min-w-0 flex-col gap-3 sm:gap-4 md:gap-5 !leading-tight text-[#fff]">
                            {chasePreview.length === 0 ? (
                                <h2 className={`text-center italic ${SUB_TEXT}`}>
                                    nothing to chase right now
                                </h2>
                            ) : (
                                chasePreview.map((c, idx) => (
                                    <Fragment key={c.invoiceId}>
                                        <Link
                                            href={`/invoices/${c.invoiceId}`}
                                            style={at(slot(7) + CONTENT_LAG + 200 + idx * 90)}
                                            className={`dash-rowlink group/row flex w-full min-w-0 flex-row items-center justify-between gap-2 p-2 hover:bg-white/5 sm:gap-3 sm:p-3 md:gap-4 lg:p-4 ${idx === 0
                                                ? "dash-pulse border-2 border-[#1C6C18]"
                                                : `${isFirstLoad ? "dash-row" : ""} border border-[#FFF]/10`
                                                }`}
                                        >
                                            <div className="dash-nudge-s flex min-w-0 flex-1 flex-col justify-center text-left">
                                                <h2 className="truncate text-sm sm:text-base lg:text-lg xl:text-xl">
                                                    {c.customerName}
                                                </h2>
                                                <p className="truncate text-xs italic text-white/60 sm:text-sm lg:text-base">
                                                    {c.reason ||
                                                        (c.daysOverdue > 0
                                                            ? `${c.daysOverdue}d overdue`
                                                            : "not yet due")}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 md:gap-3">
                                                <h3 className="text-sm tabular-nums whitespace-nowrap sm:text-base lg:text-lg xl:text-xl">
                                                    <Amount
                                                        to={c.amountPaise}
                                                        formatter={animatedInr}
                                                        delay={countDelay(7) + 100 + idx * 90}
                                                    />
                                                </h3>
                                                {idx === 0 ? (
                                                    <svg
                                                        className="dash-nudge h-2 w-2.5 sm:h-2.5 sm:w-3 lg:h-3 lg:w-3.5 xl:h-3.5 xl:w-4"
                                                        width="12"
                                                        height="10"
                                                        viewBox="0 0 12 10"
                                                        fill="none"
                                                        aria-hidden="true"
                                                    >
                                                        <path
                                                            d="M0 6H6V10L12 5L6 0V4H0V6Z"
                                                            fill="white"
                                                            fillOpacity="1"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <svg
                                                        className="dash-nudge h-2 w-1 sm:h-2.5 sm:w-[5px] lg:h-3 lg:w-[7px] xl:h-3.5 xl:w-2"
                                                        width="6"
                                                        height="10"
                                                        viewBox="0 0 6 10"
                                                        fill="none"
                                                        aria-hidden="true"
                                                    >
                                                        <path
                                                            d="M1.19663 10L6 5L1.19663 0L0 1.24343L3.6236 5L0 8.75657L1.19663 10Z"
                                                            fill="white"
                                                            fillOpacity="0.5"
                                                        />
                                                    </svg>
                                                )}
                                            </div>
                                        </Link>
                                        {idx === 0 && chasePreview.length > 1 && (
                                            <DashedSeparator
                                                delay={slot(7) + CONTENT_LAG + 300}
                                                animate={isFirstLoad}
                                            />
                                        )}
                                    </Fragment>
                                ))
                            )}
                        </div>
                    </CardHeader>
                </Card>
            </div>
        </main>
    );
}

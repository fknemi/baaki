"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { StuckBox } from "@/components/domain/stuck-box";
import { Checkbox } from "@/components/ui/checkbox";
import type { ForecastRow } from "@/lib/domain/forecast";
import { formatINR, formatINRDelta } from "@/lib/domain/money";

type ForecastData = {
    rows: ForecastRow[];
    breachWeek: number | null;
    gapPaise: number;
    openingCashPaise: number;
    safetyBufferPaise: number;
    lowestPointPaise: number;
    gapInvoiceIds: string[];
    whatIfTargets: {
        topCustomerId: string | null;
        topExpenseId: string | null;
    };
};

type Chase = {
    invoiceId: string;
    customerName: string;
    amountPaise: number;
    daysOverdue: number;
    reason: string;
};

// ─── outline icons ───────────────────────────────────────────────────────────
// Shared ladders. Both capped at h-4 (16 px) on lg/xl so glyphs never
// overpower the h-11→h-14 buttons / text-base→text-lg cards they sit in.

const ICON_MD =
    "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

function IconAlert({ className = ICON_MD }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    );
}

function IconClose({ className = ICON_MD }: { className?: string }) {
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
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function IconChart({ className = ICON_MD }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
        </svg>
    );
}

function IconTable({ className = ICON_MD }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            aria-hidden="true"
        >
            <rect x="3" y="3" width="18" height="18" rx="1" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="9" x2="9" y2="21" />
        </svg>
    );
}

// ─── shared styles ───────────────────────────────────────────────────────────

// Card chrome — matches the rest of the app (rounded-lg → rounded-2xl,
// p-3 → p-6). Two sizes because the stat strip and the chart/table card
// want different paddings at the same width.

const CARD =
    "rounded-lg border border-white/10 p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-5 lg:rounded-2xl lg:p-6 xl:rounded-2xl xl:p-6";
const CARD_SM =
    "rounded-lg border border-white/10 p-2.5 sm:rounded-xl sm:p-3 md:rounded-xl md:p-4 lg:rounded-2xl lg:p-4 xl:rounded-2xl xl:p-5";

// Chart ↔ table toggle button.
const TOGGLE_BTN =
    "flex w-full items-center justify-center font-medium text-white hover:bg-white/5 " +
    "h-9 gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-xs " +
    "sm:h-9 sm:gap-1.5 sm:rounded-lg sm:px-3 sm:text-sm " +
    "md:h-10 md:gap-2 md:rounded-xl md:px-4 md:text-sm " +
    "lg:h-11 lg:gap-2 lg:rounded-xl lg:px-4 lg:text-base " +
    "xl:h-12 xl:gap-2.5 xl:rounded-xl xl:px-5 xl:text-base";

// Secondary action button (Retry / Reset).
const SECONDARY_BTN =
    "flex items-center justify-center font-medium text-white hover:bg-white/5 " +
    "h-9 rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-xs " +
    "sm:h-9 sm:rounded-lg sm:px-3 sm:text-sm " +
    "md:h-10 md:rounded-xl md:px-4 md:text-sm " +
    "lg:h-11 lg:rounded-xl lg:px-4 lg:text-base " +
    "xl:h-12 xl:rounded-xl xl:px-5 xl:text-base";

function errorMessage(e: unknown): string {
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    return "Something went wrong loading the forecast.";
}

export default function ForecastPage() {
    const [data, setData] = useState<ForecastData | null>(null);
    const [chase, setChase] = useState<Chase[]>([]);
    const [showTable, setShowTable] = useState(false);
    const [whatIf, setWhatIf] = useState<string[]>([]);
    const [openWeek, setOpenWeek] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const lastFocusedRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        const qs = whatIf.length > 0 ? `?whatIf=${whatIf.join(",")}` : "";

        Promise.all([
            fetch(`/api/forecast${qs}`, { signal: controller.signal }).then((r) =>
                r.json(),
            ),
            fetch("/api/chase?topN=20", { signal: controller.signal }).then((r) =>
                r.json(),
            ),
        ])
            .then(([f, c]) => {
                if (f.error) setError(f.error.message);
                else {
                    setData(f.data);
                    setError(null);
                }
                if (c.data) setChase(c.data);
            })
            .catch((e: unknown) => {
                if (e instanceof DOMException && e.name === "AbortError") return;
                setError(errorMessage(e));
            });

        return () => controller.abort();
    }, [whatIf]);

    useEffect(() => {
        if (openWeek === null) return;

        lastFocusedRef.current = document.activeElement as HTMLElement | null;
        closeButtonRef.current?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setOpenWeek(null);
                return;
            }
            if (e.key !== "Tab") return;

            const container = dialogRef.current;
            if (!container) return;
            const focusable = container.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            if (focusable.length === 0) return;

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (!first || !last) return;
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            lastFocusedRef.current?.focus();
        };
    }, [openWeek]);

    if (error) {
        return (
            <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 text-sm text-white sm:max-w-xl sm:space-y-3 sm:px-4 sm:pb-24 sm:pt-16 sm:text-base md:max-w-2xl md:space-y-4 md:px-6 md:pb-28 md:pt-20 md:text-base lg:max-w-3xl lg:space-y-4 lg:px-6 lg:pb-32 lg:pt-24 lg:text-lg xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24 xl:text-lg">
                <p>{error}</p>
                <button onClick={() => setError(null)} className={SECONDARY_BTN}>
                    Retry
                </button>
            </main>
        );
    }
    if (!data)
        return (
            <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
                Loading…
            </main>
        );

    const gapSet = new Set(data.gapInvoiceIds);
    const gapCoverers = chase.filter((c) => gapSet.has(c.invoiceId));
    const visibleGapCoverers = gapCoverers.slice(0, 5);
    const hiddenGapCoverers = gapCoverers.length - visibleGapCoverers.length;

    const toggle = (id: string) => {
        setWhatIf((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
        );
    };

    const weekRow =
        openWeek !== null
            ? (data.rows.find((r) => r.week === openWeek) ?? null)
            : null;
    const { topCustomerId, topExpenseId } = data.whatIfTargets;

    return (
        <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 sm:max-w-xl sm:space-y-4 sm:px-4 sm:pb-24 sm:pt-16 md:max-w-2xl md:space-y-4 md:px-6 md:pb-28 md:pt-20 lg:max-w-3xl lg:space-y-5 lg:px-6 lg:pb-32 lg:pt-24 xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24">
            <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
                Cash forecast
            </h1>

            <section className={CARD_SM}>
                <div className="grid grid-cols-3 gap-2 text-center sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
                    <div>
                        <div className="text-[10px] italic text-white sm:text-xs md:text-xs lg:text-sm xl:text-sm">
                            Opening
                        </div>
                        <div className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:mt-0.5 sm:text-sm md:mt-1 md:text-base lg:mt-1 lg:text-lg xl:mt-1 xl:text-lg">
                            {formatINRDelta(data.openingCashPaise)}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] italic text-white sm:text-xs md:text-xs lg:text-sm xl:text-sm">
                            Lowest
                        </div>
                        <div className="mt-0.5 text-xs font-semibold tabular-nums text-[#FF9B8F] sm:mt-0.5 sm:text-sm md:mt-1 md:text-base lg:mt-1 lg:text-lg xl:mt-1 xl:text-lg">
                            {formatINRDelta(data.lowestPointPaise)}
                            {data.breachWeek !== null && (
                                <span className="text-[10px] italic text-white sm:text-xs md:text-xs lg:text-sm xl:text-sm">
                                    {" "}
                                    (W{data.breachWeek})
                                </span>
                            )}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] italic text-white sm:text-xs md:text-xs lg:text-sm xl:text-sm">
                            Buffer
                        </div>
                        <div className="mt-0.5 text-xs font-semibold tabular-nums text-white sm:mt-0.5 sm:text-sm md:mt-1 md:text-base lg:mt-1 lg:text-lg xl:mt-1 xl:text-lg">
                            {formatINR(data.safetyBufferPaise)}
                        </div>
                    </div>
                </div>
            </section>

            {data.breachWeek !== null && (
                <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-[#B42318]/40 bg-[#B42318]/10 p-3 text-xs font-medium text-white sm:gap-2 sm:rounded-lg sm:p-3 sm:text-xs md:gap-2.5 md:rounded-xl md:p-4 md:text-sm lg:gap-3 lg:rounded-xl lg:p-4 lg:text-sm xl:gap-3 xl:rounded-xl xl:p-5 xl:text-base"
                >
                    <IconAlert className={`${ICON_MD} mt-0.5 shrink-0 text-[#FF9B8F]`} />
                    <span>
                        Cash goes below buffer in week {data.breachWeek} · gap{" "}
                        {formatINR(data.gapPaise)}
                    </span>
                </div>
            )}

            {showTable ? (
                <section className={CARD_SM}>
                    <div className="max-h-80 overflow-y-auto pr-1 sm:max-h-96 sm:pr-1 md:max-h-96 md:pr-1.5 lg:max-h-[28rem] lg:pr-2 xl:max-h-[32rem] xl:pr-2">
                        <table className="w-full text-[10px] tabular-nums sm:text-xs md:text-xs lg:text-sm xl:text-sm">
                            <thead className="sticky top-0 bg-[#192221]">
                                <tr className="text-white italic">
                                    <th className="pb-1 text-left sm:pb-1 md:pb-1.5 lg:pb-2 xl:pb-2">
                                        Wk
                                    </th>
                                    <th className="pb-1 text-right sm:pb-1 md:pb-1.5 lg:pb-2 xl:pb-2">
                                        Opening
                                    </th>
                                    <th className="pb-1 text-right sm:pb-1 md:pb-1.5 lg:pb-2 xl:pb-2">
                                        In
                                    </th>
                                    <th className="pb-1 text-right sm:pb-1 md:pb-1.5 lg:pb-2 xl:pb-2">
                                        Out
                                    </th>
                                    <th className="pb-1 text-right sm:pb-1 md:pb-1.5 lg:pb-2 xl:pb-2">
                                        Closing
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map((r) => {
                                    const breach =
                                        data.breachWeek !== null && r.week === data.breachWeek;
                                    return (
                                        <tr
                                            key={r.week}
                                            className={
                                                breach
                                                    ? "bg-[#B42318]/10 text-[#FF9B8F]"
                                                    : "text-white"
                                            }
                                        >
                                            <td className="py-0.5 sm:py-0.5 md:py-1 lg:py-1 xl:py-1">
                                                {r.week}
                                            </td>
                                            <td className="py-0.5 text-right sm:py-0.5 md:py-1 lg:py-1 xl:py-1">
                                                {formatINRDelta(r.openingPaise)}
                                            </td>
                                            <td className="py-0.5 text-right sm:py-0.5 md:py-1 lg:py-1 xl:py-1">
                                                {formatINR(r.inflowPaise)}
                                            </td>
                                            <td className="py-0.5 text-right sm:py-0.5 md:py-1 lg:py-1 xl:py-1">
                                                {formatINR(r.outflowPaise)}
                                            </td>
                                            <td className="py-0.5 text-right font-medium sm:py-0.5 md:py-1 lg:py-1 xl:py-1">
                                                {formatINRDelta(r.closingPaise)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : (
                <ForecastChart
                    rows={data.rows}
                    safetyBufferPaise={data.safetyBufferPaise}
                    breachWeek={data.breachWeek}
                    onWeekClick={setOpenWeek}
                />
            )}

            <button
                onClick={() => setShowTable((s) => !s)}
                aria-pressed={showTable}
                className={TOGGLE_BTN}
            >
                {showTable ? (
                    <>
                        <IconChart />
                        Chart view
                    </>
                ) : (
                    <>
                        <IconTable />
                        Table view
                    </>
                )}
            </button>

            <StuckBox>
                What-if is a preview only — nothing is saved until you take action.
                Reset returns you to the actual forecast.
            </StuckBox>

            <section className={CARD}>
                <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
                    What-if
                </h2>
                <div className="mt-3 space-y-2 text-xs sm:mt-3 sm:space-y-2 sm:text-xs md:mt-4 md:space-y-2.5 md:text-sm lg:mt-4 lg:space-y-3 lg:text-sm xl:mt-5 xl:space-y-3 xl:text-base">
                    <label
                        className={`flex cursor-pointer items-center gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3 ${!topCustomerId ? "opacity-50" : ""
                            }`}
                    >
                        <Checkbox
                            checked={whatIf.some((w) => w.startsWith("delayCustomer"))}
                            onCheckedChange={() =>
                                topCustomerId && toggle(`delayCustomer:${topCustomerId}:30`)
                            }
                            disabled={!topCustomerId}
                            className="bg-transparent border-white/20 h-4 w-4 md:h-5 md:w-5"
                        />
                        <span className="text-white">Delay biggest customer 30 days</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3">
                        <Checkbox
                            checked={whatIf.some((w) => w.startsWith("addInflow"))}
                            onCheckedChange={() => toggle("addInflow:2026-11-15:200000000")}
                            className="bg-transparent border-white/20 h-4 w-4 md:h-5 md:w-5"
                        />
                        <span className="text-white">
                            Simulate big order +₹20,00,000
                        </span>
                    </label>
                    <label
                        className={`flex cursor-pointer items-center gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3 ${!topExpenseId ? "opacity-50" : ""
                            }`}
                    >
                        <Checkbox
                            checked={whatIf.some((w) => w.startsWith("delayExpense"))}
                            onCheckedChange={() =>
                                topExpenseId && toggle(`delayExpense:${topExpenseId}:14`)
                            }
                            disabled={!topExpenseId}
                            className="bg-transparent border-white/20 h-4 w-4 md:h-5 md:w-5"
                        />
                        <span className="text-white">
                            Delay biggest supplier payment 14 days
                        </span>
                    </label>
                    {whatIf.length > 0 && (
                        <button
                            onClick={() => setWhatIf([])}
                            className={`${SECONDARY_BTN} mt-2 sm:mt-2 md:mt-2.5 lg:mt-3 xl:mt-3`}
                        >
                            Reset
                        </button>
                    )}
                </div>
            </section>

            {gapCoverers.length > 0 && (
                <section className={CARD}>
                    <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
                        Invoices that would cover week-{data.breachWeek} gap
                    </h2>
                    <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1 sm:mt-3 sm:max-h-72 sm:space-y-2 sm:pr-1 md:mt-4 md:max-h-80 md:space-y-2.5 md:pr-1.5 lg:mt-4 lg:max-h-96 lg:space-y-3 lg:pr-2 xl:mt-5 xl:max-h-96 xl:space-y-3 xl:pr-2">
                        {visibleGapCoverers.map((c) => (
                            <li key={c.invoiceId}>
                                <Link
                                    href={`/invoices/${c.invoiceId}`}
                                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#171717]/20 p-2 hover:bg-white/5 sm:gap-3 sm:rounded-lg sm:p-2.5 md:gap-3 md:rounded-xl md:p-3 lg:gap-4 lg:rounded-xl lg:p-3.5 xl:gap-4 xl:rounded-xl xl:p-4"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate text-xs font-medium text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                            {c.customerName}
                                        </div>
                                        <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                                            {c.daysOverdue > 0
                                                ? `${c.daysOverdue} days overdue`
                                                : "not yet due"}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-xs font-semibold tabular-nums text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                        {formatINR(c.amountPaise)}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    {hiddenGapCoverers > 0 && (
                        <p className="mt-2 text-[10px] italic text-white sm:mt-2 sm:text-[11px] md:mt-2.5 md:text-xs lg:mt-3 lg:text-xs xl:mt-3 xl:text-sm">
                            +{hiddenGapCoverers} more invoice
                            {hiddenGapCoverers === 1 ? "" : "s"} not shown
                        </p>
                    )}
                </section>
            )}

            {weekRow && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4 md:p-6 lg:p-6 xl:p-8"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setOpenWeek(null);
                    }}
                >
                    <div
                        ref={dialogRef}
                        className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl sm:max-h-[88vh] sm:rounded-xl sm:p-5 md:max-h-[86vh] md:max-w-lg md:rounded-2xl md:p-6 lg:max-h-[85vh] lg:max-w-xl lg:rounded-2xl lg:p-6 xl:max-h-[85vh] xl:max-w-2xl xl:rounded-3xl xl:p-7"
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Week ${weekRow.week} detail`}
                    >
                        <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
                            <div className="min-w-0">
                                <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
                                    Week {weekRow.week}
                                </h2>
                                <p className="mt-1 text-xs italic text-white sm:mt-1 sm:text-sm md:mt-1.5 md:text-sm lg:mt-2 lg:text-base xl:mt-2 xl:text-base">
                                    {weekRow.weekStart} – {weekRow.weekEnd} · opening{" "}
                                    {formatINRDelta(weekRow.openingPaise)}
                                </p>
                            </div>
                            <button
                                ref={closeButtonRef}
                                onClick={() => setOpenWeek(null)}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white sm:h-8 sm:w-8 md:h-9 md:w-9 md:rounded-lg lg:h-9 lg:w-9 lg:rounded-lg xl:h-10 xl:w-10 xl:rounded-lg"
                                aria-label="Close"
                            >
                                <IconClose />
                            </button>
                        </div>
                        <div className="mt-3 space-y-1 text-xs sm:mt-3 sm:space-y-1 sm:text-sm md:mt-4 md:space-y-1.5 md:text-sm lg:mt-4 lg:space-y-2 lg:text-base xl:mt-5 xl:space-y-2 xl:text-base">
                            <div className="flex justify-between gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
                                <span className="text-white italic">Inflows</span>
                                <span className="font-medium tabular-nums text-[#4ADE80]">
                                    +{formatINR(weekRow.inflowPaise)}
                                </span>
                            </div>
                            <div className="flex justify-between gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
                                <span className="text-white italic">Outflows</span>
                                <span className="font-medium tabular-nums text-[#FF9B8F]">
                                    −{formatINR(weekRow.outflowPaise)}
                                </span>
                            </div>
                            <div className="mt-2 flex justify-between gap-2 border-t border-white/10 pt-2 sm:gap-2 sm:pt-2 md:mt-3 md:gap-3 md:pt-2.5 lg:mt-3 lg:gap-3 lg:pt-3 xl:mt-4 xl:gap-4 xl:pt-3">
                                <span className="font-medium text-white">Closing</span>
                                <span className="font-semibold tabular-nums text-white">
                                    {formatINRDelta(weekRow.closingPaise)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}

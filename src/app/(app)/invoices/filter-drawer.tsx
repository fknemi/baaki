// src/app/(app)/invoices/filter-drawer.tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";

export type InvoiceFilters = {
    dateFrom: string | null;
    dateTo: string | null;
    dateField: "invoice" | "due";
    minPaise: number | null;
    maxPaise: number | null;
    onlyOverdue: boolean;
    onlyUnpaid: boolean;
};

export const EMPTY_FILTERS: InvoiceFilters = {
    dateFrom: null,
    dateTo: null,
    dateField: "invoice",
    minPaise: null,
    maxPaise: null,
    onlyOverdue: false,
    onlyUnpaid: false,
};

export function countActiveFilters(f: InvoiceFilters): number {
    let n = 0;
    if (f.dateFrom || f.dateTo) n++;
    if (f.minPaise != null || f.maxPaise != null) n++;
    if (f.onlyOverdue) n++;
    if (f.onlyUnpaid) n++;
    return n;
}

export function isEmptyFilters(f: InvoiceFilters): boolean {
    return countActiveFilters(f) === 0;
}

/* ── Field surfaces ─────────────────────────────────────────────── */

/* native date inputs crop their own text above ~16px, so date text
   caps at text-base; number inputs (no icon/segments) can keep growing */
const dateText = "text-xs sm:text-sm md:text-base lg:text-base xl:text-base 2xl:text-base";
const amountText = "text-xs sm:text-sm md:text-base lg:text-base xl:text-lg 2xl:text-lg";

const fieldHeight = "h-10 sm:h-11 md:h-12 lg:h-12 xl:h-14 2xl:h-14";

const fieldRadius =
    "rounded-lg sm:rounded-lg md:rounded-xl lg:rounded-xl xl:rounded-2xl 2xl:rounded-2xl";

const fieldPadX = "px-3 sm:px-4 md:px-5 lg:px-5 xl:px-6 2xl:px-7";

const fieldBase =
    `${fieldHeight} w-full min-w-0 border border-white/10 bg-[#171717]/20 ` +
    `${fieldRadius} ${fieldPadX} ` +
    "text-white placeholder:text-white/30 focus:outline-none " +
    "focus:ring-1 focus:ring-white/20 [color-scheme:dark]";

/* date field: extra right padding reserved for the calendar icon at
   every breakpoint — the pr ladder always exceeds the icon's width */
const dateField =
    fieldBase +
    ` ${dateText} ` +
    " pr-10 sm:pr-11 md:pr-12 lg:pr-14 xl:pr-14 2xl:pr-16 " +
    "[&::-webkit-calendar-picker-indicator]:h-[1.05em] " +
    "[&::-webkit-calendar-picker-indicator]:w-[1.05em] " +
    "[&::-webkit-calendar-picker-indicator]:ml-0 " +
    "[&::-webkit-calendar-picker-indicator]:mr-0 " +
    "[&::-webkit-calendar-picker-indicator]:cursor-pointer " +
    "[&::-webkit-calendar-picker-indicator]:opacity-60 " +
    "[&::-webkit-calendar-picker-indicator]:hover:opacity-100 " +
    "[&::-webkit-calendar-picker-indicator]:transition-opacity";

const numericField = fieldBase + ` ${amountText}`;

const labelStyle =
    "text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base 2xl:text-base";

const sectionHeading =
    "text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl 2xl:text-2xl";

const pillBase =
    "whitespace-nowrap rounded-full font-medium transition-colors " +
    "h-8 px-3 text-xs " +
    "sm:h-9 sm:px-4 sm:text-sm " +
    "md:h-10 md:px-5 md:text-base " +
    "lg:h-10 lg:px-5 lg:text-base " +
    "xl:h-11 xl:px-6 xl:text-lg " +
    "2xl:h-11 2xl:px-7 2xl:text-lg";

const pillActive = "bg-white text-[#111]";
const pillInactive =
    "border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5";

/* date grid — capped to max-w-sm on phones (so a single date isn't
   absurdly long), release to 2 columns at sm+ where the drawer is wide */
const dateGrid =
    "grid w-full max-w-sm grid-cols-1 gap-2 " +
    "sm:max-w-none sm:grid-cols-2 sm:gap-3 " +
    "md:gap-4 lg:gap-4 xl:gap-5 2xl:gap-6";

const amountGrid =
    "grid w-full grid-cols-2 gap-2 sm:gap-3 md:gap-4 lg:gap-4 xl:gap-5 2xl:gap-6";

const fieldLabelStack =
    "flex min-w-0 flex-col gap-1 sm:gap-1.5 md:gap-2 lg:gap-2 xl:gap-2.5 2xl:gap-3";

export function FilterDrawer({
    filters,
    onChange,
}: {
    filters: InvoiceFilters;
    onChange: (f: InvoiceFilters) => void;
}) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<InvoiceFilters>(filters);
    useEffect(() => {
        if (!open) return;
        const timeout = setTimeout(() => setDraft(filters), 0);
        return () => clearTimeout(timeout);
    }, [open, filters]);
    const activeCount = countActiveFilters(filters);
    const draftCount = countActiveFilters(draft);

    function update<K extends keyof InvoiceFilters>(
        key: K,
        value: InvoiceFilters[K],
    ) {
        setDraft((prev) => ({ ...prev, [key]: value }));
    }

    function apply() {
        onChange(draft);
        setOpen(false);
    }

    function clearAll() {
        setDraft(EMPTY_FILTERS);
    }

    const btnSizing =
        "h-9 px-3 text-xs " +
        "sm:h-10 sm:px-4 sm:text-sm " +
        "md:h-11 md:px-5 md:text-base " +
        "lg:h-11 lg:px-6 lg:text-base " +
        "xl:h-12 xl:px-6 xl:text-lg " +
        "2xl:h-12 2xl:px-7 2xl:text-lg";

    return (
        <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
            <DrawerTrigger
                render={
                    <Button
                        variant="outline"
                        className={
                            "shrink-0 border-white/10 rounded-lg " +
                            btnSizing +
                            " " +
                            (activeCount > 0
                                ? "!bg-white text-[#111] hover:bg-white/90"
                                : "bg-[#171717]/20 text-white hover:bg-white/5")
                        }
                    >
                        Filters{activeCount > 0 ? ` · ${activeCount}` : ""}
                    </Button>
                }
            />

            {/* !important forces our max-widths over the library's
         `sm:max-w-sm` (384px) default on right-side drawers.
         bumped lg/xl/2xl by one step for real breathing room. */}
            <DrawerContent
                className={
                    "border-white/10 bg-[#192221]! w-full! " +
                    "sm:w-[70vw]! md:w-[80vw] lg:max-w-3xl! xl:max-w-3xl! 2xl:max-w-3xl!"
                }
            >
                <DrawerHeader>
                    <DrawerTitle className="text-white text-lg sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl 2xl:text-4xl">
                        Filters
                    </DrawerTitle>
                    <DrawerDescription className="text-xs italic text-white sm:text-sm md:text-base lg:text-base xl:text-lg 2xl:text-lg">
                        Refine the invoice list by date, amount, or status.
                    </DrawerDescription>
                </DrawerHeader>

                <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:space-y-6 sm:p-5 md:space-y-7 md:p-6 lg:space-y-8 lg:p-8 xl:space-y-10 xl:p-10 2xl:space-y-12 2xl:p-12">
                    {/* ── Date range ───────────────────────────────────────────── */}
                    <section className="space-y-2 sm:space-y-2.5 md:space-y-3 lg:space-y-3 xl:space-y-4 2xl:space-y-4">
                        <h3 className={sectionHeading}>Date range</h3>

                        <div className="flex gap-1.5 sm:gap-2 md:gap-2 lg:gap-2 xl:gap-2.5 2xl:gap-3">
                            {(["invoice", "due"] as const).map((f) => {
                                const active = draft.dateField === f;
                                return (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => update("dateField", f)}
                                        aria-pressed={active}
                                        className={`${pillBase} ${active ? pillActive : pillInactive}`}
                                    >
                                        {f === "invoice" ? "Invoice date" : "Due date"}
                                    </button>
                                );
                            })}
                        </div>

                        <div className={dateGrid}>
                            <label className={fieldLabelStack}>
                                <span className={labelStyle}>From</span>
                                <input
                                    type="date"
                                    value={draft.dateFrom ?? ""}
                                    onChange={(e) =>
                                        update("dateFrom", e.target.value || null)
                                    }
                                    className={dateField}
                                />
                            </label>
                            <label className={fieldLabelStack}>
                                <span className={labelStyle}>To</span>
                                <input
                                    type="date"
                                    value={draft.dateTo ?? ""}
                                    onChange={(e) => update("dateTo", e.target.value || null)}
                                    className={dateField}
                                />
                            </label>
                        </div>
                    </section>

                    {/* ── Amount range ─────────────────────────────────────────── */}
                    <section className="space-y-2 sm:space-y-2.5 md:space-y-3 lg:space-y-3 xl:space-y-4 2xl:space-y-4">
                        <h3 className={sectionHeading}>Outstanding amount</h3>
                        <div className={amountGrid}>
                            <label className={fieldLabelStack}>
                                <span className={labelStyle}>Min (₹)</span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step="any"
                                    placeholder="0"
                                    value={
                                        draft.minPaise != null ? draft.minPaise / 100 : ""
                                    }
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        update(
                                            "minPaise",
                                            v === "" ? null : Math.round(Number(v) * 100),
                                        );
                                    }}
                                    className={numericField}
                                />
                            </label>
                            <label className={fieldLabelStack}>
                                <span className={labelStyle}>Max (₹)</span>
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step="any"
                                    placeholder="Any"
                                    value={
                                        draft.maxPaise != null ? draft.maxPaise / 100 : ""
                                    }
                                    onChange={(e) => {
                                        const v = e.target.value;
                                        update(
                                            "maxPaise",
                                            v === "" ? null : Math.round(Number(v) * 100),
                                        );
                                    }}
                                    className={numericField}
                                />
                            </label>
                        </div>
                    </section>

                    {/* ── Quick toggles ────────────────────────────────────────── */}
                    <section className="space-y-2 sm:space-y-2.5 md:space-y-3 lg:space-y-3 xl:space-y-4 2xl:space-y-4">
                        <h3 className={sectionHeading}>Quick filters</h3>

                        <label className="flex cursor-pointer items-center gap-3 border border-white/10 p-3 sm:gap-3.5 sm:p-4 md:gap-4 md:p-5 lg:gap-4 lg:p-5 xl:gap-5 xl:p-6 2xl:gap-6 2xl:p-7">
                            <Checkbox
                                checked={draft.onlyOverdue}
                                onCheckedChange={(v) => update("onlyOverdue", v === true)}
                                className="border-white/20 bg-transparent"
                            />
                            <div className="min-w-0">
                                <div className="text-xs font-medium text-white sm:text-sm md:text-base lg:text-base xl:text-lg 2xl:text-lg">
                                    Overdue only
                                </div>
                                <div className="text-[10px] italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base 2xl:text-base">
                                    Past the due date with balance remaining
                                </div>
                            </div>
                        </label>

                        <label className="flex cursor-pointer items-center gap-3 border border-white/10 p-3 sm:gap-3.5 sm:p-4 md:gap-4 md:p-5 lg:gap-4 lg:p-5 xl:gap-5 xl:p-6 2xl:gap-6 2xl:p-7">
                            <Checkbox
                                checked={draft.onlyUnpaid}
                                onCheckedChange={(v) => update("onlyUnpaid", v === true)}
                                className="border-white/20 bg-transparent"
                            />
                            <div className="min-w-0">
                                <div className="text-xs font-medium text-white sm:text-sm md:text-base lg:text-base xl:text-lg 2xl:text-lg">
                                    With outstanding balance
                                </div>
                                <div className="text-[10px] italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base 2xl:text-base">
                                    Hide fully-paid invoices
                                </div>
                            </div>
                        </label>
                    </section>

                    {draftCount > 0 && (
                        <button
                            type="button"
                            onClick={clearAll}
                            className="text-xs text-white underline underline-offset-4 sm:text-sm md:text-base lg:text-base xl:text-lg 2xl:text-lg"
                        >
                            Clear all filters
                        </button>
                    )}
                </div>

                <DrawerFooter className="border-t border-white/10 gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4 2xl:gap-5">
                    <Button
                        onClick={apply}
                        className={`w-full bg-[#0F5C4E] text-white hover:bg-[#0F5C4E]/90 ${btnSizing}`}
                    >
                        Apply{draftCount > 0 ? ` (${draftCount})` : ""}
                    </Button>
                    <DrawerClose
                        render={
                            <Button
                                variant="outline"
                                className={`w-full border-white/10 bg-[#171717]/20 text-white hover:bg-white/5 ${btnSizing}`}
                            >
                                Cancel
                            </Button>
                        }
                    />
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}

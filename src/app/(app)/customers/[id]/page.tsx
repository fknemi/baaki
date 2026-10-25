"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

// Section shell — border only, no fill (matches dashboard cards).
// Radius scales; each consumer supplies its own responsive padding ladder
// because the header deliberately wants more breathing room than the
// secondary panels below it.
const SURFACE =
    "rounded-lg border border-white/10 sm:rounded-xl md:rounded-xl lg:rounded-2xl xl:rounded-2xl";

// Same badge ladder as the Customers list page.
// leading-none   — collapses the line-box to font-size so items-center
//                  centers the GLYPH, not a 1.25× line-box whose baseline
//                  sits ~80% down.
// aspect-square  — keeps 1:1 even if h-*/w-* is ever dropped.
// text-center    — guards against horizontal mis-centering on wide letters.
const GRADE_BADGE =
    "inline-flex shrink-0 items-center justify-center rounded-full font-semibold " +
    "aspect-square leading-none text-center " +
    "h-8 w-8 text-sm " +
    "sm:h-9 sm:w-9 sm:text-base " +
    "md:h-10 md:w-10 md:text-base " +
    "lg:h-11 lg:w-11 lg:text-lg " +
    "xl:h-12 xl:w-12 xl:text-lg";

// Small inline action (Edit) — h-* ladder for consistent touch targets.
const EDIT_BTN =
    "inline-flex shrink-0 items-center justify-center rounded-lg border border-white/10 font-medium text-white hover:bg-white/5 " +
    "h-8 px-2 text-xs " +
    "sm:h-8 sm:px-2.5 sm:text-xs " +
    "md:h-9 md:px-2.5 md:text-sm " +
    "lg:h-9 lg:px-3 lg:text-sm " +
    "xl:h-10 xl:px-3.5 xl:text-base";

// Footer action buttons — same ladder as the rest of the app's primary CTAs.
const ACTION_BTN =
    "flex items-center justify-center gap-1.5 font-medium " +
    "h-11 rounded-lg px-3 text-sm " +
    "sm:h-11 sm:gap-2 sm:rounded-lg sm:px-4 sm:text-sm " +
    "md:h-12 md:gap-2 md:rounded-xl md:px-4 md:text-base " +
    "lg:h-12 lg:gap-2 lg:rounded-xl lg:px-5 lg:text-base " +
    "xl:h-14 xl:gap-2.5 xl:rounded-xl xl:px-6 xl:text-lg";


function langLabel(l: string): string {
    return l === "hi" ? "हिंदी" : "English";
}

export default function CustomerDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id;
    const router = useRouter();
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
            setInvoices(
                (ij.data ?? []).filter(
                    (i: { customer?: { id?: string } }) => i.customer?.id === id,
                ),
            );
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        }
    }, [id]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            void reload();
        }, 0);
        return () => clearTimeout(timeout);
    }, [reload]);
    const openInvoices = useMemo(
        () =>
            (invoices ?? []).filter(
                (i) =>
                    i.status !== "paid" &&
                    i.status !== "draft" &&
                    i.status !== "cancelled",
            ),
        [invoices],
    );

    async function copyPayLink() {
        if (openInvoices.length === 0) return;
        setCopyingLink(true);
        setError(null);
        try {
            const first = openInvoices[0];
            if (!first) return;
            const res = await fetch(`/api/invoices/${first.id}/pay-link`, {
                method: "POST",
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j?.error?.message ?? "Failed");
            const url: string = j.data.url;

            try {
                await navigator.clipboard.writeText(url);
            } catch {
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

    if (error && !customer)
        return (
            <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 text-sm sm:max-w-xl sm:space-y-3 sm:px-4 sm:pb-24 sm:pt-16 sm:text-base md:max-w-2xl md:space-y-4 md:px-6 md:pb-28 md:pt-20 md:text-base lg:max-w-3xl lg:space-y-4 lg:px-6 lg:pb-32 lg:pt-24 lg:text-lg xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24 xl:text-lg">
                <p className="text-white">{error}</p>
                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        void reload();
                    }}
                    className="h-9 rounded-lg bg-[#0F5C4E] px-4 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 sm:h-9 sm:text-sm md:h-10 md:text-sm lg:h-11 lg:text-base xl:h-12 xl:text-base"
                >
                    Retry
                </button>
            </main>
        );
    if (!customer)
        return (
            <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
                Loading…
            </main>
        );

    return (
        <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 sm:max-w-xl sm:space-y-4 sm:px-4 sm:pb-24 sm:pt-16 md:max-w-2xl md:space-y-4 md:px-6 md:pb-28 md:pt-20 lg:max-w-3xl lg:space-y-5 lg:px-6 lg:pb-32 lg:pt-24 xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24">
            <header className={`${SURFACE} p-3 sm:p-4 md:p-5 lg:p-6 xl:p-6`}>
                <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
                    <div className="min-w-0">
                        <h1 className="break-words text-lg font-semibold text-white sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
                            {customer.name}
                        </h1>
                        <p className="mt-1 break-all font-mono text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                            GSTIN {customer.gstin}
                        </p>
                        <p className="mt-1 text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                            {customer.placeOfSupplyState ?? "—"}
                            {customer.stateCode ? ` (${customer.stateCode})` : ""}
                        </p>
                        <p className="mt-1 text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                            Credit {customer.creditDays} days · Language:{" "}
                            {langLabel(customer.preferredLanguage)}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-4">
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className={EDIT_BTN}
                            aria-label="Edit customer"
                        >
                            ✎ Edit
                        </button>
                        <span
                            className={`${GRADE_BADGE} ${GRADE_COLOR[customer.grade] ?? "bg-[#5A6170] text-white"
                                }`}
                            aria-label={`Grade ${customer.grade}`}
                        >
                            {customer.grade}
                        </span>
                    </div>
                </div>
                <p className="mt-3 text-xs italic text-white sm:mt-3 sm:text-sm md:mt-3 md:text-sm lg:mt-4 lg:text-base xl:mt-4 xl:text-base">
                    {customer.gradeReason}
                </p>
            </header>

            <section className={`${SURFACE} p-3 sm:p-4 md:p-4 lg:p-5 xl:p-5`}>
                <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
                    Payment record
                </h2>
                <dl className="mt-2 grid grid-cols-2 gap-2 sm:mt-2 sm:gap-2 md:mt-3 md:gap-3 lg:mt-3 lg:gap-3 xl:mt-4 xl:gap-4">
                    <div>
                        <dt className="text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                            On time
                        </dt>
                        <dd className="text-lg font-semibold tabular-nums text-white sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
                            {customer.pctOnTime}%
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                            Average late
                        </dt>
                        <dd className="text-lg font-semibold tabular-nums text-white sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
                            {customer.avgDaysLate === 1
                                ? "1 day"
                                : `${customer.avgDaysLate} days`}
                        </dd>
                    </div>
                </dl>
            </section>

            <section className={`${SURFACE} p-3 sm:p-4 md:p-4 lg:p-5 xl:p-5`}>
                <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
                    Contact
                </h2>
                <dl className="mt-2 space-y-1 sm:mt-2 sm:space-y-1 md:mt-3 md:space-y-1.5 lg:mt-3 lg:space-y-1.5 xl:mt-4 xl:space-y-2">
                    {customer.phoneMasked && (
                        <div className="flex justify-between gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
                            <dt className="shrink-0 text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                Phone
                            </dt>
                            <dd className="truncate font-mono text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                {customer.phoneMasked}
                            </dd>
                        </div>
                    )}
                    {customer.email && (
                        <div className="flex justify-between gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
                            <dt className="shrink-0 text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                Email
                            </dt>
                            <dd className="truncate text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                {customer.email}
                            </dd>
                        </div>
                    )}
                    {customer.city && (
                        <div className="flex justify-between gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
                            <dt className="shrink-0 text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                City
                            </dt>
                            <dd className="truncate text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                {customer.city}
                            </dd>
                        </div>
                    )}
                </dl>
            </section>

            <section className={`${SURFACE} p-3 sm:p-4 md:p-4 lg:p-5 xl:p-5`}>
                <div className="flex items-baseline justify-between gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
                    <h2 className="min-w-0 truncate text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
                        Invoices ({openInvoices.length} open)
                    </h2>
                    <span className="shrink-0 tabular-nums text-white text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base">
                        {formatINR(customer.totalOutstandingPaise ?? 0)} owed
                    </span>
                </div>
                {openInvoices.length === 0 ? (
                    <p className="mt-2 text-xs italic text-white sm:mt-2 sm:text-sm md:mt-3 md:text-sm lg:mt-3 lg:text-base xl:mt-4 xl:text-base">
                        No open invoices.
                    </p>
                ) : (
                    <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1 sm:mt-3 sm:max-h-72 sm:space-y-2 sm:pr-1 md:mt-4 md:max-h-80 md:space-y-2.5 md:pr-1.5 lg:mt-4 lg:max-h-96 lg:space-y-3 lg:pr-2 xl:mt-5 xl:max-h-96 xl:space-y-3 xl:pr-2">
                        {openInvoices.map((i) => (
                            <li key={i.id}>
                                <Link
                                    href={`/invoices/${i.id}`}
                                    className="flex items-center justify-between gap-2 rounded-md border border-white/10 p-2 hover:bg-white/5 sm:gap-2 sm:rounded-lg sm:p-2.5 md:gap-2.5 md:rounded-lg md:p-3 lg:gap-3 lg:rounded-xl lg:p-3 xl:gap-3 xl:rounded-xl xl:p-3.5"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-mono text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                            {i.number}
                                        </div>
                                        <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                                            {i.daysOverdue > 0
                                                ? `${i.daysOverdue} days overdue`
                                                : `Due ${i.dueDate}`}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-xs font-semibold tabular-nums text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                            {formatINR(i.outstandingPaise ?? 0)}
                                        </div>
                                        {i.amountPaidPaise > 0 && (
                                            <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                                                {formatINR(i.amountPaidPaise ?? 0)} paid
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {error && customer && (
                <div className="rounded-lg border border-[#B42318]/60 px-3 py-2 text-xs text-white sm:rounded-lg sm:px-3 sm:py-2 sm:text-xs md:rounded-xl md:px-3.5 md:py-2.5 md:text-sm lg:rounded-xl lg:px-4 lg:py-3 lg:text-sm xl:rounded-xl xl:px-4 xl:py-3 xl:text-base">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
                <Link
                    href="/invoices/new"
                    className={`${ACTION_BTN} bg-[#0F5C4E] text-center text-white hover:bg-[#0F5C4E]/90`}
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
                    className={`${ACTION_BTN} bg-white text-[#235C49] transition-colors hover:bg-white/90 disabled:opacity-50`}
                >
                    <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        className="shrink-0 h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-5 xl:w-5"
                    >
                        <path
                            d="M2.18305 10.1842C1.44966 10.1842 0.849609 9.58413 0.849609 8.85074V2.18354C0.849609 1.45015 1.44966 0.850098 2.18305 0.850098H8.85025C9.58364 0.850098 10.1837 1.45015 10.1837 2.18354M6.18337 4.85042H12.8506C13.587 4.85042 14.184 5.44742 14.184 6.18386V12.8511C14.184 13.5875 13.587 14.1845 12.8506 14.1845H6.18337C5.44693 14.1845 4.84993 13.5875 4.84993 12.8511V6.18386C4.84993 5.44742 5.44693 4.85042 6.18337 4.85042Z"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            stroke="currentColor"
                        />
                    </svg>
                    <span className="truncate">
                        {copyingLink
                            ? "Creating…"
                            : copied
                                ? "Copied!"
                                : "Copy pay link"}
                    </span>
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
                    onDeleted={() => {
                        setEditing(false);
                        router.push("/customers");
                        router.refresh();
                    }}
                />
            )}
        </main>
    );
}

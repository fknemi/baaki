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

// Section shell: border only, no fill — matches dashboard cards.
const SURFACE = "border border-white/10";

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
        void reload();
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
            <main className="space-y-3 p-4 text-sm">
                <p className="text-white">{error}</p>
                <button
                    type="button"
                    onClick={() => {
                        setError(null);
                        void reload();
                    }}
                    className="rounded-lg bg-[#0F5C4E] px-4 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
                >
                    Retry
                </button>
            </main>
        );
    if (!customer)
        return <main className="p-4 text-sm text-white">Loading…</main>;

    return (
        <main className="space-y-4 p-4 pb-24 pt-14">
            <header className={`${SURFACE} p-5`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-white break-words">
                            {customer.name}
                        </h1>
                        <p className="mt-1 font-mono text-xs text-white">
                            GSTIN {customer.gstin}
                        </p>
                        <p className="mt-1 text-xs text-white">
                            {customer.placeOfSupplyState ?? "—"}
                            {customer.stateCode ? ` (${customer.stateCode})` : ""}
                        </p>
                        <p className="mt-1 text-xs text-white">
                            Credit {customer.creditDays} days · Language:{" "}
                            {langLabel(customer.preferredLanguage)}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setEditing(true)}
                            className="rounded-lg border border-white/10 px-2 py-1 text-xs font-medium text-white hover:bg-white/5"
                            aria-label="Edit customer"
                        >
                            ✎ Edit
                        </button>
                        <span
                            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${GRADE_COLOR[customer.grade] ?? "bg-[#5A6170] text-white"
                                }`}
                            aria-label={`Grade ${customer.grade}`}
                        >
                            {customer.grade}
                        </span>
                    </div>
                </div>
                <p className="mt-3 text-xs text-white italic">{customer.gradeReason}</p>
            </header>

            <section className={`${SURFACE} p-4`}>
                <h2 className="text-sm font-semibold text-white">Payment record</h2>
                <dl className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                        <dt className="text-xs text-white italic">On time</dt>
                        <dd className="text-lg font-semibold tabular-nums text-white">
                            {customer.pctOnTime}%
                        </dd>
                    </div>
                    <div>
                        <dt className="text-xs text-white italic">Average late</dt>
                        <dd className="text-lg font-semibold tabular-nums text-white">
                            {customer.avgDaysLate === 1
                                ? "1 day"
                                : `${customer.avgDaysLate} days`}
                        </dd>
                    </div>
                </dl>
            </section>

            <section className={`${SURFACE} p-4`}>
                <h2 className="text-sm font-semibold text-white">Contact</h2>
                <dl className="mt-2 space-y-1">
                    {customer.phoneMasked && (
                        <div className="flex justify-between gap-2">
                            <dt className="text-xs text-white italic">Phone</dt>
                            <dd className="truncate font-mono text-xs text-white">
                                {customer.phoneMasked}
                            </dd>
                        </div>
                    )}
                    {customer.email && (
                        <div className="flex justify-between gap-2">
                            <dt className="text-xs text-white italic">Email</dt>
                            <dd className="truncate text-xs text-white">{customer.email}</dd>
                        </div>
                    )}
                    {customer.city && (
                        <div className="flex justify-between gap-2">
                            <dt className="text-xs text-white italic">City</dt>
                            <dd className="truncate text-xs text-white">{customer.city}</dd>
                        </div>
                    )}
                </dl>
            </section>

            <section className={`${SURFACE} p-4`}>
                <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-white">
                        Invoices ({openInvoices.length} open)
                    </h2>
                    <span className="text-xs tabular-nums text-white">
                        {formatINR(customer.totalOutstandingPaise ?? 0)} owed
                    </span>
                </div>
                {openInvoices.length === 0 ? (
                    <p className="mt-2 text-xs text-white italic">No open invoices.</p>
                ) : (
                    <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                        {openInvoices.map((i) => (
                            <li key={i.id}>
                                <Link
                                    href={`/invoices/${i.id}`}
                                    className="flex items-center justify-between gap-2 border border-white/10 p-2 hover:bg-white/5"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-mono text-xs text-white">
                                            {i.number}
                                        </div>
                                        <div className="text-[10px] text-white italic">
                                            {i.daysOverdue > 0
                                                ? `${i.daysOverdue} days overdue`
                                                : `Due ${i.dueDate}`}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <div className="text-xs font-semibold tabular-nums text-white">
                                            {formatINR(i.outstandingPaise ?? 0)}
                                        </div>
                                        {i.amountPaidPaise > 0 && (
                                            <div className="text-[10px] text-white italic">
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
                <div className="border border-[#B42318]/60 px-3 py-2 text-xs text-white">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <Link
                    href="/invoices/new"
                    className="rounded-lg bg-[#0F5C4E] px-3 py-3 text-center text-sm font-medium text-white hover:bg-[#0F5C4E]/90"
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
                    className="flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-3 text-sm font-medium text-[#235C49] transition-colors hover:bg-white/90 disabled:opacity-50"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                        className="shrink-0"
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

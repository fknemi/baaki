"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";
import { AgeingBar, type AgeingBucket } from "@/components/charts/ageing-bar";

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

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/dashboard")
            .then((r) => {
                if (r.status === 401) {
                    window.location.href = `/login?next=/dashboard`;
                    return;
                }
                return r.json();
            })
            .then((j) => {
                if (!j) return;
                if (j.error) setError(j.error.message);
                else setData(j.data);
            })
            .catch((e) => setError(e.message));
    }, []);

    if (error) return <main className="p-4 text-sm text-[#B42318]">{error}</main>;
    if (!data) return <main className="p-4 text-sm text-[#5A6170]">Loading…</main>;

    return (
        <main className="space-y-4 p-4 pb-24">
            <div>
                <h1 className="text-xl font-semibold">Dashboard</h1>
                <p className="text-xs text-[#5A6170]">
                    {data.overdueCount} overdue invoices · oldest {data.oldestOverdueDays}d
                </p>
            </div>

            <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
                <div className="text-xs text-[#5A6170]">Money to collect</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                    {formatINR(data.totalOutstandingPaise)}
                </div>
                <div className="mt-3 text-xs text-[#5A6170]">Overdue</div>
                <div className="mt-0.5 text-lg font-semibold tabular-nums text-[#B42318]">
                    {formatINR(data.overduePaise)}
                </div>
            </section>

            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-3 ring-1 ring-[#E4E7EC]">
                    <div className="text-[10px] text-[#5A6170]">Expected this week</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">
                        {formatINR(data.expectedThisWeekPaise)}
                    </div>
                </div>
                <div className="rounded-xl bg-white p-3 ring-1 ring-[#E4E7EC]">
                    <div className="text-[10px] text-[#5A6170]">Expected this month</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">
                        {formatINR(data.expectedThisMonthPaise)}
                    </div>
                </div>
            </div>

            <div className="rounded-xl bg-white p-3 ring-1 ring-[#E4E7EC]">
                <div className="text-[10px] text-[#5A6170]">Bills due next 30 days</div>
                <div className="mt-1 text-sm font-semibold tabular-nums">
                    {formatINR(data.billsDue30dPaise)}
                </div>
            </div>

            <div className="rounded-xl bg-white p-3 ring-1 ring-[#E4E7EC]">
                <div className="flex items-center justify-between">
                    <div className="text-[10px] text-[#5A6170]">Cash in bank</div>
                    <Link
                        href="/forecast"
                        className="text-[10px] text-[#175CD3] hover:underline"
                    >
                        See forecast →
                    </Link>
                </div>
                <div className="mt-1 text-sm font-semibold tabular-nums">
                    {formatINR(data.cashInBankPaise)}
                </div>
                <div className="mt-1 text-[10px] text-[#5A6170]">
                    Lowest point {formatINR(data.lowestPointPaise)}
                    {data.breachWeek !== null && ` (week ${data.breachWeek})`}
                </div>
            </div>

            {data.bufferWarning && (
                <div
                    role="alert"
                    className="rounded-xl bg-[#FEF3F2] p-3 text-xs font-medium text-[#B42318] ring-1 ring-[#FDA29B]"
                >
                    ⚠ Cash runs below buffer in week {data.breachWeek}
                </div>
            )}

            <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
                <h2 className="text-sm font-semibold">Ageing</h2>
                <div className="mt-3">
                    <AgeingBar buckets={data.ageing} />
                </div>
            </section>

            <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Chase these first</h2>
                    <Link
                        href="/chase"
                        className="text-[10px] text-[#175CD3] hover:underline"
                    >
                        See all →
                    </Link>
                </div>
                <ul className="mt-3 space-y-2">
                    {data.chase.map((c) => (
                        <li key={c.invoiceId}>
                            <Link
                                href={`/invoices/${c.invoiceId}`}
                                className="flex items-center justify-between rounded-lg border border-[#E4E7EC] p-2 hover:bg-[#F7F8FA]"
                            >
                                <div>
                                    <div className="text-xs font-medium">{c.customerName}</div>
                                    <div className="text-[10px] text-[#5A6170]">
                                        {c.daysOverdue > 0
                                            ? `${c.daysOverdue} days overdue`
                                            : "not yet due"}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-xs font-semibold tabular-nums">
                                        {formatINR(c.amountPaise)}
                                    </div>
                                    <span aria-hidden="true" className="text-[#5A6170]">
                                        ›
                                    </span>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>

            <div className="sticky bottom-20 z-10">
                <Link
                    href="/invoices/new"
                    className="block rounded-lg bg-[#0F5C4E] px-4 py-3 text-center text-sm font-medium text-white hover:bg-[#0F5C4E]/90"
                >
                    + New invoice
                </Link>
            </div>
        </main>
    );
}

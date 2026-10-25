export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listInvoices } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { InvoicesClient } from "./invoices-client";

const TABS = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "sent", label: "Sent" },
    { key: "due_soon", label: "Due soon" },
    { key: "overdue", label: "Overdue" },
    { key: "part_paid", label: "Part paid" },
    { key: "paid", label: "Paid" },
    { key: "disputed", label: "Disputed" },
    { key: "cancelled", label: "Cancelled" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isValidTab(s: string | undefined): s is TabKey {
    return s !== undefined && TABS.some((t) => t.key === s);
}

export default async function InvoicesPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string }>;
}) {
    const session = await getSession();
    if (!session) redirect("/login");

    const params = await searchParams;
    const activeTab: TabKey = isValidTab(params.status) ? params.status : "all";

    const today = todayIST();
    const allInvoices = await listInvoices(
        await currentBusinessId(session.userId),
        today,
    );

    const counts: Partial<Record<TabKey, number>> = { all: allInvoices.length };
    for (const inv of allInvoices) {
        const k = inv.status as TabKey;
        if (k !== "all") counts[k] = (counts[k] ?? 0) + 1;
    }

    const visible =
        activeTab === "all"
            ? allInvoices
            : allInvoices.filter((i) => i.status === activeTab);

    const activeLabel =
        activeTab === "all"
            ? ""
            : (TABS.find((t) => t.key === activeTab)?.label.toLowerCase() ?? "") + " ";

    return (
        <main className="pt-14">
            <nav
                aria-label="Filter invoices by status"
                className="-mx-4 pl-2 overflow-x-auto"
            >
                <ul className="flex gap-2 pb-1 px-4">
                    {TABS.map((t) => {
                        const active = activeTab === t.key;
                        const href =
                            t.key === "all" ? "/invoices" : `/invoices?status=${t.key}`;
                        return (
                            <li key={t.key}>
                                <Link
                                    href={href}
                                    aria-current={active ? "page" : undefined}
                                    className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                        active
                                            ? "bg-white text-[#111]"
                                            : "bg-[#171717]/20 text-white border border-white/10 hover:bg-white/5"
                                    }`}
                                >
                                    {t.label} ({counts[t.key] ?? 0})
                                </Link>
                            </li>
                        );
                    })}
                    <li aria-hidden="true" className="w-4 shrink-0" />
                </ul>
            </nav>

            <InvoicesClient invoices={visible} activeLabel={activeLabel} />
        </main>
    );
}

async function currentBusinessId(userId: string): Promise<string> {
    const { db } = await import("@/lib/db/client");
    const { businessMembers } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db
        .select()
        .from(businessMembers)
        .where(eq(businessMembers.userId, userId))
        .limit(1);
    if (!row) throw new Error("No business membership");
    return row.businessId;
}

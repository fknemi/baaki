export const instant = false;

import type { CSSProperties } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listInvoices } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { InvoicesClient, ActiveTabReveal } from "./invoices-client";

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

/* ─────────────────────────────────────────────────────────────────────
   Single source of truth for sizing. invoices-client.tsx renders inside
   <main class="inv-page">, so it inherits every token below.

   --inv-u is the base unit (≈ the invoice title size):
     • 14px on a 320px phone
     • grows smoothly to 22px at ~1350px
     • keeps growing gently on big monitors (~26px @1920, ~31px @2560)
   Every font size, gap, padding, control height and the max content
   width is a multiple of it, so the whole page scales as one piece
   instead of jumping at Tailwind breakpoints.
   ───────────────────────────────────────────────────────────────────── */
const PAGE_CSS = `
.inv-page {
    --inv-u: calc(
        clamp(0.875rem, 0.7rem + 0.8vw, 1.375rem) +
        max(0px, 100vw - 1440px) * 0.008
    );

    --inv-fs-title: var(--inv-u);
    --inv-fs-month: calc(var(--inv-u) * 1.1);
    --inv-fs-body:  max(0.875rem,  calc(var(--inv-u) * 0.95));
    --inv-fs-tab:   max(0.8125rem, calc(var(--inv-u) * 0.875));
    --inv-fs-meta:  max(0.75rem,   calc(var(--inv-u) * 0.8));

    --inv-gutter: clamp(1rem, 0.75rem + 1.5vw, 3rem);
    --inv-max: calc(var(--inv-u) * 72);
    --inv-control-h: max(2.5rem, calc(var(--inv-u) * 2.25));
    --inv-row-pad: calc(var(--inv-u) * 0.85);
    --inv-gap: calc(var(--inv-u) * 0.7);
    --inv-section-gap: calc(var(--inv-u) * 1.8);
}

/* Shared centred column — tabs and list use the same one, so their
   left edges line up at every width. */
.inv-container {
    width: 100%;
    margin-inline: auto;
    max-width: var(--inv-max);
    padding-inline: var(--inv-gutter);
}

/* Fluid type classes */
.inv-t-meta  { font-size: var(--inv-fs-meta);  line-height: 1.4; }
.inv-t-body  { font-size: var(--inv-fs-body);  line-height: 1.45; }
.inv-t-title { font-size: var(--inv-fs-title); line-height: 1.3; }
.inv-t-month { font-size: var(--inv-fs-month); line-height: 1.2; }

/* ── Tabs ── */
@keyframes inv-tab-drop {
    from { opacity: 0; transform: translateY(-10px); }
    to   { opacity: 1; transform: none; }
}
.inv-tab-drop {
    animation: inv-tab-drop 600ms cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0ms) backwards;
}
.inv-tab-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    scroll-snap-type: x proximity;
    scroll-padding-inline: var(--inv-gutter);
    /* soft fade on the right edge hints that more tabs are scrollable */
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - var(--inv-gutter)), transparent);
    mask-image: linear-gradient(to right, #000 calc(100% - var(--inv-gutter)), transparent);
}
.inv-tab-scroll::-webkit-scrollbar { display: none; }
.inv-tab-list { gap: calc(var(--inv-u) * 0.55); padding-bottom: 0.25rem; }
.inv-tab-end { width: var(--inv-gutter); flex: none; }
.inv-tab {
    display: inline-flex;
    align-items: center;
    font-size: var(--inv-fs-tab);
    line-height: 1.25;
    padding: 0.5em 1.1em;
    min-height: max(2.25rem, 2.4em);
}
@media (prefers-reduced-motion: reduce) {
    .inv-tab-drop {
        animation-duration: 0.01ms !important;
        animation-delay: 0ms !important;
    }
}
`;

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
        <main className="inv-page pt-14 sm:pt-16 md:pt-20 lg:pt-24">
            <style>{PAGE_CSS}</style>
            <h1 className="sr-only">Invoices</h1>

            <nav
                id="inv-tabs"
                aria-label="Filter invoices by status"
                className="inv-tab-scroll relative overflow-x-auto"
            >
                <div className="inv-container">
                    <ul className="inv-tab-list flex w-max">
                        {TABS.map((t, i) => {
                            const active = activeTab === t.key;
                            const href =
                                t.key === "all" ? "/invoices" : `/invoices?status=${t.key}`;
                            return (
                                <li
                                    key={t.key}
                                    className="inv-tab-drop shrink-0 snap-start"
                                    style={{ "--d": `${90 + i * 40}ms` } as CSSProperties}
                                >
                                    <Link
                                        href={href}
                                        aria-current={active ? "page" : undefined}
                                        className={`inv-tab whitespace-nowrap rounded-full border font-medium transition-colors ${
                                            active
                                                ? "border-white bg-white text-[#111]"
                                                : "border-white/10 bg-[#171717]/20 text-white hover:bg-white/5"
                                        }`}
                                    >
                                        {t.label} ({counts[t.key] ?? 0})
                                    </Link>
                                </li>
                            );
                        })}
                        <li aria-hidden="true" className="inv-tab-end" />
                    </ul>
                </div>
            </nav>

            <ActiveTabReveal navId="inv-tabs" activeKey={activeTab} />

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

export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listInvoices } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { formatINR } from "@/lib/domain/money";

const TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "due_soon", label: "Due soon" },
  { key: "overdue", label: "Overdue" },
  { key: "part_paid", label: "Part paid" },
  { key: "paid", label: "Paid" },
  { key: "disputed", label: "Disputed" },
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

  // Per-tab counts (single pass). Partial<…> because unknown statuses
  // (e.g. "cancelled") should not break TS — they just don't count
  // toward any tab.
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
    <main className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <Link
          href="/invoices/new"
          className="rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
        >
          + New invoice
        </Link>
      </div>

      {/* Status tabs — horizontal scroll on mobile, URL-driven */}
      <nav
        aria-label="Filter invoices by status"
        className="-mx-4 overflow-x-auto px-4"
      >
        <ul className="flex gap-2 pb-1">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            const href =
              t.key === "all" ? "/invoices" : `/invoices?status=${t.key}`;
            return (
              <li key={t.key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-block whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${
                    active
                      ? "bg-[#0F5C4E] text-white"
                      : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
                  }`}
                >
                  {t.label} ({counts[t.key] ?? 0})
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {visible.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-xs text-[#5A6170] ring-1 ring-[#E4E7EC]">
          {allInvoices.length === 0
            ? "No invoices yet. Run `bun seed` to populate demo data."
            : `No ${activeLabel}invoices.`}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="block rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="font-mono text-xs text-[#5A6170]">
                      {inv.number}
                    </div>
                    <div className="mt-1 truncate font-semibold">
                      {inv.customer.name}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">
                      {formatINR(inv.outstandingPaise)}
                    </div>
                    <div className="mt-1 text-xs text-[#5A6170]">
                      {inv.status === "overdue"
                        ? `${inv.daysOverdue}d overdue`
                        : inv.status.replace(/_/g, " ")}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
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

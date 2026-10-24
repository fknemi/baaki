export const instant = false;
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listInvoices } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { formatINR } from "@/lib/domain/money";

export default async function InvoicesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const today = todayIST();
  const invoices = await listInvoices(
    // getSession returns userId; we need businessId via requireRole-like path.
    // For simplicity, fetch the first business the user belongs to.
    await currentBusinessId(session.userId),
    today,
  );

  return (
    <main className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <Link href="/dashboard" className="text-muted-foreground text-xs underline">
          Back
        </Link>
      </div>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No invoices yet. Run <code>bun seed</code> to populate demo data.
        </p>
      ) : (
        <ul className="space-y-2">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className="block rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-xs text-[#5A6170]">{inv.number}</div>
                    <div className="mt-1 font-semibold">{inv.customer.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold tabular-nums">
                      {formatINR(inv.outstandingPaise)}
                    </div>
                    <div className="mt-1 text-xs text-[#5A6170]">
                      {inv.status === "overdue" ? `${inv.daysOverdue}d overdue` : inv.status}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Invoices</h1>
        <Link
          href="/invoices/new"
          className="rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
        >
          + New invoice
        </Link>
      </div>
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

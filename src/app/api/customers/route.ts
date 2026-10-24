import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { customers, invoices } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { loadCustomerStats } from "@/lib/db/queries/customers";
import { todayIST } from "@/lib/domain/dates";

export async function GET(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const today = todayIST();

      const custRows = await db
        .select()
        .from(customers)
        .where(eq(customers.businessId, ctx.businessId));
      const invRows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.businessId, ctx.businessId));
      const stats = await loadCustomerStats(ctx.businessId);
      const statsById = new Map(stats.map((s) => [s.id, s]));

      const outstandingByCustomer = new Map<string, number>();
      for (const inv of invRows) {
        if (!["sent", "part_paid", "disputed"].includes(inv.status)) continue;
        const view = await getInvoiceWithTotals(inv.id, ctx.businessId, today);
        if (!view || view.outstandingPaise <= 0) continue;
        const curr = outstandingByCustomer.get(inv.customerId) ?? 0;
        outstandingByCustomer.set(inv.customerId, curr + view.outstandingPaise);
      }

      const result = custRows.map((c) => {
        const stat = statsById.get(c.id) ?? {
          id: c.id,
          name: c.name,
          avgDaysLate: 0,
          pctOnTime: 0,
          paidCount: 0,
        };
        // Use direct reason from aggregates (gradeCustomer needs paid history array)
        const reason =
          stat.paidCount === 0
            ? "No payment history yet."
            : `Pays ${stat.pctOnTime}% on time, average ${stat.avgDaysLate} ${stat.avgDaysLate === 1 ? "day" : "days"} late.`;
        const grade =
          stat.paidCount === 0
            ? "NEW"
            : stat.pctOnTime >= 90 && stat.avgDaysLate <= 3
              ? "A"
              : stat.pctOnTime >= 60 && stat.avgDaysLate <= 15
                ? "B"
                : "C";

        return {
          id: c.id,
          name: c.name,
          gstin: c.gstin,
          stateCode: c.stateCode,
          placeOfSupplyState: c.placeOfSupplyState,
          city: c.city,
          phoneMasked: c.phoneMasked,
          email: c.email,
          creditDays: c.creditDays,
          preferredLanguage: c.preferredLanguage,
          payToken: c.payToken,
          avgDaysLate: stat.avgDaysLate,
          pctOnTime: stat.pctOnTime,
          grade,
          gradeReason: reason,
          totalOutstandingPaise: outstandingByCustomer.get(c.id) ?? 0,
        };
      });

      return NextResponse.json({ data: result });
    },
    ["owner", "accountant"],
  );
}

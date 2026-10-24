import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { customers, invoices, payments } from "@/lib/db/schema";
import { wholeDaysBetween } from "@/lib/domain/dates";

export type CustomerStat = {
  id: string;
  name: string;
  avgDaysLate: number;
  pctOnTime: number;
  paidCount: number;
};

/**
 * Derive per-customer avgDaysLate and pctOnTime from paid history.
 * Single source of truth for both /api/forecast, /api/dashboard, /api/chase,
 * and /api/customers. Spec §2.8.
 */
export async function loadCustomerStats(businessId: string): Promise<CustomerStat[]> {
  const custRows = await db.select().from(customers).where(eq(customers.businessId, businessId));
  const invRows = await db.select().from(invoices).where(eq(invoices.businessId, businessId));
  const payRows = await db.select().from(payments).where(eq(payments.businessId, businessId));

  const invById = new Map(invRows.map((i) => [i.id, i] as const));
  const byCustomer = new Map<string, Array<{ dueOn: string; paidOn: string }>>();
  for (const p of payRows) {
    if (!p.paidOn || !p.invoiceId) continue;
    const inv = invById.get(p.invoiceId);
    if (!inv) continue;
    const entry = { dueOn: inv.dueDate, paidOn: p.paidOn };
    const list = byCustomer.get(inv.customerId);
    if (list) list.push(entry);
    else byCustomer.set(inv.customerId, [entry]);
  }

  return custRows.map((c) => {
    const hist = byCustomer.get(c.id) ?? [];
    if (hist.length === 0) {
      return {
        id: c.id,
        name: c.name,
        avgDaysLate: 0,
        pctOnTime: 0,
        paidCount: 0,
      };
    }
    const onTime = hist.filter((h) => h.paidOn <= h.dueOn).length;
    const pctOnTime = Math.round((onTime / hist.length) * 100);
    const totalLate = hist.reduce(
      (s, h) => s + Math.max(0, wholeDaysBetween(h.dueOn, h.paidOn)),
      0,
    );
    const avgDaysLate = Math.round(totalLate / hist.length);
    return {
      id: c.id,
      name: c.name,
      avgDaysLate,
      pctOnTime,
      paidCount: hist.length,
    };
  });
}

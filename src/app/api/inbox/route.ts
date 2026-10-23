import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { inboxItems, invoices, customers } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  return requireRole(
    req,
    async (_req, ctx) => {
      const rows = await db
        .select({
          id: inboxItems.id,
          type: inboxItems.type,
          status: inboxItems.status,
          message: inboxItems.message,
          createdAt: inboxItems.createdAt,
          invoiceId: inboxItems.invoiceId,
          invoiceNumber: invoices.number,
          customerName: customers.name,
        })
        .from(inboxItems)
        .innerJoin(invoices, eq(invoices.id, inboxItems.invoiceId))
        .innerJoin(customers, eq(customers.id, invoices.customerId))
        .where(eq(inboxItems.businessId, ctx.businessId))
        .orderBy(desc(inboxItems.createdAt));

      return NextResponse.json({ data: rows });
    },
    ["owner", "accountant", "staff"],
  );
}

import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { payments, invoices, customers } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  return requireRole(
    req,
    async (_req, ctx) => {
      const rows = await db
        .select({
          id: payments.id,
          amountPaise: payments.amountPaise,
          paidOn: payments.paidOn,
          reference: payments.reference,
          invoiceId: payments.invoiceId,
          invoiceNumber: invoices.number,
          customerName: customers.name,
        })
        .from(payments)
        .leftJoin(invoices, eq(invoices.id, payments.invoiceId))
        .leftJoin(customers, eq(customers.id, invoices.customerId))
        .where(eq(payments.businessId, ctx.businessId))
        .orderBy(desc(payments.createdAt))
        .limit(200);

      return NextResponse.json({ data: rows });
    },
    ["owner", "accountant", "staff"],
  );
}

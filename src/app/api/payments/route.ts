import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { payments, invoices, customers } from "@/lib/db/schema";

export async function GET(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const url = new URL(req.url);

      // Optional filters so the payments page can scope the list
      // without a new endpoint. All are additive; omitting them
      // reproduces the original "last 200 payments" behavior exactly.
      const invoiceId = url.searchParams.get("invoiceId");
      const from = url.searchParams.get("from");        // YYYY-MM-DD
      const to = url.searchParams.get("to");            // YYYY-MM-DD
      const limitParam = Number(url.searchParams.get("limit"));
      const limit =
        Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 500
          ? Math.floor(limitParam)
          : 200;

      // Build the WHERE clause incrementally so each filter is
      // independently optional. Every branch uses AND, so adding one
      // filter never widens the result set — it narrows it.
      const conditions = [eq(payments.businessId, ctx.businessId)];

      if (invoiceId) {
        conditions.push(eq(payments.invoiceId, invoiceId));
      }
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
        conditions.push(gte(payments.paidOn, from));
      }
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
        conditions.push(lte(payments.paidOn, to));
      }

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
        .where(and(...conditions))
        .orderBy(
          // Order by the date the payment *happened*, not when the row
          // was inserted. `createdAt` produces wrong ordering when
          // payments are backfilled or imported out of sequence —
          // a payment made on Monday but confirmed on Friday would
          // appear before one made on Thursday. `paidOn` is the
          // business-correct sort key.
          //
          // `createdAt` breaks ties so same-day payments keep a stable
          // order (newest-inserted first).
          desc(payments.paidOn),
          desc(payments.createdAt),
        )
        .limit(limit);

      return NextResponse.json({ data: rows });
    },
    ["owner", "accountant", "staff"],
  );
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices, payments } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST, atIso } from "@/lib/domain/dates";

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const idempotencyKey = req.headers.get("Idempotency-Key");
      if (!idempotencyKey) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Idempotency-Key header required." } },
          { status: 400 },
        );
      }

      const body = (await req.json().catch(() => ({}))) as {
        invoiceId?: string;
        amountPaise?: number;
        paidOn?: string;
        reference?: string;
      };

      const invoiceId = body.invoiceId;
      const amountPaise = body.amountPaise;

      if (
        typeof invoiceId !== "string" ||
        typeof amountPaise !== "number" ||
        !Number.isInteger(amountPaise) ||
        amountPaise <= 0
      ) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "invoiceId and positive integer amountPaise required.",
            },
          },
          { status: 400 },
        );
      }

      const [inv] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, ctx.businessId)))
        .limit(1);
      if (!inv) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice not found." } },
          { status: 404 },
        );
      }

      const existing = await db
        .select()
        .from(payments)
        .where(eq(payments.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json({ data: { already: true, payment: existing[0] } });
      }

      const today = todayIST();
      const view = await getInvoiceWithTotals(invoiceId, ctx.businessId, today);
      if (!view || amountPaise > view.outstandingPaise) {
        return NextResponse.json(
          { error: { code: "BAK-PAY-001", message: "Amount exceeds outstanding." } },
          { status: 422 },
        );
      }

      const paidOn = body.paidOn ?? today;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn)) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "paidOn must be YYYY-MM-DD." } },
          { status: 400 },
        );
      }

      try {
        const payment = await db.transaction(async (tx) => {
          const [p] = await tx
            .insert(payments)
            .values({
              businessId: ctx.businessId,
              invoiceId,
              amountPaise,
              paidOn,
              reference: body.reference ?? null,
              idempotencyKey,
            })
            .returning();
          if (!p) throw new Error("insert failed");

          await tx
            .update(invoices)
            .set({ amountPaidPaise: inv.amountPaidPaise + amountPaise })
            .where(eq(invoices.id, invoiceId));

          await appendEventInTx(tx, {
            businessId: ctx.businessId,
            entityType: "invoice",
            entityId: invoiceId,
            type: "PAYMENT_CONFIRMED",
            actor: `user:${ctx.userId}`,
            atIso: atIso(today),
            payload: {
              amountPaise,
              paidOn,
              reference: body.reference ?? null,
              manual: true,
            },
          });

          return p;
        });

        return NextResponse.json({ data: { already: false, payment } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Manual payment failed";
        return NextResponse.json(
          { error: { code: "INTERNAL", message: msg } },
          { status: 500 },
        );
      }
    },
    ["owner", "accountant"],
  );
}

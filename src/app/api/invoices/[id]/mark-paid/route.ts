import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices, payments } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST, atIso } from "@/lib/domain/dates";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return requireRole(
    req,
    async (req, ctx) => {
      const idempotencyKey = req.headers.get("Idempotency-Key");
      if (!idempotencyKey) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "Idempotency-Key header required.",
            },
          },
          { status: 400 },
        );
      }

      const body = await req
        .json()
        .catch(() => ({} as { amountPaise?: number; paidOn?: string; reference?: string }));

      if (!body.amountPaise || !Number.isInteger(body.amountPaise) || body.amountPaise <= 0) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "amountPaise required (positive integer).",
            },
          },
          { status: 400 },
        );
      }

      const [inv] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.businessId, ctx.businessId)))
        .limit(1);

      if (!inv) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice not found." } },
          { status: 404 },
        );
      }

      const [existing] = await db
        .select()
        .from(payments)
        .where(eq(payments.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existing) {
        return NextResponse.json({
          data: { id: existing.id, alreadyRecorded: true },
        });
      }

      const today = todayIST();
      const paidOn = body.paidOn ?? today;

      try {
        await db.transaction(async (tx) => {
          await tx.insert(payments).values({
            businessId: ctx.businessId,
            invoiceId: inv.id,
            amountPaise: body.amountPaise!,
            paidOn,
            reference: body.reference ?? null,
            idempotencyKey,
          });

          await tx
            .update(invoices)
            .set({ amountPaidPaise: inv.amountPaidPaise + body.amountPaise! })
            .where(eq(invoices.id, inv.id));

          await appendEventInTx(tx, {
            businessId: ctx.businessId,
            entityType: "invoice",
            entityId: inv.id,
            type: "PAYMENT_CONFIRMED",
            actor: `user:${ctx.userId}`,
            atIso: atIso(today),
            payload: {
              amountPaise: body.amountPaise,
              paidOn,
              reference: body.reference ?? null,
            },
          });
        });

        const updated = await getInvoiceWithTotals(inv.id, ctx.businessId, today);
        return NextResponse.json({ data: updated });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Payment failed";
        return NextResponse.json(
          { error: { code: "INTERNAL", message: msg } },
          { status: 500 },
        );
      }
    },
    ["owner", "accountant"],
  );
}

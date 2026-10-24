import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices, payments } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST, atIso } from "@/lib/domain/dates";
import { createHash } from "node:crypto";

type ConfirmBody = {
  lineHash?: string;
  line?: {
    date: string;
    description: string;
    creditPaise: number;
    ref: string;
  };
  invoiceIds?: string[];
  splitAmountsPaise?: number[];
};

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const idempotencyBase = req.headers.get("Idempotency-Key");
      if (!idempotencyBase) {
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

      const body = (await req.json().catch(() => ({}))) as ConfirmBody;
      const { lineHash, line, invoiceIds, splitAmountsPaise } = body;

      if (
        !lineHash ||
        !line ||
        !Array.isArray(invoiceIds) ||
        !Array.isArray(splitAmountsPaise) ||
        invoiceIds.length === 0 ||
        invoiceIds.length !== splitAmountsPaise.length
      ) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "lineHash, line, invoiceIds, splitAmountsPaise required (equal lengths).",
            },
          },
          { status: 400 },
        );
      }

      // ─────────────────────────────────────────────────────────
      // Idempotency check FIRST — before any state-dependent
      // validation. A repeat call must return { already: true }
      // even if the invoice's outstanding has since dropped to 0.
      // ─────────────────────────────────────────────────────────
      const keys = invoiceIds.map((id) =>
        createHash("sha256").update(`${idempotencyBase}:${id}`).digest("hex"),
      );

      const existing = await db
        .select()
        .from(payments)
        .where(inArray(payments.idempotencyKey, keys));

      if (existing.length === keys.length) {
        return NextResponse.json({
          data: { already: true, payments: existing },
        });
      }
      if (existing.length > 0) {
        return NextResponse.json(
          {
            error: {
              code: "CONFLICT",
              message: "Partial confirm found. Contact support.",
            },
          },
          { status: 409 },
        );
      }

      // ─────────────────────────────────────────────────────────
      // Validation only runs on the FIRST confirm (nothing to
      // dedupe). If we got here, no payment exists for this key.
      // ─────────────────────────────────────────────────────────

      const splitSum = splitAmountsPaise.reduce((s, v) => s + v, 0);
      if (splitSum !== line.creditPaise) {
        return NextResponse.json(
          {
            error: {
              code: "BAK-PAY-001",
              message: `Split amounts (${splitSum}) must equal credit (${line.creditPaise}).`,
            },
          },
          { status: 422 },
        );
      }

      const invRows = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.businessId, ctx.businessId), inArray(invoices.id, invoiceIds)));
      if (invRows.length !== invoiceIds.length) {
        return NextResponse.json(
          {
            error: { code: "NOT_FOUND", message: "One or more invoices missing." },
          },
          { status: 404 },
        );
      }

      const today = todayIST();

      const outstandingById = new Map<string, number>();
      for (const id of invoiceIds) {
        const view = await getInvoiceWithTotals(id, ctx.businessId, today);
        if (!view) {
          return NextResponse.json(
            { error: { code: "NOT_FOUND", message: `Invoice ${id} missing.` } },
            { status: 404 },
          );
        }
        outstandingById.set(id, view.outstandingPaise);
      }

      for (let i = 0; i < invoiceIds.length; i++) {
        const id = invoiceIds[i]!;
        const amt = splitAmountsPaise[i]!;
        if (amt <= 0) {
          return NextResponse.json(
            { error: { code: "BAD_REQUEST", message: "Split amounts must be > 0." } },
            { status: 400 },
          );
        }
        if (amt > (outstandingById.get(id) ?? 0)) {
          return NextResponse.json(
            {
              error: {
                code: "BAK-PAY-001",
                message: `Split ${amt} exceeds outstanding for invoice ${id}. Use manual to split excess.`,
              },
            },
            { status: 422 },
          );
        }
      }

      try {
        const inserted = await db.transaction(async (tx) => {
          const rows: Array<{ id: string; invoiceId: string | null; amountPaise: number }> = [];
          for (let i = 0; i < invoiceIds.length; i++) {
            const invoiceId = invoiceIds[i]!;
            const amt = splitAmountsPaise[i]!;
            const [payment] = await tx
              .insert(payments)
              .values({
                businessId: ctx.businessId,
                invoiceId,
                amountPaise: amt,
                paidOn: line.date,
                reference: line.ref || null,
                idempotencyKey: keys[i]!,
              })
              .returning();
            if (!payment) throw new Error("payment insert failed");

            const [inv] = await tx
              .select()
              .from(invoices)
              .where(eq(invoices.id, invoiceId))
              .limit(1);
            if (!inv) throw new Error(`invoice ${invoiceId} missing`);

            await tx
              .update(invoices)
              .set({ amountPaidPaise: inv.amountPaidPaise + amt })
              .where(eq(invoices.id, invoiceId));

            await appendEventInTx(tx, {
              businessId: ctx.businessId,
              entityType: "invoice",
              entityId: invoiceId,
              type: "PAYMENT_CONFIRMED",
              actor: `user:${ctx.userId}`,
              atIso: atIso(today),
              payload: {
                amountPaise: amt,
                paidOn: line.date,
                reference: line.ref || null,
                lineHash,
                description: line.description,
              },
            });

            rows.push({
              id: payment.id,
              invoiceId,
              amountPaise: amt,
            });
          }
          return rows;
        });

        return NextResponse.json({ data: { already: false, payments: inserted } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Confirm failed";
        return NextResponse.json({ error: { code: "INTERNAL", message: msg } }, { status: 500 });
      }
    },
    ["owner", "accountant"],
  );
}

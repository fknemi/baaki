import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { inboxItems, invoices } from "@/lib/db/schema";
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
      const body = (await req.json().catch(() => ({}))) as {
        creditNoteAmountPaise?: number;
        paidOn?: string;
        reference?: string;
      };

      const [item] = await db
        .select()
        .from(inboxItems)
        .where(
          and(eq(inboxItems.id, id), eq(inboxItems.businessId, ctx.businessId)),
        )
        .limit(1);

      if (!item) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Inbox item not found." } },
          { status: 404 },
        );
      }
      if (item.status !== "open") {
        return NextResponse.json(
          { error: { code: "CONFLICT", message: "Item already resolved." } },
          { status: 409 },
        );
      }

      const [inv] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, item.invoiceId))
        .limit(1);
      if (!inv) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice missing." } },
          { status: 404 },
        );
      }

      const today = todayIST();

      try {
        await db.transaction(async (tx) => {
          await tx
            .update(inboxItems)
            .set({ status: "accepted", resolvedAt: new Date() })
            .where(eq(inboxItems.id, item.id));

          if (item.type === "dispute") {
            await tx
              .update(invoices)
              .set({ disputed: false })
              .where(eq(invoices.id, inv.id));

            await appendEventInTx(tx, {
              businessId: ctx.businessId,
              entityType: "invoice",
              entityId: inv.id,
              type: "DISPUTE_RESOLVED",
              actor: `user:${ctx.userId}`,
              atIso: atIso(today),
              payload: {
                inboxItemId: item.id,
                resolution: "accepted",
                creditNoteAmountPaise: body.creditNoteAmountPaise ?? 0,
              },
            });
          } else {
            const total = await getInvoiceWithTotals(
              inv.id,
              ctx.businessId,
              today,
            );
            if (total) {
              await tx
                .update(invoices)
                .set({ amountPaidPaise: total.totals.totalPaise })
                .where(eq(invoices.id, inv.id));
            }

            await appendEventInTx(tx, {
              businessId: ctx.businessId,
              entityType: "invoice",
              entityId: inv.id,
              type: "ALREADY_PAID_CONFIRMED",
              actor: `user:${ctx.userId}`,
              atIso: atIso(today),
              payload: {
                inboxItemId: item.id,
                resolution: "accepted",
                paidOn: body.paidOn ?? today,
                reference: body.reference ?? null,
              },
            });
          }
        });

        const updated = await getInvoiceWithTotals(
          inv.id,
          ctx.businessId,
          today,
        );
        return NextResponse.json({ data: updated });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Accept failed";
        return NextResponse.json(
          { error: { code: "INTERNAL", message: msg } },
          { status: 500 },
        );
      }
    },
    ["owner", "accountant"],
  );
}

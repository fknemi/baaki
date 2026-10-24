import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { inboxItems, invoiceItems, invoices } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { todayIST, atIso } from "@/lib/domain/dates";

type ItemPatch = {
  itemId: string;
  description?: string;
  qty?: number;
  ratePaise?: number;
  discountPaise?: number;
  gstRatePct?: number;
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as {
        corrections?: ItemPatch[];
      };
      if (!body.corrections || body.corrections.length === 0) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "corrections required" } },
          { status: 400 },
        );
      }

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
      const diffs: Array<{
        itemId: string;
        field: string;
        from: unknown;
        to: unknown;
      }> = [];

      try {
        await db.transaction(async (tx) => {
          for (const patch of body.corrections!) {
            const [existing] = await tx
              .select()
              .from(invoiceItems)
              .where(
                and(
                  eq(invoiceItems.id, patch.itemId),
                  eq(invoiceItems.invoiceId, inv.id),
                ),
              )
              .limit(1);
            if (!existing) continue;

            const updates: Record<string, unknown> = {};
            const fields: Array<keyof ItemPatch> = [
              "description",
              "qty",
              "ratePaise",
              "discountPaise",
              "gstRatePct",
            ];
            for (const f of fields) {
              if (f === "itemId") continue;
              const next = patch[f];
              if (next === undefined) continue;
              const curr = existing[f as keyof typeof existing];
              if (curr !== next) {
                updates[f] = next;
                diffs.push({
                  itemId: patch.itemId,
                  field: f,
                  from: curr,
                  to: next,
                });
              }
            }
            if (Object.keys(updates).length === 0) continue;
            await tx
              .update(invoiceItems)
              .set(updates)
              .where(eq(invoiceItems.id, patch.itemId));
          }

          // Mark the inbox item resolved
          await tx
            .update(inboxItems)
            .set({ status: "resolved", resolvedAt: new Date() })
            .where(eq(inboxItems.id, item.id));

          // Clear disputed so ladder can resume
          await tx
            .update(invoices)
            .set({ disputed: false })
            .where(eq(invoices.id, inv.id));

          await appendEventInTx(tx, {
            businessId: ctx.businessId,
            entityType: "invoice",
            entityId: inv.id,
            type: "CORRECTION",
            actor: `user:${ctx.userId}`,
            atIso: atIso(today),
            payload: { inboxItemId: item.id, corrections: diffs },
          });
        });

        return NextResponse.json({
          data: { id: item.id, status: "resolved", corrections: diffs.length },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Edit failed";
        return NextResponse.json(
          { error: { code: "INTERNAL", message: msg } },
          { status: 500 },
        );
      }
    },
    ["owner", "accountant"],
  );
}

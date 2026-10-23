import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { todayIST, atIso } from "@/lib/domain/dates";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return requireRole(req, async (_req, ctx) => {
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
    if (inv.status !== "draft") {
      return NextResponse.json({ data: { id: inv.id, status: inv.status, alreadySent: true } });
    }

    await db.transaction(async (tx) => {
      await tx.update(invoices).set({ status: "sent" }).where(eq(invoices.id, inv.id));
      await appendEventInTx(tx, {
        businessId: ctx.businessId,
        entityType: "invoice",
        entityId: inv.id,
        type: "INVOICE_SENT",
        actor: `user:${ctx.userId}`,
        atIso: atIso(todayIST()),
        payload: { number: inv.number },
      });
    });

    return NextResponse.json({ data: { id: inv.id, status: "sent" } });
  }, ["owner", "accountant"]);
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { inboxItems, invoices } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { todayIST, atIso } from "@/lib/domain/dates";
import { verifyPayToken } from "@/lib/auth/pay-token";

const oneDayAgo = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifyPayToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Link expired or invalid." } },
      { status: 404 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = (body.reason ?? "").trim();
  if (reason.length === 0) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "reason required" } },
      { status: 400 },
    );
  }

  const [inv] = await db.select().from(invoices).where(eq(invoices.id, payload.invoiceId)).limit(1);
  if (!inv || inv.businessId !== payload.businessId) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Invoice missing." } },
      { status: 404 },
    );
  }

  const [recent] = await db
    .select({ id: inboxItems.id })
    .from(inboxItems)
    .where(and(eq(inboxItems.invoiceId, inv.id), gte(inboxItems.createdAt, oneDayAgo())))
    .limit(1);
  if (recent) {
    return NextResponse.json(
      { error: { code: "CONFLICT", message: "Already sent. Please wait." } },
      { status: 409 },
    );
  }

  const today = todayIST();
  try {
    await db.transaction(async (tx) => {
      await tx.update(invoices).set({ disputed: true }).where(eq(invoices.id, inv.id));

      const [item] = await tx
        .insert(inboxItems)
        .values({
          businessId: payload.businessId,
          invoiceId: inv.id,
          type: "dispute",
          message: reason,
          reference: null,
          status: "open",
        })
        .returning();
      if (!item) throw new Error("insert failed");

      await appendEventInTx(tx, {
        businessId: payload.businessId,
        entityType: "invoice",
        entityId: inv.id,
        type: "DISPUTE_RAISED",
        actor: "customer",
        atIso: atIso(today),
        payload: { inboxItemId: item.id, reason },
      });
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: { code: "INTERNAL", message: msg } }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { todayIST, atIso } from "@/lib/domain/dates";
import { inboxItems, invoices } from "@/lib/db/schema";
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    return requireRole(
        req,
        async (req, ctx) => {
            const body = (await req.json().catch(() => ({}))) as { reply?: string };
            if (!body.reply || body.reply.trim().length === 0) {
                return NextResponse.json(
                    {
                        error: {
                            code: "BAD_REQUEST",
                            message: "reply required (non-empty).",
                        },
                    },
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
            if (item.status !== "open") {
                return NextResponse.json(
                    { error: { code: "CONFLICT", message: "Item already resolved." } },
                    { status: 409 },
                );
            }

            const today = todayIST();

            const [inv] = await db
                .select()
                .from(invoices)
                .where(eq(invoices.id, item.invoiceId))
                .limit(1);
            try {
                await db.transaction(async (tx) => {
                    await tx
                        .update(inboxItems)
                        .set({ status: "rejected", resolvedAt: new Date() })
                        .where(eq(inboxItems.id, item.id));
                    await tx
                        .update(invoices)
                        .set({ disputed: false })
                        .where(eq(invoices.id, item.invoiceId));
                    await appendEventInTx(tx, {
                        businessId: ctx.businessId,
                        entityType: "invoice",
                        entityId: item.invoiceId,
                        type:
                            item.type === "dispute"
                                ? "DISPUTE_REJECTED"
                                : "ALREADY_PAID_REJECTED",
                        actor: `user:${ctx.userId}`,
                        atIso: atIso(today),
                        payload: {
                            inboxItemId: item.id,
                            reply: body.reply!.trim(),
                        },
                    });
                });

                return NextResponse.json({ data: { id: item.id, status: "rejected" } });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Reject failed";
                return NextResponse.json(
                    { error: { code: "INTERNAL", message: msg } },
                    { status: 500 },
                );
            }
        },
        ["owner", "accountant"],
    );
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { todayIST, atIso } from "@/lib/domain/dates";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as {
        promiseDate?: string;
        notes?: string;
      };
      if (!body.promiseDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.promiseDate)) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "promiseDate must be YYYY-MM-DD.",
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

      const today = todayIST();

      await db.transaction(async (tx) => {
        await tx
          .update(invoices)
          .set({ promiseToPayDate: body.promiseDate })
          .where(eq(invoices.id, id));

        await appendEventInTx(tx, {
          businessId: ctx.businessId,
          entityType: "invoice",
          entityId: id,
          type: "PROMISE_MADE",
          actor: `user:${ctx.userId}`,
          atIso: atIso(today),
          payload: {
            promiseDate: body.promiseDate,
            notes: body.notes ?? null,
          },
        });
      });

      return NextResponse.json({
        data: { id, promiseToPayDate: body.promiseDate },
      });
    },
    ["owner", "accountant"],
  );
}

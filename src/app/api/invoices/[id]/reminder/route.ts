import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices, reminderLog } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
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
        stageKey?: string;
        channel?: "email" | "whatsapp" | "sms";
      };

      if (!body.stageKey || !body.channel) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "stageKey and channel required.",
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

      try {
        const logId = await db.transaction(async (tx) => {
          const [log] = await tx
            .insert(reminderLog)
            .values({
              businessId: ctx.businessId,
              invoiceId: inv.id,
              stageKey: body.stageKey!,
              channel: body.channel!,
              status: "sent",
              sentAt: new Date(),
            })
            .onConflictDoNothing({
              target: [reminderLog.invoiceId, reminderLog.stageKey],
            })
            .returning();

          if (!log) {
            return null;
          }

          await appendEventInTx(tx, {
            businessId: ctx.businessId,
            entityType: "invoice",
            entityId: inv.id,
            type: "REMINDER_SENT",
            actor: `user:${ctx.userId}`,
            atIso: atIso(today),
            payload: {
              stageKey: body.stageKey,
              channel: body.channel,
              // Phase 6 wires real delivery; Phase 5 records intent.
              simulated: true,
            },
          });

          return log.id;
        });

        if (!logId) {
          return NextResponse.json({
            data: { alreadySent: true, stageKey: body.stageKey },
          });
        }

        return NextResponse.json({
          data: { id: logId, stageKey: body.stageKey, channel: body.channel },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Reminder failed";
        return NextResponse.json(
          { error: { code: "INTERNAL", message: msg } },
          { status: 500 },
        );
      }
    },
    ["owner", "accountant"],
  );
}

import { todayIST, atIso } from "@/lib/domain/dates";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, users, reminderLog } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { getFollowUps } from "@/lib/db/queries/follow-ups";
import { sendEmail } from "@/lib/integrations/resend";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "CRON_SECRET not set." } },
      { status: 500 },
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Invalid cron secret." } },
      { status: 401 },
    );
  }

  const today = todayIST();
  const bizRows = await db.select().from(businesses);

  const summary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const biz of bizRows) {
    const autoSend = new Set(
      Array.isArray(biz.autoSendStages) ? (biz.autoSendStages as string[]) : ["headsUp", "dueDate"],
    );
    const [owner] = await db.select().from(users).where(eq(users.id, biz.ownerId)).limit(1);

    const followUps = await getFollowUps(biz.id, today);

    for (const item of followUps.dueToday) {
      if (!item.stage || !item.message) continue;
      if (!autoSend.has(item.stage.key)) {
        summary.skipped++;
        continue;
      }

      summary.processed++;

      if (!item.customerEmail) {
        summary.skipped++;
        continue;
      }

      try {
        const result = await db.transaction(async (tx) => {
          const [log] = await tx
            .insert(reminderLog)
            .values({
              businessId: biz.id,
              invoiceId: item.invoiceId,
              stageKey: item.stage!.key,
              channel: "email",
              status: "pending",
            })
            .onConflictDoNothing({
              target: [reminderLog.invoiceId, reminderLog.stageKey],
            })
            .returning();

          if (!log) return { alreadySent: true };

          const send = await sendEmail({
            to: item.customerEmail!,
            subject: item.message!.subject,
            body: item.message!.body,
            replyTo: owner?.email ?? undefined,
          });

          const status = send.sent ? "sent" : "failed";
          await tx
            .update(reminderLog)
            .set({
              status,
              providerId: send.sent ? send.id : null,
              error: send.sent ? null : send.error,
              sentAt: new Date(`${today}T10:00:00+05:30`),
            })
            .where(eq(reminderLog.id, log.id));

          await appendEventInTx(tx, {
            businessId: biz.id,
            entityType: "invoice",
            entityId: item.invoiceId,
            type: "REMINDER_SENT",
            actor: "system",
            atIso: atIso(today),
            payload: {
              stageKey: item.stage!.key,
              channel: "email",
              messageSubject: item.message!.subject,
              messageBody: item.message!.body,
              status,
              automated: true,
            },
          });

          return { alreadySent: false, status };
        });

        if (result.alreadySent) {
          summary.skipped++;
        } else if (result.status === "sent") {
          summary.sent++;
        } else {
          summary.failed++;
        }
      } catch (err) {
        summary.failed++;
        summary.errors.push(
          `invoice ${item.invoiceNumber}: ${err instanceof Error ? err.message : "error"}`,
        );
      }
    }
  }

  return NextResponse.json({ data: { ...summary, date: today } });
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { events, invoices } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { todayIST, atIso } from "@/lib/domain/dates";

const STAGES = ["headsUp", "dueDate", "firm", "finalCall"] as const;
const CHANNELS = ["email", "whatsapp", "sms", "call"] as const;
type Stage = (typeof STAGES)[number];
type Channel = (typeof CHANNELS)[number];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return requireRole(
    req,
    async (req, ctx) => {
      let body: { stageKey?: unknown; channel?: unknown };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "JSON body required." } },
          { status: 400 },
        );
      }

      const { stageKey, channel } = body;
      if (
        typeof stageKey !== "string" ||
        !STAGES.includes(stageKey as Stage) ||
        typeof channel !== "string" ||
        !CHANNELS.includes(channel as Channel)
      ) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "stageKey must be one of headsUp|dueDate|firm|finalCall; channel one of email|whatsapp|sms|call.",
            },
          },
          { status: 400 },
        );
      }

      // Scope to this business. A cross-business id must 404 here, not
      // after a DB hit in the tx below.
      const [inv] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.businessId, ctx.businessId)))
        .limit(1);
      if (!inv) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice not found." } },
          { status: 404 },
        );
      }

      const result = await db.transaction(async (tx) => {
        // Idempotency: (stageKey, channel) is the reminder identity.
        // Reading REMINDER_SENT events for this entity is the source of
        // truth — no separate reminders table to keep in sync. The
        // advisory lock inside appendEventInTx serializes concurrent
        // POSTs on the same entity, so two clicks can't both "win".
        const existing = await tx
          .select({ payload: events.payload })
          .from(events)
          .where(
            and(
              eq(events.businessId, ctx.businessId),
              eq(events.entityId, id),
              eq(events.type, "REMINDER_SENT"),
            ),
          );

        const alreadySent = existing.some((e) => {
          const p = (e.payload ?? {}) as Record<string, unknown>;
          return p.stageKey === stageKey && p.channel === channel;
        });

        if (alreadySent) {
          return { alreadySent: true as const };
        }

        const event = await appendEventInTx(tx, {
          businessId: ctx.businessId,
          entityType: "invoice",
          entityId: id,
          type: "REMINDER_SENT",
          actor: `user:${ctx.userId}`,
          atIso: atIso(todayIST()),
          payload: { stageKey, channel },
        });

        return { alreadySent: false as const, event };
      });

      return NextResponse.json({ data: result });
    },
    ["owner", "accountant", "staff"],
  );
}

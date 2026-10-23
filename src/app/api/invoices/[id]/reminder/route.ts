import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import {
  invoices,
  customers,
  businesses,
  users,
  reminderLog,
} from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { wholeDaysBetween, todayIST, atIso } from "@/lib/domain/dates";
import { renderReminder } from "@/lib/templates/reminders";
import { renderInvoiceAscii } from "@/lib/domain/invoice-ascii";
import { renderInvoicePdf } from "@/lib/domain/invoice-pdf";
import { sendEmail } from "@/lib/integrations/resend";

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
        channel?: "email" | "whatsapp" | "sms" | "call" | "manual";
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

      const [row] = await db
        .select({ invoice: invoices, customer: customers, business: businesses })
        .from(invoices)
        .innerJoin(customers, eq(customers.id, invoices.customerId))
        .innerJoin(businesses, eq(businesses.id, invoices.businessId))
        .where(and(eq(invoices.id, id), eq(invoices.businessId, ctx.businessId)))
        .limit(1);

      if (!row) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice not found." } },
          { status: 404 },
        );
      }

      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.id, row.business.ownerId))
        .limit(1);

      const today = todayIST();
      const totals = await getInvoiceWithTotals(id, ctx.businessId, today);
      if (!totals || totals.outstandingPaise <= 0) {
        return NextResponse.json(
          { error: { code: "CONFLICT", message: "Invoice has no outstanding." } },
          { status: 409 },
        );
      }

      const daysOverdue = Math.max(0, wholeDaysBetween(row.invoice.dueDate, today));
      const language = (row.customer.preferredLanguage as "en" | "hi") ?? "en";

      const prose = renderReminder(body.stageKey, language, {
        customerName: row.customer.name,
        invoiceNumber: row.invoice.number,
        outstandingPaise: totals.outstandingPaise,
        dueDate: row.invoice.dueDate,
        daysOverdue,
        ownerName: owner?.name ?? "the business",
        ownerPhone: owner?.phoneE164 ?? "",
      });

      // For WhatsApp and SMS: append the ASCII invoice summary.
      // For WhatsApp the client wraps it in triple backticks for monospace.
      const ascii =
        body.channel === "whatsapp" || body.channel === "sms"
          ? "\n\n" + renderInvoiceAscii(totals)
          : "";
      const messageBody = prose.body + ascii;

      try {
        const result = await db.transaction(async (tx) => {
          const [log] = await tx
            .insert(reminderLog)
            .values({
              businessId: ctx.businessId,
              invoiceId: row.invoice.id,
              stageKey: body.stageKey!,
              channel: body.channel!,
              status: "pending",
            })
            .onConflictDoNothing({
              target: [reminderLog.invoiceId, reminderLog.stageKey],
            })
            .returning();

          if (!log) {
            return { alreadySent: true, prose: { ...prose, body: messageBody } };
          }

          let providerId: string | null = null;
          let status: "sent" | "failed" = "sent";
          let errorMessage: string | null = null;

          if (body.channel === "email" && row.customer.email) {
            // Generate PDF and attach
            let attachments;
            try {
              const pdf = await renderInvoicePdf(totals);
              attachments = [
                {
                  filename: `${row.invoice.number.replace(/\//g, "-")}.pdf`,
                  content: Buffer.from(pdf).toString("base64"),
                },
              ];
            } catch (err) {
              // PDF failure should not block the email — degrade to body-only
              console.error("[reminder] PDF generation failed:", err);
            }

            const send = await sendEmail({
              to: row.customer.email,
              subject: prose.subject,
              body: prose.body, // email body is prose only; PDF carries the invoice
              replyTo: owner?.email ?? undefined,
              attachments,
            });
            if (send.sent) {
              providerId = send.id;
              status = "sent";
            } else {
              status = "failed";
              errorMessage = send.error;
            }
          } else if (body.channel === "whatsapp" || body.channel === "sms") {
            // Deep link opens client-side; log the intent
            status = "sent";
          } else if (body.channel === "call" || body.channel === "manual") {
            status = "sent";
          }

          await tx
            .update(reminderLog)
            .set({
              status,
              providerId,
              error: errorMessage,
              sentAt: new Date(`${today}T10:00:00+05:30`),
            })
            .where(eq(reminderLog.id, log.id));

          await appendEventInTx(tx, {
            businessId: ctx.businessId,
            entityType: "invoice",
            entityId: row.invoice.id,
            type: "REMINDER_SENT",
            actor: `user:${ctx.userId}`,
            atIso: atIso(today),
            payload: {
              stageKey: body.stageKey,
              channel: body.channel,
              messageSubject: prose.subject,
              messageBody,
              status,
              providerId,
            },
          });

          return {
            alreadySent: false,
            id: log.id,
            status,
            message: { subject: prose.subject, body: messageBody },
          };
        });

        if (result.alreadySent) {
          return NextResponse.json({
            data: { alreadySent: true, stageKey: body.stageKey },
          });
        }

        return NextResponse.json({ data: result });
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

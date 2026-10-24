import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { evidenceFiles, inboxItems, payments } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { listEntityEvents } from "@/lib/db/hashchain-server";
import { todayIST, wholeDaysBetween } from "@/lib/domain/dates";
import { reminderLog } from "@/lib/db/schema";
export type EvidencePayload = {
  generatedAt: string;
  business: {
    name: string;
    gstin: string | null;
    address: { line1: string; city: string; state: string; pincode: string };
  };
  customer: {
    name: string;
    gstin: string | null;
    city: string | null;
  };
  invoice: {
    id: string;
    number: string;
    invoiceDate: string;
    dueDate: string;
    status: string;
    totalPaise: number;
    amountPaidPaise: number;
    outstandingPaise: number;
    daysOverdue: number;
  };
  events: Array<{
    chainSeq: number;
    type: string;
    actor: string;
    atIso: string;
    payload: Record<string, unknown>;
  }>;
  payments: Array<{
    id: string;
    amountPaise: number;
    paidOn: string;
    reference: string | null;
  }>;
  messages: Array<{
    id: string;
    type: string;
    status: string;
    message: string | null;
    reference: string | null;
    createdAt: string;
  }>;
  attachments: Array<{
    id: string;
    storageKey: string;
    sha256: string;
    mime: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  demandLetterAvailable: boolean;
  demandLetter: {
    generatedOn: string;
    payByDate: string;
    balancePaise: number;
    includeInterest: boolean;
  } | null;
  reminders: Array<{
    id: string;
    stageKey: string;
    channel: string;
    status: string;
    sentAt: string | null;
  }>;
};

export async function loadEvidencePayload(
  invoiceId: string,
  businessId: string,
): Promise<EvidencePayload | null> {
  const today = todayIST();
  const invoice = await getInvoiceWithTotals(invoiceId, businessId, today);
  if (!invoice) return null;

  const events = await listEntityEvents(businessId, invoiceId);

  const pays = await db
    .select()
    .from(payments)
    .where(and(eq(payments.businessId, businessId), eq(payments.invoiceId, invoiceId)))
    .orderBy(desc(payments.paidOn));

  const msgs = await db
    .select()
    .from(inboxItems)
    .where(and(eq(inboxItems.businessId, businessId), eq(inboxItems.invoiceId, invoiceId)))
    .orderBy(desc(inboxItems.createdAt));

  const files = await db
    .select()
    .from(evidenceFiles)
    .where(
      and(
        eq(evidenceFiles.businessId, businessId),
        eq(evidenceFiles.entityType, "invoice"),
        eq(evidenceFiles.entityId, invoiceId),
      ),
    )
    .orderBy(desc(evidenceFiles.createdAt));

  const remRows = await db
    .select()
    .from(reminderLog)
    .where(and(eq(reminderLog.businessId, businessId), eq(reminderLog.invoiceId, invoiceId)))
    .orderBy(desc(reminderLog.sentAt));
  const daysOverdue = Math.max(0, wholeDaysBetween(invoice.dueDate, today));

  // Demand letter presence is gated on the LETTER_GENERATED event, not on
  // a `daysOverdue >= 30` time threshold. A letter is "generated" only when
  // the owner actually opened the letter page (which logs the event).
  const letterEvents = events.filter((e) => e.type === "LETTER_GENERATED");
  const letterEvent = letterEvents[letterEvents.length - 1];
  const demandLetter = letterEvent
    ? {
        generatedOn: String(
          (letterEvent.payload as { generatedOn?: string }).generatedOn ??
            letterEvent.atIso.slice(0, 10),
        ),
        payByDate: String((letterEvent.payload as { payByDate?: string }).payByDate ?? ""),
        balancePaise: Number((letterEvent.payload as { balancePaise?: number }).balancePaise ?? 0),
        includeInterest: Boolean(
          (letterEvent.payload as { includeInterest?: boolean }).includeInterest,
        ),
      }
    : null;
  const demandLetterAvailable = demandLetter !== null;

  return {
    generatedAt: today,
    business: {
      name: invoice.business.name,
      gstin: invoice.business.gstin,
      address: {
        line1: invoice.business.address.line1 ?? "",
        city: invoice.business.address.city ?? "",
        state: invoice.business.address.state ?? "",
        pincode: invoice.business.address.pincode ?? "",
      },
    },
    customer: {
      name: invoice.customer.name,
      gstin: invoice.customer.gstin,
      city: invoice.customer.city,
    },
    invoice: {
      id: invoice.id,
      number: invoice.number,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      totalPaise: invoice.totals.totalPaise,
      amountPaidPaise: invoice.amountPaidPaise,
      outstandingPaise: invoice.outstandingPaise,
      daysOverdue,
    },
    events: events.map((e) => ({
      chainSeq: e.chainSeq,
      type: e.type,
      actor: e.actor,
      atIso: e.atIso,
      payload: e.payload,
    })),
    payments: pays.map((p) => ({
      id: p.id,
      amountPaise: p.amountPaise,
      paidOn: p.paidOn,
      reference: p.reference,
    })),
    reminders: remRows.map((r) => ({
      id: r.id,
      stageKey: r.stageKey,
      channel: r.channel,
      status: r.status,
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    })),
    messages: msgs.map((m) => ({
      id: m.id,
      type: m.type,
      status: m.status,
      message: m.message,
      reference: m.reference,
      createdAt: m.createdAt.toISOString(),
    })),
    attachments: files.map((f) => ({
      id: f.id,
      storageKey: f.storageKey,
      sha256: f.sha256,
      mime: f.mime,
      sizeBytes: f.sizeBytes,
      createdAt: f.createdAt.toISOString(),
    })),
    demandLetterAvailable,
    demandLetter,
  };
}

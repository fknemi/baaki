import { db } from "@/lib/db/client";
import { businesses, users } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { addDays, atIso, todayIST, wholeDaysBetween } from "@/lib/domain/dates";
import { msmedInterest } from "@/lib/domain/msmed";
import { config } from "@/lib/domain/config";
import { and, eq, sql } from "drizzle-orm";
import { events } from "@/lib/db/schema";
import { appendEventInTx } from "@/lib/db/hashchain-server";







export type LetterPayload = {
  letterDate: string;
  payByDate: string;
  business: {
    name: string;
    gstin: string | null;
    address: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      pincode: string;
    };
    bank: {
      accountName: string;
      accountNumberMasked: string;
      ifsc: string;
      bankName: string;
    } | null;
    upiId: string | null;
  };
  customer: {
    name: string;
    city: string | null;
    state: string | null;
    gstin: string | null;
  };
  invoice: {
    id: string;
    number: string;
    invoiceDate: string;
    dueDate: string;
    totalPaise: number;
    amountPaidPaise: number;
    balancePaise: number;
  };
  msmed: {
    line: string | null;
    interestPaise: number;
    formulaNote: string | null;
    included: boolean;
  };
  contact: {
    ownerName: string;
    ownerPhone: string | null;
  };
  upiUri: string | null;
};

export async function loadLetterPayload(
  invoiceId: string,
  businessId: string,
  includeInterest: boolean,
): Promise<LetterPayload | null> {
  const today = todayIST();
  const invoice = await getInvoiceWithTotals(invoiceId, businessId, today);
  if (!invoice) return null;

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1);
  if (!biz) return null;

  const [owner] = await db
    .select({ name: users.name, phone: users.phoneE164 })
    .from(users)
    .where(eq(users.id, biz.ownerId))
    .limit(1);

  const daysOverdue = Math.max(0, wholeDaysBetween(invoice.dueDate, today));

  const msmed = msmedInterest(
    invoice.outstandingPaise,
    daysOverdue,
    config.rbiBankRatePct,
    {
      udyamRegistered: biz.udyamRegistered,
      udyamType: biz.udyamType as
        | "micro"
        | "small"
        | "medium"
        | null
        | undefined,
    },
  );

  const msmedLine = msmed.applicable
    ? `Under Section 16 of the MSMED Act 2006, you may be entitled to compound interest at three times the RBI bank rate (currently ${config.rbiBankRatePct}%).`
    : null;

  const interestIncluded = includeInterest && msmed.applicable;

  const addressJson = biz.addressJson as {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  const bankJson = biz.bankJson as {
    accountName?: string;
    accountNumberMasked?: string;
    ifsc?: string;
    bankName?: string;
  } | null;

  const upiUri =
    biz.upiId && invoice.outstandingPaise > 0
      ? `upi://pay?pa=${encodeURIComponent(biz.upiId)}&pn=${encodeURIComponent(biz.name)}&am=${(invoice.outstandingPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.number)}`
      : null;

  return {
    letterDate: today,
    payByDate: addDays(today, config.demandLetterDeadlineDays),
    business: {
      name: biz.name,
      gstin: biz.gstin,
      address: {
        line1: addressJson.line1 ?? "",
        line2: addressJson.line2,
        city: addressJson.city ?? "",
        state: addressJson.state ?? "",
        pincode: addressJson.pincode ?? "",
      },
      bank: bankJson?.accountNumberMasked
        ? {
            accountName: bankJson.accountName ?? "",
            accountNumberMasked: bankJson.accountNumberMasked,
            ifsc: bankJson.ifsc ?? "",
            bankName: bankJson.bankName ?? "",
          }
        : null,
      upiId: biz.upiId,
    },
    customer: {
      name: invoice.customer.name,
      city: invoice.customer.city,
      state: null,
      gstin: invoice.customer.gstin,
    },
    invoice: {
      id: invoice.id,
      number: invoice.number,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      totalPaise: invoice.totals.totalPaise,
      amountPaidPaise: invoice.amountPaidPaise,
      balancePaise: invoice.outstandingPaise,
    },
    msmed: {
      line: msmedLine,
      interestPaise: msmed.applicable ? msmed.interestPaise : 0,
      formulaNote: msmed.applicable ? msmed.formulaNote : null,
      included: interestIncluded,
    },
    contact: {
      ownerName: owner?.name ?? biz.name,
      ownerPhone: owner?.phone ?? null,
    },
    upiUri,
  };
}

/**
 * Appends a LETTER_GENERATED event if one doesn't already exist for today.
 * Idempotent per calendar day per invoice, race-safe.
 *
 * The check-and-insert runs inside a single transaction that holds the
 * same advisory lock appendEventInTx uses. Two concurrent letter page loads
 * therefore serialize: the first commits its event, the second sees it and
 * returns without writing a duplicate.
 */
export async function logLetterGenerated(
  invoiceId: string,
  businessId: string,
  userId: string,
  snapshot: {
    balancePaise: number;
    payByDate: string;
    includeInterest: boolean;
  },
): Promise<void> {
  const today = todayIST();

  await db.transaction(async (tx) => {
    // Acquire the same advisory lock appendEventInTx will re-acquire.
    // pg_advisory_xact_lock is reentrant within the same tx, so no deadlock.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(${`${businessId}:${invoiceId}`}))`,
    );

    // Check under lock — no other transaction can be appending for this
    // entity right now.
    const existingRows = await tx
      .select()
      .from(events)
      .where(
        and(
          eq(events.businessId, businessId),
          eq(events.entityId, invoiceId),
          eq(events.type, "LETTER_GENERATED"),
        ),
      );

    const alreadyToday = existingRows.some(
      (e) => e.atIso.toISOString().slice(0, 10) === today,
    );
    if (alreadyToday) return;

    await appendEventInTx(tx, {
      businessId,
      entityType: "invoice",
      entityId: invoiceId,
      type: "LETTER_GENERATED",
      actor: `user:${userId}`,
      atIso: atIso(today),
      payload: {
        generatedOn: today,
        payByDate: snapshot.payByDate,
        balancePaise: snapshot.balancePaise,
        includeInterest: snapshot.includeInterest,
      },
    });
  });
}

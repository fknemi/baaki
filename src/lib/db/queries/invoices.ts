import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { invoices, invoiceItems, customers, businesses } from "@/lib/db/schema";
import { computeTotals, type GstTotals, type InvoiceItemInput } from "@/lib/domain/gst";
import { wholeDaysBetween } from "@/lib/domain/dates";

export type DerivedStatus =
  "draft" | "sent" | "due_soon" | "overdue" | "part_paid" | "paid" | "disputed" | "cancelled";

export type InvoiceItemView = {
  id: string;
  description: string;
  hsnSac: string;
  qty: number;
  unit: string;
  ratePaise: number;
  discountPaise: number;
  gstRatePct: number;
};

// Matches the confirmed shape of businesses.bankJson. accountNumberMasked
// is the presence check (and the only account-number field we ever read
// or show — this app masks sensitive numbers at rest, same pattern as
// customer.phoneMasked elsewhere), so a bankJson with no
// accountNumberMasked is treated as "no bank details configured", not an
// error.
export type BusinessBankInfo = {
  accountName: string;
  accountNumberMasked: string;
  ifsc: string;
  bankName: string;
};

function bankFromJson(json: unknown): BusinessBankInfo | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Record<string, unknown>;
  const accountNumberMasked = j.accountNumberMasked;
  if (typeof accountNumberMasked !== "string" || !accountNumberMasked) return null;
  return {
    accountName: typeof j.accountName === "string" ? j.accountName : "",
    accountNumberMasked,
    ifsc: typeof j.ifsc === "string" ? j.ifsc : "",
    bankName: typeof j.bankName === "string" ? j.bankName : "",
  };
}

// paymentMethods is stored as jsonb with no DB-level type guarantee, so
// this defends against anything that isn't actually a string[] (null,
// a malformed value, non-string entries) by filtering down to strings
// and defaulting to an empty array rather than throwing.
function paymentMethodsFromJson(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.filter((m): m is string => typeof m === "string");
}

export type InvoiceView = {
  id: string;
  number: string;
  invoiceDate: string;
  dueDate: string;
  status: DerivedStatus;
  amountPaidPaise: number;
  outstandingPaise: number;
  daysOverdue: number;
  disputed: boolean;
  reverseCharge: boolean;
  placeOfSupplyStateCode: string;
  everCrossedEinvoiceThreshold: boolean;
  customer: {
    id: string;
    name: string;
    gstin: string | null;
    stateCode: string;
    city: string | null;
    phoneMasked: string | null;
    email: string | null;
  };
  business: {
    id: string;
    name: string;
    gstin: string | null;
    stateCode: string;
    upiId: string | null;
    // New: every payment method the business has configured, and the
    // bank account details (if any) to go with a "bank" entry in that
    // list. Added so reminder/summary rendering (see
    // lib/domain/invoice-ascii.ts) can show ALL configured payment
    // methods rather than just upiId alone.
    paymentMethods: string[];
    bank: BusinessBankInfo | null;
    address: {
      line1: string | null;
      city: string | null;
      state: string | null;
      pincode: string | null;
    };
  };
  items: InvoiceItemView[];
  totals: GstTotals;
};

function stateCodeFromAddress(json: unknown): string {
  if (json && typeof json === "object" && "stateCode" in json) {
    const v = (json as { stateCode: unknown }).stateCode;
    if (typeof v === "string") return v;
  }
  return "27";
}

function addressFromJson(json: unknown): InvoiceView["business"]["address"] {
  if (json && typeof json === "object") {
    const j = json as Record<string, unknown>;
    return {
      line1: typeof j.line1 === "string" ? j.line1 : null,
      city: typeof j.city === "string" ? j.city : null,
      state: typeof j.state === "string" ? j.state : null,
      pincode: typeof j.pincode === "string" ? j.pincode : null,
    };
  }
  return { line1: null, city: null, state: null, pincode: null };
}

function deriveStatus(
  row: { status: string; amountPaidPaise: number; disputed: boolean; dueDate: string },
  totals: GstTotals,
  daysOverdue: number,
  today: string,
): DerivedStatus {
  if (row.status === "cancelled") return "cancelled";
  if (row.disputed) return "disputed";
  if (row.amountPaidPaise >= totals.totalPaise && totals.totalPaise > 0) return "paid";
  if (row.amountPaidPaise > 0) return "part_paid";
  if (daysOverdue > 0) return "overdue";
  const daysUntilDue = -wholeDaysBetween(row.dueDate, today);
  if (daysUntilDue <= 7 && row.status === "sent") return "due_soon";
  return (row.status as DerivedStatus) ?? "draft";
}

export async function getInvoiceWithTotals(
  invoiceId: string,
  businessId: string,
  today: string,
): Promise<InvoiceView | null> {
  const [row] = await db
    .select({ invoice: invoices, customer: customers, business: businesses })
    .from(invoices)
    .innerJoin(customers, eq(customers.id, invoices.customerId))
    .innerJoin(businesses, eq(businesses.id, invoices.businessId))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.businessId, businessId)))
    .limit(1);

  if (!row) return null;

  const items = await db.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, invoiceId));

  const itemsView: InvoiceItemView[] = items.map((it) => ({
    id: it.id,
    description: it.description,
    hsnSac: it.hsnSac,
    qty: Number(it.qty),
    unit: it.unit,
    ratePaise: it.ratePaise,
    discountPaise: it.discountPaise,
    gstRatePct: Number(it.gstRatePct),
  }));

  const itemsInput: InvoiceItemInput[] = itemsView.map((it) => ({
    qty: it.qty,
    ratePaise: it.ratePaise,
    discountPaise: it.discountPaise,
    gstRatePct: it.gstRatePct,
  }));

  const businessStateCode = stateCodeFromAddress(row.business.addressJson);
  const totals = computeTotals(
    itemsInput,
    {
      stateCode: businessStateCode,
      registrationType: (row.business.registrationType ?? "regular") as
        "regular" | "composition" | "unregistered",
    },
    { stateCode: row.customer.stateCode ?? "27" },
  );

  const daysOverdue = Math.max(0, wholeDaysBetween(row.invoice.dueDate, today));
  const outstandingPaise = Math.max(0, totals.totalPaise - row.invoice.amountPaidPaise);

  return {
    id: row.invoice.id,
    number: row.invoice.number,
    invoiceDate: row.invoice.invoiceDate,
    dueDate: row.invoice.dueDate,
    status: deriveStatus(row.invoice, totals, daysOverdue, today),
    amountPaidPaise: row.invoice.amountPaidPaise,
    outstandingPaise,
    daysOverdue,
    disputed: row.invoice.disputed,
    reverseCharge: row.invoice.reverseCharge,
    placeOfSupplyStateCode: row.invoice.placeOfSupplyStateCode,
    everCrossedEinvoiceThreshold: row.business.everCrossedEinvoiceThreshold,
    customer: {
      id: row.customer.id,
      name: row.customer.name,
      gstin: row.customer.gstin,
      stateCode: row.customer.stateCode ?? "27",
      city: row.customer.city,
      phoneMasked: row.customer.phoneMasked,
      email: row.customer.email,
    },
    business: {
      id: row.business.id,
      name: row.business.name,
      gstin: row.business.gstin,
      stateCode: businessStateCode,
      upiId: row.business.upiId,
      paymentMethods: paymentMethodsFromJson(row.business.paymentMethods),
      bank: bankFromJson(row.business.bankJson),
      address: addressFromJson(row.business.addressJson),
    },
    items: itemsView,
    totals,
  };
}

export async function listInvoices(
  businessId: string,
  today: string,
  limit = 100,
  opts: { customerId?: string } = {},
): Promise<InvoiceView[]> {
  const conditions = [eq(invoices.businessId, businessId)];
  if (opts.customerId) {
    conditions.push(eq(invoices.customerId, opts.customerId));
  }

  const rows = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(...conditions))
    .orderBy(desc(invoices.invoiceDate), desc(invoices.number))
    .limit(limit);

  const views = await Promise.all(rows.map((r) => getInvoiceWithTotals(r.id, businessId, today)));
  return views.filter((v): v is InvoiceView => v !== null);
}

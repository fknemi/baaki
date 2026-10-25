import { formatINR, formatINRDelta } from "./money";
import type { InvoiceView } from "@/lib/db/queries/invoices";

function pad(s: string, n: number, align: "left" | "right" = "left"): string {
  if (s.length >= n) return s.slice(0, n);
  const space = " ".repeat(n - s.length);
  return align === "right" ? space + s : s + space;
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Renders one line per payment method the business has both (a) listed in
// paymentMethods and (b) actually configured data for. A method present
// in paymentMethods with no backing data (e.g. "bank" listed but bankJson
// is null, or "upi" listed but upiId is null) is silently skipped rather
// than printed as a broken/empty line — the array is the business's
// intent ("these are the ways I accept payment"), the underlying field is
// the actual data, and only the overlap of both is something we can show.
//
// ASSUMPTION, not yet confirmed against real data: the string literals
// inside paymentMethods are "upi" and "bank", matching the schema's
// default (["upi"]) and the two fields that currently exist on
// `businesses` (upiId, bankJson). If the real values differ (e.g.
// "bank_transfer"), update the two `method === "..."` checks below —
// everything else in this function is unaffected by that string.
//
// OPEN QUESTION, intentionally left as-is for now: if paymentMethods is
// empty, or every listed method is missing its data, this produces ZERO
// lines — the summary goes straight from "Total" to nothing, no
// fallback text. Add a line here (e.g. "Contact us for payment details")
// if that silence isn't the behavior you want.
function paymentLines(business: InvoiceView["business"]): string[] {
  const lines: string[] = [];
  const methods = business.paymentMethods ?? [];

  for (const method of methods) {
    if (method === "upi" && business.upiId) {
      lines.push(`UPI: ${business.upiId}`);
    } else if (method === "bank" && business.bank) {
      const b = business.bank;
      lines.push(`Bank: ${b.bankName} · ${b.accountNumberMasked} · IFSC ${b.ifsc}`);
    }
    // Any other method string, or a listed method with no data, is
    // silently skipped.
  }

  return lines;
}

export function renderInvoiceAscii(inv: InvoiceView): string {
  const lines: string[] = [];
  const width = 44;

  lines.push(`${inv.number} · ${trunc(inv.customer.name, 30)}`);
  lines.push(`Due ${inv.dueDate} · ${inv.daysOverdue}d overdue`);
  lines.push("─".repeat(width));
  lines.push(pad("Item", 24) + pad("Qty", 6, "right") + pad("Taxable", 14, "right"));
  lines.push("─".repeat(width));

  for (const it of inv.items) {
    const taxable = Math.round(it.qty * it.ratePaise) - it.discountPaise;
    lines.push(
      pad(trunc(it.description, 24), 24) +
        pad(String(it.qty), 6, "right") +
        pad(formatINR(taxable), 14, "right"),
    );
  }

  lines.push("─".repeat(width));
  lines.push(pad("Taxable", 30) + pad(formatINR(inv.totals.taxablePaise), 14, "right"));
  if (inv.totals.hasTax && !inv.totals.isInterState) {
    lines.push(pad("CGST", 30) + pad(formatINR(inv.totals.cgstPaise), 14, "right"));
    lines.push(pad("SGST", 30) + pad(formatINR(inv.totals.sgstPaise), 14, "right"));
  }
  if (inv.totals.hasTax && inv.totals.isInterState) {
    lines.push(pad("IGST", 30) + pad(formatINR(inv.totals.igstPaise), 14, "right"));
  }
  if (inv.totals.roundOffPaise !== 0) {
    lines.push(pad("Round off", 30) + pad(formatINRDelta(inv.totals.roundOffPaise), 14, "right"));
  }
  lines.push(pad("Total", 30) + pad(formatINR(inv.totals.totalPaise), 14, "right"));
  lines.push("─".repeat(width));
  lines.push(`Pay by: ${inv.dueDate}`);

  // Was: a single hardcoded `UPI: ${inv.business.upiId ?? "—"}` line.
  // Now: one line per configured payment method (see paymentLines above).
  lines.push(...paymentLines(inv.business));

  return lines.join("\n");
}

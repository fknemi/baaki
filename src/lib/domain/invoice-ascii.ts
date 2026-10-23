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

export function renderInvoiceAscii(inv: InvoiceView): string {
  const lines: string[] = [];
  const width = 44;

  lines.push(`${inv.number} · ${trunc(inv.customer.name, 30)}`);
  lines.push(`Due ${inv.dueDate} · ${inv.daysOverdue}d overdue`);
  lines.push("─".repeat(width));
  lines.push(
    pad("Item", 24) + pad("Qty", 6, "right") + pad("Taxable", 14, "right"),
  );
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
  lines.push(
    pad("Taxable", 30) + pad(formatINR(inv.totals.taxablePaise), 14, "right"),
  );
  if (inv.totals.hasTax && !inv.totals.isInterState) {
    lines.push(
      pad("CGST", 30) + pad(formatINR(inv.totals.cgstPaise), 14, "right"),
    );
    lines.push(
      pad("SGST", 30) + pad(formatINR(inv.totals.sgstPaise), 14, "right"),
    );
  }
  if (inv.totals.hasTax && inv.totals.isInterState) {
    lines.push(
      pad("IGST", 30) + pad(formatINR(inv.totals.igstPaise), 14, "right"),
    );
  }
  if (inv.totals.roundOffPaise !== 0) {
    lines.push(
      pad("Round off", 30) +
        pad(formatINRDelta(inv.totals.roundOffPaise), 14, "right"),
    );
  }
  lines.push(
    pad("Total", 30) + pad(formatINR(inv.totals.totalPaise), 14, "right"),
  );
  lines.push("─".repeat(width));
  lines.push(`Pay by: ${inv.dueDate}`);
  lines.push(`UPI: ${inv.business.upiId ?? "—"}`);

  return lines.join("\n");
}

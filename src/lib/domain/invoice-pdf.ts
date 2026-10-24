import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { numberToWordsIndian } from "./words";
import type { InvoiceView } from "@/lib/db/queries/invoices";

/**
 * Minimal A4 tax invoice PDF. Uses StandardFonts.Helvetica (WinAnsi) which
 * does not include the ₹ glyph, so amounts use "Rs." prefix. The A4 print
 * route at /print/invoice/:id uses the real ₹ via system fonts.
 */
export async function renderInvoicePdf(inv: InvoiceView): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4 in points
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const L = 40;
  const R = 555;
  let y = 800;

  const inr = (paise: number) =>
    "Rs. " +
    (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const text = (s: string, x: number, size = 10, useBold = false, color = rgb(0.1, 0.11, 0.14)) => {
    page.drawText(s, { x, y, size, font: useBold ? bold : font, color });
  };

  const textRight = (s: string, xRight: number, size = 10, useBold = false) => {
    const w = (useBold ? bold : font).widthOfTextAtSize(s, size);
    text(s, xRight - w, size, useBold);
  };

  const rule = (yPos: number) => {
    page.drawLine({
      start: { x: L, y: yPos },
      end: { x: R, y: yPos },
      thickness: 0.5,
      color: rgb(0.85, 0.87, 0.9),
    });
  };

  // Header
  text(inv.business.name, L, 16, true);
  y -= 18;
  text(
    `${inv.business.address.line1 ?? ""} · ${inv.business.address.city ?? ""} ${inv.business.address.pincode ?? ""}`,
    L,
    9,
  );
  y -= 12;
  if (inv.business.gstin) {
    text(`GSTIN: ${inv.business.gstin}`, L, 9);
    y -= 12;
  }

  textRight("TAX INVOICE", R, 14, true);
  page.drawText(inv.number, {
    x: R - font.widthOfTextAtSize(inv.number, 10),
    y: y + 14,
    size: 10,
    font,
  });
  page.drawText(`Date: ${inv.invoiceDate}`, {
    x: R - font.widthOfTextAtSize(`Date: ${inv.invoiceDate}`, 9),
    y: y + 1,
    size: 9,
    font,
  });
  page.drawText(`Due: ${inv.dueDate}`, {
    x: R - font.widthOfTextAtSize(`Due: ${inv.dueDate}`, 9),
    y: y - 11,
    size: 9,
    font,
  });

  y -= 24;
  rule(y);
  y -= 16;

  // Bill to
  text("BILL TO", L, 8, false, rgb(0.35, 0.38, 0.44));
  y -= 12;
  text(inv.customer.name, L, 11, true);
  y -= 12;
  if (inv.customer.city) {
    text(inv.customer.city, L, 9);
    y -= 11;
  }
  if (inv.customer.gstin) {
    text(`GSTIN: ${inv.customer.gstin}`, L, 9);
    y -= 11;
  }

  // Place of supply / reverse charge (right column, aligned with bill-to block)
  const rightY = y + 34;
  const posLine = `Place of supply: ${inv.placeOfSupplyStateCode}`;
  const rcLine = `Reverse charge: ${inv.reverseCharge ? "Yes" : "No"}`;
  page.drawText(posLine, { x: R - font.widthOfTextAtSize(posLine, 9), y: rightY, size: 9, font });
  page.drawText(rcLine, {
    x: R - font.widthOfTextAtSize(rcLine, 9),
    y: rightY - 12,
    size: 9,
    font,
  });

  y -= 24;
  rule(y);
  y -= 16;

  // Items header
  text("Description", L, 9, true);
  textRight("Qty", 380, 9, true);
  textRight("Rate", 440, 9, true);
  textRight("Taxable", R, 9, true);
  y -= 12;
  rule(y);
  y -= 12;

  for (const it of inv.items) {
    const taxable = Math.round(it.qty * it.ratePaise) - it.discountPaise;
    text(it.description, L, 9);
    textRight(`${it.qty} ${it.unit}`, 380, 9);
    textRight(inr(it.ratePaise), 440, 9);
    textRight(inr(taxable), R, 9);
    y -= 14;
    if (y < 200) {
      // Page break — start a new page for long invoices
      page.drawText("… continued", { x: L, y, size: 9, font, color: rgb(0.5, 0.5, 0.5) });
      break;
    }
  }

  rule(y);
  y -= 16;

  // Totals
  const totalRows: [string, number][] = [["Taxable", inv.totals.taxablePaise]];
  if (inv.totals.hasTax && !inv.totals.isInterState) {
    totalRows.push(["CGST", inv.totals.cgstPaise]);
    totalRows.push(["SGST", inv.totals.sgstPaise]);
  }
  if (inv.totals.hasTax && inv.totals.isInterState) {
    totalRows.push(["IGST", inv.totals.igstPaise]);
  }
  if (inv.totals.roundOffPaise !== 0) {
    totalRows.push(["Round off", inv.totals.roundOffPaise]);
  }

  for (const [label, amt] of totalRows) {
    textRight(label, 470, 9);
    textRight(inr(amt), R, 9);
    y -= 12;
  }

  rule(y);
  y -= 14;
  textRight("TOTAL", 470, 11, true);
  textRight(inr(inv.totals.totalPaise), R, 11, true);
  y -= 18;

  text(numberToWordsIndian(inv.totals.totalPaise), L, 9, false, rgb(0.35, 0.38, 0.44));
  y -= 20;

  // Payment block
  rule(y);
  y -= 16;
  text("PAYMENT", L, 8, false, rgb(0.35, 0.38, 0.44));
  y -= 12;
  if (inv.business.upiId) {
    text(`UPI: ${inv.business.upiId}`, L, 9);
    y -= 12;
  }
  text(`Pay by: ${inv.dueDate}`, L, 9);
  y -= 12;

  rule(y);
  y -= 16;
  text(`For ${inv.business.name}`, R - font.widthOfTextAtSize(`For ${inv.business.name}`, 9), 9);
  y -= 30;
  text("Authorised Signatory", R - font.widthOfTextAtSize("Authorised Signatory", 9), 9);

  page.drawText("Computer-generated invoice. Prototype with sample data.", {
    x: L,
    y: 30,
    size: 8,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return await doc.save();
}

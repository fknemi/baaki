export const instant = false;

import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { numberToWordsIndian } from "@/lib/domain/words";
import { formatINR, formatINRDelta } from "@/lib/domain/money";
export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const businessId = await currentBusinessId(session?.userId);
  const invoice = await getInvoiceWithTotals(id, businessId, todayIST());
  if (!invoice) notFound();

  const docTitle = invoice.totals.hasTax ? "TAX INVOICE" : "BILL OF SUPPLY";

  const upiUri =
    invoice.business.upiId && invoice.outstandingPaise > 0
      ? `upi://pay?pa=${encodeURIComponent(invoice.business.upiId)}&pn=${encodeURIComponent(invoice.business.name)}&am=${(invoice.outstandingPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.number)}`
      : null;

  return (
    <div className="print-page">
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          nav, button, .no-print { display: none !important; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          body { margin: 0; padding: 0; background: white; }
        }
        .print-page {
          font-family: system-ui, sans-serif;
          font-size: 11pt;
          color: #1A1D23;
          background: white;
          padding: 16mm;
          max-width: 210mm;
          margin: 0 auto;
        }
        .print-page table { width: 100%; border-collapse: collapse; }
        .print-page th,
        .print-page td { padding: 4px 6px; font-size: 10pt; }
        .print-page thead th { border-bottom: 1px solid #1A1D23; text-align: left; }
        .print-page tbody tr { border-bottom: 1px solid #E4E7EC; }
        .print-page .num { text-align: right; font-variant-numeric: tabular-nums; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "18pt", fontWeight: 600 }}>{invoice.business.name}</div>
          <div style={{ fontSize: "9pt", color: "#5A6170" }}>
            {invoice.business.address.line1}
            {invoice.business.address.line1 && ", "}
            {invoice.business.address.city} {invoice.business.address.state}{" "}
            {invoice.business.address.pincode}
          </div>
          {invoice.business.gstin && (
            <div style={{ fontSize: "9pt" }}>GSTIN: {invoice.business.gstin}</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "14pt", fontWeight: 600 }}>{docTitle}</div>
          <div style={{ fontSize: "10pt", fontFamily: "monospace" }}>{invoice.number}</div>
          <div style={{ fontSize: "9pt" }}>Date: {invoice.invoiceDate}</div>
          <div style={{ fontSize: "9pt" }}>Due: {invoice.dueDate}</div>
        </div>
      </div>

      <hr style={{ margin: "12px 0", borderColor: "#E4E7EC" }} />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "9pt", color: "#5A6170" }}>BILL TO</div>
          <div style={{ fontWeight: 600 }}>{invoice.customer.name}</div>
          <div style={{ fontSize: "9pt" }}>{invoice.customer.city}</div>
          {invoice.customer.gstin && (
            <div style={{ fontSize: "9pt" }}>GSTIN: {invoice.customer.gstin}</div>
          )}
        </div>
        <div style={{ textAlign: "right", fontSize: "9pt" }}>
          <div>
            <strong>Place of supply:</strong> {invoice.placeOfSupplyStateCode}
          </div>
          <div>
            <strong>Reverse charge:</strong> {invoice.reverseCharge ? "Yes" : "No"}
          </div>
        </div>
      </div>

      <table style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Description</th>
            <th>HSN</th>
            <th className="num">Qty</th>
            <th className="num">Rate</th>
            <th className="num">Taxable</th>
            {invoice.totals.hasTax && !invoice.totals.isInterState && (
              <>
                <th className="num">CGST</th>
                <th className="num">SGST</th>
              </>
            )}
            {invoice.totals.hasTax && invoice.totals.isInterState && <th className="num">IGST</th>}
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it) => {
            const taxable = Math.round(it.qty * it.ratePaise) - it.discountPaise;
            const half = taxable * (it.gstRatePct / 200);
            return (
              <tr key={it.id}>
                <td>{it.description}</td>
                <td>{it.hsnSac}</td>
                <td className="num">
                  {it.qty} {it.unit}
                </td>
                <td className="num">{formatINR(it.ratePaise)}</td>
                <td className="num">{formatINR(taxable)}</td>
                {invoice.totals.hasTax && !invoice.totals.isInterState && (
                  <>
                    <td className="num">{formatINR(Math.round(half))}</td>
                    <td className="num">{formatINR(Math.round(half))}</td>
                  </>
                )}
                {invoice.totals.hasTax && invoice.totals.isInterState && (
                  <td className="num">{formatINR(Math.round(taxable * (it.gstRatePct / 100)))}</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <table style={{ width: "50%" }}>
          <tbody>
            <tr>
              <td>Taxable</td>
              <td className="num">{formatINR(invoice.totals.taxablePaise)}</td>
            </tr>
            {invoice.totals.hasTax && !invoice.totals.isInterState && (
              <>
                <tr>
                  <td>CGST</td>
                  <td className="num">{formatINR(invoice.totals.cgstPaise)}</td>
                </tr>
                <tr>
                  <td>SGST</td>
                  <td className="num">{formatINR(invoice.totals.sgstPaise)}</td>
                </tr>
              </>
            )}
            {invoice.totals.hasTax && invoice.totals.isInterState && (
              <tr>
                <td>IGST</td>
                <td className="num">{formatINR(invoice.totals.igstPaise)}</td>
              </tr>
            )}
            <tr>
              <td>Round off</td>
              <td className="num">{formatINRDelta(invoice.totals.roundOffPaise)}</td>
            </tr>
            <tr style={{ borderTop: "1px solid #1A1D23", fontWeight: 600 }}>
              <td>Total</td>
              <td className="num">{formatINR(invoice.totals.totalPaise)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 8, fontSize: "9pt", fontStyle: "italic" }}>
        Amount in words: {numberToWordsIndian(invoice.totals.totalPaise)}
      </p>

      <hr style={{ margin: "12px 0", borderColor: "#E4E7EC" }} />

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9pt" }}>
        <div>
          {upiUri && (
            <>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Pay by UPI</div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={await QRCode.toDataURL(upiUri, {
                    errorCorrectionLevel: "M",
                    margin: 1,
                    width: 140,
                  })}
                  alt={`UPI QR for ${invoice.number}`}
                  style={{ width: 140, height: 140, display: "block" }}
                />
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "8pt",
                    wordBreak: "break-all",
                    maxWidth: 200,
                  }}
                >
                  {invoice.business.upiId}
                  <br />
                  {invoice.number}
                </div>
              </div>
            </>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ marginTop: 32, borderTop: "1px solid #1A1D23", paddingTop: 4 }}>
            For {invoice.business.name}
          </div>
        </div>
      </div>

      <hr style={{ margin: "12px 0", borderColor: "#E4E7EC" }} />

      <p style={{ fontSize: "8pt", color: "#5A6170", textAlign: "center" }}>
        Computer-generated invoice. Prototype with sample data.
      </p>
    </div>
  );
}

async function currentBusinessId(userId?: string): Promise<string> {
  if (!userId) {
    const { getSession } = await import("@/lib/auth/session");
    const s = await getSession();
    userId = s?.userId;
  }
  if (!userId) throw new Error("Not authenticated");
  const { db } = await import("@/lib/db/client");
  const { businessMembers } = await import("@/lib/db/schema");
  const { eq } = await import("drizzle-orm");
  const [row] = await db
    .select()
    .from(businessMembers)
    .where(eq(businessMembers.userId, userId))
    .limit(1);
  if (!row) throw new Error("No business membership");
  return row.businessId;
}

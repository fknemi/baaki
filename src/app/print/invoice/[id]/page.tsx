export const instant = false;

import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { numberToWordsIndian } from "@/lib/domain/words";
import { formatINR, formatINRDelta } from "@/lib/domain/money";
import { PrintControls } from "@/components/print-controls";

export default async function PrintInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    const businessId = await currentBusinessId(session?.userId);
    const invoice = await getInvoiceWithTotals(id, businessId, todayIST());
    if (!invoice) notFound();

    const docTitle = invoice.totals.hasTax ? "TAX INVOICE" : "BILL OF SUPPLY";

    const overlayLabel: string | null =
        invoice.status === "paid"
            ? "FULLY PAID"
            : invoice.status === "cancelled"
                ? "CANCELLED"
                : null;

    const upiUri =
        invoice.business.upiId && invoice.outstandingPaise > 0
            ? `upi://pay?pa=${encodeURIComponent(invoice.business.upiId)}&pn=${encodeURIComponent(invoice.business.name)}&am=${(invoice.outstandingPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(invoice.number)}`
            : null;

    return (
        <>
            <style>{`
        @page { size: A4; margin: 18mm; }

        html, body {
          margin: 0;
          padding: 0;
          background: #e5e7eb;
        }

        .invoice-shell {
          min-height: 100vh;
          background: #e5e7eb;
          padding: 16px;
          padding-top: 72px;
          box-sizing: border-box;
        }

        .print-page {
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          color: #1A1D23;
          background: #ffffff;
          max-width: 794px;
          margin: 0 auto;
          padding: 32px 36px;
          box-sizing: border-box;
          border-radius: 6px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
          position: relative;
          isolation: isolate;   /* anchors the overlay's negative z-index */
          overflow: hidden;
        }

        /* Screen-only status banner — hidden when printing */
        .inv-status-banner {
          max-width: 794px;
          margin: 0 auto 12px;
          padding: 10px 16px;
          background: rgba(220, 38, 38, 0.08);
          border: 1px solid rgba(220, 38, 38, 0.4);
          border-radius: 6px;
          color: #DC2626;
          font-weight: 700;
          text-align: center;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-size: 14px;
        }

        /* Diagonal watermark — print only, painted BEHIND the text */
        .inv-overlay {
          display: none;
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: -1;               /* behind content, in front of page bg */
          border-radius: inherit;
        }
        .inv-overlay-inner {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 240%;
          height: 240%;
          transform: translate(-50%, -50%) rotate(-30deg);
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          align-content: center;
          gap: 18px 36px;
          padding: 20px;
          box-sizing: border-box;
        }
        .inv-overlay-inner span {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(220, 38, 38, 0.5);
          white-space: nowrap;
          user-select: none;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .inv-header {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: start;
        }
        .inv-biz-name  { font-size: 20px; font-weight: 700; margin: 0 0 2px; }
        .inv-biz-meta  { font-size: 11px; color: #5A6170; margin: 0; line-height: 1.4; }
        .inv-doc-block { text-align: right; white-space: nowrap; }
        .inv-doc-title {
          font-size: 16px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.04em; margin: 0 0 4px; color: #1A1D23;
        }
        .inv-doc-num  { font-family: ui-monospace, monospace; font-size: 12px; margin: 0; }
        .inv-doc-meta { font-size: 11px; color: #5A6170; margin: 2px 0 0; }

        hr.divider { border: none; border-top: 1px solid #E4E7EC; margin: 14px 0; }

        .inv-parties {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: start;
        }
        .inv-label {
          font-size: 9px; text-transform: uppercase;
          letter-spacing: 0.06em; color: #5A6170; margin: 0 0 2px;
        }
        .inv-cust-name { font-size: 14px; font-weight: 600; margin: 0 0 2px; }
        .inv-cust-meta { font-size: 11px; color: #5A6170; margin: 0; }
        .inv-supply    { text-align: right; font-size: 11px; color: #1A1D23; }
        .inv-supply p  { margin: 0 0 2px; }

        .inv-items { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .inv-items th {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #5A6170;
          border-bottom: 1.5px solid #1A1D23;
          padding: 6px 8px;
          text-align: left;
          white-space: nowrap;
        }
        .inv-items td {
          padding: 7px 8px;
          font-size: 12px;
          border-bottom: 1px solid #E4E7EC;
          vertical-align: top;
        }
        .inv-items tbody tr:last-child td { border-bottom: none; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }

        .inv-totals-wrap {
          display: flex;
          justify-content: flex-end;
          margin-top: 12px;
        }
        .inv-totals { width: 280px; border-collapse: collapse; }
        .inv-totals td { padding: 4px 8px; font-size: 12px; }
        .inv-totals .total-row td {
          border-top: 1.5px solid #1A1D23;
          font-weight: 700;
          font-size: 13px;
          padding-top: 6px;
        }

        .inv-words {
          font-size: 10px;
          font-style: italic;
          color: #5A6170;
          margin: 8px 0 0;
        }

        .inv-footer-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 16px;
          gap: 16px;
        }
        .inv-upi-label { font-weight: 600; font-size: 11px; margin: 0 0 6px; }
        .inv-upi-id {
          font-family: ui-monospace, monospace; font-size: 10px;
          color: #5A6170; word-break: break-all; max-width: 180px; margin: 0;
        }
        .inv-sig {
          text-align: right;
          font-size: 11px;
          border-top: 1px solid #1A1D23;
          padding-top: 4px;
          min-width: 160px;
        }

        @media (max-width: 520px) {
          .invoice-shell  { padding: 8px; padding-top: 64px; }
          .print-page     { padding: 20px 16px; border-radius: 4px; font-size: 12px;
                            box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
          .inv-header     { grid-template-columns: 1fr; }
          .inv-doc-block  { text-align: left; }
          .inv-parties    { grid-template-columns: 1fr; }
          .inv-supply     { text-align: left; }
          .inv-totals     { width: 100%; }
          .inv-footer-row { flex-direction: column; align-items: flex-start; }
          .inv-sig        { align-self: flex-end; }
          .inv-overlay-inner { gap: 14px 28px; }
          .inv-overlay-inner span { font-size: 18px; letter-spacing: 0.08em; }
        }

        @media print {
          html, body { background: #fff !important; margin: 0; padding: 0; }
          .invoice-shell {
            min-height: 0;
            background: #fff !important;
            padding: 0 !important;
          }
          .print-page {
            max-width: none;
            padding: 0;
            border-radius: 0;
            box-shadow: none;
            font-size: 11pt;
            line-height: 1.4;
          }
          .inv-biz-name             { font-size: 18pt; }
          .inv-doc-title            { font-size: 14pt; }
          .inv-cust-name            { font-size: 13pt; }
          .inv-biz-meta,
          .inv-doc-meta,
          .inv-cust-meta,
          .inv-supply               { font-size: 9pt; }
          .inv-items th             { font-size: 9pt; }
          .inv-items td             { font-size: 10pt; }
          .inv-totals td            { font-size: 10pt; }
          .inv-totals .total-row td { font-size: 11pt; }
          .inv-words                { font-size: 8pt; }
          .inv-upi-label            { font-size: 9pt; }
          .inv-upi-id               { font-size: 8pt; }
          .inv-sig                  { font-size: 9pt; }
          .inv-overlay              { display: block; }
          .inv-overlay-inner        { gap: 14px 30px; }
          .inv-overlay-inner span   {
            font-size: 18pt;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          tr { page-break-inside: avoid; break-inside: avoid; }
          thead { display: table-header-group; }
          .no-print { display: none !important; }
        }
      `}</style>

            <div className="invoice-shell">
                <div className="no-print">
                    <PrintControls />
                </div>

                {overlayLabel && (
                    <div className="no-print inv-status-banner" role="status">
                        {overlayLabel}
                    </div>
                )}

                <div className="print-page">

                    {overlayLabel && (
                        <div className="inv-overlay" aria-hidden="true">
                            <div className="inv-overlay-inner">
                                {Array.from({ length: 96 }).map((_, i) => (
                                    <span key={i}>{overlayLabel}</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Header ── */}
                    <div className="inv-header">
                        <div>
                            <p className="inv-biz-name">{invoice.business.name}</p>
                            <p className="inv-biz-meta">
                                {[
                                    invoice.business.address.line1,
                                    invoice.business.address.city,
                                    invoice.business.address.state,
                                    invoice.business.address.pincode,
                                ].filter(Boolean).join(", ")}
                                {invoice.business.gstin && (
                                    <> &nbsp;·&nbsp; GSTIN: {invoice.business.gstin}</>
                                )}
                            </p>
                        </div>
                        <div className="inv-doc-block">
                            <p className="inv-doc-title">{docTitle}</p>
                            <p className="inv-doc-num">{invoice.number}</p>
                            <p className="inv-doc-meta">
                                Date: {invoice.invoiceDate}<br />
                                Due: &nbsp;{invoice.dueDate}
                            </p>
                        </div>
                    </div>

                    <hr className="divider" />

                    {/* ── Bill-to ── */}
                    <div className="inv-parties">
                        <div>
                            <p className="inv-label">Bill to</p>
                            <p className="inv-cust-name">{invoice.customer.name}</p>
                            <p className="inv-cust-meta">
                                {invoice.customer.city}
                                {invoice.customer.gstin && (
                                    <> &nbsp;·&nbsp; GSTIN: {invoice.customer.gstin}</>
                                )}
                            </p>
                        </div>
                        <div className="inv-supply">
                            <p><strong>Place of supply:</strong> {invoice.placeOfSupplyStateCode}</p>
                            <p><strong>Reverse charge:</strong> {invoice.reverseCharge ? "Yes" : "No"}</p>
                        </div>
                    </div>

                    {/* ── Line items ── */}
                    <table className="inv-items">
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
                                {invoice.totals.hasTax && invoice.totals.isInterState && (
                                    <th className="num">IGST</th>
                                )}
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
                                        <td className="num">{it.qty} {it.unit}</td>
                                        <td className="num">{formatINR(it.ratePaise)}</td>
                                        <td className="num">{formatINR(taxable)}</td>
                                        {invoice.totals.hasTax && !invoice.totals.isInterState && (
                                            <>
                                                <td className="num">{formatINR(Math.round(half))}</td>
                                                <td className="num">{formatINR(Math.round(half))}</td>
                                            </>
                                        )}
                                        {invoice.totals.hasTax && invoice.totals.isInterState && (
                                            <td className="num">
                                                {formatINR(Math.round(taxable * (it.gstRatePct / 100)))}
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* ── Totals ── */}
                    <div className="inv-totals-wrap">
                        <table className="inv-totals">
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
                                <tr className="total-row">
                                    <td>Total</td>
                                    <td className="num">{formatINR(invoice.totals.totalPaise)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <p className="inv-words">
                        Amount in words: {numberToWordsIndian(invoice.totals.totalPaise)}
                    </p>

                    <hr className="divider" />

                    {/* ── UPI + Signature ── */}
                    <div className="inv-footer-row">
                        <div>
                            {upiUri && (
                                <>
                                    <p className="inv-upi-label">Pay by UPI</p>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={await QRCode.toDataURL(upiUri, {
                                                errorCorrectionLevel: "M",
                                                margin: 1,
                                                width: 120,
                                            })}
                                            alt={`UPI QR for ${invoice.number}`}
                                            style={{ width: 120, height: 120, display: "block", flexShrink: 0 }}
                                        />
                                        <p className="inv-upi-id">
                                            {invoice.business.upiId}<br />
                                            {invoice.number}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="inv-sig">
                            For {invoice.business.name}
                        </div>
                    </div>

                </div>
            </div>
        </>
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

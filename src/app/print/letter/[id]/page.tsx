export const instant = false;
import { PrintControls } from "@/components/print-controls";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { businessMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatINR } from "@/lib/domain/money";
import { numberToWordsIndian } from "@/lib/domain/words";
import { loadLetterPayload, logLetterGenerated } from "@/lib/documents/letter";
import { buildDisclaimer } from "@/lib/documents/disclaimer";

async function currentBusinessId(userId: string): Promise<string> {
    const [row] = await db
        .select()
        .from(businessMembers)
        .where(eq(businessMembers.userId, userId))
        .limit(1);
    if (!row) throw new Error("No business membership");
    return row.businessId;
}

export default async function LetterPage({
    params,
    searchParams,
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ includeInterest?: string }>;
}) {
    const { id } = await params;
    const { includeInterest: ii } = await searchParams;
    const includeInterest = ii === "true";

    const session = await getSession();
    if (!session?.userId) {
        redirect(`/login?next=/print/letter/${id}`);
    }
    const businessId = await currentBusinessId(session.userId);
    const payload = await loadLetterPayload(id, businessId, includeInterest);
    if (!payload) notFound();

    await logLetterGenerated(id, businessId, session.userId, {
        balancePaise: payload.invoice.balancePaise,
        payByDate: payload.payByDate,
        includeInterest,
    });

    const qrUrl = payload.upiUri
        ? await QRCode.toDataURL(payload.upiUri, {
              errorCorrectionLevel: "M",
              margin: 1,
              width: 120,
          })
        : null;

    return (
        <>
            <style>{`
        /* ── Page setup ── */
        @page { size: A4; margin: 18mm; }

        html, body {
          margin: 0;
          padding: 0;
          background: #e5e7eb;
        }

        /* ── Screen shell ── */
        .letter-shell {
          min-height: 100vh;
          background: #e5e7eb;
          padding: 16px;
          padding-top: 72px;
          box-sizing: border-box;
        }

        /* ── White card (A4 proportions, capped at 794px on every screen) ── */
        .print-page {
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.6;
          color: #1A1D23;
          background: #ffffff;
          max-width: 794px;
          margin: 0 auto;
          padding: 36px 40px;
          box-sizing: border-box;
          border-radius: 6px;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04);
        }

        /* ── Sender block ── */
        .ltr-sender {
          font-size: 11px;
          color: #5A6170;
          line-height: 1.5;
          margin: 0 0 20px;
          padding-bottom: 14px;
          border-bottom: 1px solid #E4E7EC;
        }
        .ltr-sender-name {
          font-size: 16px;
          font-weight: 700;
          color: #1A1D23;
          margin: 0 0 2px;
        }

        /* ── Title ── */
        .ltr-title {
          font-size: 18px;
          font-weight: 700;
          text-align: center;
          margin: 0 0 16px;
          letter-spacing: -0.01em;
        }

        /* ── Disclaimer box ── */
        .ltr-disclaimer {
          border: 2px solid #B54708;
          background: #FFFAEB;
          padding: 10px 14px;
          margin: 0 0 20px;
          font-size: 11px;
          line-height: 1.5;
          border-radius: 4px;
        }

        /* ── To / Date row ── */
        .ltr-parties {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          margin: 0 0 16px;
          font-size: 12px;
        }
        .ltr-to-label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #5A6170;
          margin: 0 0 2px;
        }
        .ltr-to-name { font-size: 14px; font-weight: 600; margin: 0 0 2px; }
        .ltr-to-meta { font-size: 11px; color: #5A6170; margin: 0; }
        .ltr-dates   { text-align: right; white-space: nowrap; font-size: 12px; }
        .ltr-dates p { margin: 0 0 2px; }

        /* ── Subject ── */
        .ltr-subject {
          font-size: 13px;
          font-weight: 600;
          margin: 0 0 14px;
          padding: 10px 14px;
          background: #F7F8FA;
          border-left: 3px solid #1A1D23;
          border-radius: 0 4px 4px 0;
        }

        /* ── Invoice table ── */
        .ltr-table { width: 100%; border-collapse: collapse; margin: 0 0 12px; font-size: 12px; }
        .ltr-table th {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #5A6170;
          border-bottom: 1.5px solid #1A1D23;
          padding: 6px 8px;
          text-align: left;
          white-space: nowrap;
        }
        .ltr-table td {
          padding: 8px 8px;
          border-bottom: 1px solid #E4E7EC;
          vertical-align: top;
        }
        .ltr-table tbody tr:last-child td { border-bottom: none; }
        .num { text-align: right; font-variant-numeric: tabular-nums; }

        /* ── Grand total ── */
        .ltr-total {
          display: flex;
          justify-content: flex-end;
          margin: 0 0 20px;
        }
        .ltr-total-box {
          text-align: right;
          padding: 10px 14px;
          background: #F7F8FA;
          border-radius: 4px;
          border: 1px solid #E4E7EC;
          min-width: 260px;
        }
        .ltr-total-amount {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 2px;
        }
        .ltr-total-words {
          font-size: 10px;
          color: #5A6170;
          font-style: italic;
          margin: 0;
        }

        /* ── MSMED box ── */
        .ltr-msmed {
          border: 1px dashed #D0D5DD;
          padding: 12px 14px;
          margin: 0 0 20px;
          font-size: 12px;
          border-radius: 4px;
          line-height: 1.5;
        }
        .ltr-msmed-interest {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid #E4E7EC;
        }
        .ltr-msmed-amount { font-weight: 600; font-size: 13px; margin: 0 0 2px; }
        .ltr-msmed-note   { font-size: 10px; color: #5A6170; margin: 2px 0 0; }
        .ltr-msmed-caveat {
          font-size: 10px;
          color: #5A6170;
          font-style: italic;
          margin: 6px 0 0;
        }

        /* ── Payment section ── */
        .ltr-section-label {
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #5A6170;
          margin: 0 0 6px;
        }
        .ltr-payment {
          margin: 0 0 20px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: start;
        }
        .ltr-bank { font-size: 12px; line-height: 1.7; }
        .ltr-upi  { font-size: 11px; color: #5A6170; margin: 6px 0 0; }

        /* ── Contact / signature ── */
        .ltr-footer-row {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: end;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #E4E7EC;
          font-size: 12px;
        }
        .ltr-sig {
          text-align: right;
          font-size: 11px;
        }
        .ltr-sig-line {
          border-top: 1px solid #1A1D23;
          padding-top: 4px;
          margin-top: 28px;
          white-space: nowrap;
        }

        /* ── Generated note ── */
        .ltr-generated {
          font-size: 9px;
          color: #5A6170;
          text-align: center;
          margin-top: 20px;
        }

        /* ─── Responsive ladder ─────────────────────────────────────────
           Tailwind default breakpoints: sm=640 md=768 lg=1024 xl=1280.
           The A4 sheet stays capped at 794px wide on every screen — that's
           what makes it read as paper rather than a stretched app panel.
           What grows is (a) the gray shell padding around it and (b) the
           sheet's interior typography at modest increments, so it feels
           like a physical page sitting on a larger desk at every size.
           The @media print block at the bottom overrides ALL of these
           because it's in physical pt units and comes last in source. */

        /* Mobile — stack every two-column section, tighten padding */
        @media (max-width: 639px) {
          .letter-shell { padding: 8px; padding-top: 64px; }
          .print-page   { padding: 20px 16px; border-radius: 4px;
                          box-shadow: 0 2px 12px rgba(0,0,0,0.06); font-size: 12px; }
          .ltr-parties  { grid-template-columns: 1fr; }
          .ltr-dates    { text-align: left; }
          .ltr-payment  { grid-template-columns: 1fr; }
          .ltr-footer-row { grid-template-columns: 1fr; }
          .ltr-sig      { text-align: left; }
          .ltr-total-box { min-width: 0; width: 100%; }
        }

        /* md — more shell breathing room, sheet interior one step up */
        @media (min-width: 768px) {
          .letter-shell { padding: 24px; padding-top: 88px; }
          .print-page   { padding: 40px 44px; font-size: 13.5px;
                          box-shadow: 0 6px 32px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.05); }
          .ltr-sender-name   { font-size: 17px; }
          .ltr-title         { font-size: 19px; }
          .ltr-to-name       { font-size: 15px; }
          .ltr-subject       { font-size: 13.5px; }
          .ltr-table td      { font-size: 12.5px; padding: 9px 8px; }
          .ltr-total-amount  { font-size: 17px; }
          .ltr-msmed         { font-size: 12.5px; }
          .ltr-bank          { font-size: 12.5px; }
        }

        /* lg — bigger shell margin, more generous sheet padding */
        @media (min-width: 1024px) {
          .letter-shell { padding: 32px; padding-top: 96px; }
          .print-page   { padding: 44px 48px; font-size: 14px;
                          box-shadow: 0 8px 40px rgba(0,0,0,0.12), 0 3px 6px rgba(0,0,0,0.06); }
          .ltr-title         { font-size: 20px; }
          .ltr-table td      { font-size: 13px; }
          .ltr-total-amount  { font-size: 17.5px; }
        }

        /* xl — cap the breathing room; sheet stays 794px wide */
        @media (min-width: 1280px) {
          .letter-shell { padding: 40px; padding-top: 104px; }
          .print-page   { padding: 48px 52px; font-size: 14.5px;
                          box-shadow: 0 12px 48px rgba(0,0,0,0.14), 0 4px 8px rgba(0,0,0,0.06); }
          .ltr-sender-name { font-size: 18px; }
        }

        /* ── Print — overrides everything above via physical pt units ── */
        @media print {
          html, body { background: #fff !important; margin: 0; padding: 0; }
          .letter-shell {
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
            line-height: 1.5;
          }
          .ltr-sender-name  { font-size: 14pt; }
          .ltr-sender       { font-size: 9pt; }
          .ltr-title        { font-size: 16pt; }
          .ltr-disclaimer   { font-size: 9pt; }
          .ltr-to-name      { font-size: 13pt; }
          .ltr-to-meta,
          .ltr-dates        { font-size: 10pt; }
          .ltr-subject      { font-size: 11pt; }
          .ltr-table th     { font-size: 8pt; }
          .ltr-table td     { font-size: 10pt; }
          .ltr-total-amount { font-size: 14pt; }
          .ltr-total-words,
          .ltr-msmed-note,
          .ltr-msmed-caveat { font-size: 8pt; }
          .ltr-bank         { font-size: 10pt; }
          .ltr-generated    { font-size: 7pt; }
          .ltr-total-box    { background: transparent; border-color: #1A1D23; }
          .ltr-subject      { background: transparent; border-left-color: #1A1D23; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          .no-print { display: none !important; }
        }
      `}</style>

            <div className="letter-shell">
                <div className="no-print">
                    <PrintControls showInterest={payload.msmed.line != null} />
                </div>

                <div className="print-page">

                    {/* ── Sender ── */}
                    <div className="ltr-sender">
                        <p className="ltr-sender-name">{payload.business.name}</p>
                        {[
                            payload.business.address.line1,
                            payload.business.address.city,
                            payload.business.address.state,
                            payload.business.address.pincode,
                        ].filter(Boolean).join(", ")}
                        {payload.business.gstin && (
                            <> &nbsp;·&nbsp; GSTIN: {payload.business.gstin}</>
                        )}
                    </div>

                    {/* ── Title ── */}
                    <h1 className="ltr-title">Payment Demand Letter</h1>

                    {/* ── Disclaimer ── */}
                    <div className="ltr-disclaimer">
                        {buildDisclaimer(payload.business.name)}
                    </div>

                    {/* ── To / Dates ── */}
                    <div className="ltr-parties">
                        <div>
                            <p className="ltr-to-label">To</p>
                            <p className="ltr-to-name">{payload.customer.name}</p>
                            <p className="ltr-to-meta">
                                {payload.customer.city}
                                {payload.customer.gstin && (
                                    <> &nbsp;·&nbsp; GSTIN: {payload.customer.gstin}</>
                                )}
                            </p>
                        </div>
                        <div className="ltr-dates">
                            <p>Date: {payload.letterDate}</p>
                            <p>Pay by: <strong>{payload.payByDate}</strong></p>
                        </div>
                    </div>

                    {/* ── Subject ── */}
                    <div className="ltr-subject">
                        Subject: Outstanding payment for invoice {payload.invoice.number}
                    </div>

                    {/* ── Invoice table ── */}
                    <table className="ltr-table">
                        <thead>
                            <tr>
                                <th>Invoice No.</th>
                                <th>Invoice Date</th>
                                <th className="num">Invoice Amount</th>
                                <th className="num">Part Payment</th>
                                <th className="num">Balance Due</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>{payload.invoice.number}</td>
                                <td>{payload.invoice.invoiceDate}</td>
                                <td className="num">{formatINR(payload.invoice.totalPaise)}</td>
                                <td className="num">{formatINR(payload.invoice.amountPaidPaise)}</td>
                                <td className="num" style={{ fontWeight: 600 }}>
                                    {formatINR(payload.invoice.balancePaise)}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* ── Grand total ── */}
                    <div className="ltr-total">
                        <div className="ltr-total-box">
                            <p className="ltr-total-amount">
                                Grand Total Due: {formatINR(payload.invoice.balancePaise)}
                            </p>
                            <p className="ltr-total-words">
                                {numberToWordsIndian(payload.invoice.balancePaise)}
                            </p>
                        </div>
                    </div>

                    {/* ── MSMED ── */}
                    {payload.msmed.line && (
                        <div className="ltr-msmed">
                            {payload.msmed.line}
                            {payload.msmed.included && (
                                <div className="ltr-msmed-interest">
                                    <p className="ltr-msmed-amount">
                                        MSMED compound interest to date:{" "}
                                        {formatINR(payload.msmed.interestPaise)}
                                    </p>
                                    <p className="ltr-msmed-note">{payload.msmed.formulaNote}</p>
                                    <p className="ltr-msmed-caveat">
                                        This interest figure is shown separately and is not included
                                        in the Grand Total Due above. Interest is informational;
                                        check with your CA before relying on it.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── How to pay ── */}
                    <div className="ltr-payment">
                        <div>
                            <p className="ltr-section-label">How to pay</p>
                            {payload.business.bank && (
                                <div className="ltr-bank">
                                    Bank: {payload.business.bank.bankName}<br />
                                    Account: {payload.business.bank.accountNumberMasked}<br />
                                    IFSC: {payload.business.bank.ifsc}
                                </div>
                            )}
                            {payload.business.upiId && (
                                <p className="ltr-upi">UPI: {payload.business.upiId}</p>
                            )}
                        </div>
                        {qrUrl && (
                            <div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={qrUrl}
                                    alt={`UPI QR for ${payload.invoice.number}`}
                                    style={{ width: 110, height: 110, display: "block" }}
                                />
                            </div>
                        )}
                    </div>

                    {/* ── Contact + Signature ── */}
                    <div className="ltr-footer-row">
                        <div>
                            <p className="ltr-section-label">For any questions</p>
                            Contact {payload.contact.ownerName}
                            {payload.contact.ownerPhone && ` at ${payload.contact.ownerPhone}`}.
                            Please reach out before the pay-by date if any part of this
                            invoice is in dispute.
                        </div>
                        <div className="ltr-sig">
                            For {payload.business.name}
                            <div className="ltr-sig-line">{payload.contact.ownerName}</div>
                        </div>
                    </div>

                    <p className="ltr-generated">Computer-generated letter.</p>

                </div>
            </div>
        </>
    );
}

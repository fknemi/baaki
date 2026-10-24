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

// The mandatory disclaimer. Must appear exactly once across all of src/
// (enforced by scripts/check-forbidden-tokens.mjs). Do not duplicate this
// string in the API route or elsewhere.

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

    // Audit trail: record letter generation. Idempotent per day.
    await logLetterGenerated(id, businessId, session.userId, {
        balancePaise: payload.invoice.balancePaise,
        payByDate: payload.payByDate,
        includeInterest,
    });
    const qrUrl = payload.upiUri
        ? await QRCode.toDataURL(payload.upiUri, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 140,
        })
        : null;

    return (
        <div className="print-page">
            <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          .no-print { display: none !important; }
          tr { page-break-inside: avoid; }
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
        .print-page th, .print-page td { padding: 4px 6px; font-size: 10pt; }
        .print-page thead th { border-bottom: 1px solid #1A1D23; text-align: left; }
        .print-page tbody tr { border-bottom: 1px solid #E4E7EC; }
        .print-page .num { text-align: right; font-variant-numeric: tabular-nums; }
      `}</style>

            <PrintControls showInterest={payload.msmed.line != null} />
            <div style={{ fontSize: "9pt", color: "#5A6170" }}>
                {payload.business.name}
                {" · "}
                {payload.business.address.line1}
                {payload.business.address.line1 ? ", " : ""}
                {payload.business.address.city} {payload.business.address.state}{" "}
                {payload.business.address.pincode}
                {payload.business.gstin && (
                    <>
                        <br />
                        GSTIN: {payload.business.gstin}
                    </>
                )}
            </div>

            <h1
                style={{
                    fontSize: "16pt",
                    fontWeight: 700,
                    marginTop: 16,
                    textAlign: "center",
                }}
            >
                Payment Demand Letter
            </h1>

            <div
                style={{
                    border: "2px solid #B54708",
                    background: "#FFFAEB",
                    padding: 10,
                    margin: "16px 0",
                    fontSize: "10pt",
                }}
            >
                {buildDisclaimer(payload.business.name)}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10pt" }}>
                <div>
                    <div style={{ fontWeight: 600 }}>To</div>
                    <div>{payload.customer.name}</div>
                    {payload.customer.city && <div>{payload.customer.city}</div>}
                    {payload.customer.gstin && (
                        <div>GSTIN: {payload.customer.gstin}</div>
                    )}
                </div>
                <div style={{ textAlign: "right" }}>
                    <div>Date: {payload.letterDate}</div>
                    <div>Pay by: {payload.payByDate}</div>
                </div>
            </div>

            <h2 style={{ fontSize: "11pt", fontWeight: 600, marginTop: 16 }}>
                Subject: Outstanding payment for invoice {payload.invoice.number}
            </h2>

            <table style={{ marginTop: 12 }}>
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
                        <td className="num">
                            {formatINR(payload.invoice.amountPaidPaise)}
                        </td>
                        <td className="num" style={{ fontWeight: 600 }}>
                            {formatINR(payload.invoice.balancePaise)}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div style={{ textAlign: "right", marginTop: 8 }}>
                <div style={{ fontSize: "12pt", fontWeight: 600 }}>
                    Grand Total Due: {formatINR(payload.invoice.balancePaise)}
                </div>
                <div style={{ fontSize: "10pt", marginTop: 2 }}>
                    Amount in words: {numberToWordsIndian(payload.invoice.balancePaise)}
                </div>
            </div>

            {payload.msmed.line && (
                <div
                    style={{
                        marginTop: 16,
                        padding: 10,
                        border: "1px dashed #E4E7EC",
                        fontSize: "10pt",
                    }}
                >
                    {payload.msmed.line}
                    {payload.msmed.included && (
                        <div
                            style={{
                                marginTop: 8,
                                paddingTop: 8,
                                borderTop: "1px solid #E4E7EC",
                            }}
                        >
                            <div style={{ fontWeight: 600 }}>
                                MSMED compound interest to date:{" "}
                                {formatINR(payload.msmed.interestPaise)}
                            </div>
                            <div style={{ fontSize: "9pt", color: "#5A6170" }}>
                                {payload.msmed.formulaNote}
                            </div>
                            <div
                                style={{
                                    fontSize: "9pt",
                                    color: "#5A6170",
                                    marginTop: 4,
                                    fontStyle: "italic",
                                }}
                            >
                                This interest figure is shown separately and is not included
                                in the Grand Total Due above. Interest is informational; check
                                with your CA before relying on it.
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div style={{ marginTop: 16, fontSize: "10pt" }}>
                <div style={{ fontWeight: 600 }}>How to pay</div>
                {payload.business.bank && (
                    <div>
                        Bank: {payload.business.bank.bankName}
                        <br />
                        Account: {payload.business.bank.accountNumberMasked}
                        <br />
                        IFSC: {payload.business.bank.ifsc}
                    </div>
                )}
                {payload.business.upiId && (
                    <div style={{ marginTop: 6 }}>
                        UPI: {payload.business.upiId}
                        {qrUrl && (
                            <div style={{ marginTop: 6 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={qrUrl}
                                    alt={`UPI QR for ${payload.invoice.number}`}
                                    style={{ width: 140, height: 140 }}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ marginTop: 16, fontSize: "10pt" }}>
                <div style={{ fontWeight: 600 }}>For any questions</div>
                Contact {payload.contact.ownerName}
                {payload.contact.ownerPhone && ` at ${payload.contact.ownerPhone}`}.
                Please reach out before the pay-by date if any part of this invoice is
                in dispute.
            </div>

            <div style={{ marginTop: 32, textAlign: "right", fontSize: "10pt" }}>
                For {payload.business.name}
                <div
                    style={{
                        borderTop: "1px solid #1A1D23",
                        paddingTop: 4,
                        marginTop: 24,
                        width: 180,
                        marginLeft: "auto",
                    }}
                >
                    {payload.contact.ownerName}
                </div>
            </div>

            <p
                style={{
                    marginTop: 24,
                    fontSize: "8pt",
                    color: "#5A6170",
                    textAlign: "center",
                }}
            >
                Computer-generated letter. Prototype with sample data.
            </p>
        </div>
    );
}

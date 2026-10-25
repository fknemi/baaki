export const instant = false;

import { PrintControls } from "@/components/print-controls";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { loadEvidencePayload } from "@/lib/documents/evidence";
import { db } from "@/lib/db/client";
import { businessMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formatINR } from "@/lib/domain/money";
import { numberToWordsIndian } from "@/lib/domain/words";
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

function titleCase(s: string): string {
    return s
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function EvidencePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session?.userId) redirect(`/login?next=/print/evidence/${id}`);
    const businessId = await currentBusinessId(session.userId);
    const data = await loadEvidencePayload(id, businessId);
    if (!data) notFound();

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    return (
        <>
            <style>{`
        /* ══════════════════════════════════════════════════
           SCREEN — document / PDF-preview look
           ══════════════════════════════════════════════════ */
        html, body { background: #e5e7eb; }
        * { box-sizing: border-box; }

        .evidence-shell {
          min-height: 100vh;
          background: #e5e7eb;
          padding: 16px;
          padding-top: 72px;
        }

        .print-page {
          max-width: 820px;
          margin: 0 auto;
          background: #ffffff;
          color: #1A1D23;
          font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
          font-size: 13px;
          line-height: 1.5;
          padding: 28px 24px;
          border-radius: 6px;
          box-shadow:
            0 4px 24px rgba(0, 0, 0, 0.08),
            0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .print-page h1 {
          font-size: 22px;
          font-weight: 700;
          margin: 0 0 4px;
          letter-spacing: -0.01em;
        }
        .print-page h2 {
          font-size: 15px;
          font-weight: 600;
          margin: 0 0 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .print-page h3 {
          font-size: 13px;
          font-weight: 600;
          margin: 0 0 6px;
        }
        .print-page p { margin: 0 0 8px; }
        .print-page code {
          font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
          font-size: 11px;
          background: #F7F8FA;
          padding: 1px 5px;
          border-radius: 3px;
          white-space: nowrap;
        }

        .print-page section { margin-bottom: 20px; }

        /* Numbered section badge */
        .section-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #1A1D23;
          color: #ffffff;
          font-size: 11px;
          font-weight: 600;
          flex-shrink: 0;
        }

        /* ── Cover ── */
        .cover { text-align: center; padding: 24px 0 8px; }
        .cover h1 { font-size: 26px; }
        .cover-subtitle {
          font-size: 12px;
          color: #5A6170;
          margin: 4px 0 20px;
        }

        /* Cover table */
        .cover-table {
          width: 100%;
          max-width: 520px;
          margin: 0 auto;
          border-collapse: collapse;
          text-align: left;
          font-size: 12px;
        }
        .cover-table tr { border-bottom: 1px solid #E4E7EC; }
        .cover-table tr:last-child { border-bottom: none; }
        .cover-label {
          color: #5A6170;
          padding: 6px 16px 6px 0;
          white-space: nowrap;
          width: 1%;
          vertical-align: top;
        }
        .cover-value {
          font-weight: 500;
          padding: 6px 0;
          word-break: break-word;
        }

        /* Tables */
        .table-wrap {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          margin: 8px 0;
        }
        .print-page table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          min-width: 0;
        }
        .print-page th,
        .print-page td {
          padding: 6px 8px;
          text-align: left;
          vertical-align: top;
          word-break: break-word;
        }
        .print-page thead th {
          background: #F7F8FA;
          font-weight: 600;
          border-bottom: 1px solid #D0D5DD;
          white-space: nowrap;
        }
        .print-page tbody tr { border-bottom: 1px solid #E4E7EC; }
        .print-page tbody tr:last-child { border-bottom: none; }
        .print-page .num {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        /* Demand letter warning box */
        .warning-box {
          border: 1px solid #F5B347;
          background: #FFFAEB;
          padding: 10px 12px;
          margin: 12px 0;
          font-size: 12px;
          border-radius: 4px;
          line-height: 1.45;
        }

        /* Footer */
        .footer {
          font-size: 10px;
          color: #5A6170;
          text-align: center;
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #E4E7EC;
        }

        /* Inline link */
        .print-page a {
          color: #175CD3;
          text-decoration: underline;
          text-underline-offset: 2px;
        }

        /* Small caption / helper text */
        .helper {
          font-size: 10px;
          color: #5A6170;
          font-style: italic;
          margin-top: 6px;
        }

        /* URL helper line */
        .url-line {
          display: flex;
          align-items: baseline;
          gap: 4px;
          flex-wrap: nowrap;
        }
        .url-label { flex-shrink: 0; }
        .url-link {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-style: normal;
        }

        /* Empty section spacer */
        .page-break {
          display: block;
          height: 0;
          margin: 0;
          padding: 0;
        }

        /* ══════════════════════════════════════════════════
           MOBILE ≤ 440px
           ══════════════════════════════════════════════════ */
        @media (max-width: 440px) {
          .evidence-shell { padding: 8px; padding-top: 64px; }
          .print-page {
            padding: 20px 16px;
            border-radius: 4px;
            font-size: 12px;
            box-shadow: 0 2px 12px rgba(0,0,0,0.06);
          }
          .print-page h1 { font-size: 19px; }
          .cover h1 { font-size: 22px; }
          .print-page h2 { font-size: 14px; gap: 6px; }
          .section-num { width: 20px; height: 20px; font-size: 10px; }
          .cover-table { font-size: 11px; }
          .cover-label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
          }
          .print-page table { font-size: 11px; }
          .print-page th,
          .print-page td { padding: 5px 6px; }
          .print-page code { font-size: 10px; padding: 1px 4px; }
        }

        /* ══════════════════════════════════════════════════
           PRINT
           ══════════════════════════════════════════════════ */
        @page { size: A4; margin: 16mm; }
        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0;
            padding: 0;
          }
          .evidence-shell {
            min-height: 0;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .print-page {
            max-width: none;
            padding: 0;
            border-radius: 0;
            box-shadow: none;
            font-size: 11pt;
            line-height: 1.4;
          }
          .print-page h1 { font-size: 20pt; }
          .cover h1 { font-size: 20pt; }
          .cover { padding: 0 0 16pt; }
          .print-page h2 { font-size: 14pt; }
          .print-page h3 { font-size: 12pt; }
          .print-page code {
            background: transparent;
            padding: 0;
            font-size: 10pt;
          }
          .section-num {
            background: transparent;
            color: #1A1D23;
            border: 1px solid #1A1D23;
          }

          /* Cover table print */
          .cover-table { max-width: none; font-size: 10pt; }
          .cover-label { font-size: 9pt; padding: 4pt 16pt 4pt 0; }
          .cover-value { font-size: 10pt; padding: 4pt 0; }

          /* Section tables */
          .print-page table { font-size: 10pt; }
          .print-page th,
          .print-page td { padding: 4px 6px; }
          .print-page thead th {
            background: transparent;
            border-bottom: 1px solid #1A1D23;
          }
          .print-page tbody tr { border-bottom: 1px solid #E4E7EC; }
          .table-wrap { overflow: visible; }

          /* Page breaks */
          .page-break {
            page-break-after: always;
            break-after: page;
            height: 0;
          }
          tr { page-break-inside: avoid; break-inside: avoid; }
          thead { display: table-header-group; }

          /* Hide screen-only chrome */
          .no-print { display: none !important; }
          .helper { font-size: 8pt; }
          .footer { font-size: 8pt; margin-top: 24pt; }

          /* URLs: show full on print */
          .url-line { display: block; }
          .url-link {
            overflow: visible;
            text-overflow: clip;
            white-space: normal;
            word-break: break-all;
          }
        }
      `}</style>

            <div className="evidence-shell">
                <div className="no-print">
                    <PrintControls />
                </div>

                <div className="print-page">

                    {/* ═══════════════════ COVER ═══════════════════ */}
                    <section className="cover">
                        <h1>Evidence Pack</h1>
                        <p className="cover-subtitle">Generated {data.generatedAt}</p>

                        <table className="cover-table">
                            <tbody>
                                <tr>
                                    <td className="cover-label">Business</td>
                                    <td className="cover-value">{data.business.name}</td>
                                </tr>
                                {data.business.gstin && (
                                    <tr>
                                        <td className="cover-label">Business GSTIN</td>
                                        <td className="cover-value font-mono">{data.business.gstin}</td>
                                    </tr>
                                )}
                                <tr>
                                    <td className="cover-label">Customer</td>
                                    <td className="cover-value">{data.customer.name}</td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Invoice</td>
                                    <td className="cover-value font-mono">{data.invoice.number}</td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Invoice date</td>
                                    <td className="cover-value">{data.invoice.invoiceDate}</td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Due date</td>
                                    <td className="cover-value">{data.invoice.dueDate}</td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Status</td>
                                    <td className="cover-value">{titleCase(data.invoice.status)}</td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Total</td>
                                    <td className="cover-value">{formatINR(data.invoice.totalPaise)}</td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Paid</td>
                                    <td className="cover-value">{formatINR(data.invoice.amountPaidPaise)}</td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Outstanding</td>
                                    <td className="cover-value" style={{ fontWeight: 700 }}>
                                        {formatINR(data.invoice.outstandingPaise)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Days overdue</td>
                                    <td className="cover-value">{data.invoice.daysOverdue}</td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Amount in words</td>
                                    <td className="cover-value">
                                        {numberToWordsIndian(data.invoice.outstandingPaise)}
                                    </td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Hash chain events</td>
                                    <td className="cover-value">{data.events.length}</td>
                                </tr>
                                <tr>
                                    <td className="cover-label">Attachments</td>
                                    <td className="cover-value">{data.attachments.length}</td>
                                </tr>
                            </tbody>
                        </table>
                    </section>

                    <section className="page-break" />

                    {/* ═══════════════════ 1. INVOICE SUMMARY ═══════════════════ */}
                    <section>
                        <h2>
                            <span className="section-num">1</span>
                            Invoice summary
                        </h2>

                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Invoice number</td>
                                        <td className="font-mono">{data.invoice.number}</td>
                                    </tr>
                                    <tr>
                                        <td>Invoice date</td>
                                        <td>{data.invoice.invoiceDate}</td>
                                    </tr>
                                    <tr>
                                        <td>Due date</td>
                                        <td>{data.invoice.dueDate}</td>
                                    </tr>
                                    <tr>
                                        <td>Total</td>
                                        <td>{formatINR(data.invoice.totalPaise)}</td>
                                    </tr>
                                    <tr>
                                        <td>Outstanding</td>
                                        <td>{formatINR(data.invoice.outstandingPaise)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <p className="helper url-line">
                            <span className="url-label">Full tax-invoice copy:</span>
                            <a
                                href={`${appUrl}/print/invoice/${data.invoice.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="url-link"
                            >
                                {`${appUrl}/print/invoice/${data.invoice.id}`}
                            </a>
                        </p>
                    </section>

                    {/* ═══════════════════ 2. AUDIT TRAIL ═══════════════════ */}
                    <section className="page-break" />
                    <section>
                        <h2>
                            <span className="section-num">2</span>
                            Complete audit trail ({data.events.length} events)
                        </h2>

                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Date</th>
                                        <th>Event</th>
                                        <th>Actor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.events.map((e) => (
                                        <tr key={e.chainSeq}>
                                            <td>{e.chainSeq}</td>
                                            <td>{e.atIso.slice(0, 10)}</td>
                                            <td>{titleCase(e.type)}</td>
                                            <td className="font-mono">{e.actor}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {/* ═══════════════════ 3. REMINDER LOG ═══════════════════ */}
                    {data.reminders.length > 0 && (
                        <>
                            <section className="page-break" />
                            <section>
                                <h2>
                                    <span className="section-num">3</span>
                                    Reminder log ({data.reminders.length})
                                </h2>

                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Stage</th>
                                                <th>Channel</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.reminders.map((r) => (
                                                <tr key={r.id}>
                                                    <td>{r.sentAt ? r.sentAt.slice(0, 10) : "—"}</td>
                                                    <td>{r.stageKey}</td>
                                                    <td>{r.channel}</td>
                                                    <td>{r.status}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </>
                    )}

                    {/* ═══════════════════ 4. PAYMENTS ═══════════════════ */}
                    {data.payments.length > 0 && (
                        <>
                            <section className="page-break" />
                            <section>
                                <h2>
                                    <span className="section-num">4</span>
                                    Payments received ({data.payments.length})
                                </h2>

                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th className="num">Amount</th>
                                                <th>Reference</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.payments.map((p) => (
                                                <tr key={p.id}>
                                                    <td>{p.paidOn}</td>
                                                    <td className="num">{formatINR(p.amountPaise)}</td>
                                                    <td className="font-mono">{p.reference ?? "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </>
                    )}

                    {/* ═══════════════════ 5. CUSTOMER MESSAGES ═══════════════════ */}
                    {data.messages.length > 0 && (
                        <>
                            <section className="page-break" />
                            <section>
                                <h2>
                                    <span className="section-num">5</span>
                                    Customer messages ({data.messages.length})
                                </h2>

                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Type</th>
                                                <th>Status</th>
                                                <th>Message</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.messages.map((m) => (
                                                <tr key={m.id}>
                                                    <td>{m.createdAt.slice(0, 10)}</td>
                                                    <td>{titleCase(m.type)}</td>
                                                    <td>{titleCase(m.status)}</td>
                                                    <td>{m.message ?? m.reference ?? "—"}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </>
                    )}

                    {/* ═══════════════════ 6. ATTACHMENTS ═══════════════════ */}
                    {data.attachments.length > 0 && (
                        <>
                            <section className="page-break" />
                            <section>
                                <h2>
                                    <span className="section-num">6</span>
                                    Attachments ({data.attachments.length})
                                </h2>

                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Added</th>
                                                <th>Mime</th>
                                                <th className="num">Size</th>
                                                <th>SHA-256</th>
                                                <th className="no-print">File</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.attachments.map((f) => (
                                                <tr key={f.id}>
                                                    <td>{f.createdAt.slice(0, 10)}</td>
                                                    <td>{f.mime}</td>
                                                    <td className="num">
                                                        {(f.sizeBytes / 1024).toFixed(1)} KB
                                                    </td>
                                                    <td
                                                        style={{
                                                            fontSize: "9px",
                                                            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                                                            wordBreak: "break-all",
                                                        }}
                                                    >
                                                        {f.sha256.slice(0, 16)}…
                                                    </td>
                                                    <td className="no-print">
                                                        <a
                                                            href={`/api/uploads/view/${f.id}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                        >
                                                            Open
                                                        </a>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <p className="helper">
                                    Open links are session-validated and serve a 60-second signed
                                    URL to the file. They are hidden when printing.
                                </p>
                            </section>
                        </>
                    )}

                    {/* ═══════════════════ 7. DEMAND LETTER ═══════════════════ */}
                    {data.demandLetter && (
                        <>
                            <section className="page-break" />
                            <section>
                                <h2>
                                    <span className="section-num">7</span>
                                    Demand letter
                                </h2>
                                <p className="helper">
                                    Generated on {data.demandLetter.generatedOn} · Pay by{" "}
                                    {data.demandLetter.payByDate}
                                </p>

                                <div className="table-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Field</th>
                                                <th>Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>Invoice</td>
                                                <td className="font-mono">{data.invoice.number}</td>
                                            </tr>
                                            <tr>
                                                <td>Balance demanded at generation</td>
                                                <td style={{ fontWeight: 600 }}>
                                                    {formatINR(data.demandLetter.balancePaise)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Pay-by date</td>
                                                <td>{data.demandLetter.payByDate}</td>
                                            </tr>
                                            <tr>
                                                <td>MSMED interest included</td>
                                                <td>{data.demandLetter.includeInterest ? "Yes" : "No"}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="warning-box">
                                    {buildDisclaimer(data.business.name)}
                                </div>

                                <p className="helper url-line">
                                    <span className="url-label">Full letter:</span>
                                    <a
                                        href={`${appUrl}/print/letter/${data.invoice.id}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="url-link"
                                    >
                                        {`${appUrl}/print/letter/${data.invoice.id}`}
                                    </a>
                                </p>
                            </section>
                        </>
                    )}

                    <div className="footer">
                        Generated {data.generatedAt} · {data.business.name} ·{" "}
                        {data.invoice.number}
                    </div>
                </div>
            </div>
        </>
    );
}

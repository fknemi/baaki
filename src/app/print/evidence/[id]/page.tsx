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

  return (
    <div className="print-page">
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
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
        .print-page th, .print-page td { padding: 4px 6px; font-size: 10pt; }
        .print-page thead th { border-bottom: 1px solid #1A1D23; text-align: left; }
        .print-page tbody tr { border-bottom: 1px solid #E4E7EC; }
        .print-page .num { text-align: right; font-variant-numeric: tabular-nums; }
        .print-page section { margin-bottom: 24px; }
        .footer {
          font-size: 8pt;
          color: #5A6170;
          text-align: center;
          margin-top: 32px;
        }
      `}</style>

      <PrintControls />

      {/* COVER PAGE */}
      <section>
        <h1 style={{ fontSize: "20pt", fontWeight: 700, textAlign: "center" }}>Evidence Pack</h1>
        <p
          style={{
            textAlign: "center",
            fontSize: "10pt",
            color: "#5A6170",
            marginTop: 4,
          }}
        >
          Generated {data.generatedAt}
        </p>

        <table style={{ marginTop: 32, maxWidth: 400, margin: "32px auto 0" }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Business</td>
              <td>{data.business.name}</td>
            </tr>
            {data.business.gstin && (
              <tr>
                <td style={{ fontWeight: 600 }}>Business GSTIN</td>
                <td>{data.business.gstin}</td>
              </tr>
            )}
            <tr>
              <td style={{ fontWeight: 600 }}>Customer</td>
              <td>{data.customer.name}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Invoice</td>
              <td>{data.invoice.number}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Invoice date</td>
              <td>{data.invoice.invoiceDate}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Due date</td>
              <td>{data.invoice.dueDate}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Status</td>
              <td>{data.invoice.status}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Total</td>
              <td>{formatINR(data.invoice.totalPaise)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Paid</td>
              <td>{formatINR(data.invoice.amountPaidPaise)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Outstanding</td>
              <td style={{ fontWeight: 600 }}>{formatINR(data.invoice.outstandingPaise)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Days overdue</td>
              <td>{data.invoice.daysOverdue}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Amount in words</td>
              <td>{numberToWordsIndian(data.invoice.outstandingPaise)}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Hash chain events</td>
              <td>{data.events.length}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Attachments</td>
              <td>{data.attachments.length}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="page-break" />

      {/* 1. INVOICE SUMMARY */}
      <section>
        <h2 style={{ fontSize: "14pt", fontWeight: 600 }}>1. Invoice summary</h2>
        <p style={{ fontSize: "10pt", color: "#5A6170" }}>
          Full tax-invoice copy is available at <code>/print/invoice/{data.invoice.id}</code>.
        </p>
        <table style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Invoice number</td>
              <td>{data.invoice.number}</td>
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
      </section>

      {/* 2. AUDIT TRAIL */}
      <section className="page-break" />
      <section>
        <h2 style={{ fontSize: "14pt", fontWeight: 600 }}>
          2. Complete audit trail ({data.events.length} events)
        </h2>
        <table style={{ marginTop: 8 }}>
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
                <td style={{ fontSize: "9pt" }}>{e.chainSeq}</td>
                <td style={{ fontSize: "9pt" }}>{e.atIso.slice(0, 10)}</td>
                <td style={{ fontSize: "9pt" }}>{titleCase(e.type)}</td>
                <td style={{ fontSize: "9pt" }}>{e.actor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* 3. REMINDER LOG */}
      {data.reminders.length > 0 && (
        <>
          <section className="page-break" />
          <section>
            <h2 style={{ fontSize: "14pt", fontWeight: 600 }}>
              3. Reminder log ({data.reminders.length})
            </h2>
            <table style={{ marginTop: 8 }}>
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
                    <td style={{ fontSize: "9pt" }}>{r.sentAt ? r.sentAt.slice(0, 10) : "—"}</td>
                    <td style={{ fontSize: "9pt" }}>{r.stageKey}</td>
                    <td style={{ fontSize: "9pt" }}>{r.channel}</td>
                    <td style={{ fontSize: "9pt" }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* 4. PAYMENTS */}
      {data.payments.length > 0 && (
        <>
          <section className="page-break" />
          <section>
            <h2 style={{ fontSize: "14pt", fontWeight: 600 }}>
              4. Payments received ({data.payments.length})
            </h2>
            <table style={{ marginTop: 8 }}>
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
                    <td style={{ fontSize: "9pt" }}>{p.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* 5. CUSTOMER MESSAGES */}
      {data.messages.length > 0 && (
        <>
          <section className="page-break" />
          <section>
            <h2 style={{ fontSize: "14pt", fontWeight: 600 }}>
              5. Customer messages ({data.messages.length})
            </h2>
            <table style={{ marginTop: 8 }}>
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
                    <td style={{ fontSize: "9pt" }}>{m.createdAt.slice(0, 10)}</td>
                    <td style={{ fontSize: "9pt" }}>{titleCase(m.type)}</td>
                    <td style={{ fontSize: "9pt" }}>{titleCase(m.status)}</td>
                    <td style={{ fontSize: "9pt" }}>{m.message ?? m.reference ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {/* 6. ATTACHMENTS */}
      {data.attachments.length > 0 && (
        <>
          <section className="page-break" />
          <section>
            <h2 style={{ fontSize: "14pt", fontWeight: 600 }}>
              6. Attachments ({data.attachments.length})
            </h2>
            <table style={{ marginTop: 8 }}>
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
                    <td style={{ fontSize: "9pt" }}>{f.createdAt.slice(0, 10)}</td>
                    <td style={{ fontSize: "9pt" }}>{f.mime}</td>
                    <td className="num" style={{ fontSize: "9pt" }}>
                      {(f.sizeBytes / 1024).toFixed(1)} KB
                    </td>
                    <td
                      style={{
                        fontSize: "7pt",
                        fontFamily: "monospace",
                        wordBreak: "break-all",
                      }}
                    >
                      {f.sha256.slice(0, 16)}…
                    </td>
                    <td className="no-print" style={{ fontSize: "9pt" }}>
                      <a
                        href={`/api/uploads/view/${f.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: "#175CD3",
                          textDecoration: "underline",
                        }}
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p
              style={{
                fontSize: "8pt",
                color: "#5A6170",
                fontStyle: "italic",
                marginTop: 8,
              }}
            >
              Open links are session-validated and serve a 60-second signed URL to the file. They
              are hidden when printing.
            </p>
          </section>
        </>
      )}

      {/* 7. DEMAND LETTER */}
      {data.demandLetter && (
        <>
          <section className="page-break" />
          <section>
            <h2 style={{ fontSize: "14pt", fontWeight: 600 }}>7. Demand letter</h2>
            <p style={{ fontSize: "10pt", color: "#5A6170", marginTop: 4 }}>
              Generated on {data.demandLetter.generatedOn} · Pay by {data.demandLetter.payByDate}
            </p>

            <table style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Invoice</td>
                  <td>{data.invoice.number}</td>
                </tr>
                <tr>
                  <td>Balance demanded at generation</td>
                  <td style={{ fontWeight: 600 }}>{formatINR(data.demandLetter.balancePaise)}</td>
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

            <div
              style={{
                border: "1px solid #B54708",
                background: "#FFFAEB",
                padding: 8,
                marginTop: 12,
                fontSize: "9pt",
              }}
            >
              {buildDisclaimer(data.business.name)}
            </div>

            <p
              style={{
                fontSize: "9pt",
                color: "#5A6170",
                fontStyle: "italic",
                marginTop: 8,
              }}
            >
              Full letter: <code>/print/letter/{data.invoice.id}</code>
            </p>
          </section>
        </>
      )}

      <div className="footer">
        Generated {data.generatedAt} · {data.business.name} · {data.invoice.number}
      </div>
    </div>
  );
}

export const instant = false;

import { AttachmentsSection } from "@/components/attachments-section";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { formatINR, formatINRDelta } from "@/lib/domain/money";
import { numberToWordsIndian } from "@/lib/domain/words";
import { listEntityEvents, type StoredEvent } from "@/lib/db/hashchain-server";
import { VerifyButton } from "./verify-button";
import { MarkPaidButton } from "./mark-paid-button";
import { ReminderButton } from "./reminder-button";
import { TamperTestButton } from "./tamper-test-button";

const STATUS_LABEL: Record<string, string> = {
  draft: "✎ Draft",
  sent: "✈ Sent",
  due_soon: "⏱ Due soon",
  part_paid: "◐ Part paid",
  paid: "✓ Paid",
  disputed: "⚑ Disputed",
  cancelled: "✕ Cancelled",
};

const EVENT_ICON: Record<string, string> = {
  INVOICE_CREATED: "✦",
  INVOICE_SENT: "✈",
  REMINDER_SENT: "✉",
  PAYMENT_CONFIRMED: "₹",
  DISPUTE_RAISED: "⚑",
  DISPUTE_RESOLVED: "✓",
  DISPUTE_REJECTED: "✕",
  ALREADY_PAID_CONFIRMED: "✓",
  ALREADY_PAID_REJECTED: "✕",
  INVOICE_STATUS_CHANGED: "↻",
  SETTINGS_CHANGED: "⚙",
};

const EVENT_COLOR: Record<string, string> = {
  INVOICE_CREATED: "text-[#0F5C4E] bg-[#0F5C4E]/10",
  INVOICE_SENT: "text-[#175CD3] bg-[#175CD3]/10",
  REMINDER_SENT: "text-[#B54708] bg-[#B54708]/10",
  PAYMENT_CONFIRMED: "text-[#067647] bg-[#067647]/10",
  DISPUTE_RAISED: "text-[#B54708] bg-[#B54708]/10",
  DISPUTE_RESOLVED: "text-[#067647] bg-[#067647]/10",
  DISPUTE_REJECTED: "text-[#B42318] bg-[#B42318]/10",
  ALREADY_PAID_CONFIRMED: "text-[#067647] bg-[#067647]/10",
  ALREADY_PAID_REJECTED: "text-[#B42318] bg-[#B42318]/10",
  INVOICE_STATUS_CHANGED: "text-[#5A6170] bg-[#5A6170]/10",
  SETTINGS_CHANGED: "text-[#5A6170] bg-[#5A6170]/10",
};

function eventTitle(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function eventContext(e: StoredEvent): string | null {
  const p = (e.payload ?? {}) as Record<string, unknown>;

  switch (e.type) {
    case "REMINDER_SENT": {
      const stage = typeof p.stageKey === "string" ? p.stageKey : null;
      const channel = typeof p.channel === "string" ? p.channel : null;
      if (stage && channel) return `${stage} · ${channel}`;
      return stage ?? channel ?? null;
    }
    case "PAYMENT_CONFIRMED": {
      const amt = typeof p.amountPaise === "number" ? formatINR(p.amountPaise) : null;
      const ref = typeof p.reference === "string" ? p.reference : null;
      if (amt && ref) return `${amt} · ${ref}`;
      return amt ?? null;
    }
    case "DISPUTE_RESOLVED":
    case "DISPUTE_REJECTED": {
      const resolution = typeof p.resolution === "string" ? p.resolution : null;
      const reply = typeof p.reply === "string" ? p.reply : null;
      if (resolution) return `resolution: ${resolution}`;
      return reply ? `reply: ${reply.slice(0, 40)}` : null;
    }
    case "ALREADY_PAID_CONFIRMED":
    case "ALREADY_PAID_REJECTED": {
      const ref = typeof p.reference === "string" ? p.reference : null;
      return ref ? `ref: ${ref}` : null;
    }
    case "INVOICE_STATUS_CHANGED": {
      const from = typeof p.from === "string" ? p.from : null;
      const to = typeof p.to === "string" ? p.to : null;
      return from && to ? `${from} → ${to}` : null;
    }
    case "SETTINGS_CHANGED": {
      const changes = p.changes as Record<string, unknown> | undefined;
      if (!changes) return null;
      const keys = Object.keys(changes);
      if (keys.length === 0) return null;
      return keys.length === 1 ? keys[0]! : `${keys.length} fields`;
    }
    default:
      return null;
  }
}

function statusColorFor(status: string): string {
  if (status === "overdue") return "text-[#B42318]";
  if (status === "paid") return "text-[#067647]";
  if (status === "due_soon" || status === "disputed") return "text-[#B54708]";
  if (status === "part_paid") return "text-[#175CD3]";
  return "text-[#5A6170]";
}

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const businessId = await currentBusinessId(session.userId);
  const invoice = await getInvoiceWithTotals(id, businessId, todayIST());
  if (!invoice) notFound();

  const events = await listEntityEvents(businessId, invoice.id);

  const statusLabel =
    invoice.status === "overdue"
      ? `⚠ ${invoice.daysOverdue} days overdue`
      : (STATUS_LABEL[invoice.status] ?? invoice.status);
  const statusColor = statusColorFor(invoice.status);

  return (
    <main className="space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <Link href="/invoices" className="text-muted-foreground text-xs underline">
          ← Back
        </Link>
        <span className="text-muted-foreground font-mono text-xs">{invoice.number}</span>
      </div>

      {/* Header card */}
      <div className="rounded-xl bg-white p-5 ring-1 ring-[#E4E7EC]">
        <p className={`text-xs font-medium ${statusColor}`}>{statusLabel}</p>
        <h1 className="mt-1 text-lg font-semibold">{invoice.customer.name}</h1>
        <p className="mt-2 text-3xl font-semibold tabular-nums">
          {formatINR(invoice.outstandingPaise)}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          Due {invoice.dueDate} · Issued {invoice.invoiceDate}
        </p>
        {invoice.amountPaidPaise > 0 && (
          <p className="text-muted-foreground mt-1 text-xs">
            Paid {formatINR(invoice.amountPaidPaise)} of {formatINR(invoice.totals.totalPaise)}
          </p>
        )}
      </div>

      {/* Items + tax */}
      <div className="rounded-xl bg-white p-5 ring-1 ring-[#E4E7EC]">
        <h2 className="text-sm font-semibold">Items</h2>
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="py-1">Description</th>
              <th className="py-1 text-right">Qty</th>
              <th className="py-1 text-right">Rate</th>
              <th className="py-1 text-right">Taxable</th>
              <th className="py-1 text-right">GST</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {invoice.items.map((it) => {
              const taxable = Math.round(it.qty * it.ratePaise) - it.discountPaise;
              return (
                <tr key={it.id} className="border-t border-[#E4E7EC]">
                  <td className="py-2">
                    {it.description}
                    <span className="text-muted-foreground ml-2">HSN {it.hsnSac}</span>
                  </td>
                  <td className="py-2 text-right">
                    {it.qty} {it.unit}
                  </td>
                  <td className="py-2 text-right">{formatINR(it.ratePaise)}</td>
                  <td className="py-2 text-right">{formatINR(taxable)}</td>
                  <td className="py-2 text-right">{it.gstRatePct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <dl className="mt-4 space-y-1 border-t border-[#E4E7EC] pt-3 text-sm tabular-nums">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Taxable</dt>
            <dd>{formatINR(invoice.totals.taxablePaise)}</dd>
          </div>
          {invoice.totals.hasTax && !invoice.totals.isInterState && (
            <>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">CGST</dt>
                <dd>{formatINR(invoice.totals.cgstPaise)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">SGST</dt>
                <dd>{formatINR(invoice.totals.sgstPaise)}</dd>
              </div>
            </>
          )}
          {invoice.totals.hasTax && invoice.totals.isInterState && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">IGST</dt>
              <dd>{formatINR(invoice.totals.igstPaise)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Round off</dt>
            <dd>{formatINRDelta(invoice.totals.roundOffPaise)}</dd>
          </div>
          <div className="flex justify-between border-t border-[#E4E7EC] pt-2 font-semibold">
            <dt>Total</dt>
            <dd>{formatINR(invoice.totals.totalPaise)}</dd>
          </div>
        </dl>

        <p className="text-muted-foreground mt-3 text-xs capitalize">
          {numberToWordsIndian(invoice.totals.totalPaise)}
        </p>
      </div>

      <AttachmentsSection invoiceId={invoice.id} />
      {/* Timeline */}
      <div className="rounded-xl bg-white p-5 ring-1 ring-[#E4E7EC]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Timeline</h2>
          <span className="text-muted-foreground text-[10px]">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </div>
        <ol className="mt-3 space-y-3">
          {events.map((e) => {
            const ctx = eventContext(e);
            const icon = EVENT_ICON[e.type] ?? "●";
            const color = EVENT_COLOR[e.type] ?? "text-[#5A6170] bg-[#5A6170]/10";
            return (
              <li key={e.chainSeq} className="flex gap-3 text-xs">
                <span
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${color}`}
                  aria-hidden="true"
                >
                  {icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{eventTitle(e.type)}</div>
                  <div className="text-muted-foreground">
                    {e.actor.replace(/^user:/, "user ")} · {e.atIso.slice(0, 10)}
                    {ctx && (
                      <>
                        {" · "}
                        <span className="text-[#1A1D23]">{ctx}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 font-mono text-[10px]">
                  #{e.chainSeq}
                </span>
              </li>
            );
          })}
          {events.length === 0 && <p className="text-muted-foreground text-xs">No events yet.</p>}
        </ol>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/print/invoice/${invoice.id}`}
          target="_blank"
          className="rounded-lg bg-white px-4 py-3 text-center text-sm font-medium ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
        >
          🖨 Print invoice
        </Link>
        <VerifyButton invoiceId={invoice.id} />
        <MarkPaidButton
          invoiceId={invoice.id}
          outstandingRupees={(invoice.outstandingPaise / 100).toFixed(2)}
        />
        <ReminderButton invoiceId={invoice.id} />
      </div>

      {process.env.NODE_ENV !== "production" && events.length > 0 && (
        <div className="rounded-lg bg-red-50 p-3 ring-1 ring-red-200">
          <p className="mb-2 text-xs font-semibold text-red-900">Dev: tamper test</p>
          <TamperTestButton invoiceId={invoice.id} chainSeq={events.length} />
        </div>
      )}

      {invoice.everCrossedEinvoiceThreshold && (
        <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
          ℹ E-invoicing applies to your business (₹5 crore AATO threshold crossed in a prior year).
        </div>
      )}
    </main>
  );
}

async function currentBusinessId(userId: string): Promise<string> {
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

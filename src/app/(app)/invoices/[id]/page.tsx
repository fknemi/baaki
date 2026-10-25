export const instant = false;
import { CopyPayLinkButton } from "./copy-pay-link-button";
import { DemandLetterButton } from "./demand-letter-button";
import { DeleteInvoiceButton } from "./delete-invoice-button";
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

// ─── outline icons ───────────────────────────────────────────────────────────
// Two shared responsive ladders so every icon scales sm→md→lg→xl on its own.
// Capped at 16px (h-4) — going to h-5 (20px) inside an h-11→h-14 button looked
// oversized and visually unaligned with the button text.

const ICON_STD =
    "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";
const ICON_PRINT =
    "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

type IconProps = { className?: string };


function IconPencil({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
    );
}

function IconSend({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
    );
}

function IconClock({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}

function IconCircleHalf({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 0 0 18V3z" fill="currentColor" stroke="none" />
        </svg>
    );
}

function IconCheck({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function IconX({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    );
}

function IconFlag({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <line x1="4" y1="22" x2="4" y2="15" />
        </svg>
    );
}

function IconAlert({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    );
}

function IconMail({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
        </svg>
    );
}

function IconRupee({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d="M6 3h12" />
            <path d="M6 8h12" />
            <path d="M6 13h3a6 6 0 0 0 6-6" />
            <path d="M6 13h3a6 6 0 0 1 6 6v2" />
        </svg>
    );
}

function IconRefresh({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
            <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
        </svg>
    );
}

function IconSettings({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
    );
}

function IconDot({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="1" />
        </svg>
    );
}

function IconPrinter({ className = ICON_PRINT }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
        </svg>
    );
}

function IconInfo({ className = ICON_STD }: IconProps) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
    );
}

// ─── status/event helpers ────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    due_soon: "Due soon",
    part_paid: "Part paid",
    paid: "Paid",
    disputed: "Disputed",
    cancelled: "Cancelled",
};

function StatusIcon({ status }: { status: string }) {
    // Matches the label it sits next to: text-xs → sm → md → lg → xl.
    // Capped at 16px (h-4) on md+ — same cap as ICON_STD.
    const cls =
        "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";
    switch (status) {
        case "draft": return <IconPencil className={cls} />;
        case "sent": return <IconSend className={cls} />;
        case "due_soon": return <IconClock className={cls} />;
        case "part_paid": return <IconCircleHalf className={cls} />;
        case "paid": return <IconCheck className={cls} />;
        case "disputed": return <IconFlag className={cls} />;
        case "cancelled": return <IconX className={cls} />;
        default: return null;
    }
}

function EventIconFor({ type }: { type: string }) {
    // Sits inside the timeline dot (h-5 → h-6 → h-6 → h-7 → h-8).
    // Kept ~50% of the dot at every step so the glyph never fills the circle.
    const cls =
        "h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4";
    switch (type) {
        case "INVOICE_CREATED": return <IconDot className={cls} />;
        case "INVOICE_SENT": return <IconSend className={cls} />;
        case "REMINDER_SENT": return <IconMail className={cls} />;
        case "PAYMENT_CONFIRMED": return <IconRupee className={cls} />;
        case "DISPUTE_RAISED": return <IconFlag className={cls} />;
        case "DISPUTE_RESOLVED": return <IconCheck className={cls} />;
        case "DISPUTE_REJECTED": return <IconX className={cls} />;
        case "ALREADY_PAID_CONFIRMED": return <IconCheck className={cls} />;
        case "ALREADY_PAID_REJECTED": return <IconX className={cls} />;
        case "INVOICE_STATUS_CHANGED": return <IconRefresh className={cls} />;
        case "SETTINGS_CHANGED": return <IconSettings className={cls} />;
        default: return <IconDot className={cls} />;
    }
}

const EVENT_COLOR: Record<string, string> = {
    INVOICE_CREATED: "text-[#54C48C] bg-[#54C48C]/10",
    INVOICE_SENT: "text-[#60A5FA] bg-[#60A5FA]/10",
    REMINDER_SENT: "text-[#FBBF24] bg-[#FBBF24]/10",
    PAYMENT_CONFIRMED: "text-[#4ADE80] bg-[#4ADE80]/10",
    DISPUTE_RAISED: "text-[#FBBF24] bg-[#FBBF24]/10",
    DISPUTE_RESOLVED: "text-[#4ADE80] bg-[#4ADE80]/10",
    DISPUTE_REJECTED: "text-[#FF9B8F] bg-[#FF9B8F]/10",
    ALREADY_PAID_CONFIRMED: "text-[#4ADE80] bg-[#4ADE80]/10",
    ALREADY_PAID_REJECTED: "text-[#FF9B8F] bg-[#FF9B8F]/10",
    INVOICE_STATUS_CHANGED: "text-white/60 bg-white/10",
    SETTINGS_CHANGED: "text-white/60 bg-white/10",
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
            return from && to ? `${from} to ${to}` : null;
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
    if (status === "overdue") return "text-[#FF9B8F]";
    if (status === "paid") return "text-[#4ADE80]";
    if (status === "due_soon" || status === "disputed") return "text-[#FBBF24]";
    if (status === "part_paid") return "text-[#60A5FA]";
    return "text-white";
}

// Card chrome scales padding, radius, and border together.
const CARD =
    "rounded-lg border border-white/10 p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-5 lg:rounded-2xl lg:p-6 xl:rounded-2xl xl:p-6";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getSession();
    if (!session) redirect("/login");

    const businessId = await currentBusinessId(session.userId);
    const invoice = await getInvoiceWithTotals(id, businessId, todayIST());
    if (!invoice) notFound();

    const events = await listEntityEvents(businessId, invoice.id);

    const isOverdue = invoice.status === "overdue";
    const statusLabel = isOverdue
        ? `${invoice.daysOverdue} days overdue`
        : (STATUS_LABEL[invoice.status] ?? invoice.status);
    const statusColor = statusColorFor(invoice.status);

    // Mirrors ALLOWED_TRANSITIONS in the DELETE route.
    const canDelete =
        invoice.status !== "paid" &&
        invoice.status !== "cancelled" &&
        invoice.status !== "disputed";

    return (
        <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 sm:max-w-xl sm:space-y-4 sm:px-4 sm:pb-24 sm:pt-16 md:max-w-2xl md:space-y-4 md:px-6 md:pb-28 md:pt-20 lg:max-w-3xl lg:space-y-5 lg:px-6 lg:pb-32 lg:pt-24 xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24">
            {/* Header card */}
            <div className={CARD}>
                <p className={`flex items-center gap-1.5 text-xs font-medium sm:gap-1.5 sm:text-sm md:gap-2 md:text-sm lg:gap-2 lg:text-base xl:gap-2.5 xl:text-base ${statusColor}`}>
                    {isOverdue ? <IconAlert /> : <StatusIcon status={invoice.status} />}
                    {statusLabel}
                </p>
                <h1 className="mt-1 text-lg font-semibold text-white sm:mt-1 sm:text-xl md:mt-1.5 md:text-2xl lg:mt-2 lg:text-2xl xl:mt-2 xl:text-3xl">
                    {invoice.customer.name}
                </h1>
                <p className="mt-2 text-3xl font-semibold tabular-nums text-white sm:mt-2 sm:text-3xl md:mt-2.5 md:text-4xl lg:mt-3 lg:text-4xl xl:mt-3 xl:text-5xl">
                    {formatINR(invoice.outstandingPaise)}
                </p>
                <p className="mt-1 text-[11px] italic text-white sm:mt-1 sm:text-xs md:mt-1.5 md:text-sm lg:mt-2 lg:text-sm xl:mt-2 xl:text-base">
                    Due {invoice.dueDate} · Issued {invoice.invoiceDate}
                </p>
                {invoice.amountPaidPaise > 0 && (
                    <p className="mt-1 text-[11px] italic text-white sm:mt-1 sm:text-xs md:mt-1.5 md:text-sm lg:mt-2 lg:text-sm xl:mt-2 xl:text-base">
                        Paid {formatINR(invoice.amountPaidPaise)} of {formatINR(invoice.totals.totalPaise)}
                    </p>
                )}
            </div>

            {/* Items + tax */}
            <div className={CARD}>
                <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">Items</h2>

                {/* overflow-auto (not -y) so very narrow phones horizontally
                    scroll the 5-column table instead of squashing; sticky
                    thead still works on the vertical axis. */}
                <div className="mt-3 max-h-96 overflow-auto pr-1 sm:mt-3 sm:pr-1 md:mt-4 md:pr-1.5 lg:mt-4 lg:pr-2 xl:mt-5 xl:pr-2">
                    <table className="w-full text-[11px] sm:text-xs md:text-sm lg:text-sm xl:text-base">
                        <thead className="sticky top-0 bg-[#192221]">
                            <tr className="text-left italic text-white">
                                <th className="py-1 sm:py-1 md:py-1.5 lg:py-1.5 xl:py-2">Description</th>
                                <th className="py-1 text-right sm:py-1 md:py-1.5 lg:py-1.5 xl:py-2">Qty</th>
                                <th className="py-1 text-right sm:py-1 md:py-1.5 lg:py-1.5 xl:py-2">Rate</th>
                                <th className="py-1 text-right sm:py-1 md:py-1.5 lg:py-1.5 xl:py-2">Taxable</th>
                                <th className="py-1 text-right sm:py-1 md:py-1.5 lg:py-1.5 xl:py-2">GST</th>
                            </tr>
                        </thead>
                        <tbody className="tabular-nums">
                            {invoice.items.map((it) => {
                                const taxable = Math.round(it.qty * it.ratePaise) - it.discountPaise;
                                return (
                                    <tr key={it.id} className="border-t border-white/10">
                                        <td className="py-2 text-white sm:py-2 md:py-2.5 lg:py-3 xl:py-3">
                                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:gap-x-2 md:gap-x-2.5 lg:gap-x-3 xl:gap-x-3">
                                                <span className="break-words">{it.description}</span>
                                                <span className="whitespace-nowrap italic text-white">
                                                    HSN {it.hsnSac}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-2 text-right text-white sm:py-2 md:py-2.5 lg:py-3 xl:py-3">
                                            {it.qty} {it.unit}
                                        </td>
                                        <td className="py-2 text-right text-white sm:py-2 md:py-2.5 lg:py-3 xl:py-3">{formatINR(it.ratePaise)}</td>
                                        <td className="py-2 text-right text-white sm:py-2 md:py-2.5 lg:py-3 xl:py-3">{formatINR(taxable)}</td>
                                        <td className="py-2 text-right text-white sm:py-2 md:py-2.5 lg:py-3 xl:py-3">{it.gstRatePct}%</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <dl className="mt-4 space-y-1 border-t border-white/10 pt-3 text-sm tabular-nums sm:mt-4 sm:space-y-1 sm:pt-3 sm:text-sm md:mt-5 md:space-y-1.5 md:pt-4 md:text-base lg:mt-5 lg:space-y-1.5 lg:pt-4 lg:text-base xl:mt-6 xl:space-y-2 xl:pt-5 xl:text-lg">
                    <div className="flex justify-between">
                        <dt className="italic text-white">Taxable</dt>
                        <dd className="text-white">{formatINR(invoice.totals.taxablePaise)}</dd>
                    </div>
                    {invoice.totals.hasTax && !invoice.totals.isInterState && (
                        <>
                            <div className="flex justify-between">
                                <dt className="italic text-white">CGST</dt>
                                <dd className="text-white">{formatINR(invoice.totals.cgstPaise)}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="italic text-white">SGST</dt>
                                <dd className="text-white">{formatINR(invoice.totals.sgstPaise)}</dd>
                            </div>
                        </>
                    )}
                    {invoice.totals.hasTax && invoice.totals.isInterState && (
                        <div className="flex justify-between">
                            <dt className="italic text-white">IGST</dt>
                            <dd className="text-white">{formatINR(invoice.totals.igstPaise)}</dd>
                        </div>
                    )}
                    <div className="flex justify-between">
                        <dt className="italic text-white">Round off</dt>
                        <dd className="text-white">{formatINRDelta(invoice.totals.roundOffPaise)}</dd>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-2 font-semibold sm:pt-2 md:pt-2.5 lg:pt-3 xl:pt-3">
                        <dt className="text-white">Total</dt>
                        <dd className="text-base text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
                            {formatINR(invoice.totals.totalPaise)}
                        </dd>
                    </div>
                </dl>

                <p className="mt-3 text-[11px] italic capitalize text-white sm:mt-3 sm:text-xs md:mt-3 md:text-sm lg:mt-4 lg:text-sm xl:mt-4 xl:text-base">
                    {numberToWordsIndian(invoice.totals.totalPaise)}
                </p>
            </div>

            <AttachmentsSection invoiceId={invoice.id} />

            {/* Timeline */}
            <div className={CARD}>
                <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">Timeline</h2>
                    <span className="text-[10px] italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                        {events.length} event{events.length === 1 ? "" : "s"}
                    </span>
                </div>
                <ol className="mt-3 max-h-96 space-y-3 overflow-y-auto pr-1 sm:mt-3 sm:space-y-3 sm:pr-1 md:mt-4 md:space-y-3.5 md:pr-1.5 lg:mt-4 lg:space-y-4 lg:pr-2 xl:mt-5 xl:space-y-4 xl:pr-2">
                    {events.map((e) => {
                        const ctx = eventContext(e);
                        const color = EVENT_COLOR[e.type] ?? "text-white/60 bg-white/10";
                        return (
                            <li key={e.chainSeq} className="flex gap-2 text-xs sm:gap-3 sm:text-sm md:gap-3 md:text-base lg:gap-4 lg:text-base xl:gap-4 xl:text-lg">
                                <span
                                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full sm:mt-0.5 sm:h-6 sm:w-6 md:mt-1 md:h-6 md:w-6 lg:mt-1 lg:h-7 lg:w-7 xl:mt-1 xl:h-8 xl:w-8 ${color}`}
                                    aria-hidden="true"
                                >
                                    <EventIconFor type={e.type} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="font-medium text-white">{eventTitle(e.type)}</div>
                                    <div className="italic text-white">
                                        {e.actor.replace(/^user:/, "user ")} · {e.atIso.slice(0, 10)}
                                        {ctx && (
                                            <>
                                                {" · "}
                                                <span className="not-italic text-white">{ctx}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <span className="shrink-0 font-mono text-[10px] italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                                    #{e.chainSeq}
                                </span>
                            </li>
                        );
                    })}
                    {events.length === 0 && (
                        <p className="text-xs italic text-white sm:text-sm md:text-base lg:text-base xl:text-lg">No events yet.</p>
                    )}
                </ol>
            </div>

            {/* Actions
                items-start pins cells to the top of the row so a child
                button that conditionally expands (Reminder / MarkPaid /
                Verify) can't drag its row sibling's height.
                2 → 3 columns on md once the container has room. */}
            <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 md:gap-3 lg:grid-cols-3 lg:gap-4 xl:grid-cols-3 xl:gap-4">
                <Link
                    href={`/print/invoice/${invoice.id}`}
                    target="_blank"
                    className="flex h-11 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-center text-sm font-medium text-white hover:bg-white/5 sm:h-11 sm:gap-1.5 sm:rounded-lg sm:px-4 sm:text-sm md:h-12 md:gap-2 md:rounded-xl md:px-4 md:text-base lg:h-12 lg:gap-2 lg:rounded-xl lg:px-5 lg:text-base xl:h-14 xl:gap-2.5 xl:rounded-xl xl:px-6 xl:text-lg"
                >
                    <IconPrinter />
                    Print invoice
                </Link>
                <CopyPayLinkButton invoiceId={invoice.id} />
                <ReminderButton invoiceId={invoice.id} />
                <DemandLetterButton
                    invoiceId={invoice.id}
                    daysOverdue={invoice.daysOverdue}
                />
                <MarkPaidButton
                    invoiceId={invoice.id}
                    outstandingRupees={(invoice.outstandingPaise / 100).toFixed(2)}
                />
                <VerifyButton invoiceId={invoice.id} />
            </div>

            {/* Danger zone — shown only when the invoice can actually be
                cancelled (mirrors the DELETE route's ALLOWED_TRANSITIONS).
                Kept out of the main action grid so a destructive action
                isn't adjacent to daily-use buttons. */}
            {canDelete && (
                <div className="rounded-lg border border-[#B42318]/40 bg-[#B42318]/5 p-3 sm:rounded-lg sm:p-4 md:rounded-xl md:p-4 lg:rounded-xl lg:p-5 xl:rounded-xl xl:p-5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white sm:mb-2 sm:gap-1.5 sm:text-sm md:mb-2.5 md:gap-2 md:text-sm lg:mb-3 lg:gap-2 lg:text-base xl:mb-3 xl:gap-2.5 xl:text-base">
                        <IconAlert className={`${ICON_STD} text-[#FF9B8F]`} />
                        Danger zone
                    </p>
                    <DeleteInvoiceButton
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.number}
                    />
                </div>
            )}

            {process.env.NODE_ENV !== "production" && events.length > 0 && (
                <div className="rounded-lg border border-[#B42318]/40 bg-[#B42318]/10 p-3 sm:rounded-lg sm:p-4 md:rounded-xl md:p-4 lg:rounded-xl lg:p-5 xl:rounded-xl xl:p-5">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white sm:mb-2 sm:gap-1.5 sm:text-sm md:mb-2.5 md:gap-2 md:text-sm lg:mb-3 lg:gap-2 lg:text-base xl:mb-3 xl:gap-2.5 xl:text-base">
                        <IconAlert className={`${ICON_STD} text-[#FF9B8F]`} />
                        Dev: tamper test
                    </p>
                    <TamperTestButton invoiceId={invoice.id} chainSeq={events.length} />
                </div>
            )}

            {invoice.everCrossedEinvoiceThreshold && (
                <div className="flex items-start gap-2 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-white sm:gap-2 sm:rounded-lg sm:p-4 sm:text-sm md:gap-2.5 md:rounded-xl md:p-4 md:text-sm lg:gap-3 lg:rounded-xl lg:p-5 lg:text-base xl:gap-3 xl:rounded-xl xl:p-5 xl:text-base">
                    <IconInfo className={`${ICON_STD} mt-0.5 shrink-0 text-[#FBBF24] sm:mt-0.5 md:mt-1 lg:mt-1 xl:mt-1`} />
                    <span>
                        E-invoicing applies to your business (₹5 crore AATO threshold crossed in a prior year).
                    </span>
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

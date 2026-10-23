export const instant = false;
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { formatINR, formatINRDelta } from "@/lib/domain/money";
import { numberToWordsIndian } from "@/lib/domain/words";
import { VerifyButton } from "./verify-button";
import { listEntityEvents } from "@/lib/db/hashchain-server";

export default async function InvoiceDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const session = await getSession();
    if (!session) redirect("/login");

    const businessId = await currentBusinessId(session.userId);
    const invoice = await getInvoiceWithTotals(id, businessId, todayIST());

    if (!invoice) notFound();
    const events = await listEntityEvents(businessId, invoice.id);

    const statusColor =
        invoice.status === "overdue"
            ? "text-[#B42318]"
            : invoice.status === "paid"
                ? "text-[#067647]"
                : invoice.status === "due_soon"
                    ? "text-[#B54708]"
                    : "text-[#5A6170]";

    return (
        <main className="space-y-4 p-4 pb-24">
            <div className="flex items-center justify-between">
                <Link
                    href="/invoices"
                    className="text-xs text-muted-foreground underline"
                >
                    ← Back
                </Link>
                <span className="font-mono text-xs text-muted-foreground">
                    {invoice.number}
                </span>
            </div>

            {/* Header card */}
            <div className="rounded-xl bg-white p-5 ring-1 ring-[#E4E7EC]">
                <p className={`text-xs font-medium ${statusColor}`}>
                    {invoice.status === "overdue"
                        ? `⚠ ${invoice.daysOverdue} days overdue`
                        : invoice.status.replace("_", " ")}
                </p>
                <h1 className="mt-1 text-lg font-semibold">{invoice.customer.name}</h1>
                <p className="mt-2 tabular-nums text-3xl font-semibold">
                    {formatINR(invoice.outstandingPaise)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                    Due {invoice.dueDate} · Issued {invoice.invoiceDate}
                </p>
                {invoice.amountPaidPaise > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                        Paid {formatINR(invoice.amountPaidPaise)} of{" "}
                        {formatINR(invoice.totals.totalPaise)}
                    </p>
                )}
            </div>

            {/* Items + tax */}
            <div className="rounded-xl bg-white p-5 ring-1 ring-[#E4E7EC]">
                <h2 className="text-sm font-semibold">Items</h2>
                <table className="mt-3 w-full text-xs">
                    <thead>
                        <tr className="text-left text-muted-foreground">
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
                                        <span className="ml-2 text-muted-foreground">
                                            HSN {it.hsnSac}
                                        </span>
                                    </td>
                                    <td className="py-2 text-right">
                                        {it.qty} {it.unit}
                                    </td>
                                    <td className="py-2 text-right">
                                        {formatINR(it.ratePaise)}
                                    </td>
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
                    {invoice.totals.roundOffPaise !== 0 && (
                        <div className="flex justify-between">
                            <dt className="text-muted-foreground">Round off</dt>
                            <dd>{formatINRDelta(invoice.totals.roundOffPaise)}</dd>
                        </div>
                    )}
                    <div className="flex justify-between border-t border-[#E4E7EC] pt-2 font-semibold">
                        <dt>Total</dt>
                        <dd>{formatINR(invoice.totals.totalPaise)}</dd>
                    </div>
                </dl>

                <p className="mt-3 text-xs text-muted-foreground">
                    {numberToWordsIndian(invoice.totals.totalPaise)}
                </p>
            </div>







            <div className="rounded-xl bg-white p-5 ring-1 ring-[#E4E7EC]">
                <h2 className="text-sm font-semibold">Timeline</h2>
                <ol className="mt-3 space-y-3">
                    {events.map((e) => (
                        <li key={e.chainSeq} className="flex gap-3 text-xs">
                            <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full bg-[#0F5C4E]" />
                            <div>
                                <div className="font-medium">{e.type.replace(/_/g, " ")}</div>
                                <div className="text-muted-foreground">
                                    {e.actor} · {e.atIso.slice(0, 10)}
                                </div>
                            </div>
                        </li>
                    ))}
                    {events.length === 0 && (
                        <p className="text-xs text-muted-foreground">No events yet.</p>
                    )}
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
            </div>

            {invoice.everCrossedEinvoiceThreshold && (
                <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
                    ℹ E-invoicing applies to your business (₹5 crore AATO threshold
                    crossed in a prior year).
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

import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices, customers, payments } from "@/lib/db/schema";
import { parseBankStatement } from "@/lib/csv/parse";
import { proposeMatches, lineKey, type OpenInvoice } from "@/lib/domain/matcher";
import { config } from "@/lib/domain/config";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";

export async function POST(req: NextRequest) {
    return requireRole(
        req,
        async (req, ctx) => {
            const body = (await req.json().catch(() => ({}))) as { csvText?: string };
            if (typeof body.csvText !== "string") {
                return NextResponse.json(
                    { error: { code: "BAD_REQUEST", message: "csvText required." } },
                    { status: 400 },
                );
            }

            const parsed = parseBankStatement(body.csvText);
            if (!parsed.ok) {
                return NextResponse.json(
                    { error: { code: parsed.code, message: parsed.error } },
                    { status: 400 },
                );
            }

            // Open invoices for this business
            const invoiceRows = await db
                .select({ invoice: invoices, customer: customers })
                .from(invoices)
                .innerJoin(customers, eq(customers.id, invoices.customerId))
                .where(eq(invoices.businessId, ctx.businessId));

            const today = todayIST();
            const openInvoices: OpenInvoice[] = [];
            for (const row of invoiceRows) {
                const view = await getInvoiceWithTotals(row.invoice.id, ctx.businessId, today);
                if (!view || view.outstandingPaise <= 0) continue;
                openInvoices.push({
                    id: view.id,
                    number: view.number,
                    customerName: view.customer.name,
                    outstandingPaise: view.outstandingPaise,
                    taxablePaise: view.totals.taxablePaise,
                    dueDate: view.dueDate,
                });
            }

            // Which line hashes have already been confirmed (idempotency_key matches)
            const lineHashes = parsed.lines.map((l) => lineKey(l));
            const existing = lineHashes.length
                ? await db
                    .select({ key: payments.idempotencyKey })
                    .from(payments)
                    .where(inArray(payments.idempotencyKey, lineHashes))
                : [];
            const existingKeys = new Set(existing.map((p) => p.key));
            const seenInBatch = new Set(existingKeys);
            const results = parsed.lines.map((line, i) => {
                const key = lineHashes[i]!;
                const isDupe =
                    seenInBatch.has(key) ||
                    // First occurrence adds to seenInBatch; second one is dupe.
                    false;
                seenInBatch.add(key);
                const proposals = proposeMatches(
                    line,
                    openInvoices,
                    { tdsCandidateShortfallsPct: config.tdsCandidateShortfallsPct },
                    isDupe ? new Set([key]) : existingKeys,
                );
                return {
                    lineId: line.id,
                    line: {
                        date: line.date,
                        description: line.description,
                        creditPaise: line.creditPaise,
                        ref: line.ref,
                    },
                    lineHash: lineHashes[i],
                    proposals,
                    recommended: proposals[0] ?? null,
                };
            });

            const matched = results.filter(
                (r) =>
                    r.recommended &&
                    !r.recommended.flags.includes("unmatched") &&
                    !r.recommended.flags.includes("duplicate"),
            ).length;
            const needsReview = results.filter(
                (r) => !r.recommended || r.recommended.flags.length > 0,
            ).length;
            const duplicates = results.filter((r) => r.recommended?.flags.includes("duplicate")).length;

            return NextResponse.json({
                data: {
                    lines: results,
                    summary: {
                        totalLines: results.length,
                        matched,
                        needsReview,
                        duplicates,
                    },
                },
            });
        },
        ["owner", "accountant"],
    );
}

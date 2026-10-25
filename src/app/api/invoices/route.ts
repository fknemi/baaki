import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices, invoiceItems, customers } from "@/lib/db/schema";
import { listInvoices, getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { computeTotals } from "@/lib/domain/gst";
import { nextInvoiceNumber } from "@/lib/domain/numbering";
import { todayIST, atIso } from "@/lib/domain/dates";


type ItemPayload = {
    description: string;
    hsnSac: string;
    qty: number;
    unit: string;
    ratePaise: number;
    discountPaise?: number;
    gstRatePct: number;
};




export async function GET(req: NextRequest) {
    return requireRole(
        req,
        async (_req, ctx) => {
            const customerId = req.nextUrl.searchParams.get("customerId") ?? undefined;
            const data = await listInvoices(ctx.businessId, todayIST(), 100, { customerId });
            return NextResponse.json({ data });
        },
        ["owner", "accountant", "staff"],
    );
}




export async function POST(req: NextRequest) {
    return requireRole(
        req,
        async (req, ctx) => {
            let body: {
                customerId?: string;
                invoiceDate?: string;
                dueDate?: string;
                placeOfSupplyStateCode?: string;
                reverseCharge?: boolean;
                items?: ItemPayload[];
            };
            try {
                body = await req.json();
            } catch {
                return NextResponse.json(
                    { error: { code: "BAD_REQUEST", message: "JSON body required." } },
                    { status: 400 },
                );
            }

            const { customerId, invoiceDate, dueDate, items } = body;
            if (!customerId || !invoiceDate || !dueDate || !Array.isArray(items) || items.length === 0) {
                return NextResponse.json(
                    {
                        error: {
                            code: "BAD_REQUEST",
                            message: "customerId, invoiceDate, dueDate, items required.",
                        },
                    },
                    { status: 400 },
                );
            }

            const [customer] = await db
                .select()
                .from(customers)
                .where(eq(customers.id, customerId))
                .limit(1);
            if (!customer || customer.businessId !== ctx.businessId) {
                return NextResponse.json(
                    { error: { code: "NOT_FOUND", message: "Customer not found." } },
                    { status: 404 },
                );
            }

            const today = todayIST();

            try {
                const invoiceId = await db.transaction(async (tx) => {
                    const fy = "26-27";
                    // Serialize invoice-number allocation per business+FY.
                    // Different from the event-chain lock (which is per entityId) — this
                    // lock must be shared by all concurrent POSTs for the same business+FY.
                    await tx.execute(
                        sql`SELECT pg_advisory_xact_lock(hashtext(${ctx.businessId + ":inv-seq:" + fy}))`,
                    );
                    const maxRows = await tx.execute<{ max_seq: string }>(sql`
          SELECT COALESCE(MAX(CAST(SPLIT_PART(number, '/', 3) AS INTEGER)), 0) AS max_seq
          FROM invoices
          WHERE business_id = ${ctx.businessId} AND number LIKE ${"INV/" + fy + "/%"}
        `);
                    const maxSeq = Number((maxRows as unknown as { max_seq: string }[])[0]?.max_seq ?? 0);
                    const { number } = nextInvoiceNumber(fy, { [fy]: maxSeq });

                    const [inv] = await tx
                        .insert(invoices)
                        .values({
                            businessId: ctx.businessId,
                            customerId,
                            number,
                            invoiceDate,
                            dueDate,
                            placeOfSupplyStateCode: body.placeOfSupplyStateCode ?? "27",
                            reverseCharge: body.reverseCharge ?? false,
                            status: "draft",
                            amountPaidPaise: 0,
                        })
                        .returning();
                    if (!inv) throw new Error("invoice insert failed");

                    const inserted = await tx
                        .insert(invoiceItems)
                        .values(
                            items.map((it) => ({
                                invoiceId: inv.id,
                                description: it.description,
                                hsnSac: it.hsnSac,
                                qty: String(it.qty),
                                unit: it.unit,
                                ratePaise: it.ratePaise,
                                discountPaise: it.discountPaise ?? 0,
                                gstRatePct: String(it.gstRatePct),
                            })),
                        )
                        .returning();

                    const totals = computeTotals(
                        inserted.map((it) => ({
                            qty: Number(it.qty),
                            ratePaise: it.ratePaise,
                            discountPaise: it.discountPaise,
                            gstRatePct: Number(it.gstRatePct),
                        })),
                        { stateCode: "27", registrationType: "regular" },
                        { stateCode: customer.stateCode ?? "27" },
                    );

                    await appendEventInTx(tx, {
                        businessId: ctx.businessId,
                        entityType: "invoice",
                        entityId: inv.id,
                        type: "INVOICE_CREATED",
                        actor: `user:${ctx.userId}`,
                        atIso: atIso(today),
                        payload: {
                            number: inv.number,
                            customerId,
                            items: inserted.map((it) => ({
                                description: it.description,
                                hsnSac: it.hsnSac,
                                qty: Number(it.qty),
                                unit: it.unit,
                                ratePaise: it.ratePaise,
                                discountPaise: it.discountPaise,
                                gstRatePct: Number(it.gstRatePct),
                            })),
                            totals,
                        },
                    });

                    return inv.id;
                });

                const full = await getInvoiceWithTotals(invoiceId, ctx.businessId, today);
                return NextResponse.json({ data: full }, { status: 201 });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "create failed";
                return NextResponse.json({ error: { code: "INTERNAL", message: msg } }, { status: 500 });
            }
        },
        ["owner", "accountant"],
    );
}

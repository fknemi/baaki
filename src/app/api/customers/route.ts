import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { customers, invoices } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { loadCustomerStats } from "@/lib/db/queries/customers";
import { todayIST } from "@/lib/domain/dates";
import { isValidGSTIN } from "@/lib/domain/gstin";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
    return requireRole(
        req,
        async (req, ctx) => {
            const today = todayIST();

            const custRows = await db
                .select()
                .from(customers)
                .where(eq(customers.businessId, ctx.businessId));
            const invRows = await db
                .select()
                .from(invoices)
                .where(eq(invoices.businessId, ctx.businessId));
            const stats = await loadCustomerStats(ctx.businessId);
            const statsById = new Map(stats.map((s) => [s.id, s]));

            const outstandingByCustomer = new Map<string, number>();
            for (const inv of invRows) {
                if (!["sent", "part_paid", "disputed"].includes(inv.status)) continue;
                const view = await getInvoiceWithTotals(inv.id, ctx.businessId, today);
                if (!view || view.outstandingPaise <= 0) continue;
                const curr = outstandingByCustomer.get(inv.customerId) ?? 0;
                outstandingByCustomer.set(inv.customerId, curr + view.outstandingPaise);
            }

            const result = custRows.map((c) => {
                const stat = statsById.get(c.id) ?? {
                    id: c.id,
                    name: c.name,
                    avgDaysLate: 0,
                    pctOnTime: 0,
                    paidCount: 0,
                };
                const reason =
                    stat.paidCount === 0
                        ? "No payment history yet."
                        : `Pays ${stat.pctOnTime}% on time, average ${stat.avgDaysLate} ${stat.avgDaysLate === 1 ? "day" : "days"} late.`;
                const grade =
                    stat.paidCount === 0
                        ? "NEW"
                        : stat.pctOnTime >= 90 && stat.avgDaysLate <= 3
                            ? "A"
                            : stat.pctOnTime >= 60 && stat.avgDaysLate <= 15
                                ? "B"
                                : "C";

                return {
                    id: c.id,
                    name: c.name,
                    gstin: c.gstin,
                    stateCode: c.stateCode,
                    placeOfSupplyState: c.placeOfSupplyState,
                    city: c.city,
                    phoneMasked: c.phoneMasked,
                    email: c.email,
                    creditDays: c.creditDays,
                    preferredLanguage: c.preferredLanguage,
                    payToken: c.payToken,
                    avgDaysLate: stat.avgDaysLate,
                    pctOnTime: stat.pctOnTime,
                    grade,
                    gradeReason: reason,
                    totalOutstandingPaise: outstandingByCustomer.get(c.id) ?? 0,
                };
            });

            return NextResponse.json({ data: result });
        },
        ["owner", "accountant"],
    );
}

export async function POST(req: NextRequest) {
    return requireRole(
        req,
        async (req, ctx) => {
            const body = await req.json().catch(() => null);
            if (!body) {
                return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400 });
            }

            const { name, gstin, stateCode, city, phoneMasked, email, creditDays, preferredLanguage } =
                body;

            if (!name?.trim()) {
                return NextResponse.json(
                    { error: { message: "Name is required" } },
                    { status: 422 },
                );
            }

            const gstinTrim = gstin?.trim().toUpperCase() ?? null;
            if (gstinTrim) {
                const check = isValidGSTIN(gstinTrim);
                if (!check.valid) {
                    return NextResponse.json(
                        { error: { message: "Invalid GSTIN" } },
                        { status: 422 },
                    );
                }
            }

            const cd = Number(creditDays ?? 30);
            if (!Number.isInteger(cd) || cd < 0 || cd > 365) {
                return NextResponse.json(
                    { error: { message: "Credit days must be 0–365" } },
                    { status: 422 },
                );
            }

            const [created] = await db
                .insert(customers)
                .values({
                    id: randomUUID(),
                    businessId: ctx.businessId,
                    name: name.trim(),
                    gstin: gstinTrim,
                    stateCode: stateCode ?? gstinTrim?.slice(0, 2) ?? null,
                    placeOfSupplyState: null,
                    city: city?.trim() || null,
                    phoneMasked: phoneMasked?.trim() || null,
                    email: email?.trim() || null,
                    creditDays: cd,
                    preferredLanguage: preferredLanguage === "hi" ? "hi" : "en",
                    payToken: randomUUID(),   // ← add this
                }).returning();

            return NextResponse.json({ customer: created }, { status: 201 });
        },
        ["owner", "accountant"],
    );
}

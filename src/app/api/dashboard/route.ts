import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { businesses, expenses, invoices } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { loadCustomerStats } from "@/lib/db/queries/customers";
import { todayIST, addDays } from "@/lib/domain/dates";
import { computeForecast, type ForecastInput } from "@/lib/domain/forecast";
import { rankChase, type ForecastGapInfo } from "@/lib/domain/priority";
import { computeDashboard } from "@/lib/store/selectors/dashboard";

function computeGapInvoiceIds(
  openInvoices: Array<{
    id: string;
    dueDate: string;
    customerId: string;
  }>,
  avgByCustomer: Map<string, number>,
  forecastRows: Array<{ weekEnd: string }>,
  breachWeek: number | null,
  today: string,
): Set<string> {
  if (breachWeek === null) return new Set();
  const breachRow = forecastRows[breachWeek - 1];
  if (!breachRow) return new Set();
  const cutoff = breachRow.weekEnd;
  const set = new Set<string>();
  for (const inv of openInvoices) {
    const daysLate = avgByCustomer.get(inv.customerId) ?? 0;
    const effDue = addDays(inv.dueDate, daysLate);
    const clamped = effDue < today ? today : effDue;
    if (clamped <= cutoff) set.add(inv.id);
  }
  return set;
}

export async function GET(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const today = todayIST();

      const [biz] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, ctx.businessId))
        .limit(1);
      if (!biz) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Business not found." } },
          { status: 404 },
        );
      }

      const stats = await loadCustomerStats(ctx.businessId);
      const avgByCustomer = new Map(stats.map((s) => [s.id, s.avgDaysLate]));

      const invRows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.businessId, ctx.businessId));
      const openStatuses = new Set(["sent", "part_paid", "disputed"]);
      const openInvoices = invRows.filter((i) => openStatuses.has(i.status));

      type OpenInv = {
        id: string;
        customerId: string;
        dueDate: string;
        outstandingPaise: number;
      };
      const withOutstanding: OpenInv[] = [];
      for (const inv of openInvoices) {
        const view = await getInvoiceWithTotals(inv.id, ctx.businessId, today);
        if (!view || view.outstandingPaise <= 0) continue;
        withOutstanding.push({
          id: inv.id,
          customerId: inv.customerId,
          dueDate: inv.dueDate,
          outstandingPaise: view.outstandingPaise,
        });
      }

      const expRows = await db
        .select()
        .from(expenses)
        .where(eq(expenses.businessId, ctx.businessId));
      const forecastExpenses = expRows
        .filter((e) => e.dueDate && !e.paid)
        .map((e) => ({
          id: e.id,
          amountPaise: e.amountPaise,
          dueDate: e.dueDate as string,
        }));

      const forecastInput: ForecastInput = {
        openingCashPaise: biz.openingCashPaise,
        safetyBufferPaise: biz.safetyBufferPaise,
        invoices: withOutstanding,
        customers: stats.map((s) => ({ id: s.id, avgDaysLate: s.avgDaysLate })),
        expenses: forecastExpenses,
        today,
        weeks: 13,
      };
      const forecastResult = computeForecast(forecastInput);
      const lowestPointPaise = forecastResult.rows.reduce(
        (min, r) => (r.closingPaise < min ? r.closingPaise : min),
        biz.openingCashPaise,
      );

      const gapInvoiceIds = computeGapInvoiceIds(
        withOutstanding,
        avgByCustomer,
        forecastResult.rows,
        forecastResult.breachWeek,
        today,
      );
      const gapInfo: ForecastGapInfo = { gapInvoiceIds };

      const chase = rankChase(
        withOutstanding.map((i) => ({
          id: i.id,
          customerId: i.customerId,
          amountPaise: i.outstandingPaise,
          dueDate: i.dueDate,
        })),
        stats.map((s) => ({
          id: s.id,
          name: s.name,
          avgDaysLate: s.avgDaysLate,
          pctOnTime: s.pctOnTime,
        })),
        today,
        gapInfo,
        5,
      );

      const dash = computeDashboard({
        today,
        openingCashPaise: biz.openingCashPaise,
        safetyBufferPaise: biz.safetyBufferPaise,
        invoices: withOutstanding,
        customers: stats.map((s) => ({ id: s.id, avgDaysLate: s.avgDaysLate })),
        expenses: expRows.map((e) => ({
          dueDate: e.dueDate,
          amountPaise: e.amountPaise,
          paid: e.paid,
        })),
        forecast: {
          breachWeek: forecastResult.breachWeek,
          lowestPointPaise,
        },
        chase,
      });

      return NextResponse.json({
        data: {
          ...dash,
          openingCashPaise: biz.openingCashPaise,
          safetyBufferPaise: biz.safetyBufferPaise,
        },
      });
    },
    ["owner", "accountant"],
  );
}

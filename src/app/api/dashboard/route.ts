import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { businesses, expenses, invoices, payments } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { loadCustomerStats } from "@/lib/db/queries/customers";
import {
  todayIST,
  addDays,
  wholeDaysBetween,
  effectiveDueDate,
  isPaidForCurrentPeriod,
} from "@/lib/domain/dates";
import {
  computeForecast,
  projectExpenseOccurrences,
  type ForecastInput,
} from "@/lib/domain/forecast";
import { rankChase, type ForecastGapInfo } from "@/lib/domain/priority";
import { computeDashboard } from "@/lib/store/selectors/dashboard";

const HORIZON_WEEKS = 13;

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
    async (_req, ctx) => {
      const today = todayIST();
      const horizonEnd = addDays(today, HORIZON_WEEKS * 7);
      const asOfDate = new Date(`${today}T00:00:00`);

      // ── 1. Business ──────────────────────────────────────────
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

      // ── 2. Invoices that existed as of `today` ───────────────
      // An invoice filed on Oct 24 doesn't exist on Oct 22 and must
      // not show up in any card.
      const invRows = await db
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.businessId, ctx.businessId),
            lte(invoices.invoiceDate, today),
          ),
        );

      // ── 3. Payments made by `today` ──────────────────────────
      // A payment recorded on Oct 24 must not reduce outstanding on Oct 22.
      const paymentRows = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.businessId, ctx.businessId),
            isNotNull(payments.invoiceId),
            isNotNull(payments.paidOn),
            lte(payments.paidOn, today),
          ),
        );

      const paidAsOfByInvoice = new Map<string, number>();
      for (const p of paymentRows) {
        if (!p.invoiceId || !p.paidOn) continue;
        paidAsOfByInvoice.set(
          p.invoiceId,
          (paidAsOfByInvoice.get(p.invoiceId) ?? 0) + p.amountPaise,
        );
      }

      // ── 3b. Cash in bank as of `today` ──────────────────────
      // Opening balance + every payment received on or before `today`.
      // Separate query on purpose: `paymentRows` above only includes
      // payments linked to an invoice, but cash received is cash received.
      const receivedRows = await db
        .select({ amountPaise: payments.amountPaise })
        .from(payments)
        .where(
          and(
            eq(payments.businessId, ctx.businessId),
            isNotNull(payments.paidOn),
            lte(payments.paidOn, today),
          ),
        );
      const cashAsOfPaise =
        biz.openingCashPaise +
        receivedRows.reduce((sum, p) => sum + p.amountPaise, 0);

      // ── 4. As-of customer stats ─────────────────────────────
      // loadCustomerStats derives avgDaysLate/pctOnTime from ALL payments
      // (including future ones). Recompute from as-of payments so chase
      // ordering and forecast lateness reflect only what's happened by
      // the selected date.
      const customerBase = await loadCustomerStats(ctx.businessId);
      const invoiceById = new Map(invRows.map((i) => [i.id, i]));

      const latenessByCustomer = new Map<string, number[]>();
      const onTimeByCustomer = new Map<string, number>();
      const totalPaidByCustomer = new Map<string, number>();

      for (const p of paymentRows) {
        if (!p.invoiceId || !p.paidOn) continue;
        const inv = invoiceById.get(p.invoiceId);
        if (!inv) continue; // payment references a future invoice — skip
        const days = wholeDaysBetween(inv.dueDate, p.paidOn);
        const list = latenessByCustomer.get(inv.customerId) ?? [];
        list.push(days);
        latenessByCustomer.set(inv.customerId, list);
        totalPaidByCustomer.set(
          inv.customerId,
          (totalPaidByCustomer.get(inv.customerId) ?? 0) + 1,
        );
        if (days <= 0) {
          onTimeByCustomer.set(
            inv.customerId,
            (onTimeByCustomer.get(inv.customerId) ?? 0) + 1,
          );
        }
      }

      const asOfStats = customerBase.map((s) => {
        const latenesses = latenessByCustomer.get(s.id) ?? [];
        const total = totalPaidByCustomer.get(s.id) ?? 0;
        const onTime = onTimeByCustomer.get(s.id) ?? 0;
        const avgDaysLate =
          latenesses.length === 0
            ? 0
            : Math.round(
                latenesses.reduce((a, b) => a + b, 0) / latenesses.length,
              );
        const pctOnTime = total === 0 ? 0 : Math.round((onTime / total) * 100);
        return { id: s.id, name: s.name, avgDaysLate, pctOnTime };
      });
      const avgByCustomer = new Map(asOfStats.map((s) => [s.id, s.avgDaysLate]));

      // ── 5. As-of outstanding per invoice ────────────────────
      type OpenInv = {
        id: string;
        customerId: string;
        dueDate: string;
        outstandingPaise: number;
      };
      const withOutstanding: OpenInv[] = [];

      for (const inv of invRows) {
        if (inv.status === "cancelled" || inv.status === "draft") continue;

        const view = await getInvoiceWithTotals(inv.id, ctx.businessId, today);
        if (!view) continue;

        const paidSoFar = paidAsOfByInvoice.get(inv.id) ?? 0;
        const outstandingAsOf = Math.max(
          0,
          view.totals.totalPaise - paidSoFar,
        );
        if (outstandingAsOf <= 0) continue; // fully paid by `today`

        withOutstanding.push({
          id: inv.id,
          customerId: inv.customerId,
          dueDate: inv.dueDate,
          outstandingPaise: outstandingAsOf,
        });
      }

      // ── 6. Expenses as of `today` ───────────────────────────
      const expRows = await db
        .select()
        .from(expenses)
        .where(eq(expenses.businessId, ctx.businessId));

      // Forecast needs one occurrence per period across the horizon.
      const forecastExpenses = expRows
        .flatMap((e) => projectExpenseOccurrences(e, today, horizonEnd, today))
        .map((o) => ({
          id: o.id,
          amountPaise: o.amountPaise,
          dueDate: o.date,
        }));

      // ── 7. Forecast ─────────────────────────────────────────
      // Starts from cash as of `today`, not the static opening balance.
      const forecastInput: ForecastInput = {
        openingCashPaise: cashAsOfPaise,
        safetyBufferPaise: biz.safetyBufferPaise,
        invoices: withOutstanding,
        customers: asOfStats.map((s) => ({
          id: s.id,
          avgDaysLate: s.avgDaysLate,
        })),
        expenses: forecastExpenses,
        today,
        weeks: HORIZON_WEEKS,
      };

      const forecastResult = computeForecast(forecastInput);
      const lowestPointPaise = forecastResult.rows.reduce(
        (min, r) => (r.closingPaise < min ? r.closingPaise : min),
        cashAsOfPaise,
      );

      // ── 8. Gap → chase ──────────────────────────────────────
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
        asOfStats.map((s) => ({
          id: s.id,
          name: s.name,
          avgDaysLate: s.avgDaysLate,
          pctOnTime: s.pctOnTime,
        })),
        today,
        gapInfo,
        5,
      );

      // ── 9. Dashboard aggregates ─────────────────────────────
      const dash = computeDashboard({
        today,
        openingCashPaise: cashAsOfPaise,
        safetyBufferPaise: biz.safetyBufferPaise,
        invoices: withOutstanding,
        customers: asOfStats.map((s) => ({
          id: s.id,
          avgDaysLate: s.avgDaysLate,
        })),
        expenses: expRows.map((e) => ({
          dueDate: effectiveDueDate(e, asOfDate),
          amountPaise: e.amountPaise,
          paid: isPaidForCurrentPeriod(e, asOfDate),
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
          // Explicit override so the card moves with the selected date
          // regardless of what the selector does with openingCashPaise.
          cashInBankPaise: cashAsOfPaise,
          openingCashPaise: biz.openingCashPaise,
          safetyBufferPaise: biz.safetyBufferPaise,
        },
      });
    },
    ["owner", "accountant"],
  );
}

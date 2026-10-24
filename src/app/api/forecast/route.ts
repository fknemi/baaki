import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { businesses, customers, expenses, invoices, payments } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST, wholeDaysBetween, addDays } from "@/lib/domain/dates";
import {
  computeForecast,
  delayCustomer,
  addInflow,
  delayExpense,
  resetWhatIf,
  type ForecastInput,
  type ForecastCustomer,
  type ForecastInvoice,
  type ForecastExpense,
} from "@/lib/domain/forecast";

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

      const custRows = await db
        .select()
        .from(customers)
        .where(eq(customers.businessId, ctx.businessId));
      const invRows = await db
        .select()
        .from(invoices)
        .where(eq(invoices.businessId, ctx.businessId));

      // Derive avgDaysLate per customer from paid history (spec §2.8).
      const paidHistory = await db
        .select({
          customerId: invoices.customerId,
          dueDate: invoices.dueDate,
          paidOn: payments.paidOn,
        })
        .from(payments)
        .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
        .where(eq(payments.businessId, ctx.businessId));

      const lateByCustomer = new Map<string, number[]>();
      for (const p of paidHistory) {
        if (!p.paidOn) continue;
        const days = wholeDaysBetween(p.dueDate, p.paidOn);
        const list = lateByCustomer.get(p.customerId);
        if (list) list.push(days);
        else lateByCustomer.set(p.customerId, [days]);
      }

      const forecastCustomers: ForecastCustomer[] = custRows.map((c) => {
        const latenesses = lateByCustomer.get(c.id) ?? [];
        const avg =
          latenesses.length === 0
            ? 0
            : Math.round(latenesses.reduce((s, d) => s + d, 0) / latenesses.length);
        return { id: c.id, avgDaysLate: avg };
      });

      const custById = new Map(forecastCustomers.map((c) => [c.id, c]));

      const openStatuses = new Set(["sent", "part_paid", "disputed"]);
      const openInvoices = invRows.filter((i) => openStatuses.has(i.status));

      const forecastInvoices: ForecastInvoice[] = [];
      for (const inv of openInvoices) {
        const view = await getInvoiceWithTotals(inv.id, ctx.businessId, today);
        if (!view || view.outstandingPaise <= 0) continue;
        forecastInvoices.push({
          id: inv.id,
          customerId: inv.customerId,
          outstandingPaise: view.outstandingPaise,
          dueDate: inv.dueDate,
        });
      }

      const expRows = await db
        .select()
        .from(expenses)
        .where(eq(expenses.businessId, ctx.businessId));

      const forecastExpenses: ForecastExpense[] = expRows
        .filter((e) => e.dueDate && !e.paid)
        .map((e) => ({
          id: e.id,
          amountPaise: e.amountPaise,
          dueDate: e.dueDate as string,
        }));

      const baseline: ForecastInput = {
        openingCashPaise: biz.openingCashPaise,
        safetyBufferPaise: biz.safetyBufferPaise,
        invoices: forecastInvoices,
        customers: forecastCustomers,
        expenses: forecastExpenses,
        today,
        weeks: 13,
      };

      // Compute baseline BEFORE applying what-if so we can pick targets that
      // meaningfully shift the outcome.
      const baselineResult = computeForecast(baseline);

      const whatIf = req.nextUrl.searchParams.get("whatIf");
      let input = resetWhatIf(baseline);
      if (whatIf) {
        for (const part of whatIf.split(",")) {
          const [kind, ...args] = part.split(":");
          if (kind === "delayCustomer" && args.length >= 2) {
            input = delayCustomer(input, args[0]!, Number(args[1]));
          } else if (kind === "addInflow" && args.length >= 2) {
            input = addInflow(input, args[0]!, Number(args[1]));
          } else if (kind === "delayExpense" && args.length >= 2) {
            input = delayExpense(input, args[0]!, Number(args[1]));
          }
        }
      }

      const result = whatIf ? computeForecast(input) : baselineResult;
      const lowestPointPaise = result.rows.reduce(
        (min, r) => (r.closingPaise < min ? r.closingPaise : min),
        baseline.openingCashPaise,
      );

      // Invoices that could plausibly arrive by the breach week — those are
      // the ones worth chasing to close the gap.
      const gapInvoiceIds: string[] = [];
      if (result.breachWeek !== null) {
        const breachRow = result.rows[result.breachWeek - 1];
        if (breachRow) {
          for (const inv of forecastInvoices) {
            const daysLate = custById.get(inv.customerId)?.avgDaysLate ?? 0;
            const rawDue = addDays(inv.dueDate, daysLate);
            const effDue = rawDue < today ? today : rawDue;
            if (effDue <= breachRow.weekEnd) gapInvoiceIds.push(inv.id);
          }
        }
      }

      // Pick what-if targets that will actually change the outcome.
      //
      // delayCustomer: the target customer must have an invoice that currently
      // arrives before (or in) the breach week AND whose effective due moves
      // PAST the breach week when delayed 30 days. Otherwise the invoice stays
      // clamped to "today" and the forecast is identical — the toggle appears
      // broken even though the code ran.
      //
      // delayExpense: the target expense must be due at or before the breach
      // week, so pushing it out lifts the closing cash at the breach.
      const breachWeekEnd = baselineResult.breachWeek
        ? (baselineResult.rows[baselineResult.breachWeek - 1]?.weekEnd ?? null)
        : null;

      let topCustomerId: string | null = null;
      let topExpenseId: string | null = null;

      if (breachWeekEnd) {
        const customerCandidates = forecastInvoices
          .map((inv) => {
            const daysLate = custById.get(inv.customerId)?.avgDaysLate ?? 0;
            const rawDue = addDays(inv.dueDate, daysLate);
            const effDue = rawDue < today ? today : rawDue;
            const delayedRaw = addDays(inv.dueDate, daysLate + 30);
            const delayedEff = delayedRaw < today ? today : delayedRaw;
            return { inv, effDue, delayedEff };
          })
          .filter((x) => x.effDue <= breachWeekEnd && x.delayedEff > breachWeekEnd);

        if (customerCandidates.length > 0) {
          topCustomerId = customerCandidates.reduce((max, x) =>
            x.inv.outstandingPaise > max.inv.outstandingPaise ? x : max,
          ).inv.customerId;
        }

        const expenseCandidates = forecastExpenses.filter((e) => e.dueDate <= breachWeekEnd);
        if (expenseCandidates.length > 0) {
          topExpenseId = expenseCandidates.reduce((max, e) =>
            e.amountPaise > max.amountPaise ? e : max,
          ).id;
        }
      }

      return NextResponse.json({
        data: {
          rows: result.rows,
          breachWeek: result.breachWeek,
          gapPaise: result.gapPaise,
          openingCashPaise: baseline.openingCashPaise,
          safetyBufferPaise: baseline.safetyBufferPaise,
          lowestPointPaise,
          gapInvoiceIds,
          whatIfTargets: { topCustomerId, topExpenseId },
        },
      });
    },
    ["owner", "accountant"],
  );
}

import { addDays, wholeDaysBetween } from "@/lib/domain/dates";
import { computeAgeing, type AgeingBucket } from "./ageing";
import type { RankedChase } from "@/lib/domain/priority";

export type DashboardInvoice = {
  id: string;
  customerId: string;
  dueDate: string;
  outstandingPaise: number;
};

export type DashboardCustomer = {
  id: string;
  avgDaysLate: number;
};

export type DashboardExpense = {
  dueDate: string | null;
  amountPaise: number;
  paid: boolean;
};

export type DashboardInput = {
  today: string;
  openingCashPaise: number;
  safetyBufferPaise: number;
  invoices: DashboardInvoice[]; // open only
  customers: DashboardCustomer[];
  expenses: DashboardExpense[];
  forecast: { breachWeek: number | null; lowestPointPaise: number };
  chase: RankedChase[];
};

export type DashboardResult = {
  totalOutstandingPaise: number;
  overduePaise: number;
  overdueCount: number;
  oldestOverdueDays: number;
  expectedThisWeekPaise: number;
  expectedThisMonthPaise: number;
  billsDue30dPaise: number;
  cashInBankPaise: number;
  lowestPointPaise: number;
  breachWeek: number | null;
  bufferWarning: boolean;
  ageing: AgeingBucket[];
  chase: RankedChase[];
};

/** Pure selector. Never stored; recomputed on every render per spec §3.3. */
export function computeDashboard(input: DashboardInput): DashboardResult {
  const { today, invoices, expenses, forecast, chase } = input;
  const customerMap = new Map(input.customers.map((c) => [c.id, c]));
  const weekEnd = addDays(today, 6);
  const monthEnd = addDays(today, 29);

  let totalOutstandingPaise = 0;
  let overduePaise = 0;
  let overdueCount = 0;
  let oldestOverdueDays = 0;
  let expectedThisWeekPaise = 0;
  let expectedThisMonthPaise = 0;

  for (const inv of invoices) {
    totalOutstandingPaise += inv.outstandingPaise;

    const days = wholeDaysBetween(inv.dueDate, today);
    if (days > 0) {
      overduePaise += inv.outstandingPaise;
      overdueCount += 1;
      if (days > oldestOverdueDays) oldestOverdueDays = days;
    }

    const cust = customerMap.get(inv.customerId);
    const daysLate = cust?.avgDaysLate ?? 0;
    const effDue = addDays(inv.dueDate, daysLate);
    const clamped = effDue < today ? today : effDue;
    if (clamped >= today && clamped <= weekEnd) {
      expectedThisWeekPaise += inv.outstandingPaise;
    }
    if (clamped >= today && clamped <= monthEnd) {
      expectedThisMonthPaise += inv.outstandingPaise;
    }
  }

  let billsDue30dPaise = 0;
  for (const e of expenses) {
    if (e.paid || !e.dueDate) continue;
    if (e.dueDate >= today && e.dueDate <= monthEnd) {
      billsDue30dPaise += e.amountPaise;
    }
  }

  return {
    totalOutstandingPaise,
    overduePaise,
    overdueCount,
    oldestOverdueDays,
    expectedThisWeekPaise,
    expectedThisMonthPaise,
    billsDue30dPaise,
    cashInBankPaise: input.openingCashPaise,
    lowestPointPaise: forecast.lowestPointPaise,
    breachWeek: forecast.breachWeek,
    bufferWarning: forecast.breachWeek !== null,
    ageing: computeAgeing(invoices, today),
    chase,
  };
}

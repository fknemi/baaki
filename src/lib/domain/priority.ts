import { config } from "./config";
import { wholeDaysBetween } from "./dates";

export type InvoiceForPriority = {
  id: string;
  customerId: string;
  amountPaise: number;
  dueDate: string;
};

export type CustomerForPriority = {
  id: string;
  name: string;
  avgDaysLate: number;
  pctOnTime: number;
};

export type ForecastGapInfo = {
  gapInvoiceIds: Set<string>;
};

export type RankedChase = {
  invoiceId: string;
  customerName: string;
  amountPaise: number;
  daysOverdue: number;
  score: number;
  reason: string;
};

export function rankChase(
  invoices: InvoiceForPriority[],
  customers: CustomerForPriority[],
  today: string,
  gapInfo: ForecastGapInfo = { gapInvoiceIds: new Set() },
  topN: number = 5,
): RankedChase[] {
  if (invoices.length === 0) return [];

  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const maxAmount = Math.max(1, ...invoices.map((i) => i.amountPaise));
  const maxAge = Math.max(
    1,
    ...invoices.map((i) => Math.max(0, wholeDaysBetween(i.dueDate, today))),
  );

  const w = config.priorityWeights;

  const scored = invoices.map((inv) => {
    const cust = customerMap.get(inv.customerId);
    const daysOverdue = Math.max(0, wholeDaysBetween(inv.dueDate, today));

    const amountNorm = inv.amountPaise / maxAmount;
    const ageNorm = daysOverdue / maxAge;
    const reliabilityNorm = 1 - (cust?.pctOnTime ?? 0) / 100;
    const gapNorm = gapInfo.gapInvoiceIds.has(inv.id) ? 1 : 0;

    const score =
      w.amount * amountNorm + w.age * ageNorm + w.reliability * reliabilityNorm + w.gap * gapNorm;

    return {
      invoiceId: inv.id,
      customerName: cust?.name ?? "Unknown",
      amountPaise: inv.amountPaise,
      daysOverdue,
      score: Math.round(score * 100),
      customerAvgLate: cust?.avgDaysLate ?? 0,
      gapHelp: gapInfo.gapInvoiceIds.has(inv.id),
    };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.amountPaise !== a.amountPaise) return b.amountPaise - a.amountPaise;
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return a.invoiceId.localeCompare(b.invoiceId);
  });

  return scored.slice(0, topN).map((r) => {
    const amtText = `₹${(r.amountPaise / 100).toFixed(0)} outstanding (amount factor)`;
    const ageText =
      r.daysOverdue > 0 ? `${r.daysOverdue} days overdue (age factor)` : `not yet due (age factor)`;
    const relText = `pays ${r.customerAvgLate} days late on average (reliability factor)`;
    const gapText = r.gapHelp
      ? `chasing now protects the cash buffer (gap-help factor)`
      : `does not close the cash gap (gap-help factor)`;

    return {
      invoiceId: r.invoiceId,
      customerName: r.customerName,
      amountPaise: r.amountPaise,
      daysOverdue: r.daysOverdue,
      score: r.score,
      reason: `${amtText}. ${ageText}. ${relText}. ${gapText}.`,
    };
  });
}

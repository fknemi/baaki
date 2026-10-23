import { addDays } from "./dates";

export type ForecastInvoice = {
  id: string;
  customerId: string;
  outstandingPaise: number;
  dueDate: string;
};

export type ForecastCustomer = {
  id: string;
  avgDaysLate: number;
};

export type ForecastExpense = {
  id: string;
  amountPaise: number;
  dueDate: string;
};

export type ForecastInput = {
  openingCashPaise: number;
  safetyBufferPaise: number;
  invoices: ForecastInvoice[];
  customers: ForecastCustomer[];
  expenses: ForecastExpense[];
  today: string;
  weeks?: number;
};

export type ForecastRow = {
  week: number;
  weekStart: string;
  weekEnd: string;
  openingPaise: number;
  inflowPaise: number;
  outflowPaise: number;
  closingPaise: number;
};

export type ForecastResult = {
  rows: ForecastRow[];
  breachWeek: number | null;
  gapPaise: number;
};

export function computeForecast(input: ForecastInput): ForecastResult {
  const weeks = input.weeks ?? 13;
  const customerMap = new Map(input.customers.map((c) => [c.id, c]));

  const effectiveInvoices = input.invoices.map((inv) => {
    const cust = customerMap.get(inv.customerId);
    return {
      ...inv,
      effectiveDue: addDays(inv.dueDate, cust?.avgDaysLate ?? 0),
    };
  });

  const rows: ForecastRow[] = [];
  let opening = input.openingCashPaise;
  let breachWeek: number | null = null;
  let worstClosing = opening;

  for (let w = 1; w <= weeks; w++) {
    const weekStart = addDays(input.today, (w - 1) * 7);
    const weekEnd = addDays(weekStart, 6);

    const inflow = effectiveInvoices
      .filter((inv) => inv.effectiveDue >= weekStart && inv.effectiveDue <= weekEnd)
      .reduce((s, inv) => s + inv.outstandingPaise, 0);

    const outflow = input.expenses
      .filter((e) => e.dueDate >= weekStart && e.dueDate <= weekEnd)
      .reduce((s, e) => s + e.amountPaise, 0);

    const closing = opening + inflow - outflow;

    rows.push({
      week: w,
      weekStart,
      weekEnd,
      openingPaise: opening,
      inflowPaise: inflow,
      outflowPaise: outflow,
      closingPaise: closing,
    });

    if (breachWeek === null && closing < input.safetyBufferPaise) {
      breachWeek = w;
    }
    if (closing < worstClosing) worstClosing = closing;
    opening = closing;
  }

  const gapPaise = breachWeek !== null
    ? Math.max(0, input.safetyBufferPaise - worstClosing)
    : 0;

  return { rows, breachWeek, gapPaise };
}

/** Pure input transform: delay a customer by N days. */
export function delayCustomer(
  input: ForecastInput,
  customerId: string,
  days: number,
): ForecastInput {
  return {
    ...input,
    customers: input.customers.map((c) =>
      c.id === customerId ? { ...c, avgDaysLate: c.avgDaysLate + days } : c,
    ),
  };
}

/** Pure input transform: add a one-off inflow. */
export function addInflow(
  input: ForecastInput,
  dueDate: string,
  amountPaise: number,
): ForecastInput {
  return {
    ...input,
    invoices: [
      ...input.invoices,
      { id: "what-if-inflow", customerId: "what-if-customer", outstandingPaise: amountPaise, dueDate },
    ],
  };
}

/** Pure input transform: delay an expense by N days. */
export function delayExpense(
  input: ForecastInput,
  expenseId: string,
  days: number,
): ForecastInput {
  return {
    ...input,
    expenses: input.expenses.map((e) =>
      e.id === expenseId ? { ...e, dueDate: addDays(e.dueDate, days) } : e,
    ),
  };
}

/** Reset returns a deep-equal baseline. */
export function resetWhatIf(baseline: ForecastInput): ForecastInput {
  return {
    ...baseline,
    invoices: baseline.invoices.map((i) => ({ ...i })),
    customers: baseline.customers.map((c) => ({ ...c })),
    expenses: baseline.expenses.map((e) => ({ ...e })),
  };
}

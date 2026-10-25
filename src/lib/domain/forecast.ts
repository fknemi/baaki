import { addDays, currentPeriodKey } from "./dates";
import type { expenses } from "@/lib/db/schema";

type ExpenseRow = typeof expenses.$inferSelect;

// ─── input shapes ────────────────────────────────────────────────────────────

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

// ─── helpers ─────────────────────────────────────────────────────────────────

function normDate(d: string | Date | null | undefined): string {
    if (!d) return "";
    if (typeof d === "string") return d.length > 10 ? d.slice(0, 10) : d;
    // Local getters, not toISOString(): the latter converts to UTC and
    // drops a day in IST, which is what caused the "Nov 5 shows as Nov 4"
    // bug on the expense page.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
}

// ─── core forecast ───────────────────────────────────────────────────────────

export function computeForecast(input: ForecastInput): ForecastResult {
    const weeks = input.weeks ?? 13;
    const today = normDate(input.today as unknown as string | Date);
    const customerMap = new Map(input.customers.map((c) => [c.id, c]));

    const effectiveInvoices = input.invoices.map((inv) => {
        const cust = customerMap.get(inv.customerId);

        const rawDue = normDate(
            addDays(
                normDate(inv.dueDate as unknown as string | Date),
                cust?.avgDaysLate ?? 0,
            ) as unknown as string | Date,
        );
        const effectiveDue = rawDue < today ? today : rawDue;
        return { ...inv, effectiveDue };
    });

    const normExpenses = input.expenses.map((e) => ({
        ...e,
        dueDate: normDate(e.dueDate as unknown as string | Date),
    }));

    const rows: ForecastRow[] = [];
    let opening = input.openingCashPaise;
    let breachWeek: number | null = null;
    let worstClosing = opening;

    for (let w = 1; w <= weeks; w++) {
        const weekStart = normDate(addDays(today, (w - 1) * 7) as unknown as string | Date);
        const weekEnd = normDate(addDays(today, w * 7 - 1) as unknown as string | Date);

        const inflow = effectiveInvoices
            .filter((inv) => inv.effectiveDue >= weekStart && inv.effectiveDue <= weekEnd)
            .reduce((s, inv) => s + inv.outstandingPaise, 0);

        const outflow = normExpenses
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

    const gapPaise = breachWeek !== null ? Math.max(0, input.safetyBufferPaise - worstClosing) : 0;

    return { rows, breachWeek, gapPaise };
}

// ─── what-if transforms ──────────────────────────────────────────────────────

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
            {
                id: "what-if-inflow",
                customerId: "what-if-customer",
                outstandingPaise: amountPaise,
                dueDate,
            },
        ],
    };
}

/**
 * Pure input transform: delay a single expense occurrence by N days.
 *
 * `expenseId` here is the *occurrence* id produced by
 * projectExpenseOccurrences (format: `<rowId>@<YYYY-MM-DD>`), not the raw
 * expenses.id. That way "delay biggest supplier payment 14 days" nudges
 * exactly one payment of a recurring bill, not every future month of it.
 */
export function delayExpense(input: ForecastInput, expenseId: string, days: number): ForecastInput {
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

// ─── recurring-expense projection ────────────────────────────────────────────

export type ExpenseOccurrence = {
    /** occurrence-unique: `<expenseId>@<YYYY-MM-DD>` */
    id: string;
    /** parent expenses.id */
    expenseId: string;
    /** ISO date YYYY-MM-DD */
    date: string;
    amountPaise: number;
};

/**
 * Project the future cash outflows from a single expense across a horizon.
 *
 * - once-off + paid → no occurrences (already out of bank)
 * - once-off + unpaid → one occurrence iff dueDate ≤ horizonEnd (past-due
 *   but unpaid still counts — it's still owed)
 * - recurring → one occurrence per period inside the horizon, EXCEPT the
 *   current period is skipped when it's already marked paid
 *   (`lastPaidPeriod === currentPeriodKey(today)`). Future periods are
 *   always emitted — being paid this month does not cancel next month's
 *   bill.
 *
 * Each occurrence carries a stable `id` (`<rowId>@<date>`) so what-if
 * transforms can target one payment, and duplicate-occurrence generation
 * is naturally deduped if the caller ever merges results.
 */
export function projectExpenseOccurrences(
    e: ExpenseRow,
    horizonStart: string, // YYYY-MM-DD inclusive
    horizonEnd: string,   // YYYY-MM-DD inclusive
    today: string,        // YYYY-MM-DD, used for "is the current period paid?"
): ExpenseOccurrence[] {
    // ── once-off ──
    if (e.recurrence === "once") {
        if (e.paid) return [];
        if (!e.dueDate) return [];
        if (e.dueDate < horizonStart || e.dueDate > horizonEnd) return [];
        return [
            {
                id: `${e.id}@${e.dueDate}`,
                expenseId: e.id,
                date: e.dueDate,
                amountPaise: e.amountPaise,
            },
        ];
    }

    // ── recurring ──
    const dom = e.dayOfMonth ?? 1;
    const start = new Date(`${horizonStart}T00:00:00`);
    const end = new Date(`${horizonEnd}T00:00:00`);
    const todayDate = new Date(`${today}T00:00:00`);
    const currentKey = currentPeriodKey(e.recurrence, todayDate);
    const currentPaid = currentKey !== null && e.lastPaidPeriod === currentKey;

    const out: ExpenseOccurrence[] = [];

    const pushOccurrence = (d: Date) => {
        if (d < start || d > end) return;
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const periodKey = currentPeriodKey(e.recurrence, d);
        const isCurrentPeriod = periodKey === currentKey;
        if (isCurrentPeriod && currentPaid) return; // already paid this cycle
        out.push({
            id: `${e.id}@${iso}`,
            expenseId: e.id,
            date: iso,
            amountPaise: e.amountPaise,
        });
    };

    if (e.recurrence === "monthly") {
        const cursor = new Date(start.getFullYear(), start.getMonth(), dom);
        while (cursor <= end) {
            pushOccurrence(new Date(cursor));
            cursor.setMonth(cursor.getMonth() + 1);
        }
    } else if (e.recurrence === "quarterly") {
        const cursor = new Date(start.getFullYear(), start.getMonth(), dom);
        while (cursor <= end) {
            pushOccurrence(new Date(cursor));
            cursor.setMonth(cursor.getMonth() + 3);
        }
    } else if (e.recurrence === "yearly") {
        const cursor = new Date(start.getFullYear(), start.getMonth(), dom);
        while (cursor <= end) {
            pushOccurrence(new Date(cursor));
            cursor.setFullYear(cursor.getFullYear() + 1);
        }
    }

    return out;
}

import { describe, it, expect } from "vitest";
import type { ForecastInput } from "../forecast";
import { computeForecast, delayCustomer, addInflow, delayExpense, resetWhatIf } from "../forecast";

const baseInput: ForecastInput = {
    openingCashPaise: 85_000_000,
    safetyBufferPaise: 30_000_000,
    today: "2026-11-01",
    invoices: [
        { id: "i1", customerId: "c1", outstandingPaise: 11_800_000, dueDate: "2026-11-05" },
        { id: "i2", customerId: "c2", outstandingPaise: 8_650_000, dueDate: "2026-11-12" },
        { id: "i3", customerId: "c3", outstandingPaise: 5_400_000, dueDate: "2026-11-20" },
    ],
    customers: [
        { id: "c1", avgDaysLate: 4 },
        { id: "c2", avgDaysLate: 12 },
        { id: "c3", avgDaysLate: 18 },
    ],
    expenses: [
        { id: "e1", amountPaise: 48_000_000, dueDate: "2026-11-01" },
        { id: "e2", amountPaise: 8_500_000, dueDate: "2026-11-05" },
        { id: "e3", amountPaise: 60_000_000, dueDate: "2026-11-28" },
    ],
};

describe("computeForecast", () => {
    it("produces 13 rows by default", () => {
        expect(computeForecast(baseInput).rows).toHaveLength(13);
    });

    it("closing = opening + in − out on every week", () => {
        const { rows } = computeForecast(baseInput);
        for (const r of rows) {
            expect(r.closingPaise).toBe(r.openingPaise + r.inflowPaise - r.outflowPaise);
        }
    });

    it("opening_next = closing_prev on every week", () => {
        const { rows } = computeForecast(baseInput);
        for (let i = 1; i < rows.length; i++) {
            expect(rows[i]!.openingPaise).toBe(rows[i - 1]!.closingPaise);
        }
    });

    it("effective due shifts by avg days late", () => {
        const { rows } = computeForecast(baseInput);
        // i1 due 2026-11-05, c1 pays 4 days late → effective 2026-11-09 (week 2)
        const totalInflow = rows.reduce((s, r) => s + r.inflowPaise, 0);
        expect(totalInflow).toBe(11_800_000 + 8_650_000 + 5_400_000);
    });

    it("detects breach week when closing dips below buffer", () => {
        const { breachWeek } = computeForecast(baseInput);
        expect(breachWeek).not.toBeNull();
    });

    it("invariants hold across 100 random inputs", () => {
        for (let trial = 0; trial < 100; trial++) {
            const input: ForecastInput = {
                ...baseInput,
                openingCashPaise: Math.floor(Math.random() * 100_000_000),
                invoices: baseInput.invoices.map((i) => ({
                    ...i,
                    outstandingPaise: Math.floor(Math.random() * 20_000_000),
                })),
            };
            const { rows } = computeForecast(input);
            for (const r of rows) {
                expect(r.closingPaise).toBe(r.openingPaise + r.inflowPaise - r.outflowPaise);
            }
            for (let i = 1; i < rows.length; i++) {
                expect(rows[i]!.openingPaise).toBe(rows[i - 1]!.closingPaise);
            }
        }
    });

    it("what-if is a pure transform — reset returns identical baseline", () => {
        const baseline = computeForecast(baseInput);
        const shifted = computeForecast(delayCustomer(baseInput, "c1", 30));
        const reset = computeForecast(resetWhatIf(baseInput));
        expect(reset.rows).toEqual(baseline.rows);
        expect(shifted.rows).not.toEqual(baseline.rows);
    });

    it("addInflow injects a receipt", () => {
        const withInflow = addInflow(baseInput, "2026-11-15", 10_000_000);
        expect(withInflow.invoices.length).toBe(baseInput.invoices.length + 1);
        const modified = computeForecast(withInflow);
        const baseline = computeForecast(baseInput);
        expect(modified.rows).not.toEqual(baseline.rows);
    });

    it("delayExpense shifts an outflow", () => {
        const delayed = delayExpense(baseInput, "e3", 14);
        const modified = computeForecast(delayed);
        const baseline = computeForecast(baseInput);
        expect(modified.rows).not.toEqual(baseline.rows);
    });

    it("invoice from 20-day-late customer lands 20 days after due", () => {
  const input: ForecastInput = {
    ...baseInput,
    today: "2026-11-01",
    invoices: [
      { id: "ix", customerId: "cx", outstandingPaise: 1_000_000, dueDate: "2026-11-01" },
    ],
    customers: [{ id: "cx", avgDaysLate: 20 }],
    expenses: [],
  };
  const { rows } = computeForecast(input);
  // 2026-11-01 + 20 days = 2026-11-21. Week 1 = 11-01→11-07, ..., week 4 = 11-22→11-28.
  // 11-21 is in week 3 (11-15→11-21).
  const week3 = rows[2]!;
  expect(week3.inflowPaise).toBe(1_000_000);
  expect(rows[0]!.inflowPaise).toBe(0);
  expect(rows[1]!.inflowPaise).toBe(0);
});
});

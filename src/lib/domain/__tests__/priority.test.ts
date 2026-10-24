import { describe, it, expect } from "vitest";
import { rankChase } from "../priority";
import type { InvoiceForPriority, CustomerForPriority } from "../priority";

const today = "2026-11-15";

const customers: CustomerForPriority[] = [
  { id: "c1", name: "Krishna Traders", avgDaysLate: 4, pctOnTime: 92 },
  { id: "c2", name: "Patel Brothers", avgDaysLate: 12, pctOnTime: 68 },
  { id: "c3", name: "Sunrise Agencies", avgDaysLate: 18, pctOnTime: 40 },
];

const invoices: InvoiceForPriority[] = [
  { id: "i1", customerId: "c1", amountPaise: 11_800_000, dueDate: "2026-11-01" },
  { id: "i2", customerId: "c2", amountPaise: 8_650_000, dueDate: "2026-10-24" },
  { id: "i3", customerId: "c3", amountPaise: 5_400_000, dueDate: "2026-10-01" },
];

describe("rankChase", () => {
  it("returns empty for no invoices", () => {
    expect(rankChase([], customers, today)).toEqual([]);
  });

  it("returns at most topN", () => {
    expect(rankChase(invoices, customers, today, undefined, 2).length).toBe(2);
  });

  it("ranking stable across 100 shuffles", () => {
    const baseline = rankChase(invoices, customers, today).map((r) => r.invoiceId);
    for (let i = 0; i < 100; i++) {
      const shuffled = [...invoices].sort(() => Math.random() - 0.5);
      const ranked = rankChase(shuffled, customers, today).map((r) => r.invoiceId);
      expect(ranked).toEqual(baseline);
    }
  });

  it("every reason contains all four factor clauses", () => {
    const ranked = rankChase(invoices, customers, today);
    for (const r of ranked) {
      expect(r.reason).toContain("amount factor");
      expect(r.reason).toContain("age factor");
      expect(r.reason).toContain("reliability factor");
      expect(r.reason).toContain("gap-help factor");
    }
  });

  it("gap-help flag boosts the invoice", () => {
    const withGap = rankChase(invoices, customers, today, { gapInvoiceIds: new Set(["i3"]) });
    const withoutGap = rankChase(invoices, customers, today);
    const i3With = withGap.find((r) => r.invoiceId === "i3")!;
    const i3Without = withoutGap.find((r) => r.invoiceId === "i3")!;
    expect(i3With.score).toBeGreaterThan(i3Without.score);
  });

  it("not-yet-due invoice uses 'not yet due' phrasing", () => {
    const future = [{ id: "i4", customerId: "c1", amountPaise: 5_000_000, dueDate: "2026-12-01" }];
    const ranked = rankChase(future, customers, today);
    expect(ranked[0]!.daysOverdue).toBe(0);
    expect(ranked[0]!.reason).toContain("not yet due");
  });

  it("unknown customer id falls back to 'Unknown'", () => {
    const orphan = [
      { id: "i5", customerId: "ghost", amountPaise: 5_000_000, dueDate: "2026-11-01" },
    ];
    const ranked = rankChase(orphan, customers, today);
    expect(ranked[0]!.customerName).toBe("Unknown");
  });

  it("zero-amount invoice does not divide by zero", () => {
    const zero = [{ id: "i6", customerId: "c1", amountPaise: 0, dueDate: "2026-11-01" }];
    expect(() => rankChase(zero, customers, today)).not.toThrow();
  });
});

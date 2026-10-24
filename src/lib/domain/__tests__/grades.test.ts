import { describe, it, expect } from "vitest";
import { gradeCustomer } from "../grades";

describe("gradeCustomer", () => {
  it("no history → NEW", () => {
    expect(gradeCustomer([]).grade).toBe("NEW");
  });

  it("all on time, 0 avg late → A", () => {
    const h = [
      { dueOn: "2026-10-01", paidOn: "2026-10-01" },
      { dueOn: "2026-10-05", paidOn: "2026-10-04" },
      { dueOn: "2026-10-10", paidOn: "2026-10-09" },
      { dueOn: "2026-10-15", paidOn: "2026-10-15" },
      { dueOn: "2026-10-20", paidOn: "2026-10-18" },
    ];
    const r = gradeCustomer(h);
    expect(r.grade).toBe("A");
    expect(r.pctOnTime).toBe(100);
    expect(r.avgDaysLate).toBe(0);
  });

  it("80% on time, avg 2 late → B", () => {
    const h = [
      { dueOn: "2026-10-01", paidOn: "2026-10-01" },
      { dueOn: "2026-10-02", paidOn: "2026-10-02" },
      { dueOn: "2026-10-03", paidOn: "2026-10-03" },
      { dueOn: "2026-10-04", paidOn: "2026-10-04" },
      { dueOn: "2026-10-10", paidOn: "2026-10-20" }, // 10 late
    ];
    const r = gradeCustomer(h);
    expect(r.pctOnTime).toBe(80); // 4/5
    expect(r.avgDaysLate).toBe(2); // (0+0+0+0+10)/5
    expect(r.grade).toBe("B"); // 80 < 90 fails A; 80 >= 60 && 2 <= 15 → B
  });

  it("60% on time, avg 10 late → B", () => {
    const h = [
      { dueOn: "2026-10-01", paidOn: "2026-10-01" },
      { dueOn: "2026-10-05", paidOn: "2026-10-05" },
      { dueOn: "2026-10-10", paidOn: "2026-10-10" },
      { dueOn: "2026-10-15", paidOn: "2026-10-25" },
      { dueOn: "2026-10-20", paidOn: "2026-10-30" },
    ];
    const r = gradeCustomer(h);
    expect(r.grade).toBe("B");
    expect(r.pctOnTime).toBe(60);
  });

  it("40% on time, avg 20 late → C", () => {
    const h = [
      { dueOn: "2026-10-01", paidOn: "2026-10-01" },
      { dueOn: "2026-10-05", paidOn: "2026-10-25" },
      { dueOn: "2026-10-10", paidOn: "2026-10-30" },
      { dueOn: "2026-10-15", paidOn: "2026-11-04" },
      { dueOn: "2026-10-20", paidOn: "2026-11-09" },
    ];
    const r = gradeCustomer(h);
    expect(r.grade).toBe("C");
  });

  it("reason string uses same numbers", () => {
    const h = [
      { dueOn: "2026-10-01", paidOn: "2026-10-01" },
      { dueOn: "2026-10-05", paidOn: "2026-10-15" },
    ];
    const r = gradeCustomer(h);
    expect(r.reason).toContain(`${r.pctOnTime}%`);
    expect(r.reason).toContain(`${r.avgDaysLate}`);
  });

  it("unpaid invoices do not count", () => {
    const h = [
      { dueOn: "2026-10-01", paidOn: "2026-10-01" },
      { dueOn: "2026-10-05", paidOn: null },
      { dueOn: "2026-10-10", paidOn: null },
    ];
    const r = gradeCustomer(h);
    expect(r.pctOnTime).toBe(100); // only 1 paid, 1 on time
  });
});

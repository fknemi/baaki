import { describe, it, expect } from "vitest";
import { msmedInterest } from "../msmed";

const micro = { udyamRegistered: true, udyamType: "micro" as const };
const small = { udyamRegistered: true, udyamType: "small" as const };
const medium = { udyamRegistered: true, udyamType: "medium" as const };
const unregistered = { udyamRegistered: false };

describe("msmedInterest", () => {
  it("worked example: ₹1,00,000 at 6.5% for 90 days", () => {
    const r = msmedInterest(10_000_000, 90, 6.5, micro);
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      // P × ((1.01625)^3 − 1) = 495,464.78 paise → rounds to 495,465
      expect(r.interestPaise).toBe(495_465);
      expect(r.months).toBe(3);
    }
  });

  it("30 days = 1 month", () => {
    const r = msmedInterest(10_000_000, 30, 6.5, micro);
    expect(r.applicable).toBe(true);
    if (r.applicable) {
      // 10,000,000 × 0.01625 = 162,500 paise = ₹1,625
      expect(r.interestPaise).toBe(162_500);
      expect(r.months).toBe(1);
    }
  });

  it("45 days = 2 months (ceil)", () => {
    const r = msmedInterest(10_000_000, 45, 6.5, small);
    expect(r.applicable).toBe(true);
    if (r.applicable) expect(r.months).toBe(2);
  });

  it("applies to micro and small", () => {
    expect(msmedInterest(1_000_000, 30, 6.5, micro).applicable).toBe(true);
    expect(msmedInterest(1_000_000, 30, 6.5, small).applicable).toBe(true);
  });

  it("does NOT apply to medium", () => {
    expect(msmedInterest(1_000_000, 30, 6.5, medium).applicable).toBe(false);
  });

  it("does NOT apply to unregistered", () => {
    expect(msmedInterest(1_000_000, 30, 6.5, unregistered).applicable).toBe(false);
  });

  it("does NOT apply when not yet overdue", () => {
    expect(msmedInterest(1_000_000, 0, 6.5, micro).applicable).toBe(false);
    expect(msmedInterest(1_000_000, -5, 6.5, micro).applicable).toBe(false);
  });

  it("formulaNote includes the numbers", () => {
    const r = msmedInterest(10_000_000, 90, 6.5, micro);
    if (r.applicable) {
      expect(r.formulaNote).toContain("6.5%");
      expect(r.formulaNote).toContain("^3");
    }
  });
});

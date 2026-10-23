import { describe, it, expect } from "vitest";
import { computeTotals } from "../gst";

const biz = { stateCode: "27", registrationType: "regular" as const };
const bizComposition = { stateCode: "27", registrationType: "composition" as const };
const custSame = { stateCode: "27" };
const custOther = { stateCode: "24" };

describe("computeTotals — §7.2 vectors", () => {
  it("Vector 1: ₹10,000 @ 18% intra-state", () => {
    const r = computeTotals(
      [{ qty: 1, ratePaise: 10_00_000, discountPaise: 0, gstRatePct: 18 }],
      biz,
      custSame,
    );
    expect(r.taxablePaise).toBe(10_00_000);
    expect(r.cgstPaise).toBe(90_000);
    expect(r.sgstPaise).toBe(90_000);
    expect(r.igstPaise).toBe(0);
    expect(r.totalPaise).toBe(11_80_000);
    expect(r.isInterState).toBe(false);
  });

  it("Vector 2: ₹10,000 @ 18% inter-state", () => {
    const r = computeTotals(
      [{ qty: 1, ratePaise: 10_00_000, discountPaise: 0, gstRatePct: 18 }],
      biz,
      custOther,
    );
    expect(r.taxablePaise).toBe(10_00_000);
    expect(r.cgstPaise).toBe(0);
    expect(r.sgstPaise).toBe(0);
    expect(r.igstPaise).toBe(1_80_000);
    expect(r.totalPaise).toBe(11_80_000);
    expect(r.isInterState).toBe(true);
  });

  it("Vector 3: 3 × ₹333 @ 5% intra-state — rounding", () => {
    const r = computeTotals(
      [{ qty: 3, ratePaise: 33_300, discountPaise: 0, gstRatePct: 5 }],
      biz,
      custSame,
    );
    // 3 × 333 = 999 rupees = 99,900 paise
    // 5% = 2,497.5 → rounded independently to 2,498 for CGST and SGST
    expect(r.taxablePaise).toBe(99_900);
    expect(r.cgstPaise).toBe(2_498);
    expect(r.sgstPaise).toBe(2_498);
    // Gross = 99,900 + 2,498 + 2,498 = 104,896
    // Round per §170: 104,896 → 104,900 (round to rupee, 96 paise is > 50)
    expect(r.grossPaise).toBe(104_896);
    expect(r.totalPaise).toBe(104_900);
    expect(r.roundOffPaise).toBe(4);
  });

  it("Vector 4: ₹1,000 − 10% @ 18% intra-state", () => {
    const r = computeTotals(
      [{ qty: 1, ratePaise: 1_00_000, discountPaise: 10_000, gstRatePct: 18 }],
      biz,
      custSame,
    );
    expect(r.taxablePaise).toBe(90_000);
    expect(r.cgstPaise).toBe(8_100);
    expect(r.sgstPaise).toBe(8_100);
    expect(r.totalPaise).toBe(1_06_200);
  });

  it("Vector 5: composition — no tax lines", () => {
    const r = computeTotals(
      [{ qty: 1, ratePaise: 10_00_000, discountPaise: 0, gstRatePct: 18 }],
      bizComposition,
      custSame,
    );
    expect(r.taxablePaise).toBe(10_00_000);
    expect(r.cgstPaise).toBe(0);
    expect(r.sgstPaise).toBe(0);
    expect(r.igstPaise).toBe(0);
    expect(r.totalPaise).toBe(10_00_000);
    expect(r.hasTax).toBe(false);
  });

  it("Vector 6: ₹500 @ 0% zero-rated", () => {
    const r = computeTotals(
      [{ qty: 1, ratePaise: 50_000, discountPaise: 0, gstRatePct: 0 }],
      biz,
      custSame,
    );
    expect(r.cgstPaise).toBe(0);
    expect(r.sgstPaise).toBe(0);
    expect(r.totalPaise).toBe(50_000);
  });
});

describe("computeTotals — §2.6 rounding edge cases", () => {
  it("₹11,799.49 → ₹11,799 (49 paise ignored)", () => {
    // Construct an invoice whose gross is exactly 1,179,949 paise
    // taxable = 1,000,000 paise, CGST 9% = 90,000, SGST 9% = 90,000, gross = 1,180,000
    // Need to get to 1,179,949 — use a different rate
    // Easier: 999,957 taxable @ 18%: cgst=round(999957*0.09)=89,996, sgst=89,996, gross=1,179,949
    const r = computeTotals(
      [{ qty: 1, ratePaise: 9_99_957, discountPaise: 0, gstRatePct: 18 }],
      biz,
      custSame,
    );
    expect(r.grossPaise).toBe(11_79_949);
    expect(r.totalPaise).toBe(11_79_900);
  });

  it("₹11,799.50 → ₹11,800 (exactly 50 paise rounds up)", () => {
    const r = computeTotals(
      [{ qty: 1, ratePaise: 9_99_958, discountPaise: 0, gstRatePct: 18 }],
      biz,
      custSame,
    );
    expect(r.grossPaise).toBe(11_79_950);
    expect(r.totalPaise).toBe(11_80_000);
  });
});

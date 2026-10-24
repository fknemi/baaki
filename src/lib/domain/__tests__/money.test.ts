import { describe, it, expect } from "vitest";
import {
  toPaise,
  parseRupeeInput,
  formatINR,
  sumPaise,
  assertPaise,
  isPaise,
  roundToRupee,
} from "../money";

describe("toPaise", () => {
  it("converts rupees to integer paise", () => {
    expect(toPaise(1234.56)).toBe(123456);
    expect(toPaise(1234)).toBe(123400);
    expect(toPaise(0)).toBe(0);
    expect(toPaise(0.05)).toBe(5);
  });
  it("throws on non-finite", () => {
    expect(() => toPaise(NaN)).toThrow(TypeError);
    expect(() => toPaise(Infinity)).toThrow(TypeError);
  });
});

describe("parseRupeeInput", () => {
  it("parses strictly, without float drift", () => {
    expect(parseRupeeInput("1234.56")).toBe(123456);
    expect(parseRupeeInput("1234")).toBe(123400);
    expect(parseRupeeInput("0.05")).toBe(5);
    expect(parseRupeeInput("12.3")).toBe(1230);
    expect(parseRupeeInput("0")).toBe(0);
    expect(parseRupeeInput(" 42 ")).toBe(4200);
  });
  it("rejects malformed", () => {
    expect(() => parseRupeeInput("12.345")).toThrow();
    expect(() => parseRupeeInput("-12")).toThrow();
    expect(() => parseRupeeInput("1,234.56")).toThrow();
    expect(() => parseRupeeInput("")).toThrow();
    expect(() => parseRupeeInput("1234567890")).toThrow();
  });
});

describe("formatINR", () => {
  it("formats with Indian grouping", () => {
    expect(formatINR(118000000)).toMatch(/11,?80,?000/);
    expect(formatINR(0)).toMatch(/₹|INR/);
  });
});

describe("sumPaise", () => {
  it("sums cleanly", () => {
    expect(sumPaise([100, 200, 300])).toBe(600);
    expect(sumPaise([])).toBe(0);
  });
  it("rejects non-integers", () => {
    expect(() => sumPaise([100, 0.5])).toThrow();
  });
});

describe("assertPaise / isPaise", () => {
  it("accepts non-negative integers", () => {
    expect(() => assertPaise(0)).not.toThrow();
    expect(() => assertPaise(100)).not.toThrow();
    expect(isPaise(42)).toBe(true);
  });
  it("rejects negatives and floats", () => {
    expect(() => assertPaise(-1)).toThrow();
    expect(() => assertPaise(1.5)).toThrow();
    expect(isPaise("100")).toBe(false);
  });
});

describe("roundToRupee — Section 170 vectors", () => {
  it("ignores < 50 paise", () => {
    expect(roundToRupee(1179949)).toBe(1179900);
  });
  it("rounds exactly 50 paise up", () => {
    expect(roundToRupee(1179950)).toBe(1180000);
  });
  it("is identity on whole rupees", () => {
    expect(roundToRupee(1180000)).toBe(1180000);
  });
});

describe("toPaise — overflow", () => {
  it("throws RangeError when multiplying overflows", () => {
    expect(() => toPaise(1e300)).toThrow(RangeError);
  });
});

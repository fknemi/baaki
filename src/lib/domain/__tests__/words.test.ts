import { describe, it, expect } from "vitest";
import { numberToWordsIndian } from "../words";

describe("numberToWordsIndian", () => {
  it("zero", () => {
    expect(numberToWordsIndian(0)).toBe("zero rupees only");
  });
  it("small amounts", () => {
    expect(numberToWordsIndian(100)).toBe("one rupees only");
    expect(numberToWordsIndian(1_00)).toBe("one rupees only");
  });
  it("includes paise when present", () => {
    expect(numberToWordsIndian(12345)).toBe(
      "one hundred twenty three rupees and forty five paise only",
    );
  });
  it("Indian grouping", () => {
    expect(numberToWordsIndian(1_00_000_00)).toBe("one lakh rupees only");
    expect(numberToWordsIndian(1_18_000_00)).toBe("one lakh eighteen thousand rupees only");
    expect(numberToWordsIndian(11_80_000_00)).toBe("eleven lakh eighty thousand rupees only");
  });
  it("crore", () => {
    expect(numberToWordsIndian(4_20_00_000_00)).toBe("four crore twenty lakh rupees only");
  });
  it("rejects negative and non-integer", () => {
    expect(() => numberToWordsIndian(-100)).toThrow();
    expect(() => numberToWordsIndian(1.5)).toThrow();
  });
});

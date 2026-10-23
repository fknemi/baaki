import { describe, it, expect } from "vitest";
import { isValidGSTIN } from "../gstin";

const VECTOR = "27AAPFU0939F1ZV";
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

describe("isValidGSTIN", () => {
  it("accepts the CBIC reference vector", () => {
    const r = isValidGSTIN(VECTOR);
    expect(r.valid).toBe(true);
    expect(r.stateCode).toBe("27");
  });

  it("rejects every single-character mutation", () => {
    for (let i = 0; i < VECTOR.length; i++) {
      for (const c of ALPHABET) {
        if (c === VECTOR[i]) continue;
        const m = VECTOR.slice(0, i) + c + VECTOR.slice(i + 1);
        expect(isValidGSTIN(m).valid, `mut ${i} ${VECTOR}→${m}`).toBe(false);
      }
    }
  });

  it("rejects wrong length", () => {
    expect(isValidGSTIN(VECTOR.slice(0, 14)).valid).toBe(false);
    expect(isValidGSTIN(VECTOR + "X").valid).toBe(false);
  });

  it("is case-insensitive on input", () => {
    expect(isValidGSTIN(VECTOR.toLowerCase()).valid).toBe(true);
  });

  it("rejects malformed / non-string", () => {
    expect(isValidGSTIN("").valid).toBe(false);
    expect(isValidGSTIN("AAAAAAAAAAAAAAA").valid).toBe(false);
    expect(isValidGSTIN(null as unknown as string).valid).toBe(false);
  });
});

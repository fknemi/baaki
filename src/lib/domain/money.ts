const RUPEES_INPUT_RE = /^\d{1,9}(\.\d{1,2})?$/;

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Intl emits "₹1,234.56" for en-IN/INR; we want "₹ 1,234.56".
// Normalises to exactly one space (handles engines that already emit
// a narrow no-break space after the symbol).
function withRupeeSpace(formatted: string): string {
  return formatted.replace(/\u20B9\s*/, "\u20B9 ");
}

export function isPaise(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n);
}

export function assertPaise(n: unknown, label = "paise"): asserts n is number {
  if (!isPaise(n)) {
    throw new TypeError(`${label} must be integer paise, got ${String(n)}`);
  }
  if (n < 0) {
    throw new RangeError(`${label} must be non-negative, got ${n}`);
  }
}

/** The one place rupees become paise. Lint bans `* 100` outside this file. */
export function toPaise(rupees: number): number {
  if (typeof rupees !== "number" || !Number.isFinite(rupees)) {
    throw new TypeError(`toPaise: expected finite number, got ${String(rupees)}`);
  }
  const paise = Math.round(rupees * 100);
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`toPaise: overflow, got ${paise}`);
  }
  return paise;
}

/** Strict parse of a user-typed rupee string. No float drift. */
export function parseRupeeInput(input: string): number {
  if (typeof input !== "string") throw new TypeError("parseRupeeInput: expected string");
  const s = input.trim();
  if (!RUPEES_INPUT_RE.test(s)) {
    throw new RangeError(`parseRupeeInput: invalid rupee amount "${input}"`);
  }
  const [whole, frac = ""] = s.split(".");
  const paise = Number(whole! + frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`parseRupeeInput: overflow for "${input}"`);
  }
  return paise;
}

export function formatINR(paise: number): string {
  assertPaise(paise);
  return withRupeeSpace(INR.format(paise / 100));
}

export function sumPaise(values: number[]): number {
  let total = 0;
  for (const v of values) {
    assertPaise(v);
    total += v;
  }
  return total;
}

/** Section 170, CGST Act: < 50 paise ignored, >= 50 paise rounds up. */
export function roundToRupee(paise: number): number {
  assertPaise(paise);
  return Math.round(paise / 100) * 100;
}

/** Format signed paise (round-off, refunds). Accepts negatives. */
export function formatINRDelta(paise: number): string {
  if (typeof paise !== "number" || !Number.isInteger(paise)) {
    throw new TypeError(`formatINRDelta: expected integer, got ${String(paise)}`);
  }
  const sign = paise < 0 ? "\u2212" : "";
  return sign + withRupeeSpace(INR.format(Math.abs(paise) / 100));
}

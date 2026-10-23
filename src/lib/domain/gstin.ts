const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type GSTINResult = { valid: boolean; stateCode?: string };

export function isValidGSTIN(gstin: string): GSTINResult {
  if (typeof gstin !== "string") return { valid: false };
  const s = gstin.trim().toUpperCase();
  if (!GSTIN_RE.test(s)) return { valid: false };

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const factor = i % 2 === 0 ? 1 : 2;
    const product = CHARSET.indexOf(s[i]!) * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }
  const checkIndex = (36 - (sum % 36)) % 36;
  const expected = s.slice(0, 14) + CHARSET[checkIndex];
  return { valid: expected === s, stateCode: s.slice(0, 2) };
}

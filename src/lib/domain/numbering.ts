/**
 * CGST Rule 46(b): number ≤ 16 chars, unique within a financial year.
 * Baaki resets to 0001 each April by convention — not by rule.
 */
export function nextInvoiceNumber(
  fy: string,
  sequences: Record<string, number>,
): { number: string; sequence: number } {
  const current = sequences[fy] ?? 0;
  const next = current + 1;
  if (next > 9999) {
    throw new Error("BAK-INV-001: sequence exceeded 9999 for FY " + fy);
  }
  const padded = String(next).padStart(4, "0");
  const number = `INV/${fy}/${padded}`;
  if (number.length > 16) {
    throw new Error("BAK-INV-001: invoice number exceeds 16 chars: " + number);
  }
  return { number, sequence: next };
}

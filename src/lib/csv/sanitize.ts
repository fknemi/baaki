/**
 * CSV injection guard for exports (product spec §3.5).
 * A cell value starting with = + - @ \t \r can execute as a formula in Excel /
 * Sheets. Prefix with a single quote to neutralise.
 */
export function sanitizeCSVCell(value: unknown): string {
  const s = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

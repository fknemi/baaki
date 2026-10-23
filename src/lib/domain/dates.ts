/**
 * All dates are YYYY-MM-DD in IST. Pure — no Date.now().
 * Callers must pass `today` explicitly.
 */

/** Whole days between two YYYY-MM-DD strings, ignoring timezone. */
export function wholeDaysBetween(a: string, b: string): number {
  const da = utcMidnight(a);
  const db = utcMidnight(b);
  return Math.round((db - da) / 86_400_000);
}

function utcMidnight(yyyymmdd: string): number {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  if (!y || !m || !d) throw new Error(`Invalid date: ${yyyymmdd}`);
  return Date.UTC(y, m - 1, d);
}

/** Add (or subtract) whole days. Returns YYYY-MM-DD. */
export function addDays(yyyymmdd: string, days: number): string {
  const ms = utcMidnight(yyyymmdd) + days * 86_400_000;
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Today in IST — YYYY-MM-DD. Uses local time but normalises to IST. */
export function todayIST(): string {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffsetMs);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** ISO 8601 timestamp for `at_iso` fields. Caller passes today + time. */
export function atIso(today: string, hh = 10, mm = 0, ss = 0): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${today}T${pad(hh)}:${pad(mm)}:${pad(ss)}+05:30`;
}

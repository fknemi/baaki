




import type { expenses } from "@/lib/db/schema";
type ExpenseRow = typeof expenses.$inferSelect;





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

/** ISO 8601 timestamp for `at_iso` fields. Caller passes today + time. */
export function atIso(today: string, hh = 10, mm = 0, ss = 0): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${today}T${pad(hh)}:${pad(mm)}:${pad(ss)}+05:30`;
}

// Runtime demo-date override. Set via /api/admin/demo-date.
// Module-scoped so it persists across requests in the same process.
// Works in `bun dev` and single-instance deploys; serverless multi-instance
// would need per-request state (documented limitation).
let _demoDateOverride: string | null = null;

export function setDemoDateOverride(date: string | null): void {
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid demo date: ${date}`);
  }
  _demoDateOverride = date;
}

export function getDemoDateOverride(): string | null {
  return _demoDateOverride;
}

export function todayIST(): string {
  if (_demoDateOverride) return _demoDateOverride;

  const override = process.env.NEXT_PUBLIC_DEMO_TODAY;
  if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) return override;

  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffsetMs);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
















export function currentPeriodKey(
  recurrence: string,
  today: Date,
): string | null {
  if (recurrence === "once") return null;
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  if (recurrence === "monthly") return `${y}-${String(m).padStart(2, "0")}`;
  if (recurrence === "quarterly") return `${y}-Q${Math.ceil(m / 3)}`;
  if (recurrence === "yearly") return `${y}`;
  return null;
}

export function isPaidForCurrentPeriod(
  e: Pick<ExpenseRow, "recurrence" | "paid" | "lastPaidPeriod">,
  today: Date,
): boolean {
  if (e.recurrence === "once") return e.paid;
  const key = currentPeriodKey(e.recurrence, today);
  return key !== null && e.lastPaidPeriod === key;
}

/** For recurring rows the stored dueDate is static; derive the real one. */
export function effectiveDueDate(
  e: Pick<ExpenseRow, "recurrence" | "dayOfMonth" | "dueDate">,
  today: Date,
): string | null {
  if (e.recurrence === "once") return e.dueDate;
  const dom = e.dayOfMonth ?? 1;
  const y = today.getFullYear();
  const m = today.getMonth();
  const thisMonth = new Date(y, m, dom);
  const target = thisMonth > today ? thisMonth : new Date(y, m + 1, dom);
  return target.toISOString().slice(0, 10);
}

import { config } from "./config";
import { wholeDaysBetween } from "./dates";

export type PaymentHistoryEntry = {
  dueOn: string;
  paidOn: string | null;
};

export type Grade = "A" | "B" | "C" | "NEW";

export type GradeResult = {
  grade: Grade;
  pctOnTime: number;
  avgDaysLate: number;
  reason: string;
};

export function gradeCustomer(history: PaymentHistoryEntry[]): GradeResult {
  const paid = history.filter((h) => h.paidOn !== null);
  if (paid.length === 0) {
    return {
      grade: "NEW",
      pctOnTime: 0,
      avgDaysLate: 0,
      reason: "No payment history yet.",
    };
  }

  const onTime = paid.filter((h) => (h.paidOn! <= h.dueOn)).length;
  const pctOnTime = Math.round((onTime / paid.length) * 100);

  const totalLate = paid.reduce(
    (sum, h) => sum + Math.max(0, wholeDaysBetween(h.dueOn, h.paidOn!)),
    0,
  );
  const avgDaysLate = Math.round(totalLate / paid.length);

  const A = config.gradeThresholds.A;
  const B = config.gradeThresholds.B;

  let grade: Grade;
  if (pctOnTime >= A.pct && avgDaysLate <= A.maxLate) grade = "A";
  else if (pctOnTime >= B.pct && avgDaysLate <= B.maxLate) grade = "B";
  else grade = "C";

  const dayWord = avgDaysLate === 1 ? "day" : "days";
  const reason = `Pays ${pctOnTime}% on time, average ${avgDaysLate} ${dayWord} late.`;

  return { grade, pctOnTime, avgDaysLate, reason };
}

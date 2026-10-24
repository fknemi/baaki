import { wholeDaysBetween } from "@/lib/domain/dates";

export type AgeingBucketKey = "not-due" | "d1-30" | "d31-60" | "d61-90" | "d90+";

export type AgeingBucket = {
  key: AgeingBucketKey;
  label: string;
  paise: number;
  count: number;
};

export type AgeingInput = {
  dueDate: string;
  outstandingPaise: number;
};

/** Five buckets per spec §4.5. Sums to the overdue total for overdue buckets. */
export function computeAgeing(
  invoices: AgeingInput[],
  today: string,
): AgeingBucket[] {
  const buckets: AgeingBucket[] = [
    { key: "not-due", label: "Not due", paise: 0, count: 0 },
    { key: "d1-30", label: "1-30", paise: 0, count: 0 },
    { key: "d31-60", label: "31-60", paise: 0, count: 0 },
    { key: "d61-90", label: "61-90", paise: 0, count: 0 },
    { key: "d90+", label: "90+", paise: 0, count: 0 },
  ];

  for (const inv of invoices) {
    if (inv.outstandingPaise <= 0) continue;
    const days = wholeDaysBetween(inv.dueDate, today);
    let idx: number;
    if (days <= 0) idx = 0;
    else if (days <= 30) idx = 1;
    else if (days <= 60) idx = 2;
    else if (days <= 90) idx = 3;
    else idx = 4;
    buckets[idx]!.paise += inv.outstandingPaise;
    buckets[idx]!.count += 1;
  }
  return buckets;
}

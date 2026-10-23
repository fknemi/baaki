export const config = {
  gstRatesPct: [0, 5, 18, 3, 40] as const,
  gstNote: "Check current rates on cbic-gst.gov.in",
  tdsCandidateShortfallsPct: [1, 2, 10] as const,

  ladder: [
    { day: -3, key: "headsUp" },
    { day: 0, key: "dueDate" },
    { day: 7, key: "firm" },
    { day: 15, key: "finalCall" },
    { day: 30, key: "demandLetter" },
    { day: 45, key: "nextSteps" },
  ] as const,

  demandLetterDeadlineDays: 7,
  rbiBankRatePct: 6.5,
  msmedInterestMultiplier: 3,
  msmedMaxCreditDays: 45,
  eInvoiceTurnoverThresholdPaise: 500_000_000_00,

  forecastWeeks: 13,
  gstinRegex: "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$",

  priorityWeights: { amount: 0.4, age: 0.3, reliability: 0.15, gap: 0.15 },
  gradeThresholds: { A: { pct: 90, maxLate: 3 }, B: { pct: 60, maxLate: 15 } },

  defaultSafetyBufferPaise: 30_000_000,
};

/** Loose structural type for assertConfig — no literal types, so tests can pass alternate shapes. */
export type ConfigShape = {
  priorityWeights: { amount: number; age: number; reliability: number; gap: number };
  ladder: ReadonlyArray<{ day: number; key: string }>;
  gstRatesPct: ReadonlyArray<number>;
};

export function assertConfig(cfg: ConfigShape = config): void {
  const w = cfg.priorityWeights;
  const sum = w.amount + w.age + w.reliability + w.gap;
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`BAK-CFG-001: priorityWeights sum ${sum}, must equal 1.0`);
  }
  for (let i = 1; i < cfg.ladder.length; i++) {
    if (cfg.ladder[i]!.day <= cfg.ladder[i - 1]!.day) {
      throw new Error(`BAK-CFG-001: ladder days not strictly increasing at index ${i}`);
    }
  }
  for (const r of cfg.gstRatesPct) {
    if (![0, 3, 5, 18, 40].includes(r)) {
      throw new Error(`BAK-CFG-001: unexpected GST rate ${r}`);
    }
  }
}

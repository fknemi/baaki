import { config } from "./config";

export type UdyamType = "micro" | "small" | "medium";

export type BusinessForMsmed = {
  udyamRegistered: boolean;
  udyamType?: UdyamType | null;
};

export type MsmedResult =
  | { applicable: false }
  | {
      applicable: true;
      interestPaise: number;
      months: number;
      monthlyRate: number;
      formulaNote: string;
    };

/**
 * MSMED Act §16: compound interest, monthly rests, 3× RBI rate.
 * Scope restriction is statutorily correct: micro + small only.
 * Medium enterprises get the plain RBI rate, not 3× — do not widen.
 */
export function msmedInterest(
  principalPaise: number,
  wholeDaysOverdue: number,
  rbiBankRatePct: number,
  business: BusinessForMsmed,
): MsmedResult {
  if (!business.udyamRegistered) return { applicable: false };
  if (business.udyamType !== "micro" && business.udyamType !== "small") {
    return { applicable: false };
  }
  if (wholeDaysOverdue <= 0) return { applicable: false };

  const months = Math.ceil(wholeDaysOverdue / 30);
  const monthlyRate = (config.msmedInterestMultiplier * rbiBankRatePct) / 100 / 12;
  const interestPaise = Math.round(principalPaise * (Math.pow(1 + monthlyRate, months) - 1));

  const formulaNote =
    `P × ((1 + ${config.msmedInterestMultiplier}×${rbiBankRatePct}%/12)^${months} − 1)` +
    ` = ₹${(principalPaise / 100).toFixed(2)} × ((1 + ${(monthlyRate * 100).toFixed(4)}%)^${months} − 1)` +
    ` = ₹${(interestPaise / 100).toFixed(2)}`;

  return { applicable: true, interestPaise, months, monthlyRate, formulaNote };
}

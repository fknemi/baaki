import { config } from "./config";
import { wholeDaysBetween } from "./dates";

export type LadderInput = {
  dueDate: string;
  today: string;
  paid: boolean;
  disputed: boolean;
  resolved: boolean;
  promiseToPayDate: string | null;
  sentStageKeys: string[];
};

export type LadderStage = {
  day: number;
  key: string;
};

export function deriveStage(input: LadderInput): LadderStage | null {
  const { dueDate, today, paid, disputed, resolved, promiseToPayDate, sentStageKeys } = input;

  if (paid) return null;
  if (disputed && !resolved) return null;
  if (promiseToPayDate && promiseToPayDate >= today) return null;

  const d = wholeDaysBetween(dueDate, today);
  if (d < -3) return null;

  const candidates = config.ladder.filter((s) => s.day <= d);
  const unsent = candidates.filter((s) => !sentStageKeys.includes(s.key));
  return (unsent.at(-1) as LadderStage | undefined) ?? null;
}

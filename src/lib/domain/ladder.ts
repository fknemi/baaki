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

function deriveStageWith(
  input: LadderInput,
  ladder: readonly { day: number; key: string }[],
): LadderStage | null {
  const {
    dueDate,
    today,
    paid,
    disputed,
    resolved,
    promiseToPayDate,
    sentStageKeys,
  } = input;

  if (paid) return null;
  if (disputed && !resolved) return null;
  if (promiseToPayDate && promiseToPayDate >= today) return null;

  const d = wholeDaysBetween(dueDate, today);
  if (d < -3) return null;

  // The highest day offset already sent for this invoice.
  // Any stage earlier than this is implicitly skipped — you don't send
  // "remind at due date" after you've already sent "firm reminder".
  const maxSentDay = sentStageKeys.reduce((max, key) => {
    const s = ladder.find((l) => l.key === key);
    return s && s.day > max ? s.day : max;
  }, Number.NEGATIVE_INFINITY);

  const candidates = ladder.filter((s) => s.day <= d && s.day >= maxSentDay);
  const unsent = candidates.filter((s) => !sentStageKeys.includes(s.key));
  return (unsent.at(-1) as LadderStage | undefined) ?? null;
}

export function deriveStage(input: LadderInput): LadderStage | null {
  return deriveStageWith(input, config.ladder);
}

export function deriveStageWithLadder(
  input: LadderInput,
  ladder: readonly { day: number; key: string }[],
): LadderStage | null {
  return deriveStageWith(input, ladder);
}

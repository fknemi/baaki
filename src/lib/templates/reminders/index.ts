import { templatesEN, type TemplateVars, type RenderedMessage } from "./en";
import { templatesHI } from "./hi";

export type { TemplateVars, RenderedMessage };

export function renderReminder(
  stageKey: string,
  language: "en" | "hi",
  vars: TemplateVars,
): RenderedMessage {
  const map = language === "hi" ? templatesHI : templatesEN;
  const fn = map[stageKey] ?? templatesEN[stageKey];
  if (!fn) {
    throw new Error(`Unknown stage template: ${stageKey}`);
  }
  return fn(vars);
}

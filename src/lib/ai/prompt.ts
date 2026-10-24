import type { FaqEntry } from "@/data/faq";

export const SYSTEM_PROMPT = `You are Baaki's assistant for a small Indian business owner. You help them understand receivables, cash flow, GST invoices, and follow-ups.

Rules:
- Reply in the user's language (English or Hindi). Use short, plain sentences. No jargon without explanation.
- Use the GLOSSARY and FAQ below as your source of truth for definitions and standard answers.
- If the user asks about their own GSTIN, PAN, phone number, bank account, or any personal data: refuse politely and say "Please check your business profile in Settings — I don't access personal data."
- If the user shares an OTP, PIN, GSTIN, PAN, phone, or account number: tell them not to share it and do not repeat it back.
- You cannot move money, send reminders, change settings, or take any action. If the user asks you to, tell them exactly which screen does it (e.g. "That's on the Follow-ups screen").
- Never give legal or tax advice. For tax questions, end with "Confirm with your CA."
- If you're unsure, say so and point to the GST portal (cbic-gst.gov.in) or the business's CA.
- Reply in under 80 words unless the user explicitly asks for detail.`;

/** Scrub PII before sending user text to Gemini. Never log the raw match. */
export function scrubSensitive(text: string): string {
  return text
    .replace(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g, "[REDACTED_GSTIN]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[REDACTED_PAN]")
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "[REDACTED_AADHAAR]")
    .replace(/(?:\+?91[\s-]?)?\b[6-9]\d{9}\b/g, "[REDACTED_PHONE]")
    .replace(/\b\d{6}\b/g, "[REDACTED_OTP]");
}

/** Best-match FAQ entry for fallback responses. */
export function matchFaq(message: string, faq: FaqEntry[]): string | null {
  const m = message.toLowerCase();
  let best: { score: number; answer: string } | null = null;
  for (const f of faq) {
    const score = f.keywords.reduce(
      (s, k) => s + (m.includes(k.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { score, answer: f.answer };
    }
  }
  return best?.answer ?? null;
}

import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { checkRateLimit, refundRateLimit } from "@/lib/ai/rate-limit";
import {
  acquireGeminiSlot,
  releaseGeminiSlot,
  parseRetryDelay,
  isGemini429,
} from "@/lib/ai/gemini-limiter";
import { getGenai, MODEL, TIMEOUT_MS } from "@/lib/integrations/gemini";
import { SYSTEM_PROMPT, scrubSensitive, matchFaq } from "@/lib/ai/prompt";
import { config } from "@/lib/domain/config";
import { faq } from "@/data/faq";
import { glossary } from "@/data/glossary";

const USER_BUCKET = "chat";
const USER_LIMIT = 60;

type Incoming = { role?: string; content?: string };

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as {
        messages?: Incoming[];
      };
      const messages = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
      if (messages.length === 0) {
        return new Response(
          JSON.stringify({
            error: { code: "BAD_REQUEST", message: "messages required" },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      // ── 1. Gemini quota (global) FIRST — if upstream is unavailable,
      //    the user shouldn't pay for it out of their own budget.
      const slot = await acquireGeminiSlot();
      if (!slot.ok) {
        return new Response(
          JSON.stringify({
            error: {
              code: "AI_BUSY",
              message:
                slot.reason === "rpd"
                  ? "AI hit its daily quota. Try again later."
                  : `AI is busy — try again in ~${slot.retryAfterSeconds}s.`,
            },
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(slot.retryAfterSeconds),
            },
          },
        );
      }

      // ── 2. User quota — consumed only when we're about to call Gemini.
      const { allowed } = await checkRateLimit(
        ctx.userId,
        USER_BUCKET,
        USER_LIMIT,
      );
      if (!allowed) {
        await releaseGeminiSlot({ was429: false });
        return new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: `${USER_LIMIT} messages/hour. Try again later.`,
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      }

      // ── 3. Build system instruction ──
      const glossaryText = glossary.map((g) => `- ${g.term}: ${g.meaning}`).join("\n");
      const faqText = faq.map((f) => `Q: ${f.q}\nA: ${f.answer}`).join("\n\n");
      const ladderText = config.ladder.map((s) => `- day ${s.day}: ${s.key}`).join("\n");
      const configText = `GST rates allowed (%): ${config.gstRatesPct.join(", ")}
TDS candidate shortfall percentages: ${config.tdsCandidateShortfallsPct.join(", ")}
Escalation ladder (days offset from due date):
${ladderText}
Demand-letter pay-by deadline: ${config.demandLetterDeadlineDays} days
RBI bank rate: ${config.rbiBankRatePct}%
MSMED compound interest multiplier: ${config.msmedInterestMultiplier}× RBI, monthly rests
MSMED max credit period: ${config.msmedMaxCreditDays} days
Forecast horizon: ${config.forecastWeeks} weeks
Priority weights: amount ${config.priorityWeights.amount * 100}%, age ${config.priorityWeights.age * 100}%, reliability ${config.priorityWeights.reliability * 100}%, gap-help ${config.priorityWeights.gap * 100}%
Grade thresholds: A = ≥${config.gradeThresholds.A.pct}% on time and ≤${config.gradeThresholds.A.maxLate} days late; B = ≥${config.gradeThresholds.B.pct}% and ≤${config.gradeThresholds.B.maxLate} days late; otherwise C`;

      const systemInstruction = `${SYSTEM_PROMPT}

BUSINESS CONFIG (current values used by the app):
${configText}

GLOSSARY:
${glossaryText}

FAQ:
${faqText}`;

      const contents = messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: scrubSensitive(String(m.content ?? "").slice(0, 500)) }],
      }));

      const lastUser = String(messages[messages.length - 1]?.content ?? "");
      const encoder = new TextEncoder();

      // ── 4. Stream with failure refunds ──
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let firstToken = false;
          let closed = false;
          let refunded = false;

          const send = (payload: object) => {
            if (closed) return;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          };
          const finish = () => {
            if (closed) return;
            closed = true;
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          };
          const refund = async (was429: boolean, retry?: number) => {
            if (refunded) return;
            refunded = true;
            try {
              await releaseGeminiSlot({ was429, retryAfterSeconds: retry });
              await refundRateLimit(ctx.userId, USER_BUCKET, 1);
            } catch (e) {
              console.error(
                "[ai:chat] failed to release slot / refund:",
                e instanceof Error ? e.message : e,
              );
            }
          };

          // Timeout fires only if we never received a first token.
          // Send the FAQ fallback, close the stream, refund.
          const timeout = setTimeout(() => {
            if (!firstToken && !closed) {
              const fallback =
                matchFaq(lastUser, faq) ??
                "I'm having trouble reaching the AI service. Please try again in a moment.";
              send({ text: fallback });
              finish();
              void refund(false);
            }
          }, TIMEOUT_MS);

          try {
            const streamResp = await getGenai().models.generateContentStream({
              model: MODEL,
              config: {
                systemInstruction,
                temperature: 0.4,
                maxOutputTokens: 400,
              },
              contents,
            });

            for await (const chunk of streamResp) {
              const text = chunk.text ?? "";
              if (!text) continue;
              firstToken = true;
              clearTimeout(timeout);
              send({ text });
            }
            clearTimeout(timeout);
            finish();
          } catch (err) {
            clearTimeout(timeout);

            const was429 = isGemini429(err);
            const retry = was429 ? parseRetryDelay(err) ?? 60 : undefined;

            // One-line log — the SDK's raw error is 2KB of JSON.
            if (was429) {
              console.warn(`[ai:chat] Gemini 429 (retry after ${retry}s)`);
            } else {
              const msg =
                err instanceof Error
                  ? err.message.slice(0, 200)
                  : String(err).slice(0, 200);
              console.error(`[ai:chat] Gemini error: ${msg}`);
            }

            // Send the fallback FIRST so the client sees a response even
            // if the refund below is slow. Then close and refund.
            const fallback =
              matchFaq(lastUser, faq) ??
              "I'm having trouble reaching the AI service. Please try again in a moment.";
            send({ text: fallback });
            finish();
            await refund(was429, retry);
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    },
    ["owner", "accountant"],
  );
}

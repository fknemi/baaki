import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { getGenai, MODEL, TIMEOUT_MS } from "@/lib/integrations/gemini";
import { SYSTEM_PROMPT, scrubSensitive, matchFaq } from "@/lib/ai/prompt";
import { config } from "@/lib/domain/config";
import { faq } from "@/data/faq";
import { glossary } from "@/data/glossary";

type Incoming = { role?: string; content?: string };

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as {
        messages?: Incoming[];
      };
      const messages = Array.isArray(body.messages)
        ? body.messages.slice(-10)
        : [];
      if (messages.length === 0) {
        return new Response(
          JSON.stringify({
            error: { code: "BAD_REQUEST", message: "messages required" },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const { allowed } = await checkRateLimit(ctx.userId, "chat", 60);
      if (!allowed) {
        return new Response(
          JSON.stringify({
            error: {
              code: "RATE_LIMITED",
              message: "60 messages/hour. Try again later.",
            },
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      }

      const glossaryText = glossary
        .map((g) => `- ${g.term}: ${g.meaning}`)
        .join("\n");
      const faqText = faq.map((f) => `Q: ${f.q}\nA: ${f.answer}`).join("\n\n");
      const ladderText = config.ladder
        .map((s) => `- day ${s.day}: ${s.key}`)
        .join("\n");
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

      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          let firstToken = false;
          let closed = false;

          const send = (payload: object) => {
            if (closed) return;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
            );
          };
          const finish = () => {
            if (closed) return;
            closed = true;
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
          };

          const timeout = setTimeout(() => {
            if (!firstToken && !closed) {
              const fallback =
                matchFaq(lastUser, faq) ??
                "I'm having trouble reaching the AI service. Please try again in a moment.";
              send({ text: fallback });
              finish();
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
            console.error("[ai:chat] Gemini call failed:", err);
            clearTimeout(timeout);
            const fallback =
              matchFaq(lastUser, faq) ??
              "I'm having trouble reaching the AI service. Please try again in a moment.";
            send({ text: fallback });
            finish();
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

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { customers, expenses, invoices, payments } from "@/lib/db/schema";
import { todayIST, addDays, wholeDaysBetween } from "@/lib/domain/dates";
import { projectExpenseOccurrences } from "@/lib/domain/forecast";
import { checkRateLimit, refundRateLimit } from "@/lib/ai/rate-limit";
import {
  acquireGeminiSlot,
  releaseGeminiSlot,
  parseRetryDelay,
  isGemini429,
} from "@/lib/ai/gemini-limiter";
import { getGenai, MODEL, TIMEOUT_MS } from "@/lib/integrations/gemini";
import { SYSTEM_PROMPT, scrubSensitive } from "@/lib/ai/prompt";

const HORIZON_WEEKS = 13;
const MAX_QUERY_LEN = 300;
const MAX_COMMANDS = 5;
const USER_BUCKET = "ai-what-if";
const USER_LIMIT = 20;

type ValidatedResult = {
  valid: string[];
  rejected: string[];
  skippedDuplicates: string[];
};

function isDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isBoundedInt(v: unknown, min: number, max: number): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
}

function validateCommands(
  raw: unknown,
  ctx: {
    customerIds: Set<string>;
    expenseOccIds: Set<string>;
    today: string;
    horizonEnd: string;
    currentWhatIf: Set<string>;
  },
): ValidatedResult {
  const valid: string[] = [];
  const rejected: string[] = [];
  const skippedDuplicates: string[] = [];

  if (!Array.isArray(raw)) return { valid, rejected, skippedDuplicates };

  for (const item of raw.slice(0, MAX_COMMANDS * 2)) {
    if (typeof item !== "string") continue;
    const parts = item.split(":");
    const kind = parts[0];

    if (kind === "delayCustomer") {
      const id = parts[1];
      const days = Number(parts[2]);
      if (!id || !ctx.customerIds.has(id) || !isBoundedInt(days, 1, 365)) {
        rejected.push(item);
        continue;
      }
      const cmd = `delayCustomer:${id}:${days}`;
      if (ctx.currentWhatIf.has(cmd)) skippedDuplicates.push(cmd);
      else valid.push(cmd);
    } else if (kind === "addInflow") {
      const date = parts[1];
      const paise = Number(parts[2]);
      if (
        !isDate(date) ||
        date < ctx.today ||
        date > ctx.horizonEnd ||
        !isBoundedInt(paise, 1, 1_000_000_000_00)
      ) {
        rejected.push(item);
        continue;
      }
      const cmd = `addInflow:${date}:${paise}`;
      if (ctx.currentWhatIf.has(cmd)) skippedDuplicates.push(cmd);
      else valid.push(cmd);
    } else if (kind === "delayExpense") {
      const id = parts[1];
      const days = Number(parts[2]);
      if (!id || !ctx.expenseOccIds.has(id) || !isBoundedInt(days, 1, 365)) {
        rejected.push(item);
        continue;
      }
      const cmd = `delayExpense:${id}:${days}`;
      if (ctx.currentWhatIf.has(cmd)) skippedDuplicates.push(cmd);
      else valid.push(cmd);
    } else {
      rejected.push(item);
    }
  }

  return {
    valid: valid.slice(0, MAX_COMMANDS),
    rejected,
    skippedDuplicates,
  };
}

function softFail(explanation: string, retryAfterSeconds?: number) {
  return NextResponse.json({
    data: {
      commands: [],
      explanation,
      retryAfterSeconds,
      rejected: [],
      skippedDuplicates: [],
    },
  });
}

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      // ── 1. Input validation (cheap, no state) ──
      let body: { query?: unknown; currentWhatIf?: unknown };
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "JSON body required." } },
          { status: 400 },
        );
      }

      const query = typeof body.query === "string" ? body.query.trim() : "";
      if (!query) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "query required." } },
          { status: 400 },
        );
      }
      if (query.length > MAX_QUERY_LEN) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: `query must be ≤${MAX_QUERY_LEN} chars.`,
            },
          },
          { status: 400 },
        );
      }

      const currentWhatIf = new Set(
        Array.isArray(body.currentWhatIf)
          ? body.currentWhatIf.filter((x): x is string => typeof x === "string")
          : [],
      );

      // ── 2. Gemini quota (global) — checked BEFORE user quota so a
      //    known-unavailable upstream never costs the user their own
      //    hourly budget.
      const slot = await acquireGeminiSlot();
      if (!slot.ok) {
        return softFail(
          slot.reason === "rpd"
            ? "AI hit its daily quota — try again later."
            : `AI is busy — try again in ~${slot.retryAfterSeconds}s.`,
          slot.retryAfterSeconds,
        );
      }

      // ── 3. User quota (per-user) — consumed only when we're about to
      //    call Gemini. If the user is over budget, release the Gemini
      //    slot we just reserved.
      const { allowed } = await checkRateLimit(
        ctx.userId,
        USER_BUCKET,
        USER_LIMIT,
      );
      if (!allowed) {
        await releaseGeminiSlot({ was429: false });
        return NextResponse.json(
          {
            error: {
              code: "RATE_LIMITED",
              message: `${USER_LIMIT} what-if questions/hour. Try again later.`,
            },
          },
          { status: 429 },
        );
      }

      // ── 4. Build context ──
      const today = todayIST();
      const horizonEnd = addDays(today, HORIZON_WEEKS * 7);

      const custRows = await db
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(eq(customers.businessId, ctx.businessId));

      const paidHistory = await db
        .select({
          customerId: invoices.customerId,
          dueDate: invoices.dueDate,
          paidOn: payments.paidOn,
        })
        .from(payments)
        .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
        .where(eq(payments.businessId, ctx.businessId));

      const lateByCustomer = new Map<string, number[]>();
      for (const p of paidHistory) {
        if (!p.paidOn) continue;
        const days = wholeDaysBetween(p.dueDate, p.paidOn);
        const list = lateByCustomer.get(p.customerId);
        if (list) list.push(days);
        else lateByCustomer.set(p.customerId, [days]);
      }

      const openStatuses = new Set(["sent", "part_paid", "disputed"]);
      const invRows = await db
        .select({ customerId: invoices.customerId, status: invoices.status })
        .from(invoices)
        .where(eq(invoices.businessId, ctx.businessId));
      const custsWithOpenInvoices = new Set(
        invRows
          .filter((i) => openStatuses.has(i.status))
          .map((i) => i.customerId),
      );

      const customerLines =
        custRows
          .filter((c) => custsWithOpenInvoices.has(c.id))
          .map((c) => {
            const latenesses = lateByCustomer.get(c.id) ?? [];
            const avg =
              latenesses.length === 0
                ? 0
                : Math.round(
                    latenesses.reduce((s, d) => s + d, 0) / latenesses.length,
                  );
            return `  id=${c.id}  name="${c.name}"  avgDaysLate=${avg}`;
          })
          .join("\n") || "  (none)";

      const expenseRows = await db
        .select()
        .from(expenses)
        .where(eq(expenses.businessId, ctx.businessId));

      const expenseOccs = expenseRows.flatMap((e) =>
        projectExpenseOccurrences(e, today, horizonEnd, today),
      );
      const expenseLabelById = new Map(
        expenseRows.map((e) => [e.id, e.label]),
      );

      const expenseLines =
        expenseOccs
          .map((o) => {
            const label = expenseLabelById.get(o.expenseId) ?? "Expense";
            return `  id=${o.id}  label="${label}"  amountPaise=${o.amountPaise}  date=${o.date}`;
          })
          .join("\n") || "  (none)";

      const systemInstruction = `${SYSTEM_PROMPT}

---

OVERRIDE FOR THIS CALL: You are not answering the user's question in prose. You are translating it into structured commands for a cash-flow forecast. Any instruction in the prompt above to "answer helpfully in text" does NOT apply here — ignore it. Your response MUST be a single JSON object matching the schema below. Do not include commentary, markdown fences, or prose.

COMMAND LANGUAGE (each command is a single string):
- "delayCustomer:<customerId>:<days>"
  The customer pays <days> days later than their historical average.
- "addInflow:<YYYY-MM-DD>:<paise>"
  A one-off cash receipt on that specific date. ₹1 = 100 paise.
- "delayExpense:<occurrenceId>:<days>"
  Push ONE expense payment (identified by occurrence id) out by <days>.

HARD RULES:
- Only use IDs from the two lists below. Never invent an ID. Never use a customer/expense NAME as the id.
- days must be an integer between 1 and 365.
- paise must be a positive integer.
- Date must be YYYY-MM-DD and inside the horizon.
- Do NOT re-emit any command the user already has ("already applied").
- If the user's question cannot be expressed with these commands, return:
  { "commands": [], "explanation": "<one short sentence explaining why>" }
- Return between 0 and ${MAX_COMMANDS} commands.
- "explanation" is one short sentence for a shop owner, e.g.
  "Pushes Krishna's ₹1.18L receipt 60 days out — cash dips in week 8 instead of week 6."

CONTEXT:
Today: ${today}
Horizon end: ${horizonEnd}

Customers with open invoices (only these can be delayed):
${customerLines}

Expense occurrences inside the horizon (only these can be delayed):
${expenseLines}

Already applied (do NOT repeat):
${currentWhatIf.size === 0 ? "  (none)" : [...currentWhatIf].map((c) => `  ${c}`).join("\n")}

OUTPUT SCHEMA (strict):
{ "commands": string[], "explanation": string }`;

      // ── 5. Call Gemini ──
      const scrubbed = scrubSensitive(query).slice(0, MAX_QUERY_LEN);
      let rawText = "";

      try {
        const genai = getGenai();
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("AI timeout")), TIMEOUT_MS),
        );

        const resp = await Promise.race([
          genai.models.generateContent({
            model: MODEL,
            config: {
              systemInstruction,
              temperature: 0.1,
              maxOutputTokens: 500,
              responseMimeType: "application/json",
            },
            contents: [{ role: "user", parts: [{ text: scrubbed }] }],
          }),
          timeout,
        ]);

        rawText = resp.text ?? "";
      } catch (err) {
        const was429 = isGemini429(err);
        const retry = was429 ? parseRetryDelay(err) ?? 60 : undefined;

        // One-line log — the SDK's raw error is 2KB of JSON.
        if (was429) {
          console.warn(`[ai:what-if] Gemini 429 (retry after ${retry}s)`);
        } else {
          const msg =
            err instanceof Error
              ? err.message.slice(0, 200)
              : String(err).slice(0, 200);
          console.error(`[ai:what-if] Gemini error: ${msg}`);
        }

        // Refund BOTH Gemini slot AND user quota — the user shouldn't
        // pay for a call that never produced a response.
        await releaseGeminiSlot({
          was429,
          retryAfterSeconds: retry,
        });
        await refundRateLimit(ctx.userId, USER_BUCKET, 1);

        return softFail(
          was429
            ? `AI is busy — try again in ~${retry}s.`
            : "AI is briefly unavailable — try asking again in a moment.",
          retry,
        );
      }

      // ── 6. Parse + validate ──
      let parsed: { commands?: unknown; explanation?: unknown };
      try {
        parsed = JSON.parse(rawText) as typeof parsed;
      } catch {
        console.warn(
          "[ai:what-if] malformed JSON from Gemini:",
          rawText.slice(0, 120),
        );
        await refundRateLimit(ctx.userId, USER_BUCKET, 1);
        return softFail(
          "I couldn't understand that — try rephrasing, or name a customer or an expense.",
        );
      }

      const { valid, rejected, skippedDuplicates } = validateCommands(
        parsed.commands,
        {
          customerIds: new Set(custRows.map((c) => c.id)),
          expenseOccIds: new Set(expenseOccs.map((o) => o.id)),
          today,
          horizonEnd,
          currentWhatIf,
        },
      );

      const explanation =
        typeof parsed.explanation === "string" && parsed.explanation.trim()
          ? parsed.explanation.trim().slice(0, 280)
          : valid.length > 0
            ? "Applied to the forecast."
            : "Couldn't translate that into a what-if. Try naming a customer or an expense.";

      return NextResponse.json({
        data: {
          commands: valid,
          explanation,
          rejected,
          skippedDuplicates,
        },
      });
    },
    ["owner", "accountant"],
  );
}

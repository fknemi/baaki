import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { todayIST } from "@/lib/domain/dates";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { expenses } from "@/lib/db/schema";
import {
  currentPeriodKey,
  effectiveDueDate,
  isPaidForCurrentPeriod,
} from "@/lib/domain/dates";

const RECURRENCES = ["once", "monthly", "quarterly", "yearly"] as const;
type Recurrence = (typeof RECURRENCES)[number];

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRecurrence(v: unknown): v is Recurrence {
  return typeof v === "string" && (RECURRENCES as readonly string[]).includes(v);
}

type ExpenseRow = typeof expenses.$inferSelect;

/**
 * Derive the user-facing shape of an expense row for the current period.
 * - "once" rows: `paid` and `dueDate` come straight from the columns.
 * - recurring rows: `paid` comes from `lastPaidPeriod === currentPeriodKey`,
 *   and `dueDate` is recomputed from `dayOfMonth` so the UI always shows the
 *   next real due date (the stored `dueDate` column is only the original one).
 */
function viewExpense(e: ExpenseRow, now: Date) {
  return {
    ...e,
    paid: isPaidForCurrentPeriod(e, now),
    dueDate: effectiveDueDate(e, now),
  };
}

export async function GET(req: NextRequest) {
  return requireRole(
    req,
    async (_req, ctx) => {
      const url = req.nextUrl;
      const paidParam = url.searchParams.get("paid");
      const recurrenceParam = url.searchParams.get("recurrence");

      if (paidParam !== null && paidParam !== "true" && paidParam !== "false") {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "paid must be true or false." } },
          { status: 400 },
        );
      }

      const conditions = [eq(expenses.businessId, ctx.businessId)];
      if (recurrenceParam !== null) {
        if (!isRecurrence(recurrenceParam)) {
          return NextResponse.json(
            {
              error: {
                code: "BAD_REQUEST",
                message: `recurrence must be one of ${RECURRENCES.join(", ")}.`,
              },
            },
            { status: 400 },
          );
        }
        conditions.push(eq(expenses.recurrence, recurrenceParam));
      }

      const rows = await db
        .select()
        .from(expenses)
        .where(and(...conditions));

      const now = new Date(`${todayIST()}T00:00:00`);
      let view = rows.map((r) => viewExpense(r, now));

      // `paid` cannot be pushed down to SQL: for recurring rows the raw
      // column is irrelevant — only `lastPaidPeriod` matters, and it is
      // compared against the current period. Filter here instead.
      if (paidParam !== null) {
        const want = paidParam === "true";
        view = view.filter((e) => e.paid === want);
      }

      // Sort: unpaid first, then soonest due (nulls last), then label.
      view.sort((a, b) => {
        if (a.paid !== b.paid) return a.paid ? 1 : -1;
        if (a.dueDate !== b.dueDate) {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate < b.dueDate ? -1 : 1;
        }
        return a.label.localeCompare(b.label);
      });

      return NextResponse.json({ data: view });
    },
    ["owner", "accountant", "staff"],
  );
}

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      let body: Record<string, unknown>;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "JSON body required." } },
          { status: 400 },
        );
      }

      if (typeof body.label !== "string" || !body.label.trim()) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "label is required." } },
          { status: 400 },
        );
      }
      const label = body.label.trim();

      if (typeof body.category !== "string" || !body.category.trim()) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "category is required." } },
          { status: 400 },
        );
      }
      const category = body.category.trim();

      if (
        typeof body.amountPaise !== "number" ||
        !Number.isInteger(body.amountPaise) ||
        body.amountPaise <= 0
      ) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "amountPaise must be a positive integer (paise).",
            },
          },
          { status: 400 },
        );
      }
      const amountPaise = body.amountPaise;

      const recurrenceRaw = body.recurrence === undefined ? "once" : body.recurrence;
      if (!isRecurrence(recurrenceRaw)) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: `recurrence must be one of ${RECURRENCES.join(", ")}.`,
            },
          },
          { status: 400 },
        );
      }
      const recurrence: Recurrence = recurrenceRaw;

      let dayOfMonth: number | null = null;
      if (body.dayOfMonth !== undefined && body.dayOfMonth !== null) {
        if (
          typeof body.dayOfMonth !== "number" ||
          !Number.isInteger(body.dayOfMonth) ||
          body.dayOfMonth < 1 ||
          body.dayOfMonth > 31
        ) {
          return NextResponse.json(
            {
              error: {
                code: "BAD_REQUEST",
                message: "dayOfMonth must be an integer 1–31 or null.",
              },
            },
            { status: 400 },
          );
        }
        dayOfMonth = body.dayOfMonth;
      }
      if (recurrence === "once") {
        dayOfMonth = null;
      } else if (dayOfMonth === null) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "dayOfMonth is required when recurrence is not 'once'.",
            },
          },
          { status: 400 },
        );
      }

      let dueDate: string | null = null;
      if (body.dueDate !== undefined && body.dueDate !== null) {
        if (typeof body.dueDate !== "string" || !ISO_DATE_RE.test(body.dueDate)) {
          return NextResponse.json(
            {
              error: {
                code: "BAD_REQUEST",
                message: "dueDate must be YYYY-MM-DD or null.",
              },
            },
            { status: 400 },
          );
        }
        dueDate = body.dueDate;
      }

      const paid = body.paid === undefined ? false : body.paid;
      if (typeof paid !== "boolean") {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "paid must be a boolean." } },
          { status: 400 },
        );
      }

      // Derive lastPaidPeriod:
      // 1. explicit lastPaidPeriod wins (imports/migrations, "this October was paid")
      // 2. else if paid === true on a recurring row: stamp the current period
      // 3. else: null
      const now = new Date(`${todayIST()}T00:00:00`);
      let lastPaidPeriod: string | null = null;
      if (typeof body.lastPaidPeriod === "string" && body.lastPaidPeriod.trim()) {
        lastPaidPeriod = body.lastPaidPeriod.trim();
      } else if (paid && recurrence !== "once") {
        lastPaidPeriod = currentPeriodKey(recurrence, now);
      }

      // For recurring rows the `paid` column is not the source of truth —
      // the read path only looks at lastPaidPeriod. Store false so anyone
      // querying the raw column doesn't get confused.
      const paidColumn = recurrence === "once" ? paid : false;

      const [created] = await db
        .insert(expenses)
        .values({
          businessId: ctx.businessId,
          label,
          category,
          amountPaise,
          recurrence,
          dayOfMonth,
          dueDate,
          paid: paidColumn,
          lastPaidPeriod,
        })
        .returning();

      if (!created) {
        return NextResponse.json(
          { error: { code: "INTERNAL", message: "Insert failed." } },
          { status: 500 },
        );
      }

      return NextResponse.json({ data: viewExpense(created, now) }, { status: 201 });
    },
    ["owner", "accountant"],
  );
}

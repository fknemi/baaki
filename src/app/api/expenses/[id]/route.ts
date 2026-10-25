import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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

function viewExpense(e: ExpenseRow, now: Date) {
  return {
    ...e,
    paid: isPaidForCurrentPeriod(e, now),
    dueDate: effectiveDueDate(e, now),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return requireRole(
    req,
    async (_req, ctx) => {
      const [row] = await db
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)))
        .limit(1);

      if (!row) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Expense not found." } },
          { status: 404 },
        );
      }
      return NextResponse.json({ data: viewExpense(row, new Date()) });
    },
    ["owner", "accountant", "staff"],
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

      const [existing] = await db
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)))
        .limit(1);
      if (!existing) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Expense not found." } },
          { status: 404 },
        );
      }

      const now = new Date();
      const updates: Record<string, unknown> = {};

      if (body.label !== undefined) {
        if (typeof body.label !== "string" || !body.label.trim()) {
          return NextResponse.json(
            { error: { code: "BAD_REQUEST", message: "label must be a non-empty string." } },
            { status: 400 },
          );
        }
        updates.label = body.label.trim();
      }

      if (body.category !== undefined) {
        if (typeof body.category !== "string" || !body.category.trim()) {
          return NextResponse.json(
            { error: { code: "BAD_REQUEST", message: "category must be a non-empty string." } },
            { status: 400 },
          );
        }
        updates.category = body.category.trim();
      }

      if (body.amountPaise !== undefined) {
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
        updates.amountPaise = body.amountPaise;
      }

      // Recurrence — resolved up front so the paid-handling block below
      // knows what the *final* recurrence will be.
      let effRecurrence: Recurrence = existing.recurrence as Recurrence;
      if (body.recurrence !== undefined) {
        if (!isRecurrence(body.recurrence)) {
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
        updates.recurrence = body.recurrence;
        effRecurrence = body.recurrence;
      }

      if (body.dayOfMonth !== undefined) {
        if (body.dayOfMonth === null) {
          updates.dayOfMonth = null;
        } else if (
          typeof body.dayOfMonth === "number" &&
          Number.isInteger(body.dayOfMonth) &&
          body.dayOfMonth >= 1 &&
          body.dayOfMonth <= 31
        ) {
          updates.dayOfMonth = body.dayOfMonth;
        } else {
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
      }

      if (body.dueDate !== undefined) {
        if (body.dueDate === null) {
          updates.dueDate = null;
        } else if (typeof body.dueDate === "string" && ISO_DATE_RE.test(body.dueDate)) {
          updates.dueDate = body.dueDate;
        } else {
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
      }

      // ── paid handling ──
      // The single most important block. `paid` means different things
      // depending on recurrence:
      //   once      → write the `paid` column directly
      //   recurring → write `lastPaidPeriod` (= current period key on mark-paid,
      //               null on mark-unpaid); leave `paid` column at false
      if (body.paid !== undefined) {
        if (typeof body.paid !== "boolean") {
          return NextResponse.json(
            { error: { code: "BAD_REQUEST", message: "paid must be a boolean." } },
            { status: 400 },
          );
        }

        if (effRecurrence === "once") {
          updates.paid = body.paid;
          updates.lastPaidPeriod = null;
        } else if (body.paid) {
          const key = currentPeriodKey(effRecurrence, now);
          if (!key) {
            return NextResponse.json(
              { error: { code: "BAD_REQUEST", message: "Unknown recurrence." } },
              { status: 400 },
            );
          }
          updates.lastPaidPeriod = key;
          updates.paid = false; // keep the raw column clean for recurring rows
        } else {
          updates.lastPaidPeriod = null;
        }
      }

      // Explicit lastPaidPeriod (imports / admin). Only meaningful for
      // recurring rows; ignored for "once".
      if (body.lastPaidPeriod !== undefined && effRecurrence !== "once") {
        if (body.lastPaidPeriod === null) {
          updates.lastPaidPeriod = null;
        } else if (
          typeof body.lastPaidPeriod === "string" &&
          body.lastPaidPeriod.trim()
        ) {
          updates.lastPaidPeriod = body.lastPaidPeriod.trim();
        } else {
          return NextResponse.json(
            {
              error: {
                code: "BAD_REQUEST",
                message: "lastPaidPeriod must be a string or null.",
              },
            },
            { status: 400 },
          );
        }
      }

      // ── recurrence transitions ──
      // If the caller changed recurrence but didn't touch paid, carry
      // the *current* paid status across so no state is silently lost.
      if (
        body.recurrence !== undefined &&
        existing.recurrence !== effRecurrence &&
        body.paid === undefined
      ) {
        if (effRecurrence === "once") {
          // recurring → once: snapshot "was it paid this period?" into paid
          updates.paid = isPaidForCurrentPeriod(existing, now);
          updates.lastPaidPeriod = null;
        } else {
          // once → recurring: nothing was tracked, reset both
          updates.paid = false;
          updates.lastPaidPeriod = null;
        }
      }

      // Reconcile (recurrence, dayOfMonth) after all edits.
      const finalRecurrence =
        (updates.recurrence as Recurrence | undefined) ?? (existing.recurrence as Recurrence);
      const finalDayOfMonth =
        updates.dayOfMonth !== undefined
          ? (updates.dayOfMonth as number | null)
          : existing.dayOfMonth;

      if (finalRecurrence === "once") {
        if (finalDayOfMonth !== null) updates.dayOfMonth = null;
      } else if (finalDayOfMonth === null || finalDayOfMonth === undefined) {
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

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "No fields to update." } },
          { status: 400 },
        );
      }

      const [updated] = await db
        .update(expenses)
        .set(updates)
        .where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)))
        .returning();

      if (!updated) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Expense not found." } },
          { status: 404 },
        );
      }

      return NextResponse.json({ data: viewExpense(updated, now) });
    },
    ["owner", "accountant"],
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return requireRole(
    req,
    async (_req, ctx) => {
      // No FK points at expenses in the current schema, so a hard delete
      // is safe. If a payments/attachments table ever references this,
      // guard it like the customers DELETE route does.
      const [deleted] = await db
        .delete(expenses)
        .where(and(eq(expenses.id, id), eq(expenses.businessId, ctx.businessId)))
        .returning({ id: expenses.id });

      if (!deleted) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Expense not found." } },
          { status: 404 },
        );
      }

      return NextResponse.json({ data: { id: deleted.id } });
    },
    ["owner", "accountant"],
  );
}

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { appendEventInTx } from "@/lib/db/hashchain-server";
import { todayIST, atIso } from "@/lib/domain/dates";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft: ["cancelled"],
  sent: ["cancelled"],
  part_paid: ["cancelled"],
  overdue: ["cancelled"],
  due_soon: ["cancelled"],
};

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return requireRole(
    req,
    async (_req, ctx) => {
      const invoice = await getInvoiceWithTotals(id, ctx.businessId, todayIST());
      if (!invoice) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice not found." } },
          { status: 404 },
        );
      }
      return NextResponse.json({ data: invoice });
    },
    ["owner", "accountant", "staff"],
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as { status?: string };
      const target = body.status;
      if (!target) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "status field required." } },
          { status: 400 },
        );
      }

      const [inv] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.businessId, ctx.businessId)))
        .limit(1);
      if (!inv) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice not found." } },
          { status: 404 },
        );
      }

      const allowed = ALLOWED_TRANSITIONS[inv.status] ?? [];
      if (!allowed.includes(target)) {
        return NextResponse.json(
          { error: { code: "CONFLICT", message: `Cannot transition ${inv.status} → ${target}.` } },
          { status: 409 },
        );
      }

      await db.transaction(async (tx) => {
        await tx.update(invoices).set({ status: target }).where(eq(invoices.id, id));
        await appendEventInTx(tx, {
          businessId: ctx.businessId,
          entityType: "invoice",
          entityId: id,
          type: "INVOICE_STATUS_CHANGED",
          actor: `user:${ctx.userId}`,
          atIso: atIso(todayIST()),
          payload: { from: inv.status, to: target },
        });
      });

      return NextResponse.json({ data: { id, status: target } });
    },
    ["owner"],
  );
}

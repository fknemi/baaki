import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, invoices, users } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import { verifyPayToken, decodePayTokenUnverified } from "@/lib/auth/pay-token";

const friendly404 = (
  msg = "This link is no longer valid. Please contact the business that sent it.",
) => NextResponse.json({ error: { code: "NOT_FOUND", message: msg } }, { status: 404 });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = verifyPayToken(token);

  if (!payload) {
    // Signature invalid or expired. Try to decode (unverified) so the 404
    // still gives the customer a human contact — the businessId is one of
    // the few claims we can trust even from a corrupt token because
    // tampering with it produces an unrecognizable UUID that matches no row.
    const fallback = decodePayTokenUnverified(token);
    if (fallback.businessId) {
      const [biz] = await db
        .select({
          name: businesses.name,
          ownerPhone: users.phoneE164,
        })
        .from(businesses)
        .innerJoin(users, eq(users.id, businesses.ownerId))
        .where(eq(businesses.id, fallback.businessId))
        .limit(1);
      if (biz) {
        return friendly404(
          biz.ownerPhone
            ? `This link has expired. Call ${biz.name} at ${biz.ownerPhone} for a new one.`
            : `This link has expired. Call ${biz.name} for a new one.`,
        );
      }
    }
    return friendly404();
  }

  const [inv] = await db.select().from(invoices).where(eq(invoices.id, payload.invoiceId)).limit(1);
  if (!inv || inv.businessId !== payload.businessId) {
    return friendly404();
  }

  const [biz] = await db
    .select({
      name: businesses.name,
      upiId: businesses.upiId,
      ownerPhone: users.phoneE164,
    })
    .from(businesses)
    .innerJoin(users, eq(users.id, businesses.ownerId))
    .where(eq(businesses.id, payload.businessId))
    .limit(1);
  if (!biz) return friendly404();

  const today = todayIST();
  const view = await getInvoiceWithTotals(inv.id, inv.businessId, today);
  if (!view) return friendly404();

  return NextResponse.json({
    data: {
      invoice: {
        number: inv.number,
        dueDate: inv.dueDate,
        invoiceDate: inv.invoiceDate,
        status: inv.status,
        outstandingPaise: view.outstandingPaise,
        totalPaise: view.totals.totalPaise,
        items: view.items.map((it) => ({
          description: it.description,
          qty: it.qty,
          unit: it.unit,
          ratePaise: it.ratePaise,
        })),
      },
      business: {
        name: biz.name,
        upiId: biz.upiId,
        phone: biz.ownerPhone,
      },
    },
  });
}

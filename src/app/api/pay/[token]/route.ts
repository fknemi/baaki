import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businesses, invoices, users } from "@/lib/db/schema";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { todayIST } from "@/lib/domain/dates";
import {
  verifyPayToken,
  decodePayTokenUnverified,
} from "@/lib/auth/pay-token";

const friendly404 = (
  msg = "This link is no longer valid. Please contact the business that sent it.",
) =>
  NextResponse.json(
    { error: { code: "NOT_FOUND", message: msg } },
    { status: 404 },
  );

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = verifyPayToken(token);

  if (!payload) {
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

  const [inv] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, payload.invoiceId))
    .limit(1);
  if (!inv || inv.businessId !== payload.businessId) {
    return friendly404();
  }

  const [biz] = await db
    .select({
      name: businesses.name,
      upiId: businesses.upiId,
      bankJson: businesses.bankJson,
      paymentMethods: businesses.paymentMethods,
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

  const bankJson = biz.bankJson as {
    accountName?: string;
    accountNumberMasked?: string;
    ifsc?: string;
    bankName?: string;
  } | null;

  const methods = Array.isArray(biz.paymentMethods)
    ? (biz.paymentMethods as string[])
    : ["upi"];

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
        bank:
          bankJson?.accountNumberMasked && methods.includes("bank")
            ? {
                accountName: bankJson.accountName ?? "",
                accountNumberMasked: bankJson.accountNumberMasked,
                ifsc: bankJson.ifsc ?? "",
                bankName: bankJson.bankName ?? "",
              }
            : null,
        paymentMethods: methods,
      },
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getInvoiceWithTotals } from "@/lib/db/queries/invoices";
import { verifyEntityChain, listEntityEvents } from "@/lib/db/hashchain-server";
import { todayIST } from "@/lib/domain/dates";

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

      const chain = await verifyEntityChain(ctx.businessId, id);
      const events = await listEntityEvents(ctx.businessId, id);
      const created = events.find((e) => e.type === "INVOICE_CREATED");

      let totalsMatch = true;
      const discrepancies: string[] = [];

      if (created) {
        const stored = created.payload as {
          totals?: { totalPaise?: number; taxablePaise?: number };
        };
        if (stored.totals?.totalPaise !== invoice.totals.totalPaise) {
          totalsMatch = false;
          discrepancies.push(
            `totalPaise: stored ${stored.totals?.totalPaise}, recomputed ${invoice.totals.totalPaise}`,
          );
        }
        if (stored.totals?.taxablePaise !== invoice.totals.taxablePaise) {
          totalsMatch = false;
          discrepancies.push(
            `taxablePaise: stored ${stored.totals?.taxablePaise}, recomputed ${invoice.totals.taxablePaise}`,
          );
        }
      }

      const anchor = chain.anchor;

      return NextResponse.json({
        data: {
          valid: chain.valid && totalsMatch,
          chain,
          totalsMatch,
          discrepancies,
          eventCount: events.length,
          computed: invoice.totals,
          anchor,
        },
      });
    },
    ["owner", "accountant", "staff"],
  );
}

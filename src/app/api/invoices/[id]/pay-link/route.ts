import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { invoices } from "@/lib/db/schema";
import { signPayToken } from "@/lib/auth/pay-token";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return requireRole(
    req,
    async (_req, ctx) => {
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
      const { token, payload } = signPayToken(inv.id, ctx.businessId, 30);
      const base =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
      return NextResponse.json({
        data: {
          token,
          url: `${base}/pay/${token}`,
          expiresAt: new Date(payload.exp * 1000).toISOString(),
        },
      });
    },
    ["owner", "accountant"],
  );
}

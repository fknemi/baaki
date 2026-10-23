import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";

export async function GET(req: NextRequest) {
  return requireRole(
    req,
    async (_req, ctx) =>
      NextResponse.json({
        data: {
          user: { id: ctx.userId, name: ctx.userName, phone: ctx.phoneE164 },
          business: { id: ctx.businessId, name: ctx.businessName },
          role: ctx.role,
        },
      }),
    ["owner", "accountant", "staff"],
  );
}

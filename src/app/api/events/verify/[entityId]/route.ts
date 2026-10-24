import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { verifyEntityChain } from "@/lib/db/hashchain-server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ entityId: string }> }) {
  const { entityId } = await params;
  return requireRole(
    req,
    async (_req, ctx) => {
      const result = await verifyEntityChain(ctx.businessId, entityId);
      if (result.valid) {
        return NextResponse.json({
          data: {
            valid: true,
            eventCount: result.eventCount,
            anchor: result.anchor,
          },
        });
      }
      return NextResponse.json({
        data: {
          valid: false,
          failedAt: result.failedAt,
          reason: result.reason,
          anchor: result.anchor,
        },
      });
    },
    ["owner", "accountant", "staff"],
  );
}

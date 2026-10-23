import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getFollowUps } from "@/lib/db/queries/follow-ups";
import { todayIST } from "@/lib/domain/dates";

export async function GET(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const date = req.nextUrl.searchParams.get("date") ?? todayIST();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "date must be YYYY-MM-DD." } },
          { status: 400 },
        );
      }
      const data = await getFollowUps(ctx.businessId, date);
      return NextResponse.json({ data });
    },
    ["owner", "accountant", "staff"],
  );
}

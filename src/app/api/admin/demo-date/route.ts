import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { getDemoDateOverride, setDemoDateOverride, todayIST } from "@/lib/domain/dates";

export async function GET(req: NextRequest) {
  return requireRole(req, async () => {
    return NextResponse.json({
      data: {
        today: todayIST(),
        override: getDemoDateOverride(),
        envOverride: process.env.NEXT_PUBLIC_DEMO_TODAY ?? null,
      },
    });
  }, ["owner", "accountant"]);
}

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req) => {
      const body = (await req.json().catch(() => ({}))) as {
        date?: string | null;
      };
      const date = body.date === null ? null : String(body.date ?? "");
      if (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "date must be YYYY-MM-DD or null." } },
          { status: 400 },
        );
      }
      setDemoDateOverride(date);
      return NextResponse.json({ data: { today: todayIST(), override: date } });
    },
    ["owner", "accountant"],
  );
}

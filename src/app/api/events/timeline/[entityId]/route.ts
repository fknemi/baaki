export const instant = false;

import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { listEntityEvents } from "@/lib/db/hashchain-server";

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ entityId: string }> },
) {
    const { entityId } = await params;

    return requireRole(
        req,
        async (_req, ctx) => {
            const events = await listEntityEvents(ctx.businessId, entityId);
            return NextResponse.json({ data: events });
        },
        ["owner", "accountant", "staff"],
    );
}

import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { evidenceFiles, invoices } from "@/lib/db/schema";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return requireRole(
    req,
    async (_req, ctx) => {
      const [inv] = await db
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.businessId, ctx.businessId)))
        .limit(1);
      if (!inv) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice not found." } },
          { status: 404 },
        );
      }

      const rows = await db
        .select()
        .from(evidenceFiles)
        .where(
          and(
            eq(evidenceFiles.entityType, "invoice"),
            eq(evidenceFiles.entityId, id),
            eq(evidenceFiles.businessId, ctx.businessId),
          ),
        )
        .orderBy(desc(evidenceFiles.createdAt));

      return NextResponse.json({ data: rows });
    },
    ["owner", "accountant"],
  );
}

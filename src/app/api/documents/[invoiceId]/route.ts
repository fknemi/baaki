import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { loadEvidencePayload } from "@/lib/documents/evidence";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  return requireRole(
    req,
    async (_req, ctx) => {
      const payload = await loadEvidencePayload(invoiceId, ctx.businessId);
      if (!payload) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice not found." } },
          { status: 404 },
        );
      }
      return NextResponse.json({ data: payload });
    },
    ["owner", "accountant"],
  );
}

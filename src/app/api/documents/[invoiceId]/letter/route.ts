import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { loadLetterPayload } from "@/lib/documents/letter";
import { buildDisclaimer } from "@/lib/documents/disclaimer";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ invoiceId: string }> },
) {
  const { invoiceId } = await params;
  return requireRole(
    req,
    async (req, ctx) => {
      const includeInterest =
        req.nextUrl.searchParams.get("includeInterest") === "true";

      const payload = await loadLetterPayload(
        invoiceId,
        ctx.businessId,
        includeInterest,
      );
      if (!payload) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "Invoice not found." } },
          { status: 404 },
        );
      }

      return NextResponse.json({
        data: {
          ...payload,
          disclaimer: buildDisclaimer(payload.business.name),
          disclaimerRequired: true,
          disclaimerLocation: "/print/letter/" + invoiceId,
        },
      });
    },
    ["owner", "accountant"],
  );
}

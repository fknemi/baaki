import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { requireRole } from "@/lib/auth/require-role";
import { s3, BUCKET } from "@/lib/integrations/r2";

const ALLOWED_MIMES = ["image/jpeg", "image/png", "application/pdf"];
const MAX_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as {
        mime?: string;
        sizeBytes?: number;
        entityType?: string;
        entityId?: string | null;
      };

      const mime = String(body.mime ?? "");
      const sizeBytes = Number(body.sizeBytes ?? 0);
      const entityType = String(body.entityType ?? "temp").replace(/[^a-z_-]/gi, "");

      if (!ALLOWED_MIMES.includes(mime)) {
        return NextResponse.json(
          {
            error: {
              code: "UNSUPPORTED_MEDIA_TYPE",
              message: "Only JPEG, PNG, or PDF allowed.",
            },
          },
          { status: 415 },
        );
      }
      if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_SIZE) {
        return NextResponse.json(
          {
            error: {
              code: "PAYLOAD_TOO_LARGE",
              message: "File must be 1 byte to 5 MB.",
            },
          },
          { status: 413 },
        );
      }

      const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "pdf";
      const storageKey = `${entityType}/${ctx.userId}/${randomUUID()}.${ext}`;

      const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: storageKey,
        ContentType: mime,
      });

      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });

      return NextResponse.json({
        data: {
          uploadUrl,
          storageKey,
          expiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
      });
    },
    ["owner", "accountant"],
  );
}

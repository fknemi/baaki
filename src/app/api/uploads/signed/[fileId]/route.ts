import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { evidenceFiles } from "@/lib/db/schema";
import { s3, BUCKET } from "@/lib/integrations/r2";

export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const { fileId } = await params;
  return requireRole(
    req,
    async (_req, ctx) => {
      const [file] = await db
        .select()
        .from(evidenceFiles)
        .where(and(eq(evidenceFiles.id, fileId), eq(evidenceFiles.businessId, ctx.businessId)))
        .limit(1);

      if (!file) {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "File not found." } },
          { status: 404 },
        );
      }

      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: BUCKET, Key: file.storageKey }),
        { expiresIn: 60 },
      );

      return NextResponse.json({
        data: {
          url,
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          mime: file.mime,
          sizeBytes: file.sizeBytes,
        },
      });
    },
    ["owner", "accountant"],
  );
}

import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { requireRole } from "@/lib/auth/require-role";
import { s3, BUCKET } from "@/lib/integrations/r2";

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req) => {
      const body = (await req.json().catch(() => ({}))) as {
        storageKey?: string;
        sha256?: string;
      };
      const storageKey = String(body.storageKey ?? "");
      const sha256 = String(body.sha256 ?? "");

      if (!storageKey || !sha256) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "storageKey and sha256 required",
            },
          },
          { status: 400 },
        );
      }

      try {
        await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: storageKey }));
      } catch {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "File not found" } },
          { status: 404 },
        );
      }

      return NextResponse.json({ data: { ok: true, storageKey, sha256 } });
    },
    ["owner", "accountant"],
  );
}

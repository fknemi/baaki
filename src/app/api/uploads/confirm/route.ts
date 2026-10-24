import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { requireRole } from "@/lib/auth/require-role";
import { db } from "@/lib/db/client";
import { evidenceFiles } from "@/lib/db/schema";
import { s3, BUCKET } from "@/lib/integrations/r2";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA_RE = /^[a-f0-9]{64}$/;

export async function POST(req: NextRequest) {
  return requireRole(
    req,
    async (req, ctx) => {
      const body = (await req.json().catch(() => ({}))) as {
        storageKey?: string;
        sha256?: string;
      };
      const storageKey = String(body.storageKey ?? "");
      const clientHash = String(body.sha256 ?? "").toLowerCase();

      if (!storageKey || !SHA_RE.test(clientHash)) {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "storageKey and 64-hex sha256 required.",
            },
          },
          { status: 400 },
        );
      }

      const parts = storageKey.split("/");
      if (parts.length !== 3) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid storageKey." } },
          { status: 400 },
        );
      }

      const entityType = parts[0];
      const entityIdStr = parts[1];
      if (!entityType || !entityIdStr) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid storageKey." } },
          { status: 400 },
        );
      }
      if (entityType === "temp") {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "temp uploads cannot be confirmed.",
            },
          },
          { status: 400 },
        );
      }
      if (!UUID_RE.test(entityIdStr)) {
        return NextResponse.json(
          { error: { code: "BAD_REQUEST", message: "Invalid entityId." } },
          { status: 400 },
        );
      }

      let bytes: Uint8Array;
      let contentType = "application/octet-stream";
      try {
        const obj = await s3.send(
          new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }),
        );
        if (!obj.Body) throw new Error("empty");
        bytes = await obj.Body.transformToByteArray();
        contentType = obj.ContentType ?? contentType;
      } catch {
        return NextResponse.json(
          { error: { code: "NOT_FOUND", message: "File not found." } },
          { status: 404 },
        );
      }

      const actualHash = createHash("sha256").update(bytes).digest("hex");
      if (actualHash !== clientHash) {
        return NextResponse.json(
          {
            error: {
              code: "HASH_MISMATCH",
              message: `SHA-256 mismatch. Computed ${actualHash}.`,
            },
          },
          { status: 400 },
        );
      }

      const [row] = await db
        .insert(evidenceFiles)
        .values({
          businessId: ctx.businessId,
          entityType,
          entityId: entityIdStr,
          storageKey,
          sha256: actualHash,
          mime: contentType,
          sizeBytes: bytes.length,
        })
        .returning();

      if (!row) {
        return NextResponse.json(
          { error: { code: "INTERNAL", message: "Insert failed." } },
          { status: 500 },
        );
      }

      return NextResponse.json({
        data: {
          id: row.id,
          storageKey: row.storageKey,
          sha256: row.sha256,
          sizeBytes: row.sizeBytes,
          mime: row.mime,
        },
      });
    },
    ["owner", "accountant"],
  );
}

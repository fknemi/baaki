import { NextRequest, NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { db } from "@/lib/db/client";
import { evidenceFiles, sessions } from "@/lib/db/schema";
import { s3, BUCKET } from "@/lib/integrations/r2";

const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "CRON_SECRET not set." } },
      { status: 500 },
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Invalid cron secret." } },
      { status: 401 },
    );
  }

  // 1. Expired sessions
  const deletedSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });

  // 2. Orphan temp files: unreferenced by evidence_files and > 24h old
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "temp/" }));
  const referencedRows = await db.select({ key: evidenceFiles.storageKey }).from(evidenceFiles);
  const referenced = new Set(referencedRows.map((r) => r.key));

  const cutoff = Date.now() - ORPHAN_AGE_MS;
  const orphans: Array<{ Key: string }> = [];
  for (const obj of listed.Contents ?? []) {
    if (!obj.Key) continue;
    if (referenced.has(obj.Key)) continue;
    const lastMod = obj.LastModified?.getTime() ?? 0;
    if (lastMod > 0 && lastMod < cutoff) {
      orphans.push({ Key: obj.Key });
    }
  }

  let deletedFiles = 0;
  if (orphans.length > 0) {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: orphans },
      }),
    );
    deletedFiles = orphans.length;
  }

  return NextResponse.json({
    data: {
      deletedSessions: deletedSessions.length,
      deletedOrphanFiles: deletedFiles,
      at: new Date().toISOString(),
    },
  });
}

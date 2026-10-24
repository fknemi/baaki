import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";

const WINDOW_SEC = 3600;

export async function checkRateLimit(
  userId: string,
  bucket: string,
  limit: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `${userId}:${bucket}`;
  const windowSec = WINDOW_SEC;

  const [row] = await db
    .insert(rateLimits)
    .values({
      key,
      count: 1,
      // Compute reset_at entirely in SQL so no Date is bound as a parameter.
      resetAt: sql`now() + make_interval(secs => ${windowSec})` as unknown as Date,
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} <= now() THEN now() + make_interval(secs => ${windowSec}) ELSE ${rateLimits.resetAt} END`,
      },
    })
    .returning({ count: rateLimits.count });

  const count = row?.count ?? 1;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}

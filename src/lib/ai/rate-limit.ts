import { db } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
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



/**
 * Decrement a bucket's count. Used to refund a slot when the upstream
 * call failed for reasons outside the user's control (Gemini 429,
 * network error, timeout). Never goes below 0.
 */
export async function refundRateLimit(
  userId: string,
  bucket: string,
  amount = 1,
): Promise<void> {
  const key = `${userId}:${bucket}`;
  await db
    .update(rateLimits)
    .set({ count: sql`GREATEST(${rateLimits.count} - ${amount}, 0)` })
    .where(eq(rateLimits.key, key));
}

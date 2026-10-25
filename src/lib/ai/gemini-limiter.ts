import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { rateLimits } from "@/lib/db/schema";
import { checkRateLimit, refundRateLimit } from "./rate-limit";

// Mirror Google's free-tier limits for gemini-3.5-flash-lite.
// Adjust per tier/model: https://ai.google.dev/gemini-api/docs/rate-limits
export const GEMINI_LIMITS = {
  rpm: 15,
  rpd: 250,
} as const;

const SYSTEM = "system";
const RPM_BUCKET = "gemini:rpm";
const RPD_BUCKET = "gemini:rpd";
const COOLDOWN_BUCKET = "gemini:cooldown";

export type SlotResult =
  | { ok: true }
  | {
      ok: false;
      reason: "cooldown" | "rpm" | "rpd";
      retryAfterSeconds: number;
    };

/**
 * Reserve one slot from the global Gemini budget. If this returns
 * { ok: false }, do NOT call Gemini — surface the retryAfterSeconds
 * to the user and do NOT charge their per-user quota.
 */
export async function acquireGeminiSlot(): Promise<SlotResult> {
  const cooldown = await getCooldownSeconds();
  if (cooldown > 0) {
    return { ok: false, reason: "cooldown", retryAfterSeconds: cooldown };
  }

  const rpm = await checkRateLimit(SYSTEM, RPM_BUCKET, GEMINI_LIMITS.rpm);
  if (!rpm.allowed) {
    return { ok: false, reason: "rpm", retryAfterSeconds: 60 };
  }

  const rpd = await checkRateLimit(SYSTEM, RPD_BUCKET, GEMINI_LIMITS.rpd);
  if (!rpd.allowed) {
    return { ok: false, reason: "rpd", retryAfterSeconds: 3600 };
  }

  return { ok: true };
}

/**
 * Refund a Gemini slot after a failure. On 429, also sets a cooldown
 * so back-to-back traffic backs off instead of re-hitting the same
 * quota error.
 */
export async function releaseGeminiSlot(opts: {
  was429: boolean;
  retryAfterSeconds?: number;
}): Promise<void> {
  await refundRateLimit(SYSTEM, RPM_BUCKET, 1);
  await refundRateLimit(SYSTEM, RPD_BUCKET, 1);
  if (opts.was429) {
    await setCooldown(opts.retryAfterSeconds ?? 60);
  }
}

async function getCooldownSeconds(): Promise<number> {
  const [row] = await db
    .select({ resetAt: rateLimits.resetAt })
    .from(rateLimits)
    .where(eq(rateLimits.key, `${SYSTEM}:${COOLDOWN_BUCKET}`))
    .limit(1);
  if (!row) return 0;
  const diff = row.resetAt.getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

async function setCooldown(seconds: number): Promise<void> {
  const resetAt = new Date(Date.now() + seconds * 1000);
  await db
    .insert(rateLimits)
    .values({
      key: `${SYSTEM}:${COOLDOWN_BUCKET}`,
      count: 1,
      resetAt,
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        resetAt: sql`GREATEST(${rateLimits.resetAt}, ${resetAt}::timestamptz)`,
      },
    });
}

/**
 * Extract "retry after N seconds" from a Gemini error. Prefers the
 * structured `retryDelay` in the API body; falls back to parsing the
 * human-readable "retry in 50s" message.
 */
export function parseRetryDelay(err: unknown): number | null {
  if (!(err instanceof Error)) return null;

  // SDK serializes the response body into err.message as JSON.
  try {
    const parsed = JSON.parse(err.message);
    const details = parsed?.error?.details;
    if (Array.isArray(details)) {
      for (const d of details) {
        if (
          d &&
          typeof d === "object" &&
          typeof d["@type"] === "string" &&
          d["@type"].includes("RetryInfo") &&
          typeof d.retryDelay === "string"
        ) {
          const m = d.retryDelay.match(/^(\d+(?:\.\d+)?)s?$/);
          if (m) return Math.ceil(Number(m[1]));
        }
      }
    }
  } catch {
    /* not JSON */
  }

  const m = err.message.match(/retry in (\d+(?:\.\d+)?)s/i);
  return m ? Math.ceil(Number(m[1])) : null;
}

export function isGemini429(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as Error & {
    status?: number;
    response?: { status?: number };
  };
  if (e.status === 429) return true;
  if (e.response?.status === 429) return true;
  return (
    err.message.includes('"code":429') ||
    err.message.includes("RESOURCE_EXHAUSTED")
  );
}

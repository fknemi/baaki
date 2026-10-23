import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";

const COOKIE_NAME = "baaki_session";
const SESSION_TTL_DAYS = 30;

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error("AUTH_SECRET missing or shorter than 32 chars.");
  }
  return s;
}

function hashToken(raw: string): string {
  return createHmac("sha256", getSecret()).update(raw).digest("hex");
}

export async function createSession(userId: string): Promise<void> {
  const rawToken = randomBytes(32).toString("hex");
  const hashedId = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);

  await db.insert(sessions).values({ id: hashedId, userId, expiresAt });

  const jar = await cookies();
  jar.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
}

export async function getSession(): Promise<{ userId: string; sessionId: string } | null> {
  const jar = await cookies();
  const rawToken = jar.get(COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const hashedId = hashToken(rawToken);
  const [row] = await db.select().from(sessions).where(eq(sessions.id, hashedId)).limit(1);

  if (!row) return null;
  if (row.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, hashedId));
    return null;
  }

  return { userId: row.userId, sessionId: hashedId };
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const rawToken = jar.get(COOKIE_NAME)?.value;
  if (rawToken) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(rawToken)));
  }
  jar.delete(COOKIE_NAME);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { getFirebaseAdminAuth } from "@/lib/auth/firebase-admin";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users, businesses, businessMembers } from "@/lib/db/schema";

type UserRow = typeof users.$inferSelect;

/**
 * Name for a newly created business.
 * Priority: user's display name → email local-part → random fallback.
 */
function pickBusinessName(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;

  const localPart = email?.split("@")[0]?.trim();
  if (localPart) return localPart;

  return `My Business ${randomUUID().slice(0, 6)}`;
}

export async function POST(req: NextRequest) {
  // ─── Parse + verify the Firebase token ──────────────────────────────
  let body: { idToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "JSON body required." } },
      { status: 400 },
    );
  }

  const { idToken } = body;
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "idToken required." } },
      { status: 400 },
    );
  }

  let decoded;
  try {
    decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
  } catch (err) {
    console.error("[session] verifyIdToken failed:", err);
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Invalid or expired token." } },
      { status: 401 },
    );
  }

  const { uid, phone_number, email, name, email_verified } = decoded;

  // Firebase only populates `phone_number` after an SMS OTP round-trip,
  // so it is a verified identity. Email only counts when Firebase says
  // `email_verified === true` (Google sign-in, or clicked verification link).
  const isPhoneVerified =
    typeof phone_number === "string" && phone_number.length > 0;
  const isEmailVerified = email_verified === true;

  // ─── 1. Resolve the user row ────────────────────────────────────────
  let userRow: UserRow | undefined;
  let justInserted = false;

  // 1a. Fast path — stable Firebase UID
  [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, uid))
    .limit(1);

  // 1b. Claim by verified phone. If the row exists but carries a different
  //     firebaseUid, overwrite it — the SMS OTP just proved this person
  //     controls the phone, which is stronger than any stale UID on the row.
  if (!userRow && isPhoneVerified) {
    const [byPhone] = await db
      .select()
      .from(users)
      .where(eq(users.phoneE164, phone_number!))
      .limit(1);
    if (byPhone) {
      [userRow] = await db
        .update(users)
        .set({ firebaseUid: uid })
        .where(eq(users.id, byPhone.id))
        .returning();
    }
  }

  // 1c. Claim by verified email (same reasoning — Firebase asserted the
  //     email is verified).
  if (!userRow && isEmailVerified && email) {
    const [byEmail] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (byEmail) {
      [userRow] = await db
        .update(users)
        .set({ firebaseUid: uid })
        .where(eq(users.id, byEmail.id))
        .returning();
    }
  }

  // 1d. No match — create a brand-new user.
  if (!userRow) {
    const fallbackName =
      name?.trim() ||
      email?.split("@")[0] ||
      "Baaki user";

    try {
      const [inserted] = await db
        .insert(users)
        .values({
          firebaseUid: uid,
          phoneE164: phone_number ?? null,
          email: email ?? null,
          name: fallbackName,
        })
        .returning();
      userRow = inserted!;
      justInserted = true;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "23505") {
        // Race: another request inserted the same phone/email between our
        // SELECT and INSERT. Re-fetch by whatever identity we can prove.
        const recheck = isPhoneVerified
          ? eq(users.phoneE164, phone_number!)
          : isEmailVerified && email
            ? eq(users.email, email)
            : null;
        if (!recheck) throw err;

        const [raced] = await db
          .select()
          .from(users)
          .where(recheck)
          .limit(1);
        if (!raced) throw err;

        [userRow] = await db
          .update(users)
          .set({ firebaseUid: uid })
          .where(eq(users.id, raced.id))
          .returning();
      } else {
        throw err;
      }
    }
  }

  if (!userRow) {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "User row missing." } },
      { status: 500 },
    );
  }
  const user = userRow;

  // 1e. Touch lastLoginAt for returning users (not for the fresh insert).
  if (!justInserted) {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));
  }

  // ─── 2. Ensure the user has at least one business ───────────────────
  //
  // A user is only ever attached to a business via:
  //   (a) this route — creating a FRESH business they own, or
  //   (b) POST /api/business/members — accepting an invite.
  //
  // Never fall back to "the first existing business" — that was the leak.
  const [existingMembership] = await db
    .select({ businessId: businessMembers.businessId })
    .from(businessMembers)
    .where(eq(businessMembers.userId, user.id))
    .limit(1);

  if (!existingMembership) {
    await db.transaction(async (tx) => {
      const [createdBiz] = await tx
        .insert(businesses)
        .values({
          name: pickBusinessName(user.name, user.email),
          ownerId: user.id,
          // NOT NULL columns with no DB default — placeholders that
          // onboarding fills in.
          addressJson: {},
          safetyBufferPaise: 0,
          openingCashPaise: 0,
        })
        .returning();

      await tx.insert(businessMembers).values({
        businessId: createdBiz!.id,
        userId: user.id,
        role: "owner",
        acceptedAt: new Date(),
      });
    });
  }

  // ─── 3. Mint the session cookie ─────────────────────────────────────
  await createSession(user.id);

  return NextResponse.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        phone: user.phoneE164,
        email: user.email,
      },
    },
  });
}

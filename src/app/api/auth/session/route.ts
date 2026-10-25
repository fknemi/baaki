import { NextRequest, NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { getFirebaseAdminAuth } from "@/lib/auth/firebase-admin";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { users, businesses, businessMembers } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
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

  const { uid, phone_number, email, name } = decoded;

  // Preferred lookup: stable Firebase UID
  let [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, uid))
    .limit(1);

  // Legacy rows created before firebaseUid existed — match on phone or email
  if (!userRow) {
    const matches = [
      phone_number ? eq(users.phoneE164, phone_number) : undefined,
      email ? eq(users.email, email) : undefined,
    ].filter((c): c is NonNullable<typeof c> => Boolean(c));

    if (matches.length) {
      [userRow] = await db
        .select()
        .from(users)
        .where(matches.length === 1 ? matches[0]! : or(...matches))
        .limit(1);

      if (userRow) {
        // Backfill so the next sign-in is a direct hit
        [userRow] = await db
          .update(users)
          .set({ firebaseUid: uid })
          .where(eq(users.id, userRow.id))
          .returning();
      }
    }
  }

  // New user — phone optional; name falls back to email prefix or "Baaki user"
  if (!userRow) {
    const fallbackName =
      name?.trim() ||
      email?.split("@")[0] ||
      "Baaki user";

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
  } else {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userRow.id));
  }

  // Link the user to a business. If none is seeded, create one owned by
  // this user so signup never blocks on an empty database.
  let [memberRow] = await db
    .select()
    .from(businessMembers)
    .where(eq(businessMembers.userId, userRow.id))
    .limit(1);

  if (!memberRow) {
    let [targetBiz] = await db.select().from(businesses).limit(1);

    if (!targetBiz) {
      const [created] = await db
        .insert(businesses)
        .values({
          name: userRow.name,
          ownerId: userRow.id,
          // Required NOT NULL columns with no DB default — placeholders
          // the user can fill in during onboarding.
          addressJson: {},
          safetyBufferPaise: 0,
          openingCashPaise: 0,
        })
        .returning();
      targetBiz = created!;
    }

    const [inserted] = await db
      .insert(businessMembers)
      .values({
        businessId: targetBiz.id,
        userId: userRow.id,
        role: "owner",
        acceptedAt: new Date(),
      })
      .returning();
    memberRow = inserted!;
  }

  await createSession(userRow.id);

  return NextResponse.json({
    data: {
      user: {
        id: userRow.id,
        name: userRow.name,
        phone: userRow.phoneE164,
        email: userRow.email,
      },
    },
  });
}

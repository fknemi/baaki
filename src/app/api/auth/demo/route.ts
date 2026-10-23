import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, businesses, businessMembers } from "@/lib/db/schema";
import { createSession } from "@/lib/auth/session";

/**
 * POST /api/auth/demo
 * Mints a session for the seeded Sharma Packaging owner without Firebase.
 * One-tap judge onboarding. Production would gate this behind ALLOW_DEMO_LOGIN.
 */
export async function POST() {
  const [owner] = await db
    .select({
      userId: users.id,
      phone: users.phoneE164,
      name: users.name,
      businessId: businesses.id,
      businessName: businesses.name,
    })
    .from(users)
    .innerJoin(businessMembers, eq(businessMembers.userId, users.id))
    .innerJoin(businesses, eq(businesses.id, businessMembers.businessId))
    .where(eq(businesses.name, "Sharma Packaging"))
    .limit(1);

  if (!owner) {
    return NextResponse.json(
      { error: { code: "NOT_SEEDED", message: "Run `bun seed` first." } },
      { status: 500 },
    );
  }

  await createSession(owner.userId);

  return NextResponse.json({
    data: {
      user: { id: owner.userId, phone: owner.phone, name: owner.name },
      business: { id: owner.businessId, name: owner.businessName },
    },
  });
}

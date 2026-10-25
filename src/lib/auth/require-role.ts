import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { users, businesses, businessMembers } from "@/lib/db/schema";
import { getSession } from "./session";

export type AuthContext = {
  userId: string;
  userName: string;
  /**
   * Nullable on purpose. Google and email/password sign-ins never
   * produce a phone number, and the `users.phone_e164` column is
   * nullable. Treating "no phone" as "unauthenticated" is a bug —
   * the session cookie is the source of truth for auth, not this.
   *
   * Downstream code that *needs* a phone (SMS reminders, tel: links)
   * must null-check this explicitly; auth helpers should not.
   */
  phoneE164: string | null;
  businessId: string;
  businessName: string;
  role: "owner" | "accountant" | "staff";
};

export type AuthHandler = (req: NextRequest, ctx: AuthContext) => Promise<Response>;

export async function requireRole(
  req: NextRequest,
  handler: AuthHandler,
  allowedRoles: AuthContext["role"][] = ["owner"],
): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      { status: 401 },
    );
  }

  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!userRow) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "User not found." } },
      { status: 401 },
    );
  }

  const [memberRow] = await db
    .select({
      businessId: businessMembers.businessId,
      role: businessMembers.role,
      businessName: businesses.name,
    })
    .from(businessMembers)
    .innerJoin(businesses, eq(businessMembers.businessId, businesses.id))
    .where(eq(businessMembers.userId, userRow.id))
    .limit(1);

  if (!memberRow) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "No business membership." } },
      { status: 403 },
    );
  }

  const role = memberRow.role as AuthContext["role"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Insufficient role." } },
      { status: 403 },
    );
  }

  return handler(req, {
    userId: userRow.id,
    userName: userRow.name,
    // Nullable — do not add a guard here. See AuthContext.phoneE164.
    phoneE164: userRow.phoneE164,
    businessId: memberRow.businessId,
    businessName: memberRow.businessName,
    role,
  });
}

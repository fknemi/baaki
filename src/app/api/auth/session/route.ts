import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
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
        console.error("[session] verifyIdToken failed:", err);   // ← add this line
        return NextResponse.json(
            { error: { code: "UNAUTHENTICATED", message: "Invalid or expired token." } },
            { status: 401 },
        );
    }
    const phone = decoded.phone_number;
    if (!phone) {
        return NextResponse.json(
            { error: { code: "UNAUTHENTICATED", message: "Phone number required." } },
            { status: 401 },
        );
    }

    // Upsert user by phone
    let [userRow] = await db.select().from(users).where(eq(users.phoneE164, phone)).limit(1);
    if (!userRow) {
        const [inserted] = await db
            .insert(users)
            .values({ phoneE164: phone, name: decoded.name ?? "Baaki user" })
            .returning();
        userRow = inserted!;
    }

    // Demo mode: link every new user to the first seeded business
    let [memberRow] = await db
        .select()
        .from(businessMembers)
        .where(eq(businessMembers.userId, userRow.id))
        .limit(1);

    if (!memberRow) {
        const [demoBiz] = await db.select().from(businesses).limit(1);
        if (!demoBiz) {
            return NextResponse.json(
                { error: { code: "INTERNAL", message: "No demo business seeded. Run bun seed." } },
                { status: 500 },
            );
        }
        const [inserted] = await db
            .insert(businessMembers)
            .values({ businessId: demoBiz.id, userId: userRow.id, role: "owner", acceptedAt: new Date() })
            .returning();
        memberRow = inserted!;
    }

    await createSession(userRow.id);

    return NextResponse.json({
        data: { user: { id: userRow.id, name: userRow.name, phone: userRow.phoneE164 } },
    });
}

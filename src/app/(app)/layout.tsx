import { connection } from "next/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { businesses, businessMembers } from "@/lib/db/schema";

export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
    await connection();
    const session = await getSession();
    if (!session) {
        const h = await headers();
        const pathname = h.get("x-pathname") ?? "/dashboard";
        redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }

    const [member] = await db
        .select()
        .from(businessMembers)
        .where(eq(businessMembers.userId, session.userId))
        .limit(1);
    const [biz] = member
        ? await db
            .select({ name: businesses.name })
            .from(businesses)
            .where(eq(businesses.id, member.businessId))
            .limit(1)
        : [];

    const businessName = biz?.name ?? "Baaki";

    return <>{children}</>;
}

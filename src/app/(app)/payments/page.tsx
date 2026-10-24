export const instant = false;

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { businessMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PaymentsClient } from "./client";

export default async function PaymentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [member] = await db
    .select()
    .from(businessMembers)
    .where(eq(businessMembers.userId, session.userId))
    .limit(1);
  if (!member) redirect("/dashboard");

  return <PaymentsClient />;
}

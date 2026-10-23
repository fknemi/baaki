export const instant = false;

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { businesses, businessMembers } from "@/lib/db/schema";
import { LadderEditor } from "./editor";

export default async function LadderSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [member] = await db
    .select()
    .from(businessMembers)
    .where(eq(businessMembers.userId, session.userId))
    .limit(1);
  if (!member) redirect("/dashboard");

  const [biz] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, member.businessId))
    .limit(1);
  if (!biz) redirect("/dashboard");

  return (
    <LadderEditor
      ladder={(biz.ladderOverride as { day: number; key: string }[] | null) ?? null}
      autoSend={(biz.autoSendStages as string[] | null) ?? ["headsUp", "dueDate"]}
    />
  );
}

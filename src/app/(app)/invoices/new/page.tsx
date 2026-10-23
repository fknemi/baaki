export const instant = false;

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { businesses, businessMembers, customers } from "@/lib/db/schema";
import { todayIST } from "@/lib/domain/dates";
import { Wizard } from "./wizard";

export default async function NewInvoicePage() {
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

  const customerList = await db
    .select({
      id: customers.id,
      name: customers.name,
      gstin: customers.gstin,
      stateCode: customers.stateCode,
      city: customers.city,
    })
    .from(customers)
    .where(eq(customers.businessId, member.businessId))
    .orderBy(customers.name);

  const stateCode =
    (biz.addressJson as { stateCode?: string } | null)?.stateCode ?? "27";

  return (
    <Wizard
      customers={customerList}
      business={{
        id: biz.id,
        name: biz.name,
        gstin: biz.gstin,
        stateCode,
        registrationType: biz.registrationType,
        everCrossedEinvoiceThreshold: biz.everCrossedEinvoiceThreshold,
      }}
      today={todayIST()}
    />
  );
}

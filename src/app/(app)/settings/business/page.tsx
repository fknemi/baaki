export const instant = false;

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { businesses, businessMembers, users } from "@/lib/db/schema";
import { BusinessProfileForm } from "./form";

export default async function BusinessSettingsPage() {
  const session = await getSession();
  if (!session?.userId) redirect("/login");

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

  const [owner] = await db
    .select({ name: users.name, phone: users.phoneE164 })
    .from(users)
    .where(eq(users.id, biz.ownerId))
    .limit(1);

  const addressJson = biz.addressJson as {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    stateCode?: string;
    pincode?: string;
  };
  const bankJson = biz.bankJson as {
    accountName?: string;
    accountNumberMasked?: string;
    ifsc?: string;
    bankName?: string;
  } | null;

  return (
    <main className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">Business profile</h1>
      <BusinessProfileForm
        initial={{
          name: biz.name,
          ownerName: owner?.name ?? "",
          ownerPhone: owner?.phone ?? "",
          gstin: biz.gstin,
          registrationType: biz.registrationType,
          turnoverPaise: biz.turnoverPaise,
          everCrossedEinvoiceThreshold: biz.everCrossedEinvoiceThreshold,
          udyamRegistered: biz.udyamRegistered,
          udyamType: biz.udyamType,
          upiId: biz.upiId,
          safetyBufferPaise: biz.safetyBufferPaise,
          address: {
            line1: addressJson.line1 ?? "",
            city: addressJson.city ?? "",
            state: addressJson.state ?? "",
            pincode: addressJson.pincode ?? "",
          },
          bank: bankJson?.accountNumberMasked
            ? {
                accountName: bankJson.accountName ?? "",
                accountNumberMasked: bankJson.accountNumberMasked,
                ifsc: bankJson.ifsc ?? "",
                bankName: bankJson.bankName ?? "",
              }
            : null,
        }}
      />
    </main>
  );
}

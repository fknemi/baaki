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

  const paymentMethods = Array.isArray(biz.paymentMethods)
    ? (biz.paymentMethods as string[])
    : ["upi"];

  return (
    // Container max-width matches the parent Settings page (`md:max-w-3xl
    // lg:max-w-4xl xl:max-w-4xl`) so navigating in/out of this route keeps
    // the same content width — the form doesn't snap from a 4xl-wide page
    // back to a phone-width sheet on desktop.
    <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 sm:max-w-xl sm:space-y-4 sm:px-4 sm:pt-16 md:max-w-3xl md:space-y-4 md:px-6 md:pt-20 lg:max-w-4xl lg:space-y-5 lg:px-6 lg:pb-32 lg:pt-24 xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24">
      <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
        Business profile
      </h1>
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
          paymentMethods,
        }}
      />
    </main>
  );
}

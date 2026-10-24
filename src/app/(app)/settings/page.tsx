export const instant = false;
import { ResetDemoButton } from "@/components/reset-demo-button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SettingsPreferences } from "@/components/settings-preferences";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">Settings</h1>

      <ul className="space-y-2">
        <li>
          <Link
            href="/settings/business"
            className="block rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
          >
            <div className="font-medium">Business profile</div>
            <div className="text-muted-foreground text-xs">Name, GSTIN, Udyam, UPI ID</div>
          </Link>
        </li>
        <li>
          <Link
            href="/settings/ladder"
            className="block rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
          >
            <div className="font-medium">Escalation ladder</div>
            <div className="text-muted-foreground text-xs">6 stages · auto-send toggles</div>
          </Link>
        </li>
        <li>
          <Link
            href="/help"
            className="block rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
          >
            <div className="font-medium">Help & AI assistant</div>
            <div className="text-muted-foreground text-xs">
              Ask about GST, receivables, or how Baaki works
            </div>
          </Link>
        </li>
      </ul>

      <SettingsPreferences />

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">Reset demo</h3>
        <p className="text-muted-foreground mt-1 text-xs">Restores pristine seed data</p>

        <ResetDemoButton />
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">About</h3>
        <p className="mt-1 text-xs text-[#5A6170]">
          Prototype · all data synthetic. Built for HackCache &apos;26 · Problem 4. For current GST
          rates, see cbic-gst.gov.in.
        </p>
      </section>
    </main>
  );
}

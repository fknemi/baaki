export const instant = false;
import { ResetDemoButton } from "@/components/reset-demo-button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SettingsPreferences } from "@/components/settings-preferences";

// ─── outline icon ────────────────────────────────────────────────────────────

function IconChevronRight({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

const CARD = "rounded-xl border border-white/10";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="space-y-4 p-4 pb-24 pt-14">
      <h1 className="text-xl font-semibold text-white">Settings</h1>

      <ul className="space-y-2">
        <li>
          <Link
            href="/settings/business"
            className={`flex items-center justify-between gap-3 ${CARD} p-4 hover:bg-white/5`}
          >
            <div className="min-w-0">
              <div className="font-medium text-white">Business profile</div>
              <div className="text-xs text-white italic">
                Name, GSTIN, Udyam, UPI ID
              </div>
            </div>
            <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-white/50" />
          </Link>
        </li>
        <li>
          <Link
            href="/settings/ladder"
            className={`flex items-center justify-between gap-3 ${CARD} p-4 hover:bg-white/5`}
          >
            <div className="min-w-0">
              <div className="font-medium text-white">Escalation ladder</div>
              <div className="text-xs text-white italic">
                6 stages · auto-send toggles
              </div>
            </div>
            <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-white/50" />
          </Link>
        </li>
        <li>
          <Link
            href="/settings/expenses"
            className={`flex items-center justify-between gap-3 ${CARD} p-4 hover:bg-white/5`}
          >
            <div className="min-w-0">
              <div className="font-medium text-white">Expenses</div>
              <div className="text-xs text-white italic">
                Recurring costs, due dates, paid status
              </div>
            </div>
            <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-white/50" />
          </Link>
        </li>
        <li>
          <Link
            href="/help"
            className={`flex items-center justify-between gap-3 ${CARD} p-4 hover:bg-white/5`}
          >
            <div className="min-w-0">
              <div className="font-medium text-white">Help & AI assistant</div>
              <div className="text-xs text-white italic">
                Ask about GST, receivables, or how Baaki works
              </div>
            </div>
            <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-white/50" />
          </Link>
        </li>
      </ul>

      <SettingsPreferences />

      <section className={`${CARD} p-4`}>
        <h3 className="text-sm font-semibold text-white">Reset demo</h3>
        <p className="mt-1 text-xs text-white italic">
          Restores pristine seed data
        </p>

        <ResetDemoButton />
      </section>

      <section className={`${CARD} p-4`}>
        <h3 className="text-sm font-semibold text-white">About</h3>
        <p className="mt-1 text-xs text-white italic">
          Prototype · all data synthetic. Built for HackCache &apos;26 · Problem
          4. For current GST rates, see cbic-gst.gov.in.
        </p>
      </section>
    </main>
  );
}

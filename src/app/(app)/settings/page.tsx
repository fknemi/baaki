export const instant = false;
import { ResetDemoButton } from "@/components/reset-demo-button";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { SettingsPreferences } from "@/components/settings-preferences";

// ─── outline icon ────────────────────────────────────────────────────────────

const ICON_CHEVRON =
  "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";
const LINK_CHEVRON = `${ICON_CHEVRON} shrink-0 text-white/50`;

function IconChevronRight({ className = ICON_CHEVRON }: { className?: string }) {
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

// Card chrome — radius ladder matches every other card in the app.
const CARD =
  "rounded-lg border border-white/10 sm:rounded-xl md:rounded-xl lg:rounded-2xl xl:rounded-2xl";

// One settings link — shared chrome so the four rows stay pixel-identical
// in every dimension except their title/subtitle text.
const LINK_ROW =
  "flex items-center justify-between gap-2 hover:bg-white/5 " +
  "p-3 sm:gap-3 sm:p-4 md:gap-3 md:p-4 lg:gap-4 lg:p-5 xl:gap-4 xl:p-5";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 sm:max-w-xl sm:space-y-4 sm:px-4 sm:pt-16 md:max-w-3xl md:space-y-4 md:px-6 md:pt-20 lg:max-w-4xl lg:space-y-5 lg:px-6 lg:pb-32 lg:pt-24 xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24">
      <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
        Settings
      </h1>

      {/* auto-rows-fr — forces every grid row to the height of the tallest
          card in the entire grid, so ALL FOUR cards match height, not just
          the two per row. flex on <li> + w-full on <Link> stretches each
          card to fill its grid cell (default align-items:stretch).
          line-clamp-2 on the subtitle — safety net so a future longer
          subtitle can't blow up the shared row height. */}
      <ul className="grid auto-rows-fr grid-cols-1 gap-2 sm:gap-2 md:grid-cols-2 md:gap-3 lg:gap-3 xl:gap-4">
        <li className="flex">
          <Link
            href="/settings/business"
            className={`${CARD} ${LINK_ROW} w-full`}
          >
            <div className="min-w-0">
              <div className="font-medium text-white text-sm sm:text-base md:text-base lg:text-lg xl:text-lg">
                Business profile
              </div>
              <div className="italic text-white text-xs sm:text-sm md:text-sm lg:text-base xl:text-base line-clamp-2">
                Name, GSTIN, Udyam, UPI ID
              </div>
            </div>
            <IconChevronRight className={LINK_CHEVRON} />
          </Link>
        </li>
        <li className="flex">
          <Link
            href="/settings/ladder"
            className={`${CARD} ${LINK_ROW} w-full`}
          >
            <div className="min-w-0">
              <div className="font-medium text-white text-sm sm:text-base md:text-base lg:text-lg xl:text-lg">
                Escalation ladder
              </div>
              <div className="italic text-white text-xs sm:text-sm md:text-sm lg:text-base xl:text-base line-clamp-2">
                6 stages · auto-send toggles
              </div>
            </div>
            <IconChevronRight className={LINK_CHEVRON} />
          </Link>
        </li>
        <li className="flex">
          <Link
            href="/settings/expenses"
            className={`${CARD} ${LINK_ROW} w-full`}
          >
            <div className="min-w-0">
              <div className="font-medium text-white text-sm sm:text-base md:text-base lg:text-lg xl:text-lg">
                Expenses
              </div>
              <div className="italic text-white text-xs sm:text-sm md:text-sm lg:text-base xl:text-base line-clamp-2">
                Recurring costs, due dates, paid status
              </div>
            </div>
            <IconChevronRight className={LINK_CHEVRON} />
          </Link>
        </li>
        <li className="flex">
          <Link
            href="/help"
            className={`${CARD} ${LINK_ROW} w-full`}
          >
            <div className="min-w-0">
              <div className="font-medium text-white text-sm sm:text-base md:text-base lg:text-lg xl:text-lg">
                Help &amp; AI assistant
              </div>
              <div className="italic text-white text-xs sm:text-sm md:text-sm lg:text-base xl:text-base line-clamp-2">
                Ask about GST, receivables, or how Baaki works
              </div>
            </div>
            <IconChevronRight className={LINK_CHEVRON} />
          </Link>
        </li>
      </ul>

      <SettingsPreferences />

      <section className={`${CARD} p-3 sm:p-4 md:p-4 lg:p-5 xl:p-5`}>
        <h3 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
          Reset demo
        </h3>
        <p className="mt-1 text-xs italic text-white sm:mt-1 sm:text-sm md:mt-1.5 md:text-sm lg:mt-2 lg:text-base xl:mt-2 xl:text-base">
          Restores pristine seed data
        </p>

        <ResetDemoButton />
      </section>

      <section className={`${CARD} p-3 sm:p-4 md:p-4 lg:p-5 xl:p-5`}>
        <h3 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
          About
        </h3>
        <p className="mt-1 text-xs italic text-white sm:mt-1 sm:text-sm md:mt-1.5 md:text-sm lg:mt-2 lg:text-base xl:mt-2 xl:text-base">
          Prototype · all data synthetic. Built for HackCache &apos;26 · Problem
          4. For current GST rates, see cbic-gst.gov.in.
        </p>
      </section>
    </main>
  );
}

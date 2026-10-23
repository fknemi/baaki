export const instant = false;

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const items = [
    { href: "/settings/business", label: "Business profile", desc: "Name, GSTIN, Udyam, UPI ID" },
    { href: "/settings/ladder", label: "Escalation ladder", desc: "6 stages · auto-send toggles" },
  ];

  return (
    <main className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">Settings</h1>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href}
              className="block rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
            >
              <div className="font-medium">{it.label}</div>
              <div className="text-xs text-muted-foreground">{it.desc}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

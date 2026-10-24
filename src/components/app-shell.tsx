"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LanguageToggle } from "./language-toggle";
import { DemoDateBadge } from "./demo-date-badge";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/invoices", label: "Invoices", icon: "▤" },
  { href: "/follow-ups", label: "Follow-ups", icon: "●" },
  { href: "/forecast", label: "Forecast", icon: "↗" },
  { href: "/more", label: "More", icon: "⋯" },
];

const MORE_ITEMS = [
  { href: "/chase", label: "Chase these first", desc: "Ranked by priority" },
  { href: "/payments", label: "Payments", desc: "Match bank statements" },
  { href: "/inbox", label: "Inbox", desc: "Disputes and claims" },
  { href: "/customers", label: "Customers", desc: "Grades and history" },
  { href: "/documents", label: "Documents", desc: "Letters and evidence" },
  { href: "/help", label: "Help & AI assistant", desc: "Ask about GST" },
  { href: "/settings", label: "Settings", desc: "Profile, ladder, demo" },
];

export function AppShell({
  children,
  businessName,
}: {
  children: React.ReactNode;
  businessName: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(href: string): boolean {
    if (href === "/more") return false;
    return pathname === href || pathname?.startsWith(href + "/");
  }

  function moreIsActive(): boolean {
    return MORE_ITEMS.some((m) => pathname === m.href || pathname?.startsWith(m.href + "/"));
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* HEADER */}
      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#E4E7EC] bg-white px-4"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/dashboard"
            className="truncate text-sm font-semibold text-[#1A1D23] hover:text-[#0F5C4E]"
          >
            {businessName}
          </Link>
          <DemoDateBadge />
        </div>
        <div className="flex items-center gap-1">
          <LanguageToggle />
          <Link
            href="/settings"
            className="rounded px-2 py-1 text-xs font-medium text-[#5A6170] hover:bg-[#F7F8FA]"
            aria-label="Text size and accessibility"
          >
            Aa
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded px-2 py-1 text-xs text-[#5A6170] hover:bg-[#F7F8FA]"
            aria-label="More options"
          >
            ⋮
          </button>
        </div>
      </header>

      {/* MAIN */}
      <div className="flex-1 pb-20">{children}</div>

      {/* BOTTOM NAV */}
      <nav
        className="fixed right-0 bottom-0 left-0 z-30 flex h-14 items-center justify-around border-t border-[#E4E7EC] bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/more" ? moreIsActive() : isActive(item.href);
          const isMore = item.href === "/more";
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                if (isMore) {
                  setMoreOpen(true);
                } else {
                  window.location.href = item.href;
                }
              }}
              className={`flex h-14 min-w-[48px] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] ${
                active ? "text-[#0F5C4E]" : "text-[#5A6170]"
              }`}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <span className="text-lg" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* MORE SHEET */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMoreOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">More</h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="text-[#5A6170] hover:text-[#1A1D23]"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {MORE_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="block rounded-lg p-3 hover:bg-[#F7F8FA]"
                  >
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-[10px] text-[#5A6170]">{item.desc}</div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* HEADER MENU SHEET */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMenuOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Options menu"
        >
          <div
            className="w-full max-w-md rounded-t-2xl bg-white p-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Options</h2>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="text-[#5A6170] hover:text-[#1A1D23]"
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              <li>
                <Link
                  href="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg p-3 hover:bg-[#F7F8FA]"
                >
                  Settings
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/business"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg p-3 hover:bg-[#F7F8FA]"
                >
                  Business profile
                </Link>
              </li>
              <li>
                <Link
                  href="/settings/ladder"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-lg p-3 hover:bg-[#F7F8FA]"
                >
                  Escalation ladder
                </Link>
              </li>
              <li>
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="block w-full rounded-lg p-3 text-left text-[#B42318] hover:bg-[#FEF3F2]"
                  >
                    Sign out
                  </button>
                </form>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

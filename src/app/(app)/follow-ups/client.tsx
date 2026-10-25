"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatINR } from "@/lib/domain/money";
import type { FollowUpsResult, FollowUpItem } from "@/lib/db/queries/follow-ups";

function addDays(yyyymmdd: string, days: number): string {
  const d = new Date(yyyymmdd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TABS = [
  { key: "dueToday", label: "Due today" },
  { key: "snoozed", label: "Snoozed" },
  { key: "promised", label: "Promised" },
  { key: "sentToday", label: "Sent today" },
] as const;

type Channel = "email" | "whatsapp" | "sms" | "call" | "manual";
type Language = "en" | "hi";

// ─── outline icons ───────────────────────────────────────────────────────────

function IconMessageCircle({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconMail({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconMessageSquare({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconPhone({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function IconCheck({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── shared styles ───────────────────────────────────────────────────────────

const PRIMARY_BTN =
  "flex items-center justify-center gap-1 rounded-lg bg-[#0F5C4E] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50";
const CALL_BTN =
  "flex items-center justify-center gap-1 rounded-lg bg-[#175CD3] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#175CD3]/90 disabled:opacity-50";
const SECONDARY_BTN =
  "rounded-lg border border-white/10 bg-[#171717]/20 px-2 py-1.5 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50";
const fieldSurface =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]";

function whatsappUri(phone: string, body: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  const monospace = "```\n" + body + "\n```";
  return `https://wa.me/${digits}?text=${encodeURIComponent(monospace)}`;
}

function smsUri(phone: string, body: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIOS) {
    return `sms:${digits}&body=${body}`;
  }
  return `sms:${digits}?body=${encodeURIComponent(body)}`;
}

export function FollowUpsClient({
  data,
  today,
}: {
  data: FollowUpsResult;
  today: string;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("dueToday");
  const items = data[tab];

  return (
    <main className="space-y-4 p-4 pb-24 pt-14">
      <h1 className="text-xl font-semibold text-white">Follow-ups</h1>

      <nav
        aria-label="Filter follow-ups"
        className="-mx-4 overflow-x-auto"
      >
        <ul className="flex gap-2 pb-1 px-4">
          {TABS.map((t) => {
            const isActive = tab === t.key;
            return (
              <li key={t.key}>
                <button
                  onClick={() => setTab(t.key)}
                  aria-pressed={isActive}
                  className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-white text-[#111]"
                      : "border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5"
                  }`}
                >
                  {t.label} ({data[t.key].length})
                </button>
              </li>
            );
          })}
          <li aria-hidden="true" className="w-4 shrink-0" />
        </ul>
      </nav>

      {items.length === 0 ? (
        <p className="flex items-center gap-1.5 rounded-lg border border-white/10 p-4 text-sm text-white italic">
          {tab === "dueToday" ? (
            <>
              <IconCheck className="h-3.5 w-3.5" />
              Nothing to chase today.
            </>
          ) : (
            "Nothing here."
          )}
        </p>
      ) : (
        <ul className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
          {items.map((item) => (
            <FollowUpCard key={item.invoiceId} item={item} today={today} />
          ))}
        </ul>
      )}
    </main>
  );
}

function FollowUpCard({ item, today }: { item: FollowUpItem; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<"none" | "snooze" | "promise">("none");
  const [snoozeDate, setSnoozeDate] = useState(addDays(today, 7));
  const [promiseDate, setPromiseDate] = useState(addDays(today, 10));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<Channel | null>(null);

  // Defaults to the customer's saved preference, but this is a per-send
  // override only — it does not write back to the customer record. The
  // server (getFollowUps) already computed both messageEn and messageHi,
  // so switching this is instant and needs no request; it only changes
  // which precomputed message text is shown and which language gets sent
  // in the POST body below. Nothing about the invoice — totals, items,
  // GST, invoice number — is affected by this; renderReminder only ever
  // builds message text.
  const [language, setLanguage] = useState<Language>(item.customerLanguage);

  const activeMessage =
    language === "hi" ? item.messageHi : item.messageEn;

  async function sendReminder(channel: Channel) {
    if (!item.stage) return;
    setSending(channel);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${item.invoiceId}/reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageKey: item.stage.key, channel, language }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed");
      }
      const json = await res.json();
      const already = json.data?.alreadySent === true;
      const serverBody: string =
        json.data?.message?.body ?? activeMessage?.body ?? "";

      if (!already) {
        const phone = item.customerPhone?.replace(/[^\d+]/g, "") ?? "";
        if (channel === "whatsapp" && phone) {
          window.open(whatsappUri(phone, serverBody), "_blank");
        } else if (channel === "sms" && phone) {
          window.location.href = smsUri(phone, serverBody);
        } else if (channel === "call" && phone) {
          window.location.href = `tel:${phone}`;
        }
      }

      router.refresh();
      if (already) setError("Already sent for this stage.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(null);
    }
  }

  async function postJSON(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error?.message ?? "Failed");
      }
      setSheet("none");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const stageLabel = item.stage?.key ?? "";
  const hasPhone = !!item.customerPhone;
  const hasEmail = !!item.customerEmail;
  const anySending = !!sending;
  const hasBothLanguages = item.messageEn !== null && item.messageHi !== null;

  return (
    <li className="rounded-xl border border-white/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-white italic">
            {stageLabel} · {item.sentStageKeys.length > 0 ? "reminded" : "new"}
          </div>
          <Link
            href={`/invoices/${item.invoiceId}`}
            className="mt-1 block truncate font-semibold text-white underline-offset-4 hover:underline"
          >
            {item.customerName}
          </Link>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-semibold tabular-nums text-white">
            {formatINR(item.outstandingPaise)}
          </div>
          {item.daysOverdue > 0 && (
            <div className="text-xs text-[#FF9B8F] italic">
              {item.daysOverdue}d overdue
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/5 bg-white/5 p-3 text-xs text-white">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="font-medium text-white">{item.invoiceNumber}</span>
          {hasBothLanguages && (
            <div
              role="group"
              aria-label="Follow-up language"
              className="flex shrink-0 overflow-hidden rounded-md border border-white/10"
            >
              <button
                type="button"
                onClick={() => setLanguage("en")}
                aria-pressed={language === "en"}
                className={`px-2 py-0.5 text-[10px] font-medium not-italic ${
                  language === "en"
                    ? "bg-white text-[#111]"
                    : "bg-transparent text-white hover:bg-white/10"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage("hi")}
                aria-pressed={language === "hi"}
                className={`px-2 py-0.5 text-[10px] font-medium not-italic ${
                  language === "hi"
                    ? "bg-white text-[#111]"
                    : "bg-transparent text-white hover:bg-white/10"
                }`}
              >
                हिं
              </button>
            </div>
          )}
        </div>
        {activeMessage ? (
          <p className="whitespace-pre-line italic">{activeMessage.body}</p>
        ) : (
          <p className="italic">No reminder stage active.</p>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-[#FF9B8F]">{error}</p>
      )}

      {/* Primary channels: real send */}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <button
          onClick={() => sendReminder("whatsapp")}
          disabled={anySending || !item.stage || !hasPhone}
          className={PRIMARY_BTN}
        >
          <IconMessageCircle />
          {sending === "whatsapp" ? "…" : "WhatsApp"}
        </button>
        <button
          onClick={() => sendReminder("email")}
          disabled={anySending || !item.stage || !hasEmail}
          className={PRIMARY_BTN}
        >
          <IconMail />
          {sending === "email" ? "…" : "Email"}
        </button>
        <button
          onClick={() => sendReminder("sms")}
          disabled={anySending || !item.stage || !hasPhone}
          className={PRIMARY_BTN}
        >
          <IconMessageSquare />
          {sending === "sms" ? "…" : "SMS"}
        </button>
        <button
          onClick={() => sendReminder("call")}
          disabled={anySending || !item.stage || !hasPhone}
          className={CALL_BTN}
        >
          <IconPhone />
          {sending === "call" ? "…" : "Call"}
        </button>
      </div>

      {/* Secondary row: workflow actions */}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          onClick={() => sendReminder("manual")}
          disabled={anySending || !item.stage}
          className={SECONDARY_BTN}
        >
          {sending === "manual" ? "…" : "Mark sent"}
        </button>
        <button
          onClick={() => setSheet("snooze")}
          className={SECONDARY_BTN}
        >
          Snooze
        </button>
        <button
          onClick={() => setSheet("promise")}
          className={SECONDARY_BTN}
        >
          Promise
        </button>
      </div>

      {sheet === "snooze" && (
        <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-[#171717]/20 p-3">
          <label className="text-xs text-white italic">Snooze until</label>
          <input
            type="date"
            min={today}
            value={snoozeDate}
            onChange={(e) => setSnoozeDate(e.target.value)}
            className={fieldSurface}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setSheet("none")}
              className={`flex-1 ${SECONDARY_BTN}`}
            >
              Cancel
            </button>
            <button
              onClick={() =>
                postJSON(`/api/invoices/${item.invoiceId}/snooze`, {
                  until: snoozeDate,
                })
              }
              disabled={busy}
              className="flex-1 rounded-lg bg-[#0F5C4E] py-1.5 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
            >
              {busy ? "…" : "Snooze"}
            </button>
          </div>
        </div>
      )}

      {sheet === "promise" && (
        <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-[#171717]/20 p-3">
          <label className="text-xs text-white italic">Promised date</label>
          <input
            type="date"
            min={today}
            value={promiseDate}
            onChange={(e) => setPromiseDate(e.target.value)}
            className={fieldSurface}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setSheet("none")}
              className={`flex-1 ${SECONDARY_BTN}`}
            >
              Cancel
            </button>
            <button
              onClick={() =>
                postJSON(`/api/invoices/${item.invoiceId}/promise`, {
                  promiseDate,
                })
              }
              disabled={busy}
              className="flex-1 rounded-lg bg-[#0F5C4E] py-1.5 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
            >
              {busy ? "…" : "Promise"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

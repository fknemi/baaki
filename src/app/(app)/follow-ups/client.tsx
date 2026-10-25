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


const STAGES = ["headsUp", "dueDate", "firm", "finalCall"] as const;

type StageKey = (typeof STAGES)[number];
type ApiChannel = "email" | "whatsapp" | "sms" | "call";
type Channel = ApiChannel;
type Language = "en" | "hi";

// ─── outline icons ───────────────────────────────────────────────────────────

const ICON_CHANNEL =
    "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";
const ICON_EMPTY =
    "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-5 lg:w-5 xl:h-5 xl:w-5";

function IconMessageCircle({ className = ICON_CHANNEL }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
    );
}

function IconMail({ className = ICON_CHANNEL }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
        </svg>
    );
}

function IconMessageSquare({ className = ICON_CHANNEL }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
    );
}

function IconPhone({ className = ICON_CHANNEL }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
        </svg>
    );
}

function IconCheck({ className = ICON_EMPTY }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

// ─── shared styles ───────────────────────────────────────────────────────────

const BTN_CHANNEL =
    "flex flex-col items-center justify-center font-medium text-white disabled:opacity-50 " +
    "gap-0.5 rounded-lg px-1 py-1.5 text-[10px] " +
    "sm:gap-0.5 sm:rounded-lg sm:px-1 sm:py-1.5 sm:text-[11px] " +
    "md:gap-1 md:rounded-xl md:px-1.5 md:py-2 md:text-xs " +
    "lg:gap-1 lg:rounded-xl lg:px-2 lg:py-2 lg:text-xs " +
    "xl:gap-1 xl:rounded-xl xl:px-2 xl:py-2 xl:text-sm";

const PRIMARY_BTN = `${BTN_CHANNEL} bg-[#0F5C4E] hover:bg-[#0F5C4E]/90`;
const CALL_BTN = `${BTN_CHANNEL} bg-[#175CD3] hover:bg-[#175CD3]/90`;

const SECONDARY_BTN =
    "flex items-center justify-center font-medium text-white hover:bg-white/5 disabled:opacity-50 " +
    "h-8 rounded-lg border border-white/10 bg-[#171717]/20 px-2 text-xs " +
    "sm:h-9 sm:rounded-lg sm:px-2.5 sm:text-xs " +
    "md:h-10 md:rounded-xl md:px-3 md:text-sm " +
    "lg:h-11 lg:rounded-xl lg:px-3.5 lg:text-sm " +
    "xl:h-11 xl:rounded-xl xl:px-4 xl:text-sm";

const INLINE_SUBMIT =
    "flex flex-1 items-center justify-center font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 " +
    "h-8 rounded-lg bg-[#0F5C4E] px-2 text-xs " +
    "sm:h-9 sm:rounded-lg sm:px-2.5 sm:text-xs " +
    "md:h-10 md:rounded-xl md:px-3 md:text-sm " +
    "lg:h-11 lg:rounded-xl lg:px-3.5 lg:text-sm " +
    "xl:h-11 xl:rounded-xl xl:px-4 xl:text-sm";

const fieldSurface =
    "w-full rounded-lg border border-white/10 bg-[#171717]/20 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark] " +
    "h-8 px-2 text-xs " +
    "sm:h-9 sm:rounded-lg sm:px-2.5 sm:text-sm " +
    "md:h-10 md:rounded-xl md:px-3 md:text-sm " +
    "lg:h-11 lg:rounded-xl lg:px-3.5 lg:text-sm " +
    "xl:h-11 xl:rounded-xl xl:px-4 xl:text-sm";

const SELECT_OPTION = "[&>option]:bg-[#192221] [&>option]:text-white";

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
        <main className="mx-auto w-full max-w-7xl px-3 pb-24 pt-14 sm:px-4 sm:pt-16 md:px-6 md:pt-20 lg:px-8 lg:pt-24">
            <div className="mb-3 space-y-3 sm:mb-4 sm:space-y-4 md:mb-5 md:space-y-5">
                <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
                    Follow-ups
                </h1>

                <nav
                    aria-label="Filter follow-ups"
                    className="-mx-3 overflow-x-auto sm:-mx-4 md:-mx-6 lg:-mx-8"
                >
                    <ul className="flex gap-2 px-3 pb-1 sm:gap-2 sm:px-4 md:gap-2.5 md:px-6 lg:gap-3 lg:px-8">
                        {TABS.map((t) => {
                            const isActive = tab === t.key;
                            return (
                                <li key={t.key}>
                                    <button
                                        onClick={() => setTab(t.key)}
                                        aria-pressed={isActive}
                                        className={`inline-block whitespace-nowrap rounded-full font-medium transition-colors ${"px-3 py-1.5 text-xs " +
                                            "sm:px-3.5 sm:py-1.5 sm:text-xs " +
                                            "md:px-4 md:py-2 md:text-sm " +
                                            "lg:px-4 lg:py-2 lg:text-sm " +
                                            "xl:px-5 xl:py-2.5 xl:text-base"
                                            } ${isActive
                                                ? "bg-white text-[#111]"
                                                : "border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5"
                                            }`}
                                    >
                                        {t.label} ({data[t.key].length})
                                    </button>
                                </li>
                            );
                        })}
                        <li aria-hidden="true" className="w-3 shrink-0 sm:w-4 md:w-4 lg:w-4 xl:w-5" />
                    </ul>
                </nav>
            </div>

            {items.length === 0 ? (
                <p className="flex items-center gap-1.5 rounded-lg border border-white/10 p-3 text-sm italic text-white sm:gap-1.5 sm:rounded-xl sm:p-4 sm:text-sm md:gap-2 md:rounded-xl md:p-5 md:text-sm lg:gap-2 lg:rounded-2xl lg:p-5 lg:text-base xl:gap-2.5 xl:rounded-2xl xl:p-6 xl:text-base">
                    {tab === "dueToday" ? (
                        <>
                            <IconCheck />
                            Nothing to chase today.
                        </>
                    ) : (
                        "Nothing here."
                    )}
                </p>
            ) : (
                <ul className="grid grid-cols-1 items-start gap-3 sm:gap-3 md:grid-cols-2 md:gap-4 lg:gap-4 xl:grid-cols-3 xl:gap-5">
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
    const [doneMsg, setDoneMsg] = useState<string | null>(null);
    const [sending, setSending] = useState<Channel | null>(null);
    const [language, setLanguage] = useState<Language>(item.customerLanguage);

    // Clamped strictly to a valid stage so the POST request never hits a 400
    const [stage, setStage] = useState<StageKey>(() => {
        const k = item.stage?.key as StageKey;
        return STAGES.includes(k) ? k : "headsUp";
    });

    // PREVIEW IS DYNAMIC! Instantly looks up the text for whatever stage is selected in the dropdown.
    // Fallback to original derived message if the backend hasn't been updated yet.
    const activeMessage = item.allMessages?.[stage]?.[language] ?? (language === "hi" ? item.messageHi : item.messageEn);

    // Clicking these buttons sends the intent AND logs it automatically.
    async function sendReminder(btnChannel: ApiChannel) {
        setSending(btnChannel);
        setError(null);
        setDoneMsg(null);
        try {
            const res = await fetch(`/api/invoices/${item.invoiceId}/reminder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    stageKey: stage,
                    channel: btnChannel,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message ?? "Failed");
            }

            const serverBody: string = activeMessage?.body ?? "";
            const phone = item.customerPhone?.replace(/[^\d+]/g, "") ?? "";

            if (btnChannel === "whatsapp" && phone) {
                window.open(whatsappUri(phone, serverBody), "_blank");
            } else if (btnChannel === "sms" && phone) {
                window.location.href = smsUri(phone, serverBody);
            } else if (btnChannel === "call" && phone) {
                window.location.href = `tel:${phone}`;
            }

            setDoneMsg(`Logged via ${btnChannel}`);
            setTimeout(() => setDoneMsg(null), 3000);
            router.refresh();
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

    return (
        <li className="flex h-full flex-col rounded-lg border border-white/10 p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-4 lg:rounded-2xl lg:p-5 xl:rounded-2xl xl:p-5">
            <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
                <div className="min-w-0">
                    <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-xs">
                        {stageLabel} · {item.sentStageKeys.length > 0 ? "reminded" : "new"}
                    </div>
                    <Link
                        href={`/invoices/${item.invoiceId}`}
                        className="mt-1 block truncate text-sm font-semibold text-white underline-offset-4 hover:underline sm:text-base md:text-base lg:text-lg xl:text-lg"
                    >
                        {item.customerName}
                    </Link>
                </div>
                <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-white sm:text-base md:text-base lg:text-lg xl:text-lg">
                        {formatINR(item.outstandingPaise)}
                    </div>
                    {item.daysOverdue > 0 && (
                        <div className="text-[10px] italic text-[#FF9B8F] sm:text-[11px] md:text-xs lg:text-xs xl:text-xs">
                            {item.daysOverdue}d overdue
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-2.5 flex-1 rounded-lg border border-white/5 bg-white/5 p-2.5 text-xs text-white sm:mt-3 sm:rounded-lg sm:p-3 sm:text-xs md:mt-3 md:rounded-xl md:p-3 md:text-sm lg:mt-4 lg:rounded-xl lg:p-3.5 lg:text-sm xl:mt-4 xl:rounded-xl xl:p-4 xl:text-sm">
                <div className="mb-1 flex items-center justify-between gap-2 sm:mb-1 sm:gap-2 md:mb-1.5 md:gap-2.5 lg:mb-1.5 lg:gap-3 xl:mb-2 xl:gap-3">
                    <span className="truncate font-medium text-white">{item.invoiceNumber}</span>
                    {/* Always render the language toggle since we now pre-render both text variants */}
                    <div
                        role="group"
                        aria-label="Follow-up language"
                        className="flex shrink-0 overflow-hidden rounded-md border border-white/10 sm:rounded-md md:rounded-lg lg:rounded-lg xl:rounded-lg"
                    >
                        <button
                            type="button"
                            onClick={() => setLanguage("en")}
                            aria-pressed={language === "en"}
                            className={`px-1.5 py-0.5 text-[10px] font-medium not-italic sm:px-2 sm:py-0.5 sm:text-[10px] md:px-2 md:py-1 md:text-xs lg:px-2.5 lg:py-1 lg:text-xs xl:px-3 xl:py-1 xl:text-xs ${language === "en"
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
                            className={`px-1.5 py-0.5 text-[10px] font-medium not-italic sm:px-2 sm:py-0.5 sm:text-[10px] md:px-2 md:py-1 md:text-xs lg:px-2.5 lg:py-1 lg:text-xs xl:px-3 xl:py-1 xl:text-xs ${language === "hi"
                                ? "bg-white text-[#111]"
                                : "bg-transparent text-white hover:bg-white/10"
                                }`}
                        >
                            हिं
                        </button>
                    </div>
                </div>
                {activeMessage ? (
                    <p className="whitespace-pre-line italic">{activeMessage.body}</p>
                ) : (
                    <p className="italic">No reminder stage active.</p>
                )}
            </div>

            {error && (
                <p className="mt-2 text-xs text-[#FF9B8F] sm:mt-2 sm:text-xs md:mt-2.5 md:text-sm lg:mt-3 lg:text-sm xl:mt-3 xl:text-sm">
                    {error}
                </p>
            )}

            {doneMsg && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[#4ADE80] sm:mt-2 sm:text-xs md:mt-2.5 md:text-sm lg:mt-3 lg:text-sm xl:mt-3 xl:text-sm">
                    <IconCheck className="h-3 w-3" />
                    {doneMsg}
                </p>
            )}

            {/* STAGE SELECTOR */}
            <div className="mt-2.5">
                <label className="flex flex-col gap-0.5">
                    <span className="text-[10px] italic text-white sm:text-[10px] md:text-xs lg:text-xs xl:text-xs">
                        Stage
                    </span>
                    <select
                        value={stage}
                        onChange={(e) => setStage(e.target.value as StageKey)}
                        className={`${fieldSurface} ${SELECT_OPTION}`}
                    >
                        {STAGES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {/* CHANNEL BUTTONS (These now handle the logging directly) */}
            <div className="mt-2.5 grid grid-cols-4 gap-1 sm:mt-3 sm:gap-1 md:mt-3 md:gap-1.5 lg:mt-4 lg:gap-2 xl:mt-4 xl:gap-2">
                <button
                    onClick={() => sendReminder("whatsapp")}
                    disabled={anySending || !hasPhone}
                    className={PRIMARY_BTN}
                >
                    <IconMessageCircle />
                    <span className="truncate">{sending === "whatsapp" ? "…" : "WhatsApp"}</span>
                </button>
                <button
                    onClick={() => sendReminder("email")}
                    disabled={anySending || !hasEmail}
                    className={PRIMARY_BTN}
                >
                    <IconMail />
                    <span className="truncate">{sending === "email" ? "…" : "Email"}</span>
                </button>
                <button
                    onClick={() => sendReminder("sms")}
                    disabled={anySending || !hasPhone}
                    className={PRIMARY_BTN}
                >
                    <IconMessageSquare />
                    <span className="truncate">{sending === "sms" ? "…" : "SMS"}</span>
                </button>
                <button
                    onClick={() => sendReminder("call")}
                    disabled={anySending || !hasPhone}
                    className={CALL_BTN}
                >
                    <IconPhone />
                    <span className="truncate">{sending === "call" ? "…" : "Call"}</span>
                </button>
            </div>

            {/* SNOOZE & PROMISE */}
            <div className="mt-2 grid grid-cols-2 gap-1 sm:mt-2 sm:gap-1 md:mt-2.5 md:gap-1.5 lg:mt-3 lg:gap-2 xl:mt-3 xl:gap-2">
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
                <div className="mt-2.5 space-y-2 rounded-lg border border-white/10 bg-[#171717]/20 p-2.5 sm:mt-3 sm:space-y-2 sm:rounded-lg sm:p-3 md:mt-3 md:space-y-2.5 md:rounded-xl md:p-3 lg:mt-4 lg:space-y-3 lg:rounded-xl lg:p-3.5 xl:mt-4 xl:space-y-3 xl:rounded-xl xl:p-4">
                    <label className="text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-sm">
                        Snooze until
                    </label>
                    <input
                        type="date"
                        min={today}
                        value={snoozeDate}
                        onChange={(e) => setSnoozeDate(e.target.value)}
                        className={fieldSurface}
                    />
                    <div className="flex gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3">
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
                            className={INLINE_SUBMIT}
                        >
                            {busy ? "…" : "Snooze"}
                        </button>
                    </div>
                </div>
            )}

            {sheet === "promise" && (
                <div className="mt-2.5 space-y-2 rounded-lg border border-white/10 bg-[#171717]/20 p-2.5 sm:mt-3 sm:space-y-2 sm:rounded-lg sm:p-3 md:mt-3 md:space-y-2.5 md:rounded-xl md:p-3 lg:mt-4 lg:space-y-3 lg:rounded-xl lg:p-3.5 xl:mt-4 xl:space-y-3 xl:rounded-xl xl:p-4">
                    <label className="text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-sm">
                        Promised date
                    </label>
                    <input
                        type="date"
                        min={today}
                        value={promiseDate}
                        onChange={(e) => setPromiseDate(e.target.value)}
                        className={fieldSurface}
                    />
                    <div className="flex gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3">
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
                            className={INLINE_SUBMIT}
                        >
                            {busy ? "…" : "Promise"}
                        </button>
                    </div>
                </div>
            )}
        </li>
    );
}

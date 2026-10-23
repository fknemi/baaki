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

function whatsappUri(phone: string, body: string): string {
    const digits = phone.replace(/[^\d]/g, "");
    // Triple backticks make WhatsApp render the enclosed text in monospace,
    // preserving the ASCII table's column alignment.
    const monospace = "```\n" + body + "\n```";
    return `https://wa.me/${digits}?text=${encodeURIComponent(monospace)}`;
}

function smsUri(phone: string, body: string): string {
    const digits = phone.replace(/[^\d+]/g, "");
    // iOS Safari ignores percent-encoding in the body param and renders the
    // encoded string literally, so pass the raw body. Android expects the
    // body to be URL-encoded.
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
        <main className="space-y-4 p-4 pb-24">
            <h1 className="text-xl font-semibold">Follow-ups</h1>

            <div className="flex gap-1 overflow-x-auto border-b border-[#E4E7EC] pb-1 text-xs">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`shrink-0 rounded-lg px-3 py-1.5 ${tab === t.key
                            ? "bg-[#0F5C4E] text-white"
                            : "text-[#5A6170] hover:bg-[#F7F8FA]"
                            }`}
                    >
                        {t.label} ({data[t.key].length})
                    </button>
                ))}
            </div>

            {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {tab === "dueToday" ? "Nothing to chase today 🎉" : "Nothing here."}
                </p>
            ) : (
                <ul className="space-y-3">
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

    async function sendReminder(channel: Channel) {
        if (!item.stage) return;
        setSending(channel);
        setError(null);
        try {
            const res = await fetch(`/api/invoices/${item.invoiceId}/reminder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stageKey: item.stage.key, channel }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message ?? "Failed");
            }
            const json = await res.json();
            const already = json.data?.alreadySent === true;
            const serverBody: string =
                json.data?.message?.body ?? item.message?.body ?? "";

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

    return (
        <li className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
            <div className="flex items-start justify-between">
                <div>
                    <div className="text-xs text-muted-foreground">
                        {stageLabel} · {item.sentStageKeys.length > 0 ? "reminded" : "new"}
                    </div>
                    <Link
                        href={`/invoices/${item.invoiceId}`}
                        className="mt-1 font-semibold hover:underline"
                    >
                        {item.customerName}
                    </Link>
                </div>
                <div className="text-right">
                    <div className="tabular-nums font-semibold">
                        {formatINR(item.outstandingPaise)}
                    </div>
                    {item.daysOverdue > 0 && (
                        <div className="text-xs text-[#B42318]">
                            {item.daysOverdue}d overdue
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-3 rounded-lg bg-[#F7F8FA] p-3 text-xs text-[#5A6170]">
                <div className="mb-1 font-medium text-[#1A1D23]">
                    {item.invoiceNumber}
                </div>
                {item.message ? (
                    <p className="whitespace-pre-line">{item.message.body}</p>
                ) : (
                    <p className="italic">No reminder stage active.</p>
                )}
            </div>

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            {/* Primary channels: real send */}
            <div className="mt-3 grid grid-cols-4 gap-2">
                <button
                    onClick={() => sendReminder("whatsapp")}
                    disabled={!!sending || !item.stage || !hasPhone}
                    className="rounded-lg bg-[#0F5C4E] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
                >
                    {sending === "whatsapp" ? "…" : "WhatsApp"}
                </button>
                <button
                    onClick={() => sendReminder("email")}
                    disabled={!!sending || !item.stage || !hasEmail}
                    className="rounded-lg bg-[#0F5C4E] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
                >
                    {sending === "email" ? "…" : "Email"}
                </button>
                <button
                    onClick={() => sendReminder("sms")}
                    disabled={!!sending || !item.stage || !hasPhone}
                    className="rounded-lg bg-[#0F5C4E] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
                >
                    {sending === "sms" ? "…" : "SMS"}
                </button>
                <button
                    onClick={() => sendReminder("call")}
                    disabled={!!sending || !item.stage || !hasPhone}
                    className="rounded-lg bg-[#175CD3] px-2 py-1.5 text-xs font-medium text-white hover:bg-[#175CD3]/90 disabled:opacity-50"
                >
                    {sending === "call" ? "…" : "📞 Call"}
                </button>
            </div>

            {/* Secondary row: workflow actions */}
            <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                    onClick={() => sendReminder("manual")}
                    disabled={!!sending || !item.stage}
                    className="rounded-lg bg-white px-2 py-1.5 text-xs ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA] disabled:opacity-50"
                >
                    {sending === "manual" ? "…" : "Mark sent"}
                </button>
                <button
                    onClick={() => setSheet("snooze")}
                    className="rounded-lg bg-white px-2 py-1.5 text-xs ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
                >
                    Snooze
                </button>
                <button
                    onClick={() => setSheet("promise")}
                    className="rounded-lg bg-white px-2 py-1.5 text-xs ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
                >
                    Promise
                </button>
            </div>

            {sheet === "snooze" && (
                <div className="mt-3 space-y-2 rounded-lg bg-white p-3 ring-1 ring-[#E4E7EC]">
                    <label className="text-xs text-muted-foreground">Snooze until</label>
                    <input
                        type="date"
                        min={today}
                        value={snoozeDate}
                        onChange={(e) => setSnoozeDate(e.target.value)}
                        className="w-full rounded-lg border border-[#E4E7EC] bg-white px-2 py-1.5 text-xs"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSheet("none")}
                            className="flex-1 rounded-lg bg-white py-1.5 text-xs ring-1 ring-[#E4E7EC]"
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
                            className="flex-1 rounded-lg bg-[#0F5C4E] py-1.5 text-xs text-white disabled:opacity-50"
                        >
                            {busy ? "…" : "Snooze"}
                        </button>
                    </div>
                </div>
            )}

            {sheet === "promise" && (
                <div className="mt-3 space-y-2 rounded-lg bg-white p-3 ring-1 ring-[#E4E7EC]">
                    <label className="text-xs text-muted-foreground">Promised date</label>
                    <input
                        type="date"
                        min={today}
                        value={promiseDate}
                        onChange={(e) => setPromiseDate(e.target.value)}
                        className="w-full rounded-lg border border-[#E4E7EC] bg-white px-2 py-1.5 text-xs"
                    />
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSheet("none")}
                            className="flex-1 rounded-lg bg-white py-1.5 text-xs ring-1 ring-[#E4E7EC]"
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
                            className="flex-1 rounded-lg bg-[#0F5C4E] py-1.5 text-xs text-white disabled:opacity-50"
                        >
                            {busy ? "…" : "Promise"}
                        </button>
                    </div>
                </div>
            )}
        </li>
    );
}

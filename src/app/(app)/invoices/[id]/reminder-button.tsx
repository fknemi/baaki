"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = ["headsUp", "dueDate", "firm", "finalCall"] as const;
const CHANNELS = ["email", "whatsapp", "sms", "call"] as const;

// ─── outline icons ───────────────────────────────────────────────────────────
// Capped at h-4 (16px) — going to h-5 inside the trigger/submit buttons looked
// oversized (same bug the InvoiceDetailPage icons had).

const ICON_STD =
    "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

function IconMail({ className = ICON_STD }: { className?: string }) {
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

function IconCheck({ className = ICON_STD }: { className?: string }) {
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

// Native <select> can't take an explicit h-* cleanly without breaking the
// option dropdown on some mobile browsers, so the scale is driven by
// responsive padding + font-size + radius. Both the outer control AND the
// text inside step through the full sm→md→lg→xl ladder.
const selectSurface =
    "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 [&>option]:bg-[#192221] [&>option]:text-white " +
    "sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-sm " +
    "md:rounded-xl md:px-3 md:py-2.5 md:text-base " +
    "lg:rounded-xl lg:px-3 lg:py-3 lg:text-base " +
    "xl:rounded-xl xl:px-3.5 xl:py-3 xl:text-lg";

export function ReminderButton({ invoiceId }: { invoiceId: string }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [stage, setStage] = useState<(typeof STAGES)[number]>("firm");
    const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("email");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/reminder`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stageKey: stage, channel }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message ?? "Could not record reminder");
            }
            const data = (await res.json()).data;
            setDone(data.alreadySent ? `${stage} already recorded` : `${stage} logged (${channel})`);
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not record reminder");
        } finally {
            setBusy(false);
        }
    }

    return (
        // self-start — see mark-paid-button.tsx for why.
        <div className="self-start">
            <button
                onClick={() => {
                    setOpen((v) => !v);
                    setDone(null);
                }}
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-center text-sm font-medium text-white hover:bg-white/5 sm:h-11 sm:gap-1.5 sm:rounded-lg sm:px-4 sm:text-sm md:h-12 md:gap-2 md:rounded-xl md:px-4 md:text-base lg:h-12 lg:gap-2 lg:rounded-xl lg:px-5 lg:text-base xl:h-14 xl:gap-2.5 xl:rounded-xl xl:px-6 xl:text-lg"
            >
                <IconMail />
                Log reminder
            </button>

            {done && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-white sm:mt-2 sm:gap-1.5 sm:text-xs md:mt-2.5 md:gap-2 md:text-sm lg:mt-3 lg:gap-2 lg:text-sm xl:mt-3 xl:gap-2.5 xl:text-base">
                    <IconCheck />
                    {done}
                </p>
            )}

            {open && !done && (
                <form
                    onSubmit={submit}
                    className="mt-2 space-y-2 rounded-lg border border-white/10 bg-[#171717]/20 p-3 sm:mt-2 sm:space-y-2 sm:rounded-lg sm:p-3 md:mt-3 md:space-y-2.5 md:rounded-xl md:p-4 lg:mt-3 lg:space-y-3 lg:rounded-xl lg:p-4 xl:mt-4 xl:space-y-3 xl:rounded-xl xl:p-5"
                >
                    <select
                        value={stage}
                        onChange={(e) => setStage(e.target.value as (typeof STAGES)[number])}
                        className={selectSurface}
                    >
                        {STAGES.map((s) => (
                            <option key={s} value={s}>
                                {s}
                            </option>
                        ))}
                    </select>
                    <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value as (typeof CHANNELS)[number])}
                        className={selectSurface}
                    >
                        {CHANNELS.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        disabled={busy}
                        className="h-9 w-full rounded-lg bg-[#0F5C4E] text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 sm:h-9 sm:rounded-lg sm:text-sm md:h-10 md:rounded-xl md:text-sm lg:h-11 lg:rounded-xl lg:text-base xl:h-12 xl:rounded-xl xl:text-base"
                    >
                        {busy ? "Logging…" : "Log reminder"}
                    </button>
                    {error && (
                        <p className="text-xs text-[#FF9B8F] sm:text-xs md:text-sm lg:text-sm xl:text-base">
                            {error}
                        </p>
                    )}
                </form>
            )}
        </div>
    );
}

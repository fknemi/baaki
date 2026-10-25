"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = ["headsUp", "dueDate", "firm", "finalCall"] as const;
const CHANNELS = ["email", "whatsapp", "sms", "call"] as const;

// ─── outline icons ───────────────────────────────────────────────────────────

function IconMail({ className = "h-3.5 w-3.5" }: { className?: string }) {
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

const selectSurface =
    "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-2 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 [&>option]:bg-[#192221] [&>option]:text-white";

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
                className="flex h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-[#171717]/20 px-4 text-sm font-medium text-white hover:bg-white/5"
            >
                <IconMail />
                Log reminder
            </button>

            {done && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-white">
                    <IconCheck className="h-3 w-3" />
                    {done}
                </p>
            )}

            {open && !done && (
                <form
                    onSubmit={submit}
                    className="mt-2 space-y-2 rounded-lg border border-white/10 bg-[#171717]/20 p-3"
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
                        className="w-full rounded-lg bg-[#0F5C4E] py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
                    >
                        {busy ? "Logging…" : "Log reminder"}
                    </button>
                    {error && <p className="text-xs text-[#FF9B8F]">{error}</p>}
                </form>
            )}
        </div>
    );
}

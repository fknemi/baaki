"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = ["headsUp", "dueDate", "firm", "finalCall"] as const;
const CHANNELS = ["email", "whatsapp", "sms"] as const;

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
    <div>
      <button
        onClick={() => {
          setOpen((v) => !v);
          setDone(null);
        }}
        className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA]"
      >
        ✉ Log reminder
      </button>

      {done && <p className="mt-2 text-xs text-green-700">✓ {done}</p>}

      {open && !done && (
        <form
          onSubmit={submit}
          className="mt-2 space-y-2 rounded-lg bg-white p-3 ring-1 ring-[#E4E7EC]"
        >
          <select
            value={stage}
            onChange={(e) => setStage(e.target.value as (typeof STAGES)[number])}
            className="w-full rounded-lg border border-[#E4E7EC] bg-white px-2 py-2 text-sm"
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
            className="w-full rounded-lg border border-[#E4E7EC] bg-white px-2 py-2 text-sm"
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
            className="w-full rounded-lg bg-[#0F5C4E] py-2 text-sm font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
          >
            {busy ? "Logging…" : "Log reminder"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </form>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/domain/config";

// ─── outline icons ───────────────────────────────────────────────────────────

function IconAlert({ className = "h-4 w-4" }: { className?: string }) {
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
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconCheck({ className = "h-3 w-3" }: { className?: string }) {
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

const fieldSurface =
  "rounded border border-white/10 bg-[#171717]/20 px-2 py-1 text-white focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]";

export function LadderEditor({
  ladder,
  autoSend,
}: {
  ladder: { day: number; key: string }[] | null;
  autoSend: string[];
}) {
  const router = useRouter();
  const initial = ladder ?? config.ladder.map((s) => ({ day: s.day, key: s.key }));
  const [rows, setRows] = useState(initial);
  const [auto, setAuto] = useState(new Set(autoSend));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function update(i: number, day: number) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, day } : r)));
  }

  function toggleAuto(key: string) {
    setAuto((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const sorted = [...rows].sort((a, b) => a.day - b.day);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i]!.day <= sorted[i - 1]!.day) {
          throw new Error("Day offsets must be strictly increasing.");
        }
      }

      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ladderOverride: sorted,
          autoSendStages: [...auto],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Save failed");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen p-4 pb-24 pt-14">
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-semibold text-white">Escalation ladder</h1>

        <div className="flex gap-2 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-white">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#FBBF24]" />
          <span>
            Demand letters are never sent automatically — you always press
            Send.
          </span>
        </div>

        <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
          {rows.map((row, i) => (
            <li
              key={row.key}
              className="rounded-lg border border-white/10 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white">
                  {row.key}
                </span>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-white italic">
                  <input
                    type="checkbox"
                    checked={auto.has(row.key)}
                    onChange={() => toggleAuto(row.key)}
                    className="h-3.5 w-3.5 accent-[#0F5C4E]"
                  />
                  auto-send
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <label className="text-white italic">Day</label>
                <input
                  type="number"
                  value={row.day}
                  onChange={(e) => update(i, Number(e.target.value))}
                  className={`w-20 ${fieldSurface}`}
                />
                <span className="text-white italic">
                  {row.day < 0
                    ? `${Math.abs(row.day)} days before due`
                    : row.day === 0
                      ? "on due date"
                      : `${row.day} days after due`}
                </span>
              </div>
            </li>
          ))}
        </ul>

        {error && <p className="text-xs text-[#FF9B8F]">{error}</p>}
        {saved && (
          <p className="flex items-center gap-1.5 text-xs text-white">
            <IconCheck className="h-3 w-3" />
            Saved
          </p>
        )}

        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded-lg bg-[#0F5C4E] py-3 text-sm font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save ladder"}
        </button>
      </div>
    </main>
  );
}

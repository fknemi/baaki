"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/domain/config";

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
    <main className="min-h-screen bg-[#F7F8FA] p-4 pb-24">
      <div className="mx-auto max-w-lg space-y-4">
        <h1 className="text-xl font-semibold">Escalation ladder</h1>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          ⚠ Demand letters are never sent automatically — you always press Send.
        </div>

        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={row.key} className="rounded-lg bg-white p-3 ring-1 ring-[#E4E7EC]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{row.key}</span>
                <label className="flex items-center gap-1 text-xs text-[#5A6170]">
                  <input
                    type="checkbox"
                    checked={auto.has(row.key)}
                    onChange={() => toggleAuto(row.key)}
                  />
                  auto-send
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <label className="text-[#5A6170]">Day</label>
                <input
                  type="number"
                  value={row.day}
                  onChange={(e) => update(i, Number(e.target.value))}
                  className="w-20 rounded border border-[#E4E7EC] px-2 py-1"
                />
                <span className="text-[#5A6170]">
                  {row.day < 0
                    ? `${Math.abs(row.day)} days before due`
                    : row.day === 0
                      ? "on due date"
                      : `${row.day} days after due`}
                </span>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {saved && <p className="text-xs text-green-700">✓ Saved</p>}

        <button
          onClick={save}
          disabled={busy}
          className="w-full rounded-lg bg-[#0F5C4E] py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save ladder"}
        </button>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/domain/config";

// ─── outline icons ───────────────────────────────────────────────────────────
// Two ladders, both capped at h-4 (16 px) on lg/xl so the glyph never
// overpowers the h-9→h-11 button / text-xs→text-lg card it sits in.

const ICON_STD =
  "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";
const ICON_MD =
  "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

function IconAlert({ className = ICON_MD }: { className?: string }) {
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

// ─── shared styles ───────────────────────────────────────────────────────────

// fieldSurface — the small "Day" number input on each row. Height AND
// text scale together so the control never stretches while the text stays
// tiny (the input-group bug from the OCR / MarkPaid passes). Kept smaller
// than the main form controls on purpose — this is an inline numeric cell
// inside a row card, not a full-width field.
const fieldSurface =
  "rounded-lg border border-white/10 bg-[#171717]/20 text-white " +
  "focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark] " +
  "h-8 px-2 text-xs " +
  "sm:h-9 sm:px-2.5 sm:text-sm " +
  "md:h-10 md:rounded-lg md:px-3 md:text-sm " +
  "lg:h-10 lg:rounded-lg lg:px-3 lg:text-base " +
  "xl:h-11 xl:rounded-lg xl:px-3.5 xl:text-base";

// Row card chrome — radius + padding ladder matches every other card in
// the app so the 4 stage tiles sit flush with the settings page above.
const ROW_CARD =
  "rounded-lg border border-white/10 p-3 " +
  "sm:rounded-xl sm:p-4 " +
  "md:rounded-xl md:p-4 " +
  "lg:rounded-2xl lg:p-5 " +
  "xl:rounded-2xl xl:p-5";

// Submit button — same ladder as every other CTA in the app.
const SUBMIT_BTN =
  "flex w-full items-center justify-center font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 " +
  "h-11 rounded-lg bg-[#0F5C4E] px-3 text-sm " +
  "sm:h-11 sm:px-4 sm:text-sm " +
  "md:h-12 md:rounded-xl md:px-4 md:text-base " +
  "lg:h-12 lg:rounded-xl lg:px-5 lg:text-base " +
  "xl:h-14 xl:rounded-xl xl:px-6 xl:text-lg";

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
    // mx-auto max-w-md → max-w-4xl — same container ladder as the parent
    // Settings page so navigating in/out of this route keeps a consistent
    // content width. Was `min-h-screen p-4 pb-24 pt-14` with no max-width,
    // which meant an 830px-wide row card on a 1440px monitor holding a
    // single tiny "Day [7] 7 days before due" line.
    <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 sm:max-w-xl sm:space-y-4 sm:px-4 sm:pt-16 md:max-w-3xl md:space-y-4 md:px-6 md:pt-20 lg:max-w-4xl lg:space-y-5 lg:px-6 lg:pb-32 lg:pt-24 xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24">
      <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
        Escalation ladder
      </h1>

      {/* Warning banner — was `p-3 text-xs` locked at every viewport, so on
          xl the banner stayed 12px inside a card whose neighbours had
          grown to text-base / text-lg. Now the padding and text grow
          together, and the icon merges onto the ladder instead of being
          pinned at h-4 by the caller override. */}
      <div className="flex gap-2 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-white sm:gap-2 sm:rounded-lg sm:p-3 sm:text-xs md:gap-2.5 md:rounded-xl md:p-4 md:text-sm lg:gap-3 lg:rounded-xl lg:p-4 lg:text-sm xl:gap-3 xl:rounded-xl xl:p-5 xl:text-base">
        <IconAlert className={`${ICON_MD} mt-0.5 shrink-0 text-[#FBBF24]`} />
        <span>
          Demand letters are never sent automatically — you always press
          Send.
        </span>
      </div>

      {/* Stage rows — 1-col on mobile → 2×2 at md. auto-rows-fr keeps
          both rows the same height so the borders line up instead of
          stair-stepping when the "auto-send" checkbox wraps or the "30
          days after due" line is a different width. Was a max-h-[60vh]
          vertical scroll trap — no longer needed; 4 items fit comfortably
          and the page scrolls naturally. */}
      <ul className="grid auto-rows-fr grid-cols-1 gap-2 sm:gap-2 md:grid-cols-2 md:gap-3 lg:gap-3 xl:gap-4">
        {rows.map((row, i) => (
          <li key={row.key} className={ROW_CARD}>
            {/* Top row: stage name + auto-send toggle */}
            <div className="flex items-center justify-between gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3">
              <span className="font-medium text-white text-sm sm:text-sm md:text-base lg:text-base xl:text-lg">
                {row.key}
              </span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs italic text-white sm:gap-1.5 sm:text-xs md:gap-2 md:text-sm lg:gap-2 lg:text-sm xl:gap-2.5 xl:text-base">
                <input
                  type="checkbox"
                  checked={auto.has(row.key)}
                  onChange={() => toggleAuto(row.key)}
                  className="accent-[#0F5C4E] h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-5 xl:w-5"
                />
                auto-send
              </label>
            </div>

            {/* Bottom row: Day label + numeric input + human-readable
                description. flex-wrap so on a narrow md (2-col inside
                max-w-3xl) if the description is long enough it drops to
                its own line cleanly instead of squashing the input. */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:mt-2 sm:gap-2 sm:text-xs md:mt-2.5 md:gap-2.5 md:text-sm lg:mt-3 lg:gap-3 lg:text-sm xl:mt-3 xl:gap-3 xl:text-base">
              <label className="italic text-white">Day</label>
              <input
                type="number"
                value={row.day}
                onChange={(e) => update(i, Number(e.target.value))}
                className={`w-20 sm:w-20 md:w-24 lg:w-24 xl:w-28 ${fieldSurface}`}
              />
              <span className="italic text-white">
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

      {error && (
        <p className="text-xs text-[#FF9B8F] sm:text-sm md:text-sm lg:text-base xl:text-base">
          {error}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-1.5 text-xs text-white sm:gap-1.5 sm:text-sm md:gap-2 md:text-sm lg:gap-2 lg:text-base xl:gap-2.5 xl:text-base">
          <IconCheck />
          Saved
        </p>
      )}

      <button
        onClick={save}
        disabled={busy}
        className={SUBMIT_BTN}
      >
        {busy ? "Saving…" : "Save ladder"}
      </button>
    </main>
  );
}

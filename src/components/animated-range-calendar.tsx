"use client";

import * as React from "react";
import gsap from "gsap";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Day as DayPickerDay, useDayPicker } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*                                   tuning                                   */
/* -------------------------------------------------------------------------- */

/** Seconds the blue path takes to cross ONE day cell. Higher = slower. */
const FLOW_SECONDS = 0.001;
/** Seconds per cell when the path drains back (cursor moved back / left). */
const DRAIN_SECONDS = 0.001;
/** After the click, whatever is still flowing finishes this much faster. */
const COMMIT_SPEEDUP = 0.2;
/** true = skip the flow for people whose OS asks for reduced motion. */
const RESPECT_REDUCED_MOTION = false;

/* -------------------------------------------------------------------------- */
/*                                   helpers                                  */
/* -------------------------------------------------------------------------- */

const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`);

const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const DATE_FMT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const MONTH_FMT = new Intl.DateTimeFormat(undefined, {
  month: "long",
  year: "numeric",
});

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

/* -------------------------------------------------------------------------- */
/*                               flow (the path)                              */
/* -------------------------------------------------------------------------- */

interface Flow {
  mode: "preview" | "commit";
  /** the cell the path flows out of (the invoice date) */
  anchor: string;
  /** chronological first / last key covered (null = nothing to show) */
  lo: string | null;
  hi: string | null;
  /** true = flowing towards later dates */
  forward: boolean;
  /** the hovered cell while previewing */
  head: string | null;
}

/** p: 0 = empty, 1 = full. dir: 1 = fills from the left, -1 = from the right. */
interface CellState {
  p: number;
  dir: 1 | -1;
  want: boolean;
}

interface CellItem {
  cell: HTMLElement;
  fill: HTMLElement;
  state: CellState;
  key: string;
  fresh: boolean;
  want: boolean;
}

interface FlowCtx {
  states: WeakMap<HTMLElement, CellState>;
  anchor: string | null;
  headCall: gsap.core.Tween | null;
}

function computeFlow(
  startKey: string | null,
  endKey: string | null,
  hoverKey: string | null,
): Flow | null {
  if (!startKey) return null;

  if (endKey) {
    const forward = endKey >= startKey;
    return {
      mode: "commit",
      anchor: startKey,
      lo: forward ? startKey : endKey,
      hi: forward ? endKey : startKey,
      forward,
      head: null,
    };
  }

  if (!hoverKey) {
    return { mode: "preview", anchor: startKey, lo: null, hi: null, forward: true, head: null };
  }

  const forward = hoverKey >= startKey;
  return {
    mode: "preview",
    anchor: startKey,
    lo: forward ? startKey : hoverKey,
    hi: forward ? hoverKey : startKey,
    forward,
    head: hoverKey,
  };
}

/** Reveals `p` of the bar with clip-path (no transforms => stays pixel crisp). */
function paint(fill: HTMLElement, s: CellState) {
  if (s.p >= 0.999) {
    fill.style.clipPath = "none";
    return;
  }
  const r = ((1 - Math.max(0, s.p)) * 100).toFixed(2);
  fill.style.clipPath = s.dir === 1 ? `inset(0 ${r}% 0 0)` : `inset(0 0 0 ${r}%)`;
}

/**
 * Cells are in DOM order (left -> right, row by row), so filling them one
 * after another makes the path run to the end of a row and then start again
 * at the beginning of the next row.
 */
function applyFlow(root: HTMLElement, flow: Flow | null, ctx: FlowCtx) {
  const items: CellItem[] = [];
  root.querySelectorAll<HTMLElement>("[data-arc-day]").forEach((cell) => {
    const fill = cell.querySelector<HTMLElement>(".arc-fill");
    if (!fill) return;
    let state = ctx.states.get(fill);
    const fresh = state === undefined;
    if (!state) {
      state = { p: 0, dir: 1, want: false };
      ctx.states.set(fill, state);
    }
    items.push({ cell, fill, state, key: cell.dataset.arcDay ?? "", fresh, want: false });
  });
  if (!items.length) return;

  gsap.killTweensOf(items.map((i) => i.state));
  ctx.headCall?.kill();
  ctx.headCall = null;

  const lo = flow?.lo ?? null;
  const hi = flow?.hi ?? null;
  const anchor = flow?.anchor ?? null;
  const forward = flow?.forward ?? true;
  const head = flow?.mode === "preview" ? flow.head : null;
  if (anchor) ctx.anchor = anchor;

  const calm =
    RESPECT_REDUCED_MOTION &&
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const perCell = calm ? 0.001 : FLOW_SECONDS * (flow?.mode === "commit" ? COMMIT_SPEEDUP : 1);
  const perDrain = calm ? 0.001 : DRAIN_SECONDS;

  // 1. classify every cell
  for (const it of items) {
    const { cell, fill, state, key } = it;
    delete cell.dataset.arcHead;
    it.want = lo !== null && hi !== null && key >= lo && key <= hi;
    state.want = it.want;

    // cells that just mounted (e.g. after a month change) snap to their final state
    if (it.fresh) {
      state.p = it.want ? 1 : 0;
      paint(fill, state);
    }

    if (it.want) {
      cell.dataset.arcPos =
        key === lo && key === hi ? "single" : key === lo ? "start" : key === hi ? "end" : "mid";
    } else if (state.p < 0.001) {
      delete cell.dataset.arcPos;
    }
  }

  // 2. flow out of the invoice date, one cell after the other
  let t = 0;
  for (const it of forward ? items : [...items].reverse()) {
    if (!it.want) continue;
    const { state, fill } = it;

    if (it.key === anchor) {
      state.p = 1;
      state.dir = forward ? 1 : -1;
      paint(fill, state);
      continue;
    }
    if (state.p > 0.999) continue;

    if (state.p < 0.001) {
      state.dir = forward ? 1 : -1;
      paint(fill, state);
    }

    const dur = perCell * (1 - state.p);
    gsap.to(state, {
      p: 1,
      duration: dur,
      delay: t,
      ease: "none",
      onUpdate: () => paint(fill, state),
    });
    t += dur;
  }

  // 3. the hovered date lights up once the path has reached it
  if (head && head !== anchor) {
    const headCell = items.find((i) => i.key === head)?.cell;
    if (headCell) {
      const reveal = () => {
        if (headCell.isConnected) headCell.dataset.arcHead = "1";
      };
      if (t > 0) ctx.headCall = gsap.delayedCall(t, reveal);
      else reveal();
    }
  }

  // 4. drain what is no longer covered, farthest cell first
  const anchorKey = anchor ?? ctx.anchor;
  let anchorIdx = anchorKey ? items.findIndex((i) => i.key >= anchorKey) : 0;
  if (anchorIdx < 0) anchorIdx = items.length;

  const drain = items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => !it.want && it.state.p > 0.001)
    .sort((a, b) => Math.abs(b.idx - anchorIdx) - Math.abs(a.idx - anchorIdx));

  let td = 0;
  for (const { it } of drain) {
    const { state, fill, cell } = it;
    const dur = perDrain * state.p;
    gsap.to(state, {
      p: 0,
      duration: dur,
      delay: td,
      ease: "none",
      onUpdate: () => paint(fill, state),
      onComplete: () => {
        if (!state.want) delete cell.dataset.arcPos;
      },
    });
    td += dur;
  }
}

/* -------------------------------------------------------------------------- */
/*                         calendar part overrides                            */
/* -------------------------------------------------------------------------- */

/** Every day cell gets a path track; GSAP reveals it with clip-path. */
function ArcDay(props: React.ComponentProps<typeof DayPickerDay>) {
  const { children, ...rest } = props;
  return (
    <DayPickerDay {...rest} {...{ "data-arc-day": toKey(props.day.date) }}>
      <span className="arc-fill" aria-hidden="true" />
      {children}
    </DayPickerDay>
  );
}

/**
 * shadcn's <Calendar> builds its `Root` inline, so every re-render of our
 * component gave React a brand-new component type and the whole month was
 * unmounted and rebuilt. Providing a stable Root stops that.
 */
function ArcRoot({
  rootRef,
  ...props
}: { rootRef?: React.Ref<HTMLDivElement> } & React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="calendar" ref={rootRef} {...props} />;
}

const NullNav = () => <></>;

function ArcMonthCaption(props: {
  calendarMonth?: { date?: Date };
  displayIndex?: number;
  children?: React.ReactNode;
}) {
  const ctx = useDayPicker();
  const prev = ctx.previousMonth;
  const next = ctx.nextMonth;

  const label =
    (props.calendarMonth?.date && MONTH_FMT.format(props.calendarMonth.date)) ||
    null;

  return (
    <div className="flex h-11 w-full items-center justify-between gap-2">
      <button
        type="button"
        disabled={!prev}
        onClick={() => prev && ctx.goToMonth(prev)}
        aria-label="Previous month"
        className="arc-nav-btn"
      >
        <ChevronLeft className="size-5" strokeWidth={2.25} />
      </button>

      <span className="truncate text-base font-semibold text-foreground">
        {label ?? props.children}
      </span>

      <button
        type="button"
        disabled={!next}
        onClick={() => next && ctx.goToMonth(next)}
        aria-label="Next month"
        className="arc-nav-btn"
      >
        <ChevronRight className="size-5" strokeWidth={2.25} />
      </button>
    </div>
  );
}

// Must be a stable object (see ArcRoot).
const CALENDAR_COMPONENTS = {
  Root: ArcRoot,
  Day: ArcDay,
  Nav: NullNav,
  MonthCaption: ArcMonthCaption,
};

const CALENDAR_CLASSNAMES = {
  months: "flex flex-col",
  month: "relative flex flex-col gap-4",
  month_caption: "w-full",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday:
    "min-w-0 flex-1 select-none py-2 text-center text-xs font-medium text-muted-foreground",
  week: "mt-1.5 flex w-full",
  day: "group/day relative flex w-full items-center justify-center p-0 text-center select-none",
  // the blue path is drawn by our own fill tracks, not by these
  range_start: "",
  range_end: "",
  range_middle: "",
  today: "arc-today",
  day_button: "arc-day-button",
};

/* -------------------------------------------------------------------------- */
/*                                 component                                  */
/* -------------------------------------------------------------------------- */

export interface AnimatedRangeCalendarProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
  defaultMonth?: Date;
  startLabel?: string;
  endLabel?: string;
}

export function AnimatedRangeCalendar({
  value,
  onChange,
  className,
  defaultMonth,
  startLabel = "Invoice date",
  endLabel = "Due date",
}: AnimatedRangeCalendarProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const startRef = React.useRef<HTMLSpanElement>(null);
  const endRef = React.useRef<HTMLSpanElement>(null);

  // Hover lives in a ref on purpose: it must NOT re-render the calendar.
  const hoverRef = React.useRef<string | null>(null);
  const ctxRef = React.useRef<FlowCtx>({
    states: new WeakMap(),
    anchor: null,
    headCall: null,
  });

  const [month, setMonth] = React.useState<Date | undefined>(defaultMonth);

  const startKey = value?.from ? toKey(value.from) : null;
  const endKey = value?.to ? toKey(value.to) : null;
  const hasRange = Boolean(startKey && endKey);
  const pickingEnd = Boolean(startKey) && !endKey;

  const keysRef = React.useRef({ startKey, endKey });
  keysRef.current = { startKey, endKey };

  const dayCount = React.useMemo(() => {
    if (!startKey || !endKey) return 0;
    return Math.round((Date.parse(endKey) - Date.parse(startKey)) / 86_400_000) + 1;
  }, [startKey, endKey]);

  const sync = React.useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const { startKey: s, endKey: e } = keysRef.current;
    applyFlow(root, computeFlow(s, e, hoverRef.current), ctxRef.current);
  }, []);

  /* ----------------------------- selection ------------------------------ */

  // We own the click logic so the invoice date is ALWAYS committed on its own
  // first (react-day-picker can set from === to on the first click, which
  // would skip the "pick the due date" step).
  const handleSelect = React.useCallback(
    (_range: DateRange | undefined, day: Date) => {
      const from = value?.from;
      if (!from || value?.to) {
        onChange({ from: day, to: undefined });
        return;
      }
      onChange(toKey(day) < toKey(from) ? { from: day, to: from } : { from, to: day });
    },
    [value, onChange],
  );

  const handleMonthChange = React.useCallback((m: Date) => {
    hoverRef.current = null;
    setMonth(m);
  }, []);

  /* ------------------------------- hover -------------------------------- */

  const trackHover = React.useCallback(
    (e: React.SyntheticEvent<HTMLElement>) => {
      const cell = (e.target as Element).closest<HTMLElement>("[data-arc-day]");
      const key = cell?.dataset.arcDay;
      if (!key || key === hoverRef.current) return;
      hoverRef.current = key;
      if (!keysRef.current.endKey) sync(); // a committed range ignores hover
    },
    [sync],
  );

  const clearHover = React.useCallback(() => {
    if (hoverRef.current === null) return;
    hoverRef.current = null;
    if (!keysRef.current.endKey) sync();
  }, [sync]);

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) clearHover();
    },
    [clearHover],
  );

  /* ---------------- sync the path whenever the value changes -------------- */

  // `month` is a dependency so freshly mounted cells are picked up.
  useIsoLayoutEffect(() => {
    sync();
  }, [startKey, endKey, month, sync]);

  /* --------------------- header value micro-animation ------------------- */

  React.useEffect(() => {
    const el = startRef.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { yPercent: 55, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
    );
    return () => {
      tween.kill();
    };
  }, [startKey]);

  React.useEffect(() => {
    const el = endRef.current;
    if (!el) return;
    const tween = gsap.fromTo(
      el,
      { yPercent: 55, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: 0.45, ease: "power3.out" },
    );
    return () => {
      tween.kill();
    };
  }, [endKey]);

  /* ----------------------- endpoint "pop" on commit ---------------------- */

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !hasRange) return;

    const buttons = root.querySelectorAll<HTMLElement>(
      'button[data-range-start="true"], button[data-range-end="true"]',
    );
    if (!buttons.length) return;

    const tween = gsap.fromTo(
      buttons,
      { scale: 0.82 },
      {
        scale: 1,
        duration: 0.5,
        ease: "back.out(2.4)",
        stagger: 0.06,
        overwrite: "auto",
        onComplete: () => {
          gsap.set(buttons, { clearProps: "transform" });
        },
      },
    );

    return () => {
      tween.kill();
    };
  }, [hasRange, startKey, endKey]);

  /* ------------------------------- cleanup ------------------------------ */

  React.useEffect(() => {
    const root = rootRef.current;
    const ctx = ctxRef.current;
    return () => {
      ctx.headCall?.kill();
      root?.querySelectorAll<HTMLElement>(".arc-fill").forEach((fill) => {
        const state = ctx.states.get(fill);
        if (state) gsap.killTweensOf(state);
      });
    };
  }, []);

  /* -------------------------------- render ------------------------------ */

  const hint = pickingEnd
    ? "Hover to preview, click to set the due date"
    : hasRange
      ? `${dayCount} day${dayCount === 1 ? "" : "s"} total`
      : "Pick the invoice date to begin";

  return (
    <div
      ref={rootRef}
      className={cn("arc-root relative mx-auto w-full min-w-0  h-fit ", className)}
    >
      <style>{CSS}</style>

      {/* ------------------------------ header ----------------------------- */}
      <div className="mb-4 grid grid-cols-2 gap-4 w-full ">
        <DateCard
          label={startLabel}
          filled={Boolean(startKey)}
          textRef={startRef}
          text={value?.from ? DATE_FMT.format(value.from) : "Select date"}
        />
        <DateCard
          label={endLabel}
          filled={Boolean(endKey)}
          textRef={endRef}
          text={value?.to ? DATE_FMT.format(value.to) : "Select date"}
        />
      </div>

      {/* ----------------------------- calendar ---------------------------- */}
      <div
        className="arc-calendar"
        onMouseOver={trackHover}
        onFocus={trackHover}
        onBlur={handleBlur}
        onMouseLeave={clearHover}
      >
        <Calendar
          mode="range"
          numberOfMonths={1}
          defaultMonth={defaultMonth ?? value?.from}
          selected={value}
          onSelect={handleSelect}
          onMonthChange={handleMonthChange}
          components={CALENDAR_COMPONENTS}
          className="w-full bg-transparent p-0"
          classNames={CALENDAR_CLASSNAMES}
        />
      </div>

      {/* ------------------------------ footer ----------------------------- */}
      <p
        className={cn(
          "mt-3 px-1 text-xs leading-4 font-medium transition-colors duration-300",
          pickingEnd ? "text-[var(--arc-accent)]" : "text-muted-foreground",
        )}
      >
        {hint}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 date card                                  */
/* -------------------------------------------------------------------------- */

function DateCard({
  label,
  filled,
  text,
  textRef,
}: {
  label: string;
  filled: boolean;
  text: string;
  textRef: React.RefObject<HTMLSpanElement | null>;
}) {
  return (
    <div className="min-w-0 px-1">
      <span className="block truncate text-[11px] font-semibold tracking-[0.09em] uppercase text-muted-foreground">
        {label}
      </span>

      <div className="mt-1 h-8 overflow-hidden">
        <span
          ref={textRef}
          aria-live="polite"
          className={cn(
            "block truncate text-[19px] leading-8 font-semibold tabular-nums transition-colors duration-300",
            filled ? "text-foreground" : "text-muted-foreground/50",
          )}
        >
          {text}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    CSS                                     */
/* -------------------------------------------------------------------------- */

const CSS = `
/* ---------------------------- theme + size tokens ---------------------------- */
.arc-root {
  --arc-accent: #2563eb;
  --arc-accent-soft: rgba(37, 99, 235, 0.10);
  --arc-path: rgba(37, 99, 235, 0.15);
  --arc-ring: rgba(37, 99, 235, 0.45);
  --arc-glow: rgba(37, 99, 235, 0.40);

  /* whole-pixel sizes keep every edge on the pixel grid (crisp) */
  --arc-cell-h: 40px;   /* height of one day row  */
  --arc-d-max: 42px;    /* day circle + path height (shrinks if the card is narrow) */
}
@media (max-width: 480px) {
  .arc-root { --arc-cell-h: 56px; --arc-d-max: 46px; }
}

.dark .arc-root {
  --arc-accent: #3b82f6;
  --arc-accent-soft: rgba(59, 130, 246, 0.16);
  --arc-path: rgba(59, 130, 246, 0.26);
  --arc-ring: rgba(96, 165, 250, 0.5);
  --arc-glow: rgba(59, 130, 246, 0.5);
}

/* the calendar always fits its card, never wider */
.arc-calendar { max-width: 100%; min-width: 0; }
.arc-calendar .rdp-root,
.arc-calendar [data-slot="calendar"] { width: 100%; max-width: 100%; }
.arc-calendar table { width: 100%; }

/* ------------------------------- nav ---------------------------------- */
.arc-nav-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  color: var(--foreground);
  opacity: 0.65;
  transition: background-color 180ms ease, color 180ms ease, opacity 180ms ease;
}
.arc-nav-btn:hover:not(:disabled) {
  background-color: var(--arc-accent-soft);
  color: var(--arc-accent);
  opacity: 1;
}
.arc-nav-btn:disabled { opacity: 0.2; cursor: not-allowed; }

/* ------------------------------ day cell ------------------------------ */
.arc-calendar td[data-arc-day] {
  position: relative;
  display: flex;
  flex: 1 1 0%;
  min-width: 0;
  align-items: center;
  justify-content: center;
  height: var(--arc-cell-h);
  padding: 0;
}

/* circle + path height: fixed on roomy cards, shrinks with the column on tight ones */
.arc-calendar td[data-arc-day] > button,
.arc-calendar td[data-arc-day] > .arc-fill { --arc-d: var(--arc-d-max); }
@supports (width: 1cqw) {
  .arc-calendar td[data-arc-day] { container-type: inline-size; }
  .arc-calendar td[data-arc-day] > button,
  .arc-calendar td[data-arc-day] > .arc-fill { --arc-d: min(var(--arc-d-max), 92cqw); }
}

/* ------------------- the path: one plain box per day ------------------- */
/* revealed with clip-path (no transforms / layers), so it stays razor sharp */
.arc-calendar td[data-arc-day] > .arc-fill {
  position: absolute;
  z-index: 0;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  margin: auto 0;
  height: var(--arc-d);
  background-color: var(--arc-path);
  pointer-events: none;
  clip-path: inset(0 100% 0 0); /* empty until GSAP reveals it */
}

/* rounded ends where a row starts / ends, so the path wraps like a ribbon */
.arc-calendar td[data-arc-day]:first-child > .arc-fill {
  border-top-left-radius: 9999px;
  border-bottom-left-radius: 9999px;
}
.arc-calendar td[data-arc-day]:last-child > .arc-fill {
  border-top-right-radius: 9999px;
  border-bottom-right-radius: 9999px;
}

/* first / last day: the path starts at the centre of the round button */
.arc-calendar td[data-arc-pos="start"] > .arc-fill { left: 50%; }
.arc-calendar td[data-arc-pos="end"] > .arc-fill { right: 50%; }
.arc-calendar td[data-arc-pos="single"] > .arc-fill { left: 50%; right: 50%; }

/* ------------------------------- buttons ------------------------------ */
.arc-calendar td[data-arc-day] > button {
  position: relative;
  z-index: 1;
  flex: none;
  width: var(--arc-d);
  height: var(--arc-d);
  min-width: 0;
  padding: 0;
  border-radius: 9999px;
  font-size: 1rem;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
}

/* endpoints + the hovered date once the path has reached it */
.arc-calendar button[data-range-start="true"],
.arc-calendar button[data-range-end="true"],
.arc-calendar button[data-selected-single="true"],
.arc-calendar td[data-arc-head="1"] > button {
  background-color: var(--arc-accent);
  color: #fff;
  box-shadow: 0 6px 14px -8px var(--arc-glow);
}
.arc-calendar button[data-range-start="true"]:hover,
.arc-calendar button[data-range-end="true"]:hover,
.arc-calendar button[data-selected-single="true"]:hover {
  background-color: var(--arc-accent);
  color: #fff;
}

/* days in the middle of a range stay transparent so the path shows through */
.arc-calendar button[data-range-middle="true"],
.arc-calendar button[data-range-middle="true"]:hover {
  background-color: transparent;
  color: inherit;
  box-shadow: none;
}

/* -------------------------------- today ------------------------------- */
.arc-calendar td.arc-today button {
  font-weight: 600;
  color: var(--arc-accent);
  box-shadow: inset 0 0 0 2px var(--arc-ring);
}
.arc-calendar td.arc-today button[data-range-start="true"],
.arc-calendar td.arc-today button[data-range-end="true"],
.arc-calendar td.arc-today button[data-selected-single="true"],
.arc-calendar td.arc-today[data-arc-head="1"] > button {
  color: #fff;
  box-shadow: 0 6px 14px -8px var(--arc-glow);
}
`;

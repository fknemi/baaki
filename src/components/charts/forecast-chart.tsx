"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { formatINR } from "@/lib/domain/money";
import type { ForecastRow } from "@/lib/domain/forecast";

const COLORS = {
  safe: "#54C48C",
  buffer: "#FBBF24",
  breach: "#EF4444",
  grid: "rgba(255,255,255,0.06)",
  axis: "rgba(255,255,255,0.4)",
  text: "rgba(255,255,255,0.7)",
  surface: "#192221",
};

const LAKH = 100 * 100000;

// How long the draw-in takes. Kept short and deliberate — this isn't a
// loading spinner, it's a "the line just moved" cue when what-if toggles
// change the trajectory.
const ANIM_MS = 650;

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: ForecastRow }>;
};

function ChartTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#192221] p-2.5 text-xs shadow-xl">
      <div className="font-medium text-white">Week {row.week}</div>
      <div className="text-[10px] text-white italic">
        {row.weekStart} – {row.weekEnd}
      </div>
      <div className="mt-2 space-y-0.5">
        <div className="flex justify-between gap-3 text-white">
          <span className="italic">Opening</span>
          <span className="tabular-nums">{formatINR(row.openingPaise)}</span>
        </div>
        <div className="flex justify-between gap-3 text-white">
          <span className="italic">Inflow</span>
          <span className="tabular-nums text-[#4ADE80]">
            +{formatINR(row.inflowPaise)}
          </span>
        </div>
        <div className="flex justify-between gap-3 text-white">
          <span className="italic">Outflow</span>
          <span className="tabular-nums text-[#FF9B8F]">
            −{formatINR(row.outflowPaise)}
          </span>
        </div>
        <div className="mt-1 flex justify-between gap-3 border-t border-white/10 pt-1 text-white">
          <span className="font-medium">Closing</span>
          <span className="font-semibold tabular-nums">
            {formatINR(row.closingPaise)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ForecastChart({
  rows,
  safetyBufferPaise,
  breachWeek,
  onWeekClick,
}: {
  rows: ForecastRow[];
  safetyBufferPaise: number;
  breachWeek: number | null;
  onWeekClick: (week: number) => void;
}) {
  // Convert to lakh units so Y-axis labels stay readable on 360px.
  const data = rows.map((r) => ({
    ...r,
    closingLakh: r.closingPaise / LAKH,
  }));
  const bufferLakh = safetyBufferPaise / LAKH;

  // Include both the trajectory and the buffer in the Y domain so the
  // reference line is always visible even when the two are far apart.
  const allValues = [
    ...rows.map((r) => r.closingPaise),
    safetyBufferPaise,
    0,
  ];
  const minLakh = Math.min(...allValues) / LAKH;
  const maxLakh = Math.max(...allValues) / LAKH;
  const span = Math.max(maxLakh - minLakh, 1);
  const domain: [number, number] = [
    minLakh - span * 0.08,
    maxLakh + span * 0.08,
  ];

  // Recharts re-runs its mount animation whenever the component identity
  // changes (via `key`), not on every prop update — if we just flipped
  // `isAnimationActive` to `true` with no key, every click anywhere in
  // the chart (tooltip hover, week click) risks a re-render that Recharts
  // *could* interpret as "replay the draw-in," which reads as flickery.
  //
  // Instead we derive a signature of the actual series shape — first/last
  // closing balance, row count, and which week breaches — and use that as
  // the `key`. It only changes when the trajectory itself changes (first
  // load, or a what-if toggle altering the forecast), which is exactly
  // when a redraw animation earns its place.
  const seriesSignature = useMemo(() => {
    const first = rows[0]?.closingPaise ?? 0;
    const last = rows[rows.length - 1]?.closingPaise ?? 0;
    return `${rows.length}-${first}-${last}-${breachWeek ?? "none"}`;
  }, [rows, breachWeek]);

  function handleClick(state: { activeLabel?: string | number | null }) {
    if (state?.activeLabel != null) {
      onWeekClick(Number(state.activeLabel));
    }
  }

  return (
    <div className="w-full rounded-xl border border-white/10 p-2">
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart
          key={seriesSignature}
          data={data}
          margin={{ top: 16, right: 44, left: -16, bottom: 0 }}
          onClick={handleClick}
        >
          <defs>
            <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.safe} stopOpacity={0.35} />
              <stop offset="100%" stopColor={COLORS.safe} stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            stroke={COLORS.grid}
            strokeDasharray="3 3"
            vertical={false}
          />

          <XAxis
            dataKey="week"
            stroke={COLORS.axis}
            tick={{ fill: COLORS.text, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(w: number) => `W${w}`}
            interval={1}
          />

          <YAxis
            domain={domain}
            stroke={COLORS.axis}
            tick={{ fill: COLORS.text, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => {
              const abs = Math.abs(v);
              if (abs >= 100) return `${(v / 100).toFixed(1)}Cr`;
              return `${v.toFixed(0)}L`;
            }}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{
              stroke: "rgba(255,255,255,0.2)",
              strokeDasharray: "4 4",
            }}
          />

          {/* Safety buffer reference */}
          <ReferenceLine
            y={bufferLakh}
            stroke={COLORS.buffer}
            strokeDasharray="4 4"
            isFront
            label={{
              value: "buffer",
              position: "insideTopRight",
              fill: COLORS.buffer,
              fontSize: 9,
            }}
          />

          {/* Vertical marker at breach week */}
          {breachWeek !== null && (
            <ReferenceLine
              x={breachWeek}
              stroke={COLORS.breach}
              strokeDasharray="2 4"
              strokeOpacity={0.8}
            />
          )}

          {/* Cash trajectory — Area so it has both line + subtle fill.
              Animates in on mount and whenever `seriesSignature` changes
              the ComposedChart's `key` above, which forces Recharts to
              treat it as a fresh mount and replay the draw-in. */}
          <Area
            type="monotone"
            dataKey="closingLakh"
            stroke={COLORS.safe}
            strokeWidth={2}
            fill="url(#forecastFill)"
            isAnimationActive
            animationDuration={ANIM_MS}
            animationEasing="ease-out"
            activeDot={{
              r: 5,
              fill: COLORS.safe,
              stroke: COLORS.surface,
              strokeWidth: 2,
            }}
            dot={(props: {
              cx?: number;
              cy?: number;
              payload?: { week: number };
            }) => {
              const { cx = 0, cy = 0, payload } = props;
              const isBreach = payload?.week === breachWeek;
              return (
                <circle
                  key={payload?.week ?? "dot"}
                  cx={cx}
                  cy={cy}
                  r={isBreach ? 4.5 : 2.5}
                  fill={isBreach ? COLORS.breach : COLORS.safe}
                  stroke={COLORS.surface}
                  strokeWidth={isBreach ? 2 : 1}
                />
              );
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 pb-1 pt-1 text-[10px] text-white italic">
        <span className="flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#54C48C]" />
          closing cash
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-0 w-3 border-t border-dashed border-[#FBBF24]" />
          buffer
        </span>
        {breachWeek !== null && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
            week {breachWeek} breach
          </span>
        )}
        <span className="italic opacity-60">tap a week for detail</span>
      </div>
    </div>
  );
}

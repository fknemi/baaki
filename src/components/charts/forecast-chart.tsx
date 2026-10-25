"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatINR, formatINRDelta } from "@/lib/domain/money";
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
const ANIM_MS = 650;

// ─── responsive size table ───────────────────────────────────────────────────
// Recharts props are SVG attributes, not Tailwind classes — the chart can't
// read `md:text-sm`. So every numeric prop that needs to scale is pulled
// from here, keyed off the same min-width thresholds Tailwind uses. The
// hook below mirrors Tailwind's default breakpoints exactly, so the chart
// grows in lockstep with the surrounding page (`max-w-md → max-w-4xl`).

type Breakpoint = "base" | "sm" | "md" | "lg" | "xl";

type SizePreset = {
    height: number;
    tick: number;
    dot: number;
    breachDot: number;
    activeDot: number;
    stroke: number;
    bufferLabel: number;
    margin: { top: number; right: number; left: number; bottom: number };
    yAxisWidth: number;
    xInterval: 0 | 1 | "preserveStartEnd";
};

const SIZES: Record<Breakpoint, SizePreset> = {
    base: {
        height: 240,
        tick: 10,
        dot: 2.5,
        breachDot: 4.5,
        activeDot: 5,
        stroke: 2,
        bufferLabel: 9,
        margin: { top: 16, right: 44, left: -16, bottom: 0 },
        yAxisWidth: 44,
        xInterval: 1,
    },
    sm: {
        height: 260,
        tick: 10,
        dot: 3,
        breachDot: 5,
        activeDot: 5.5,
        stroke: 2,
        bufferLabel: 10,
        margin: { top: 18, right: 48, left: -12, bottom: 0 },
        yAxisWidth: 48,
        xInterval: 1,
    },
    md: {
        height: 300,
        tick: 11,
        dot: 3,
        breachDot: 5.5,
        activeDot: 6,
        stroke: 2.5,
        bufferLabel: 11,
        margin: { top: 20, right: 52, left: -8, bottom: 0 },
        yAxisWidth: 52,
        xInterval: "preserveStartEnd",
    },
    lg: {
        height: 340,
        tick: 12,
        dot: 3.5,
        breachDot: 6,
        activeDot: 6.5,
        stroke: 2.5,
        bufferLabel: 11,
        margin: { top: 22, right: 56, left: -4, bottom: 0 },
        yAxisWidth: 56,
        xInterval: 0,
    },
    xl: {
        height: 380,
        tick: 12,
        dot: 4,
        breachDot: 6.5,
        activeDot: 7,
        stroke: 3,
        bufferLabel: 12,
        margin: { top: 24, right: 60, left: 0, bottom: 0 },
        yAxisWidth: 60,
        xInterval: 0,
    },
};

// Tracks the current Tailwind breakpoint via matchMedia. Returns "base"
// until the first client-side effect runs, which is fine because Recharts'
// ResponsiveContainer only produces real output client-side anyway.
function useBreakpoint(): Breakpoint {
    const [bp, setBp] = useState<Breakpoint>("base");

    useEffect(() => {
        const queries: Array<[Breakpoint, MediaQueryList]> = [
            ["xl", window.matchMedia("(min-width: 1280px)")],
            ["lg", window.matchMedia("(min-width: 1024px)")],
            ["md", window.matchMedia("(min-width: 768px)")],
            ["sm", window.matchMedia("(min-width: 640px)")],
        ];

        const update = () => {
            if (queries[0]![1].matches) setBp("xl");
            else if (queries[1]![1].matches) setBp("lg");
            else if (queries[2]![1].matches) setBp("md");
            else if (queries[3]![1].matches) setBp("sm");
            else setBp("base");
        };

        update();
        for (const [, m] of queries) m.addEventListener("change", update);
        return () => {
            for (const [, m] of queries) m.removeEventListener("change", update);
        };
    }, []);

    return bp;
}

// ─── tooltip ─────────────────────────────────────────────────────────────────

type TooltipProps = {
    active?: boolean;
    payload?: Array<{ payload: ForecastRow }>;
};

function ChartTooltip({ active, payload }: TooltipProps) {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    return (
        <div className="rounded-lg border border-white/10 bg-[#192221] p-2.5 text-xs shadow-xl sm:rounded-lg sm:p-3 sm:text-xs md:rounded-xl md:p-3.5 md:text-sm lg:rounded-xl lg:p-4 lg:text-sm xl:rounded-xl xl:p-4 xl:text-base">
            <div className="font-medium text-white">Week {row.week}</div>
            <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                {row.weekStart} – {row.weekEnd}
            </div>
            <div className="mt-2 space-y-0.5 sm:mt-2 sm:space-y-0.5 md:mt-2.5 md:space-y-1 lg:mt-3 lg:space-y-1 xl:mt-3 xl:space-y-1">
                <div className="flex justify-between gap-3 text-white sm:gap-3 md:gap-3.5 lg:gap-4 xl:gap-4">
                    <span className="italic">Opening</span>
                    <span className="tabular-nums">{formatINRDelta(row.openingPaise)}</span>
                </div>
                <div className="flex justify-between gap-3 text-white sm:gap-3 md:gap-3.5 lg:gap-4 xl:gap-4">
                    <span className="italic">Inflow</span>
                    <span className="tabular-nums text-[#4ADE80]">
                        +{formatINR(row.inflowPaise)}
                    </span>
                </div>
                <div className="flex justify-between gap-3 text-white sm:gap-3 md:gap-3.5 lg:gap-4 xl:gap-4">
                    <span className="italic">Outflow</span>
                    <span className="tabular-nums text-[#FF9B8F]">
                        −{formatINR(row.outflowPaise)}
                    </span>
                </div>
                <div className="mt-1 flex justify-between gap-3 border-t border-white/10 pt-1 text-white sm:mt-1 sm:gap-3 sm:pt-1 md:mt-1.5 md:gap-3.5 md:pt-1.5 lg:mt-2 lg:gap-4 lg:pt-1.5 xl:mt-2 xl:gap-4 xl:pt-2">
                    <span className="font-medium">Closing</span>
                    <span className="font-semibold tabular-nums">
                        {formatINRDelta(row.closingPaise)}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── chart ───────────────────────────────────────────────────────────────────

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
    const bp = useBreakpoint();
    const sz = SIZES[bp];

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

    // Same key-animation trick as before — only replay the draw-in when the
    // trajectory itself changes (first load, or a what-if toggle altering
    // the shape). Hovering / clicking / tooltip open must not trigger a
    // redraw.
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
        <div className="w-full rounded-lg border border-white/10 p-2 sm:rounded-xl sm:p-2.5 md:rounded-xl md:p-3 lg:rounded-2xl lg:p-3 xl:rounded-2xl xl:p-3.5">
            <ResponsiveContainer width="100%" height={sz.height}>
                <ComposedChart
                    key={seriesSignature}
                    data={data}
                    margin={sz.margin}
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
                        tick={{ fill: COLORS.text, fontSize: sz.tick }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(w: number) => `W${w}`}
                        interval={sz.xInterval}
                    />

                    <YAxis
                        domain={domain}
                        stroke={COLORS.axis}
                        tick={{ fill: COLORS.text, fontSize: sz.tick }}
                        tickLine={false}
                        axisLine={false}
                        width={sz.yAxisWidth}
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
                        {...({ isFront: true } as any)}
                        label={{
                            value: "buffer",
                            position: "insideTopRight",
                            fill: COLORS.buffer,
                            fontSize: sz.bufferLabel,
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

                    {/* Cash trajectory */}
                    <Area
                        type="monotone"
                        dataKey="closingLakh"
                        stroke={COLORS.safe}
                        strokeWidth={sz.stroke}
                        fill="url(#forecastFill)"
                        isAnimationActive
                        animationDuration={ANIM_MS}
                        animationEasing="ease-out"
                        activeDot={{
                            r: sz.activeDot,
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
                                    r={isBreach ? sz.breachDot : sz.dot}
                                    fill={isBreach ? COLORS.breach : COLORS.safe}
                                    stroke={COLORS.surface}
                                    strokeWidth={isBreach ? 2 : 1}
                                />
                            );
                        }}
                    />
                </ComposedChart>
            </ResponsiveContainer>

            {/* Legend — plain DOM, so a normal Tailwind ladder applies. */}
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-2 pb-1 pt-1 text-[10px] italic text-white sm:gap-x-3 sm:px-2 sm:pb-1 sm:pt-1 sm:text-[10px] md:gap-x-4 md:gap-y-1.5 md:px-2.5 md:pb-1.5 md:pt-1.5 md:text-xs lg:gap-x-4 lg:gap-y-1.5 lg:px-3 lg:pb-1.5 lg:pt-1.5 lg:text-xs xl:gap-x-5 xl:gap-y-2 xl:px-3 xl:pb-2 xl:pt-2 xl:text-sm">
                <span className="flex items-center gap-1 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#54C48C] sm:h-1.5 sm:w-1.5 md:h-2 md:w-2 lg:h-2 lg:w-2 xl:h-2.5 xl:w-2.5" />
                    closing cash
                </span>
                <span className="flex items-center gap-1 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2">
                    <span className="inline-block h-0 w-3 border-t border-dashed border-[#FBBF24] sm:w-3 md:w-3.5 lg:w-4 xl:w-4" />
                    buffer
                </span>
                {breachWeek !== null && (
                    <span className="flex items-center gap-1 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#EF4444] sm:h-1.5 sm:w-1.5 md:h-2 md:w-2 lg:h-2 lg:w-2 xl:h-2.5 xl:w-2.5" />
                        week {breachWeek} breach
                    </span>
                )}
                <span className="italic opacity-60">tap a week for detail</span>
            </div>
        </div>
    );
}

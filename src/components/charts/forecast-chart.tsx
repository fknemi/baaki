"use client";

import type { ForecastRow } from "@/lib/domain/forecast";

const lakh = (paise: number) =>
  (paise / 100 / 100000).toLocaleString("en-IN", {
    maximumFractionDigits: 1,
  });

export function ForecastChart({
  rows,
  safetyBufferPaise,
  breachWeek,
  onWeekClick,
}: {
  rows: ForecastRow[];
  safetyBufferPaise: number;
  breachWeek: number | null;
  onWeekClick?: (week: number) => void;
}) {
  const W = 328;
  const H = 200;
  const padLeft = 40;
  const padBottom = 18;
  const chartW = W - padLeft;
  const chartH = H - padBottom;

  const maxCash = Math.max(...rows.map((r) => r.closingPaise), safetyBufferPaise, 1);
  const maxFlow = Math.max(...rows.flatMap((r) => [r.inflowPaise, r.outflowPaise]), 1);
  const barW = chartW / Math.max(rows.length, 1);

  const cashY = (v: number) => chartH - (v / maxCash) * chartH;
  const flowH = (v: number) => (v / maxFlow) * (chartH / 3.5);

  const linePath = rows
    .map((r, i) => {
      const cx = padLeft + i * barW + barW / 2;
      const cy = cashY(r.closingPaise);
      return `${i === 0 ? "M" : "L"} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
    })
    .join(" ");

  const bufferY = cashY(safetyBufferPaise);
  const breachRow = breachWeek !== null ? rows[breachWeek - 1] : null;

  return (
    <div className="rounded-lg bg-white p-3 ring-1 ring-[#E4E7EC]">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`13-week cash forecast. ${
          breachWeek !== null
            ? `Cash falls below the ₹${lakh(safetyBufferPaise)}L buffer in week ${breachWeek}.`
            : "Cash stays above the safety buffer."
        }`}
      >
        {[0, 0.5, 1].map((f) => (
          <text
            key={f}
            x={padLeft - 4}
            y={chartH - f * chartH + 3}
            textAnchor="end"
            fontSize={8}
            fill="#5A6170"
          >
            ₹{Math.round((maxCash * f) / 100 / 100000)}L
          </text>
        ))}

        {rows.map((r, i) => {
          const cx = padLeft + i * barW + barW / 2;
          const inH = flowH(r.inflowPaise);
          const outH = flowH(r.outflowPaise);
          return (
            <g key={r.week}>
              <rect
                x={cx - barW * 0.35}
                y={chartH - inH}
                width={barW * 0.28}
                height={inH}
                fill="#067647"
                opacity={0.28}
              />
              <rect
                x={cx + barW * 0.07}
                y={chartH}
                width={barW * 0.28}
                height={outH}
                fill="#B42318"
                opacity={0.28}
              />
            </g>
          );
        })}

        <line
          x1={padLeft}
          y1={bufferY}
          x2={W}
          y2={bufferY}
          stroke="#B54708"
          strokeDasharray="3 2"
          strokeWidth={1}
        />
        <text x={padLeft + 2} y={bufferY - 3} fontSize={7} fill="#B54708">
          buffer
        </text>

        <path d={linePath} fill="none" stroke="#0F5C4E" strokeWidth={2} />

        {breachRow && (
          <circle
            cx={padLeft + (breachWeek! - 1) * barW + barW / 2}
            cy={cashY(breachRow.closingPaise)}
            r={4}
            fill="#B42318"
            stroke="#FFFFFF"
            strokeWidth={1}
          />
        )}

        {rows.map((r, i) => (
          <text
            key={r.week}
            x={padLeft + i * barW + barW / 2}
            y={chartH + 12}
            textAnchor="middle"
            fontSize={7}
            fill="#5A6170"
          >
            W{r.week}
          </text>
        ))}

        {rows.map((r, i) => (
          <rect
            key={`hit-${r.week}`}
            x={padLeft + i * barW}
            y={0}
            width={barW}
            height={chartH}
            fill="transparent"
            style={{ cursor: onWeekClick ? "pointer" : undefined }}
            onClick={onWeekClick ? () => onWeekClick(r.week) : undefined}
          >
            <title>
              Week {r.week} ({r.weekStart}–{r.weekEnd}): closing ₹{lakh(r.closingPaise)}L
            </title>
          </rect>
        ))}
      </svg>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-[#5A6170]">
        <span>
          <span className="mr-1 inline-block h-2 w-2 bg-[#067647]/40" aria-hidden="true" />
          Inflow
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 bg-[#B42318]/40" aria-hidden="true" />
          Outflow
        </span>
        <span>
          <span className="mr-1 inline-block h-0.5 w-3 bg-[#0F5C4E]" aria-hidden="true" />
          Closing cash
        </span>
        <span>
          <span
            className="mr-1 inline-block h-0.5 w-3 border-t border-dashed border-[#B54708]"
            aria-hidden="true"
          />
          Buffer
        </span>
      </div>
    </div>
  );
}

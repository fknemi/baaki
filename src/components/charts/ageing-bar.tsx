"use client";

import Link from "next/link";

export type AgeingBucket = {
  key: string;
  label: string;
  paise: number;
  count: number;
};

const COLORS: Record<string, string> = {
  "not-due": "#E4E7EC",
  "d1-30": "#F59E0B",
  "d31-60": "#B54708",
  "d61-90": "#B42318",
  "d90+": "#7A1F16",
};

const HREFS: Record<string, string> = {
  "not-due": "/invoices?status=sent",
  "d1-30": "/invoices?ageing=d1-30",
  "d31-60": "/invoices?ageing=d31-60",
  "d61-90": "/invoices?ageing=d61-90",
  "d90+": "/invoices?ageing=d90+",
};

const lakh = (paise: number) => (paise / 100 / 100000).toFixed(1);

export function AgeingBar({ buckets }: { buckets: AgeingBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.paise, 0);
  const W = 328;
  const H = 24;

  let x = 0;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`Ageing: ${buckets
          .map((b) => `${b.label}: ${b.count} invoices, ₹${lakh(b.paise)} lakh`)
          .join(", ")}`}
      >
        {buckets.map((b) => {
          const w = total > 0 ? (b.paise / total) * W : 0;
          const r = (
            <rect
              key={b.key}
              x={x}
              y={0}
              width={w}
              height={H}
              fill={COLORS[b.key] ?? "#E4E7EC"}
            >
              <title>
                {b.label}: ₹{lakh(b.paise)}L across {b.count} invoices
              </title>
            </rect>
          );
          x += w;
          return r;
        })}
      </svg>
      <div className="mt-2 grid grid-cols-5 gap-1 text-[10px] text-[#5A6170]">
        {buckets.map((b) => (
          <Link
            key={b.key}
            href={HREFS[b.key] ?? "/invoices"}
            className="flex flex-col items-center rounded px-1 py-1 hover:bg-[#F7F8FA]"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: COLORS[b.key] ?? "#E4E7EC" }}
              aria-hidden="true"
            />
            <span className="mt-0.5 font-medium text-[#1A1D23]">{b.label}</span>
            <span>₹{lakh(b.paise)}L</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { buttonVariants } from "@/components/ui/button";

export type AgeingBucket = {
  key: string;
  label: string;
  paise: number;
  count: number;
};

// Green (safe) → amber → orange → red (worst)

const COLORS: Record<string, string> = {
  "not-due": "#54C48C", // hsl(150, 49%, 55%) — mint green
  "d1-30":   "#7AC554", // hsl(100, 49%, 55%) — yellow-green
  "d31-60":  "#C5BB54", // hsl( 55, 49%, 55%) — mustard
  "d61-90":  "#C58354", // hsl( 25, 49%, 55%) — terracotta
  "d90+":    "#C55454", // hsl(  0, 49%, 55%) — brick red
};
const HREFS: Record<string, string> = {
  "not-due": "/invoices?status=sent",
  "d1-30":   "/invoices?ageing=d1-30",
  "d31-60":  "/invoices?ageing=d31-60",
  "d61-90":  "/invoices?ageing=d61-90",
  "d90+":    "/invoices?ageing=d90+",
};

const lakh = (paise: number) => (paise / 100 / 100000).toFixed(1);

/* mirror the dashboard's card spacing + title scale so the Ageing card
   lines up with every other card in the grid at every breakpoint */
const CARD_Y = "!py-3 sm:!py-4 md:!py-5 lg:!py-5 xl:!py-6";
const PAD_X = "!px-4 sm:!px-5 md:!px-6 lg:!px-7 xl:!px-8";
const TITLE =
  "font-heading text-base sm:text-lg md:text-xl lg:text-2xl xl:text-2xl !text-[#fff]";

/* legend type scale — mirrors the rest of the dashboard so labels read
   at the same weight/size as the card body copy, growing up to 2xl */
const LEGEND_LABEL =
  "text-[11px] sm:text-sm md:text-base lg:text-lg xl:text-xl";
const LEGEND_VALUE =
  "text-[10px] sm:text-xs md:text-sm lg:text-base xl:text-lg";

// The stacked bar plate. Height AND radius grow together — a 16px tall bar
// with rounded-md would look like a slab, so as it thickens the corners
// round with it (rounded-md → rounded-lg → rounded-xl).
const BAR_TRACK =
  "flex w-full overflow-hidden " +
  "h-2 rounded-md " +
  "sm:h-2.5 sm:rounded-md " +
  "md:h-3 md:rounded-lg " +
  "lg:h-3.5 lg:rounded-lg " +
  "xl:h-4 xl:rounded-xl";

// Each legend cell grows its vertical padding + gap in lockstep with the
// label/value text. Without this, at xl the link reads as text crammed
// between two invisible rules even though the type is 20px.
const LEGEND_CELL =
  "h-auto min-w-0 flex-col items-center leading-tight " +
  "gap-0.5 px-1 py-1.5 " +
  "sm:gap-0.5 sm:px-1 sm:py-1.5 " +
  "md:gap-1 md:px-1.5 md:py-2 " +
  "lg:gap-1 lg:px-1.5 lg:py-2 " +
  "xl:gap-1.5 xl:px-2 xl:py-2.5";

// Legend colour dot. Matches the bar plate's ladder so the dot beside
// each label is proportional to the segment it represents in the bar above.
const LEGEND_DOT =
  "inline-block shrink-0 rounded-full " +
  "h-2 w-2 " +
  "sm:h-2.5 sm:w-2.5 " +
  "md:h-3 md:w-3 " +
  "lg:h-3 lg:w-3 " +
  "xl:h-3.5 xl:w-3.5";

// Tooltip chrome. Grows so the hover/focus popover stays readable against
// a 900px-wide bar on desktop instead of looking like a 12px pinprick.
const TOOLTIP_BODY =
  "text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base";

export function AgeingBar({ buckets }: { buckets: AgeingBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.paise, 0);

  return (
    <Card
      className={`relative w-full min-w-0 !gap-0 !rounded-none !border-[#fff]/10 !bg-transparent ${CARD_Y}`}
    >
      <CardHeader
        className={`!pb-0 !gap-3 sm:!gap-4 md:!gap-5 lg:!gap-5 xl:!gap-6 ${PAD_X}`}
      >
        <CardTitle className={TITLE}>Ageing</CardTitle>
      </CardHeader>

      <CardContent
        className={`${PAD_X} !pt-3 sm:!pt-4 md:!pt-5 lg:!pt-5 xl:!pt-6 space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-5 xl:space-y-6`}
      >
        <TooltipProvider>
          <div
            className={BAR_TRACK}
            role="img"
            aria-label={`Ageing: ${buckets
              .map((b) => `${b.label}: ${b.count} invoices, ₹${lakh(b.paise)} lakh`)
              .join(", ")}`}
          >
            {buckets.map((bucket) => {
              const pct = total > 0 ? (bucket.paise / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <Tooltip key={bucket.key}>
                  <TooltipTrigger
                    render={
                      <div
                        tabIndex={0}
                        style={{
                          width: `${pct}%`,
                          background: COLORS[bucket.key] ?? "#E4E7EC",
                        }}
                        className="h-full cursor-pointer outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-white/40"
                      />
                    }
                  />
                  <TooltipContent className={TOOLTIP_BODY}>
                    <div className="font-medium">{bucket.label}</div>
                    <div className="opacity-70">
                      ₹{lakh(bucket.paise)}L · {bucket.count} invoices
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* 2 cols on mobile, 3 on small, 5 from md — avoids the
            squashed single-row layout on narrow screens */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2 md:grid-cols-5 md:gap-3 lg:gap-3 xl:gap-4">
          {buckets.map((b) => (
            <Link
              key={b.key}
              href={HREFS[b.key] ?? "/invoices"}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                LEGEND_CELL,
              )}
            >
              <span
                className={LEGEND_DOT}
                style={{ background: COLORS[b.key] ?? "#E4E7EC" }}
                aria-hidden="true"
              />
              <span
                className={`max-w-full truncate font-medium ${LEGEND_LABEL}`}
              >
                {b.label}
              </span>
              <span
                className={`whitespace-nowrap tabular-nums opacity-70 ${LEGEND_VALUE}`}
              >
                ₹{lakh(b.paise)}L
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

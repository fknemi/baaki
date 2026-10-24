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

export function AgeingBar({ buckets }: { buckets: AgeingBucket[] }) {
  const total = buckets.reduce((s, b) => s + b.paise, 0);

  return (
    <Card className="relative w-full !gap-3 !rounded-none !border-[#fff]/10 !bg-transparent !py-3">
      <CardHeader className="!pb-0">
        <CardTitle className="font-heading text-lg !text-[#fff]">Ageing</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <TooltipProvider>
          <div
            className="flex h-2 w-full overflow-hidden rounded-md"
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
                  <TooltipContent className="text-xs">
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

        <div className="grid grid-cols-5 gap-1">
          {buckets.map((b) => (
            <Link
              key={b.key}
              href={HREFS[b.key] ?? "/invoices"}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-auto flex-col gap-0.5 px-1 py-1 text-[10px]",
              )}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: COLORS[b.key] ?? "#E4E7EC" }}
                aria-hidden="true"
              />
              <span className="font-medium">{b.label}</span>
              <span className="opacity-70">₹{lakh(b.paise)}L</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

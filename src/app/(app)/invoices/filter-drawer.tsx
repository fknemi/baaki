// src/app/(app)/invoices/filter-drawer.tsx
"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

export type InvoiceFilters = {
  dateFrom: string | null; // yyyy-mm-dd
  dateTo: string | null; // yyyy-mm-dd
  dateField: "invoice" | "due";
  minPaise: number | null;
  maxPaise: number | null;
  onlyOverdue: boolean;
  onlyUnpaid: boolean;
};

export const EMPTY_FILTERS: InvoiceFilters = {
  dateFrom: null,
  dateTo: null,
  dateField: "invoice",
  minPaise: null,
  maxPaise: null,
  onlyOverdue: false,
  onlyUnpaid: false,
};

export function countActiveFilters(f: InvoiceFilters): number {
  let n = 0;
  if (f.dateFrom || f.dateTo) n++;
  if (f.minPaise != null || f.maxPaise != null) n++;
  if (f.onlyOverdue) n++;
  if (f.onlyUnpaid) n++;
  return n;
}

export function isEmptyFilters(f: InvoiceFilters): boolean {
  return countActiveFilters(f) === 0;
}

const fieldSurface =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]";

const labelStyle = "text-xs italic text-white";

export function FilterDrawer({
  filters,
  onChange,
}: {
  filters: InvoiceFilters;
  onChange: (f: InvoiceFilters) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<InvoiceFilters>(filters);

  // Sync the working draft each time the drawer opens.
  React.useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);

  const activeCount = countActiveFilters(filters);
  const draftCount = countActiveFilters(draft);

  function update<K extends keyof InvoiceFilters>(
    key: K,
    value: InvoiceFilters[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function apply() {
    onChange(draft);
    setOpen(false);
  }

  function clearAll() {
    setDraft(EMPTY_FILTERS);
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} swipeDirection="right">
      <DrawerTrigger
        render={
          <Button
            variant="outline"
            className={
              activeCount > 0
                ? "shrink-0 border-white/10 bg-white text-[#111] hover:bg-white/90"
                : "shrink-0 border-white/10 bg-[#171717]/20 text-white hover:bg-white/5"
            }
          >
            Filters{activeCount > 0 ? ` · ${activeCount}` : ""}
          </Button>
        }
      />

      <DrawerContent className="border-white/10 bg-[#192221]!">
        <DrawerHeader>
          <DrawerTitle className="text-white">Filters</DrawerTitle>
          <DrawerDescription className="text-xs italic text-white">
            Refine the invoice list by date, amount, or status.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* ── Date range ───────────────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Date range</h3>

            <div className="flex gap-1">
              {(["invoice", "due"] as const).map((f) => {
                const active = draft.dateField === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => update("dateField", f)}
                    aria-pressed={active}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "bg-white text-[#111]"
                        : "border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5"
                    }`}
                  >
                    {f === "invoice" ? "Invoice date" : "Due date"}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className={labelStyle}>From</span>
                <input
                  type="date"
                  value={draft.dateFrom ?? ""}
                  onChange={(e) =>
                    update("dateFrom", e.target.value || null)
                  }
                  className={fieldSurface}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelStyle}>To</span>
                <input
                  type="date"
                  value={draft.dateTo ?? ""}
                  onChange={(e) => update("dateTo", e.target.value || null)}
                  className={fieldSurface}
                />
              </label>
            </div>
          </section>

          {/* ── Amount range ─────────────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-white">
              Outstanding amount
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className={labelStyle}>Min (₹)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="0"
                  value={
                    draft.minPaise != null ? draft.minPaise / 100 : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    update(
                      "minPaise",
                      v === "" ? null : Math.round(Number(v) * 100),
                    );
                  }}
                  className={fieldSurface}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className={labelStyle}>Max (₹)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  placeholder="Any"
                  value={
                    draft.maxPaise != null ? draft.maxPaise / 100 : ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    update(
                      "maxPaise",
                      v === "" ? null : Math.round(Number(v) * 100),
                    );
                  }}
                  className={fieldSurface}
                />
              </label>
            </div>
          </section>

          {/* ── Quick toggles ────────────────────────────────────────── */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-white">Quick filters</h3>

            <label className="flex cursor-pointer items-center gap-3 border border-white/10 p-3">
              <Checkbox
                checked={draft.onlyOverdue}
                onCheckedChange={(v) => update("onlyOverdue", v === true)}
                className="border-white/20 bg-transparent"
              />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white">
                  Overdue only
                </div>
                <div className="text-[10px] italic text-white">
                  Past the due date with balance remaining
                </div>
              </div>
            </label>

            <label className="flex cursor-pointer items-center gap-3 border border-white/10 p-3">
              <Checkbox
                checked={draft.onlyUnpaid}
                onCheckedChange={(v) => update("onlyUnpaid", v === true)}
                className="border-white/20 bg-transparent"
              />
              <div className="min-w-0">
                <div className="text-xs font-medium text-white">
                  With outstanding balance
                </div>
                <div className="text-[10px] italic text-white">
                  Hide fully-paid invoices
                </div>
              </div>
            </label>
          </section>

          {draftCount > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-white underline underline-offset-4"
            >
              Clear all filters
            </button>
          )}
        </div>

        <DrawerFooter className="border-t border-white/10">
          <Button
            onClick={apply}
            className="w-full bg-[#0F5C4E] text-white hover:bg-[#0F5C4E]/90"
          >
            Apply{draftCount > 0 ? ` (${draftCount})` : ""}
          </Button>
          <DrawerClose
            render={
              <Button
                variant="outline"
                className="w-full border-white/10 bg-[#171717]/20 text-white hover:bg-white/5"
              >
                Cancel
              </Button>
            }
          />
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

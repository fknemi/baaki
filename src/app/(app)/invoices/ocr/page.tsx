"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadButton } from "@/components/upload-button";
import { formatINR, formatINRDelta } from "@/lib/domain/money";
import { computeTotals } from "@/lib/domain/gst";
import { isValidGSTIN } from "@/lib/domain/gstin";
import { addDays, todayIST } from "@/lib/domain/dates";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";

// ─── types ───────────────────────────────────────────────────────────────────

type ExtractedItem = {
  description?: string;
  hsnSac?: string;
  qty?: number;
  unit?: string;
  ratePaise?: number;
  gstRatePct?: number;
};

type Extracted = {
  invoiceNumber?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  customerName?: string | null;
  gstin?: string | null;
  items?: ExtractedItem[];
  taxablePaise?: number | null;
  totalPaise?: number | null;
};

type Customer = {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string | null;
  city: string | null;
};

// ─── outline icons ───────────────────────────────────────────────────────────

const ICON_STD =
  "h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";
const ICON_TINY =
  "h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4";

function IconCheck({ className = ICON_STD }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function IconAlert({ className = ICON_STD }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function IconClose({ className = ICON_TINY }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ─── shared chrome ───────────────────────────────────────────────────────────

const fieldSurface =
  "bg-[#171717]/20 border-white/10 h-9 sm:h-10 md:h-11 lg:h-12 md:text-base";

// SelectTrigger ships data-[size=default]:h-9. In Tailwind v4 arbitrary
// data-* variants emit AFTER breakpoint variants, so data-[size]:h-9 wins
// over md:h-11. The ! suffix forces our height to win at every breakpoint.
const selectSurface =
  "bg-[#171717]/20 border-white/10 " +
  "h-9! sm:h-10! md:h-11! lg:h-12! " +
  "md:text-base";

const CARD =
  "rounded-lg border border-white/10 p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-5 lg:rounded-2xl lg:p-6 xl:rounded-2xl xl:p-6";

const UNITS = ["pcs", "box", "kg", "m", "sqft", "roll", "set"];
const GST_RATES = [0, 5, 12, 18, 28];
const unitItems = UNITS.map((u) => ({ label: u, value: u }));
const gstItems = GST_RATES.map((r) => ({ label: `${r}%`, value: String(r) }));

function gstItemsFor(current: number | undefined) {
  if (current !== undefined && !GST_RATES.includes(current)) {
    return [...gstItems, { label: `${current}% (custom)`, value: String(current) }];
  }
  return gstItems;
}

const SECONDARY_BTN =
  "flex h-9 items-center justify-center rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-xs font-medium text-white hover:bg-white/5 " +
  "sm:h-9 sm:rounded-lg sm:px-3 sm:text-sm " +
  "md:h-10 md:rounded-xl md:px-4 md:text-sm " +
  "lg:h-11 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:rounded-xl xl:px-5 xl:text-base";

const PRIMARY_BTN =
  "flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] px-3 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 " +
  "sm:h-9 sm:gap-1.5 sm:rounded-lg sm:px-3 sm:text-sm " +
  "md:h-10 md:gap-2 md:rounded-xl md:px-4 md:text-sm " +
  "lg:h-11 lg:gap-2 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:gap-2.5 xl:rounded-xl xl:px-5 xl:text-base";

// ─── page ────────────────────────────────────────────────────────────────────

export default function OcrPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [edited, setEdited] = useState<Extracted | null>(null);

  // ── customer-picker state ──
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Lazy-fetch customers the first time the picker opens. Adjust the URL
  // if your project exposes customers under a different route.
  useEffect(() => {
    if (!pickerOpen || customers !== null) return;
    let cancelled = false;
    setCustomersError(null);
    fetch("/api/customers")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load customers"))))
      .then((j) => {
        if (cancelled) return;
        setCustomers((j?.data as Customer[]) ?? []);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setCustomersError(e instanceof Error ? e.message : "Failed to load customers");
      });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, customers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !customers) return customers ?? [];
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.gstin ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  async function handleUpload(storageKey: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/extract-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Extraction failed");
      setExtracted(j.data.extracted);
      setEdited(j.data.extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function patchField<K extends keyof Extracted>(key: K, value: Extracted[K]) {
    setEdited((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function patchItem(idx: number, patch: Partial<ExtractedItem>) {
    setEdited((prev) => {
      if (!prev) return prev;
      const items = [...(prev.items ?? [])];
      items[idx] = { ...items[idx], ...patch };
      return { ...prev, items };
    });
  }

  function removeItem(idx: number) {
    setEdited((prev) => {
      if (!prev) return prev;
      const items = [...(prev.items ?? [])];
      items.splice(idx, 1);
      return { ...prev, items };
    });
  }

  function addItem() {
    setEdited((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: [
          ...(prev.items ?? []),
          {
            description: "",
            hsnSac: "",
            qty: 1,
            unit: "pcs",
            ratePaise: 0,
            gstRatePct: 18,
          },
        ],
      };
    });
  }

  function reset() {
    setEdited(null);
    setExtracted(null);
    setError(null);
  }

  function openPicker() {
    // Default to extracted customer name as a search hint
    setSearch(edited?.customerName?.trim() ?? "");
    setSelectedCustomerId(null);
    setSaveError(null);
    setPickerOpen(true);
  }

  async function saveInvoice() {
    if (!edited || !selectedCustomerId) return;
    const customer = customers?.find((c) => c.id === selectedCustomerId);
    setSaving(true);
    setSaveError(null);
    try {
      const invoiceDate = edited.invoiceDate || todayIST();
      const dueDate = edited.dueDate || addDays(invoiceDate, 30);

      const payload = {
        customerId: selectedCustomerId,
        invoiceDate,
        dueDate,
        // Customer's state is the right default for a sale. Falls back to
        // "27" to match the hardcoded state used by computeTotals below.
        placeOfSupplyStateCode: customer?.stateCode ?? "27",
        reverseCharge: false,
        items: (edited.items ?? []).map((it) => ({
          description: it.description ?? "",
          hsnSac: it.hsnSac ?? "",
          qty: Number(it.qty ?? 0),
          unit: it.unit ?? "pcs",
          ratePaise: Number(it.ratePaise ?? 0),
          discountPaise: 0,
          gstRatePct: Number(it.gstRatePct ?? 0),
        })),
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Save failed");
      }
      setPickerOpen(false);
      router.push("/invoices?status=draft");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const totals =
    edited?.items && edited.items.length > 0
      ? computeTotals(
          edited.items.map((it) => ({
            qty: Number(it.qty ?? 0),
            ratePaise: Number(it.ratePaise ?? 0),
            discountPaise: 0,
            gstRatePct: Number(it.gstRatePct ?? 0),
          })),
          { stateCode: "27", registrationType: "regular" },
          { stateCode: "27" },
        )
      : null;

  const liveFlags: string[] = [];
  if (edited?.gstin && edited.gstin.trim().length > 0) {
    if (!isValidGSTIN(edited.gstin.trim().toUpperCase()).valid) {
      liveFlags.push("invalid_gstin");
    }
  }
  if (totals && edited?.totalPaise && edited.totalPaise > 0) {
    const reported = Number(edited.totalPaise);
    const computed = totals.totalPaise;
    if (Math.abs(computed - reported) > 100) {
      liveFlags.push(`total_mismatch: computed=${computed} reported=${reported}`);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md space-y-3 px-3 pb-24 pt-14 sm:max-w-xl sm:space-y-4 sm:px-4 sm:pb-24 sm:pt-16 md:max-w-2xl md:space-y-4 md:px-6 md:pb-28 md:pt-20 lg:max-w-3xl lg:space-y-5 lg:px-6 lg:pb-32 lg:pt-24 xl:max-w-4xl xl:space-y-5 xl:px-8 xl:pb-32 xl:pt-24">
      <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
        Scan invoice
      </h1>
      <p className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
        Upload a photo. We&apos;ll pre-fill the fields, recompute GST, and flag
        anything that looks off. Edit any field to fix — flags update live.
      </p>

      {!edited && (
        <UploadButton onUploaded={handleUpload} label="Upload invoice photo" />
      )}

      {busy && (
        <p className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
          Reading…
        </p>
      )}
      {error && (
        <p className="text-xs text-[#FF9B8F] sm:text-sm md:text-sm lg:text-base xl:text-base">
          {error}
        </p>
      )}

      {liveFlags.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-white sm:gap-2 sm:rounded-lg sm:p-3 sm:text-xs md:gap-2.5 md:rounded-xl md:p-4 md:text-sm lg:gap-3 lg:rounded-xl lg:p-4 lg:text-sm xl:gap-3 xl:rounded-xl xl:p-5 xl:text-base">
          <IconAlert className={`${ICON_STD} mt-0.5 shrink-0 text-[#FBBF24]`} />
          <div className="min-w-0">
            <p className="font-medium">Review needed:</p>
            <ul className="mt-1 list-disc pl-4 sm:pl-4 md:pl-5 lg:pl-5 xl:pl-6">
              {liveFlags.map((f, i) => (
                <li key={i} className="break-words">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {liveFlags.length === 0 && edited && (
        <div className="flex items-center gap-1.5 rounded-lg border border-[#067647]/40 bg-[#067647]/10 p-3 text-xs text-white sm:gap-1.5 sm:rounded-lg sm:p-3 sm:text-xs md:gap-2 md:rounded-xl md:p-4 md:text-sm lg:gap-2 lg:rounded-xl lg:p-4 lg:text-sm xl:gap-2.5 xl:rounded-xl xl:p-5 xl:text-base">
          <IconCheck className={`${ICON_STD} shrink-0 text-[#4ADE80]`} />
          No flags — extracted values look consistent.
        </div>
      )}

      {edited && (
        <div className="space-y-3 sm:space-y-3 md:space-y-4 lg:space-y-4 xl:space-y-5">
          <section className={CARD}>
            <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
              Extracted fields
            </h2>
            <div className="mt-2 space-y-2 sm:mt-2 sm:space-y-2 md:mt-3 md:space-y-3 lg:mt-3 lg:space-y-3 xl:mt-4 xl:space-y-3">
              <FieldInput
                label="Invoice #"
                value={edited.invoiceNumber ?? ""}
                onChange={(v) => patchField("invoiceNumber", v || null)}
              />
              <FieldInput
                label="Invoice date"
                type="date"
                value={edited.invoiceDate ?? ""}
                onChange={(v) => patchField("invoiceDate", v || null)}
              />
              <FieldInput
                label="Due date"
                type="date"
                value={edited.dueDate ?? ""}
                onChange={(v) => patchField("dueDate", v || null)}
              />
              <FieldInput
                label="Customer"
                value={edited.customerName ?? ""}
                onChange={(v) => patchField("customerName", v || null)}
              />
              <FieldInput
                label="GSTIN"
                value={edited.gstin ?? ""}
                onChange={(v) => patchField("gstin", v ? v.toUpperCase() : null)}
                mono
              />
            </div>
          </section>

          <section className={CARD}>
            <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
              Items
            </h2>
            <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1 sm:mt-3 sm:space-y-2.5 sm:pr-1 md:mt-3 md:space-y-3 md:pr-1.5 lg:mt-4 lg:space-y-3 lg:pr-2 xl:mt-4 xl:space-y-4 xl:pr-2">
              {edited.items?.map((it, i) => {
                const lineTotal = Math.round((it.qty ?? 0) * (it.ratePaise ?? 0));
                const items = gstItemsFor(it.gstRatePct);
                return (
                  <li
                    key={i}
                    className="rounded-md border border-white/10 p-2.5 sm:p-3 md:p-4 space-y-2 sm:space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] sm:text-xs md:text-sm font-semibold text-muted-foreground">
                        Item {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        aria-label="Remove item"
                      >
                        <IconClose className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                      </button>
                    </div>

                    <Field>
                      <FieldLabel htmlFor={`desc-${i}`}>Description</FieldLabel>
                      <Input
                        id={`desc-${i}`}
                        placeholder="Item description"
                        value={it.description ?? ""}
                        onChange={(e) => patchItem(i, { description: e.target.value })}
                        className={fieldSurface}
                      />
                    </Field>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Field>
                        <FieldLabel htmlFor={`hsn-${i}`}>HSN / SAC</FieldLabel>
                        <Input
                          id={`hsn-${i}`}
                          placeholder="e.g. 8471"
                          value={it.hsnSac ?? ""}
                          onChange={(e) => patchItem(i, { hsnSac: e.target.value })}
                          className={fieldSurface}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`unit-${i}`}>Unit</FieldLabel>
                        <Select
                          items={unitItems}
                          value={it.unit ?? "pcs"}
                          onValueChange={(v) => patchItem(i, { unit: String(v) })}
                        >
                          <SelectTrigger id={`unit-${i}`} className={selectSurface}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {unitItems.map((item) => (
                              <SelectItem key={item.value} value={item.value} className="md:text-base">
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Field>
                        <FieldLabel htmlFor={`qty-${i}`}>Qty</FieldLabel>
                        <Input
                          id={`qty-${i}`}
                          type="number"
                          placeholder="1"
                          min={0}
                          value={it.qty ?? 0}
                          onChange={(e) => patchItem(i, { qty: Number(e.target.value) })}
                          className={fieldSurface}
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor={`rate-${i}`}>Rate (₹)</FieldLabel>
                        <Input
                          id={`rate-${i}`}
                          type="number"
                          placeholder="0.00"
                          min={0}
                          value={it.ratePaise ? it.ratePaise / 100 : ""}
                          onChange={(e) =>
                            patchItem(i, { ratePaise: Math.round(Number(e.target.value) * 100) })
                          }
                          className={fieldSurface}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <Field>
                        <FieldLabel htmlFor={`gst-${i}`}>GST %</FieldLabel>
                        <Select
                          items={items}
                          value={String(it.gstRatePct ?? 18)}
                          onValueChange={(v) => patchItem(i, { gstRatePct: Number(v) })}
                        >
                          <SelectTrigger id={`gst-${i}`} className={selectSurface}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((item) => (
                              <SelectItem key={item.value} value={item.value} className="md:text-base">
                                {item.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>

                    <div className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                      Line: {formatINR(lineTotal)}
                      {it.unit ? ` · ${it.unit}` : ""}
                    </div>
                  </li>
                );
              })}
            </ul>

            <Button
              variant="outline"
              className="mt-3 w-full text-sm sm:text-base md:text-lg h-9 sm:h-10 md:h-11"
              onClick={addItem}
            >
              + Add Item
            </Button>
          </section>

          <section className={CARD}>
            <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
              Reported total on invoice
            </h2>
            <p className="mt-1 text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
              What the image says. Used to detect OCR misreads.
            </p>
            <div className="mt-2 sm:mt-2 md:mt-3 lg:mt-3 xl:mt-4">
              <FieldInput
                label="Reported total (paise)"
                type="number"
                value={String(edited.totalPaise ?? 0)}
                onChange={(v) => patchField("totalPaise", Number(v) || 0)}
                mono
              />
            </div>
          </section>

          {totals && (
            <section className={CARD}>
              <h2 className="text-sm font-semibold text-white sm:text-base md:text-lg lg:text-lg xl:text-xl">
                GST recomputed
              </h2>
              <dl className="mt-2 space-y-1 text-xs tabular-nums sm:mt-2 sm:space-y-1 sm:text-sm md:mt-3 md:space-y-1.5 md:text-base lg:mt-3 lg:space-y-1.5 lg:text-base xl:mt-4 xl:space-y-2 xl:text-lg">
                <Row label="Taxable" value={formatINR(totals.taxablePaise)} />
                <Row label="CGST" value={formatINR(totals.cgstPaise)} />
                <Row label="SGST" value={formatINR(totals.sgstPaise)} />
                <Row label="Round off" value={formatINRDelta(totals.roundOffPaise)} />
                <Row label="Total" value={formatINR(totals.totalPaise)} />
              </dl>
            </section>
          )}

          <div className="grid grid-cols-2 gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
            <button onClick={reset} className={SECONDARY_BTN}>
              Scan another
            </button>
            <button onClick={openPicker} className={PRIMARY_BTN}>
              Save invoice
            </button>
          </div>

          {extracted && (
            <details className={`${CARD} text-[10px] sm:text-[11px] md:text-xs lg:text-xs xl:text-sm`}>
              <summary className="cursor-pointer italic text-white">
                Show original extraction
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[9px] text-white sm:text-[10px] md:text-xs lg:text-xs xl:text-sm">
                {JSON.stringify(extracted, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* ── Customer picker dialog ─────────────────────────────────────── */}
      <Dialog
        open={pickerOpen}
        onOpenChange={(v) => {
          if (!saving) setPickerOpen(v);
        }}
      >
        <DialogContent className="bg-[#192221]! sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base md:text-lg lg:text-lg xl:text-xl">
              Pick customer
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <InputGroup className="bg-[#171717]/20! border-white/10 w-full h-9 sm:h-10 md:h-11 lg:h-12">
              <InputGroupAddon className="bg-[#171717]/20! pl-2 sm:pl-2.5 md:pl-3">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 shrink-0"
                >
                  <path
                    d="M9.89181 4.9459C9.89181 2.21947 7.67233 0 4.9459 0C2.21947 0 0 2.21947 0 4.9459C0 7.67233 2.21947 9.89181 4.9459 9.89181C6.08964 9.89181 7.13447 9.50232 7.97527 8.84699L11.1283 12L12 11.1283L8.84699 7.97527C9.5218 7.10941 9.88937 6.04366 9.89181 4.9459ZM1.23648 4.9459C1.23648 2.89954 2.89954 1.23648 4.9459 1.23648C6.99227 1.23648 8.65533 2.89954 8.65533 4.9459C8.65533 6.99227 6.99227 8.65533 4.9459 8.65533C2.89954 8.65533 1.23648 6.99227 1.23648 4.9459Z"
                    fill="white"
                    fillOpacity="0.2"
                  />
                </svg>
              </InputGroupAddon>
              <InputGroupInput
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="placeholder:text-[#737373] !ring-0 !outline-none text-sm sm:text-base md:text-lg"
                placeholder="Search customers…"
              />
            </InputGroup>

            {customersError && (
              <p className="text-xs text-[#FF9B8F] sm:text-sm md:text-sm lg:text-base">
                {customersError}
              </p>
            )}

            {!customersError && customers === null && (
              <p className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base">
                Loading customers…
              </p>
            )}

            {!customersError && customers !== null && filteredCustomers.length === 0 && (
              <p className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base">
                No customers found.
              </p>
            )}

            {!customersError && filteredCustomers.length > 0 && (
              <ul className="max-h-64 overflow-y-auto flex flex-col gap-2 sm:gap-3 md:max-h-72 lg:max-h-80">
                {filteredCustomers.map((c) => (
                  <li
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={[
                      "flex flex-row items-center gap-3 sm:gap-4",
                      "border-2 p-2 sm:p-2.5 md:p-3 lg:p-3.5 cursor-pointer transition-colors",
                      c.id === selectedCustomerId ? "border-white/40" : "border-white/10",
                    ].join(" ")}
                  >
                    <Checkbox
                      checked={c.id === selectedCustomerId}
                      onCheckedChange={() => setSelectedCustomerId(c.id)}
                      className="bg-transparent border-white/20 shrink-0 h-4 w-4 md:h-5 md:w-5"
                    />
                    <div className="flex flex-col gap-1 sm:gap-1.5 min-w-0">
                      <span className="font-medium text-sm sm:text-base md:text-lg truncate text-white">
                        {c.name}
                      </span>
                      {(c.gstin || c.city) && (
                        <span className="text-xs sm:text-sm italic text-white/60 truncate">
                          {c.gstin}
                          {c.gstin && c.city && " · "}
                          {c.city}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {saveError && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive sm:text-sm">
                {saveError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPickerOpen(false)}
              disabled={saving}
              className="text-sm sm:text-base h-9 sm:h-10 md:h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={saveInvoice}
              disabled={!selectedCustomerId || saving}
              className="text-sm sm:text-base h-9 sm:h-10 md:h-11"
            >
              {saving ? "Saving…" : "Save invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "date" | "number";
  mono?: boolean;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${fieldSurface} [color-scheme:dark] ${mono ? "font-mono" : ""}`}
      />
    </Field>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
      <dt className="italic text-white">{label}</dt>
      <dd className="text-right tabular-nums text-white">{value}</dd>
    </div>
  );
}

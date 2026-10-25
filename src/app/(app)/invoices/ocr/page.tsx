"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadButton } from "@/components/upload-button";
import { formatINR, formatINRDelta } from "@/lib/domain/money";
import { computeTotals } from "@/lib/domain/gst";
import { isValidGSTIN } from "@/lib/domain/gstin";

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

// ─── outline icons ───────────────────────────────────────────────────────────

function IconCheck({ className = "h-3.5 w-3.5" }: { className?: string }) {
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

function IconAlert({ className = "h-3.5 w-3.5" }: { className?: string }) {
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

function IconClose({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconArrowRight({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function IconPlus({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ─── shared styles ───────────────────────────────────────────────────────────

const CARD = "rounded-xl border border-white/10 p-4";
const fieldSurface =
  "rounded border border-white/10 bg-[#171717]/20 px-2 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]";
const SECONDARY_BTN =
  "rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5";

export default function OcrPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [edited, setEdited] = useState<Extracted | null>(null);

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
      if (!res.ok) {
        throw new Error(j?.error?.message ?? "Extraction failed");
      }
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

  function saveAndContinue() {
    if (!edited) return;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("ocr-prefill", JSON.stringify(edited));
    }
    const qs = new URLSearchParams();
    if (edited.invoiceNumber) qs.set("number", edited.invoiceNumber);
    if (edited.customerName) qs.set("customer", edited.customerName);
    router.push(`/invoices/new?${qs.toString()}`);
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
    <main className="space-y-4 p-4 pb-24 pt-14">
      <h1 className="text-xl font-semibold text-white">Scan invoice</h1>
      <p className="text-xs text-white italic">
        Upload a photo. We&apos;ll pre-fill the fields, recompute GST, and flag
        anything that looks off. Edit any field to fix — flags update live.
      </p>

      {!edited && (
        <UploadButton onUploaded={handleUpload} label="Upload invoice photo" />
      )}

      {busy && <p className="text-xs text-white italic">Reading…</p>}
      {error && <p className="text-xs text-[#FF9B8F]">{error}</p>}

      {liveFlags.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3 text-xs text-white">
          <IconAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FBBF24]" />
          <div className="min-w-0">
            <p className="font-medium">Review needed:</p>
            <ul className="mt-1 list-disc pl-4">
              {liveFlags.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {liveFlags.length === 0 && edited && (
        <div className="flex items-center gap-1.5 rounded-lg border border-[#067647]/40 bg-[#067647]/10 p-3 text-xs text-white">
          <IconCheck className="h-3.5 w-3.5 shrink-0 text-[#4ADE80]" />
          No flags — extracted values look consistent.
        </div>
      )}

      {edited && (
        <div className="space-y-3">
          <section className={CARD}>
            <h2 className="text-sm font-semibold text-white">
              Extracted fields
            </h2>
            <div className="mt-2 space-y-2 text-xs">
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-white">Items</h2>
              <button
                onClick={addItem}
                className="flex items-center gap-1 rounded border border-white/10 bg-[#171717]/20 px-2 py-1 text-[10px] font-medium text-white hover:bg-white/5"
              >
                <IconPlus className="h-2.5 w-2.5" />
                Add item
              </button>
            </div>
            <ul className="mt-2 max-h-96 space-y-2 overflow-y-auto pr-1 text-xs">
              {edited.items?.map((it, i) => (
                <li key={i} className="space-y-1 rounded border border-white/10 p-2">
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={it.description ?? ""}
                      onChange={(e) =>
                        patchItem(i, { description: e.target.value })
                      }
                      placeholder="Description"
                      className={`flex-1 ${fieldSurface}`}
                    />
                    <button
                      onClick={() => removeItem(i)}
                      className="flex items-center justify-center rounded border border-white/10 px-2 text-[#FF9B8F] hover:bg-[#B42318]/10"
                      aria-label="Remove item"
                    >
                      <IconClose className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <input
                      type="text"
                      value={it.hsnSac ?? ""}
                      onChange={(e) => patchItem(i, { hsnSac: e.target.value })}
                      placeholder="HSN"
                      className={`font-mono text-[10px] ${fieldSurface}`}
                    />
                    <input
                      type="number"
                      value={it.qty ?? 0}
                      onChange={(e) =>
                        patchItem(i, { qty: Number(e.target.value) })
                      }
                      placeholder="Qty"
                      className={`text-[10px] ${fieldSurface}`}
                    />
                    <input
                      type="number"
                      value={it.ratePaise ?? 0}
                      onChange={(e) =>
                        patchItem(i, { ratePaise: Number(e.target.value) })
                      }
                      placeholder="Rate paise"
                      className={`text-[10px] ${fieldSurface}`}
                    />
                    <input
                      type="number"
                      value={it.gstRatePct ?? 0}
                      onChange={(e) =>
                        patchItem(i, { gstRatePct: Number(e.target.value) })
                      }
                      placeholder="GST%"
                      className={`text-[10px] ${fieldSurface}`}
                    />
                  </div>
                  <div className="text-[10px] text-white italic">
                    Line:{" "}
                    {formatINR(Math.round((it.qty ?? 0) * (it.ratePaise ?? 0)))}
                    {it.unit ? ` · ${it.unit}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={CARD}>
            <h2 className="text-sm font-semibold text-white">
              Reported total on invoice
            </h2>
            <p className="mt-1 text-[10px] text-white italic">
              What the image says. Used to detect OCR misreads.
            </p>
            <div className="mt-2">
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
              <h2 className="text-sm font-semibold text-white">
                GST recomputed
              </h2>
              <dl className="mt-2 space-y-1 text-xs">
                <Row label="Taxable" value={formatINR(totals.taxablePaise)} />
                <Row label="CGST" value={formatINR(totals.cgstPaise)} />
                <Row label="SGST" value={formatINR(totals.sgstPaise)} />
                <Row
                  label="Round off"
                  value={formatINRDelta(totals.roundOffPaise)}
                />
                <Row label="Total" value={formatINR(totals.totalPaise)} />
              </dl>
            </section>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button onClick={reset} className={SECONDARY_BTN}>
              Scan another
            </button>
            <button
              onClick={saveAndContinue}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
            >
              Save & continue
              <IconArrowRight />
            </button>
          </div>

          {extracted && (
            <details className={`${CARD} text-[10px]`}>
              <summary className="cursor-pointer text-white italic">
                Show original extraction
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-[9px] text-white">
                {JSON.stringify(extracted, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
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
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="min-w-[100px] text-[#white]/0 text-xs italic text-white">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 rounded border border-white/10 bg-[#171717]/20 px-2 py-1 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark] ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-white italic">{label}</dt>
      <dd className="text-right tabular-nums text-white">{value}</dd>
    </div>
  );
}

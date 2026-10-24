"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UploadButton } from "@/components/upload-button";
import { formatINR } from "@/lib/domain/money";
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
    // Full extracted/edited payload is carried in sessionStorage so the
    // wizard can pre-fill beyond just invoice#/customer. Wizard reads
    // sessionStorage key "ocr-prefill" on mount.
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

  // Live flags — recomputed from current edited state so fixing a value
  // clears the flag immediately (that's the point of "editable + re-flag").
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
      liveFlags.push(
        `total_mismatch: computed=${computed} reported=${reported}`,
      );
    }
  }

  return (
    <main className="space-y-4 p-4 pb-24">
      <h1 className="text-xl font-semibold">Scan invoice</h1>
      <p className="text-xs text-[#5A6170]">
        Upload a photo. We'll pre-fill the fields, recompute GST, and flag
        anything that looks off. Edit any field to fix — flags update live.
      </p>

      {!edited && (
        <UploadButton onUploaded={handleUpload} label="Upload invoice photo" />
      )}

      {busy && <p className="text-xs text-[#5A6170]">Reading…</p>}
      {error && <p className="text-xs text-[#B42318]">{error}</p>}

      {liveFlags.length > 0 && (
        <div className="rounded-lg bg-[#FFFAEB] p-3 text-xs text-[#B54708] ring-1 ring-[#FEDF89]">
          <p className="font-medium">Review needed:</p>
          <ul className="mt-1 list-disc pl-4">
            {liveFlags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      {liveFlags.length === 0 && edited && (
        <div className="rounded-lg bg-[#ECFDF5] p-3 text-xs text-[#067647] ring-1 ring-[#A6F4C5]">
          ✓ No flags — extracted values look consistent.
        </div>
      )}

      {edited && (
        <div className="space-y-3">
          <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
            <h2 className="text-sm font-semibold">Extracted fields</h2>
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
                onChange={(v) =>
                  patchField("gstin", v ? v.toUpperCase() : null)
                }
                mono
              />
            </div>
          </section>

          <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Items</h2>
              <button
                onClick={addItem}
                className="rounded border border-[#E4E7EC] px-2 py-1 text-[10px] font-medium hover:bg-[#F7F8FA]"
              >
                + Add item
              </button>
            </div>
            <ul className="mt-2 space-y-2 text-xs">
              {edited.items?.map((it, i) => (
                <li
                  key={i}
                  className="space-y-1 rounded border border-[#E4E7EC] p-2"
                >
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={it.description ?? ""}
                      onChange={(e) =>
                        patchItem(i, { description: e.target.value })
                      }
                      placeholder="Description"
                      className="flex-1 rounded border border-[#E4E7EC] px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => removeItem(i)}
                      className="rounded border border-[#E4E7EC] px-2 text-[10px] text-[#B42318] hover:bg-[#FEF3F2]"
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <input
                      type="text"
                      value={it.hsnSac ?? ""}
                      onChange={(e) =>
                        patchItem(i, { hsnSac: e.target.value })
                      }
                      placeholder="HSN"
                      className="rounded border border-[#E4E7EC] px-2 py-1 text-[10px] font-mono"
                    />
                    <input
                      type="number"
                      value={it.qty ?? 0}
                      onChange={(e) =>
                        patchItem(i, { qty: Number(e.target.value) })
                      }
                      placeholder="Qty"
                      className="rounded border border-[#E4E7EC] px-2 py-1 text-[10px]"
                    />
                    <input
                      type="number"
                      value={it.ratePaise ?? 0}
                      onChange={(e) =>
                        patchItem(i, { ratePaise: Number(e.target.value) })
                      }
                      placeholder="Rate paise"
                      className="rounded border border-[#E4E7EC] px-2 py-1 text-[10px]"
                    />
                    <input
                      type="number"
                      value={it.gstRatePct ?? 0}
                      onChange={(e) =>
                        patchItem(i, { gstRatePct: Number(e.target.value) })
                      }
                      placeholder="GST%"
                      className="rounded border border-[#E4E7EC] px-2 py-1 text-[10px]"
                    />
                  </div>
                  <div className="text-[10px] text-[#5A6170]">
                    Line: {formatINR(Math.round((it.qty ?? 0) * (it.ratePaise ?? 0)))}
                    {it.unit ? ` · ${it.unit}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
            <h2 className="text-sm font-semibold">Reported total on invoice</h2>
            <p className="mt-1 text-[10px] text-[#5A6170]">
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
            <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
              <h2 className="text-sm font-semibold">GST recomputed</h2>
              <dl className="mt-2 space-y-1 text-xs">
                <Row label="Taxable" value={formatINR(totals.taxablePaise)} />
                <Row label="CGST" value={formatINR(totals.cgstPaise)} />
                <Row label="SGST" value={formatINR(totals.sgstPaise)} />
                <Row label="Round off" value={formatINR(totals.roundOffPaise)} />
                <Row label="Total" value={formatINR(totals.totalPaise)} />
              </dl>
            </section>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={reset}
              className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-medium hover:bg-[#F7F8FA]"
            >
              Scan another
            </button>
            <button
              onClick={saveAndContinue}
              className="rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
            >
              Save & continue →
            </button>
          </div>

          {extracted && (
            <details className="rounded-xl bg-white p-3 text-[10px] ring-1 ring-[#E4E7EC]">
              <summary className="cursor-pointer font-medium text-[#5A6170]">
                Show original extraction
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[9px] text-[#5A6170]">
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
      <span className="min-w-[100px] text-[#5A6170]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 rounded border border-[#E4E7EC] px-2 py-1 text-xs ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-[#5A6170]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

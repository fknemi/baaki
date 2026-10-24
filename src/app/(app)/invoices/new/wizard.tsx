"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StuckBox } from "@/components/domain/stuck-box";
import { StepProgress } from "@/components/domain/step-progress";
import { computeTotals } from "@/lib/domain/gst";
import { numberToWordsIndian } from "@/lib/domain/words";
import { addDays } from "@/lib/domain/dates";
import { formatINR, formatINRDelta } from "@/lib/domain/money";

type Customer = {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string | null;
  city: string | null;
};

type Business = {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string;
  registrationType: string;
  everCrossedEinvoiceThreshold: boolean;
};

type ItemDraft = {
  id: string;
  description: string;
  hsnSac: string;
  qty: number;
  unit: string;
  ratePaise: number;
  discountType: "amount" | "pct";
  discountValue: number;
  gstRatePct: number;
};

const GST_RATES = [0, 5, 12, 18, 28];
const UNITS = ["pcs", "box", "kg", "m", "sqft", "roll", "set"];
const STEP_LABELS = ["Customer", "Items", "Dates", "Review", "Preview", "Save"];

function newItem(): ItemDraft {
  return {
    id: crypto.randomUUID(),
    description: "",
    hsnSac: "",
    qty: 1,
    unit: "pcs",
    ratePaise: 0,
    discountType: "amount",
    discountValue: 0,
    gstRatePct: 18,
  };
}

function discountPaise(it: ItemDraft): number {
  if (it.discountType === "pct") {
    const gross = Math.round(it.qty * it.ratePaise);
    return Math.round((gross * it.discountValue) / 100);
  }
  return Math.round(it.discountValue * 100);
}

export function Wizard({
  customers,
  business,
  today,
}: {
  customers: Customer[];
  business: Business;
  today: string;
}) {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [customerId, setCustomerId] = useState("");
  const [search, setSearch] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState(addDays(today, 30));
  const [placeOfSupply, setPlaceOfSupply] = useState(business.stateCode);
  const [reverseCharge, setReverseCharge] = useState(false);
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const customer = customers.find((c) => c.id === customerId);

  const totals = useMemo(() => {
    if (!customer) return null;
    const complete = items.every(
      (it) =>
        it.qty > 0 && it.ratePaise > 0 && discountPaise(it) <= Math.round(it.qty * it.ratePaise),
    );
    if (!complete) return null;
    return computeTotals(
      items.map((it) => ({
        qty: it.qty,
        ratePaise: it.ratePaise,
        discountPaise: discountPaise(it),
        gstRatePct: it.gstRatePct,
      })),
      {
        stateCode: business.stateCode,
        registrationType: business.registrationType as "regular" | "composition" | "unregistered",
      },
      { stateCode: customer.stateCode ?? business.stateCode },
    );
  }, [items, customer, business]);

  function updateItem(id: string, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
  }

  const stepValid =
    step === 1
      ? !!customerId
      : step === 2
        ? items.every(
            (it) =>
              it.description.trim() &&
              /^\d{4,8}$/.test(it.hsnSac) &&
              it.qty > 0 &&
              it.ratePaise > 0,
          )
        : step === 3
          ? !!invoiceDate && !!dueDate && !!placeOfSupply
          : true;

  function next() {
    if (!stepValid) return;
    setStep((s) => Math.min(s + 1, 6));
  }

  function back() {
    setStep((s) => Math.max(s - 1, 1));
  }

  async function save(send: boolean) {
    if (!customer || !totals) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          invoiceDate,
          dueDate,
          placeOfSupplyStateCode: placeOfSupply,
          reverseCharge,
          items: items.map((it) => ({
            description: it.description,
            hsnSac: it.hsnSac,
            qty: it.qty,
            unit: it.unit,
            ratePaise: it.ratePaise,
            discountPaise: discountPaise(it),
            gstRatePct: it.gstRatePct,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Save failed");
      }
      const json = await res.json();
      const newId = json.data.id;
      if (send) {
        await fetch(`/api/invoices/${newId}/send`, { method: "POST" });
      }
      router.push(`/invoices/${newId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  const filtered = customers.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.gstin ?? "").includes(search),
  );

  return (
    <main className="min-h-screen bg-[#F7F8FA] pb-24">
      <div className="mx-auto max-w-lg px-4 py-6">
        <button
          onClick={() => router.push("/invoices")}
          className="mb-4 text-xs text-[#5A6170] underline"
        >
          ← Back to invoices
        </button>

        <div className="mb-4">
          <StepProgress current={step} total={6} labels={STEP_LABELS} />
        </div>

        <div className="rounded-xl bg-white p-5 ring-1 ring-[#E4E7EC]">
          <h1 className="mb-4 text-lg font-semibold">
            Step {step} of 6 · {STEP_LABELS[step - 1]}
          </h1>

          {step === 1 && (
            <div className="space-y-4">
              <Input
                placeholder="Search customers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCustomerId(c.id)}
                    className={`w-full rounded-lg border p-3 text-left text-sm ${
                      customerId === c.id
                        ? "border-[#0F5C4E] bg-[#0F5C4E]/5"
                        : "border-[#E4E7EC] hover:bg-[#F7F8FA]"
                    }`}
                  >
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-[#5A6170]">
                      {c.gstin ?? "Unregistered"} · {c.stateCode} {c.city}
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-xs text-[#5A6170]">No customers match.</p>
                )}
              </div>
              <p className="text-xs text-[#5A6170]">
                Need a new customer? Add them from the Customers page first.
              </p>
              <StuckBox>
                GSTIN is 15 characters. The first two digits are the state code — 27 is Maharashtra.
                A registered customer from a different state gets IGST, not CGST+SGST.
              </StuckBox>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {items.map((it, idx) => (
                <div key={it.id} className="rounded-lg border border-[#E4E7EC] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold">Item {idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(it.id)}
                        className="text-xs text-red-600 underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Description"
                      value={it.description}
                      onChange={(e) => updateItem(it.id, { description: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="HSN/SAC"
                        value={it.hsnSac}
                        onChange={(e) =>
                          updateItem(it.id, { hsnSac: e.target.value.replace(/\D/g, "") })
                        }
                      />
                      <select
                        value={it.unit}
                        onChange={(e) => updateItem(it.id, { unit: e.target.value })}
                        className="rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm"
                      >
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        value={it.qty || ""}
                        onChange={(e) => updateItem(it.id, { qty: Number(e.target.value) || 0 })}
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Rate ₹"
                        value={it.ratePaise ? (it.ratePaise / 100).toString() : ""}
                        onChange={(e) => {
                          const v = Number(e.target.value) || 0;
                          updateItem(it.id, { ratePaise: Math.round(v * 100) });
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        min="0"
                        placeholder={it.discountType === "pct" ? "Disc %" : "Disc ₹"}
                        value={it.discountValue || ""}
                        onChange={(e) =>
                          updateItem(it.id, { discountValue: Number(e.target.value) || 0 })
                        }
                      />
                      <select
                        value={it.discountType}
                        onChange={(e) =>
                          updateItem(it.id, {
                            discountType: e.target.value as "amount" | "pct",
                            discountValue: 0,
                          })
                        }
                        className="rounded-lg border border-[#E4E7EC] bg-white px-2 py-2 text-sm"
                      >
                        <option value="amount">₹</option>
                        <option value="pct">%</option>
                      </select>
                      <select
                        value={it.gstRatePct}
                        onChange={(e) => updateItem(it.id, { gstRatePct: Number(e.target.value) })}
                        className="rounded-lg border border-[#E4E7EC] bg-white px-2 py-2 text-sm"
                      >
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}% GST
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => setItems((p) => [...p, newItem()])}
                className="w-full"
              >
                + Add another item
              </Button>
              <StuckBox>
                HSN codes are 4 digits for businesses under ₹5 crore turnover. For services, use the
                SAC code (also 4-6 digits). A wrong code can invalidate the input tax credit for
                your customer.
              </StuckBox>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6170]">
                  Invoice date
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6170]">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-[#E4E7EC] bg-white px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-[#5A6170]">Default: 30 days from invoice date</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6170]">
                  Place of supply
                </label>
                <Input
                  value={placeOfSupply}
                  onChange={(e) => setPlaceOfSupply(e.target.value)}
                  maxLength={2}
                  placeholder="27"
                />
                <p className="mt-1 text-xs text-[#5A6170]">
                  Two-digit state code. 27 = Maharashtra.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reverseCharge}
                  onChange={(e) => setReverseCharge(e.target.checked)}
                />
                Reverse charge applies
              </label>
            </div>
          )}

          {step === 4 && customer && totals && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-[#F7F8FA] p-3">
                <div className="text-xs text-[#5A6170]">Bill to</div>
                <div className="font-semibold">{customer.name}</div>
                <div className="text-xs text-[#5A6170]">
                  {customer.gstin ?? "Unregistered"} · {customer.city}
                </div>
              </div>
              <div className="text-xs">
                Invoice date <strong>{invoiceDate}</strong> · Due <strong>{dueDate}</strong>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#5A6170]">
                    <th className="text-left">Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Taxable</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const taxable = Math.round(it.qty * it.ratePaise) - discountPaise(it);
                    return (
                      <tr key={it.id} className="border-t border-[#E4E7EC]">
                        <td className="py-1">{it.description}</td>
                        <td className="py-1 text-right tabular-nums">
                          {it.qty} {it.unit}
                        </td>
                        <td className="py-1 text-right tabular-nums">{formatINR(it.ratePaise)}</td>
                        <td className="py-1 text-right tabular-nums">{formatINR(taxable)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <dl className="space-y-1 border-t border-[#E4E7EC] pt-2 text-xs tabular-nums">
                <div className="flex justify-between">
                  <dt>Taxable</dt>
                  <dd>{formatINR(totals.taxablePaise)}</dd>
                </div>
                {totals.hasTax && !totals.isInterState && (
                  <>
                    <div className="flex justify-between">
                      <dt>CGST</dt>
                      <dd>{formatINR(totals.cgstPaise)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>SGST</dt>
                      <dd>{formatINR(totals.sgstPaise)}</dd>
                    </div>
                  </>
                )}
                {totals.hasTax && totals.isInterState && (
                  <div className="flex justify-between">
                    <dt>IGST</dt>
                    <dd>{formatINR(totals.igstPaise)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>Round off</dt>
                  <dd>{formatINRDelta(totals.roundOffPaise)}</dd>
                </div>
                <div className="flex justify-between border-t border-[#E4E7EC] pt-1 font-semibold">
                  <dt>Total</dt>
                  <dd>{formatINR(totals.totalPaise)}</dd>
                </div>
              </dl>
              <p className="text-xs text-[#5A6170] italic">
                {numberToWordsIndian(totals.totalPaise)}
              </p>
              {business.everCrossedEinvoiceThreshold && (
                <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900 ring-1 ring-amber-200">
                  ℹ E-invoicing applies to your business (₹5 crore AATO threshold crossed in a prior
                  year)
                </div>
              )}
            </div>
          )}

          {step === 5 && customer && totals && (
            <div className="space-y-3">
              <div className="rounded-xl border border-[#E4E7EC] bg-white p-4 shadow-sm">
                <div className="flex justify-between text-xs">
                  <div>
                    <div className="font-semibold">{business.name}</div>
                    <div className="text-[#5A6170]">GSTIN {business.gstin}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {totals.hasTax ? "TAX INVOICE" : "BILL OF SUPPLY"}
                    </div>
                    <div className="font-mono text-[#5A6170]">INV/…/____</div>
                  </div>
                </div>
                <hr className="my-3 border-[#E4E7EC]" />
                <div className="text-xs">
                  <div className="text-[#5A6170]">Bill to</div>
                  <div className="font-semibold">{customer.name}</div>
                  <div className="text-[#5A6170]">{customer.gstin ?? "Unregistered"}</div>
                </div>
                <table className="mt-3 w-full text-[10px]">
                  <thead>
                    <tr className="border-b border-[#1A1D23] text-left">
                      <th>Description</th>
                      <th className="text-right">Qty</th>
                      <th className="text-right">Taxable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const taxable = Math.round(it.qty * it.ratePaise) - discountPaise(it);
                      return (
                        <tr key={it.id} className="border-b border-[#E4E7EC]">
                          <td className="py-1">{it.description}</td>
                          <td className="py-1 text-right">
                            {it.qty} {it.unit}
                          </td>
                          <td className="py-1 text-right tabular-nums">{formatINR(taxable)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="mt-2 flex justify-end text-[10px]">
                  <table className="w-1/2">
                    <tbody>
                      <tr>
                        <td>Taxable</td>
                        <td className="text-right tabular-nums">
                          {formatINR(totals.taxablePaise)}
                        </td>
                      </tr>
                      {totals.hasTax && !totals.isInterState && (
                        <>
                          <tr>
                            <td>CGST</td>
                            <td className="text-right tabular-nums">
                              {formatINR(totals.cgstPaise)}
                            </td>
                          </tr>
                          <tr>
                            <td>SGST</td>
                            <td className="text-right tabular-nums">
                              {formatINR(totals.sgstPaise)}
                            </td>
                          </tr>
                        </>
                      )}
                      {totals.hasTax && totals.isInterState && (
                        <tr>
                          <td>IGST</td>
                          <td className="text-right tabular-nums">{formatINR(totals.igstPaise)}</td>
                        </tr>
                      )}
                      <tr>
                        <td>Round off</td>
                        <td className="text-right tabular-nums">
                          {formatINRDelta(totals.roundOffPaise)}
                        </td>
                      </tr>
                      <tr className="border-t border-[#1A1D23] font-semibold">
                        <td>Total</td>
                        <td className="text-right tabular-nums">{formatINR(totals.totalPaise)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] text-[#5A6170] italic">
                  {numberToWordsIndian(totals.totalPaise)}
                </p>
              </div>
              <p className="text-xs text-[#5A6170]">
                This is a preview. The actual A4 print layout (with UPI QR) is available after
                saving.
              </p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-3 text-sm">
              <p>
                Save this invoice as a draft, or send it right away and start the follow-up clock.
              </p>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          )}

          {!stepValid && step <= 3 && (
            <p className="mt-3 text-xs text-red-600">
              {step === 1
                ? "Select a customer to continue."
                : step === 2
                  ? "Every item needs a description, 4-8 digit HSN, quantity > 0, and rate > 0."
                  : "All date fields and place of supply are required."}
            </p>
          )}
        </div>

        {(step === 2 || step === 3 || step === 4) && (
          <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-[#E4E7EC]">
            {totals ? (
              <div className="flex justify-between text-xs">
                <span className="text-[#5A6170]">Taxable {formatINR(totals.taxablePaise)}</span>
                <span className="font-semibold tabular-nums">
                  Total {formatINR(totals.totalPaise)}
                </span>
              </div>
            ) : (
              <p className="text-xs text-[#5A6170]">
                Fill in qty and rate for every item to see the totals.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={back} disabled={busy} className="flex-1">
              ← Back
            </Button>
          )}
          {step < 6 && (
            <Button
              onClick={next}
              disabled={!stepValid || busy}
              className="flex-1 bg-[#0F5C4E] text-white hover:bg-[#0F5C4E]/90"
            >
              Next →
            </Button>
          )}
          {step === 6 && (
            <>
              <Button
                variant="outline"
                onClick={() => save(false)}
                disabled={busy}
                className="flex-1"
              >
                Save as draft
              </Button>
              <Button
                onClick={() => save(true)}
                disabled={busy}
                className="flex-1 bg-[#0F5C4E] text-white hover:bg-[#0F5C4E]/90"
              >
                {busy ? "Saving…" : "Send invoice →"}
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

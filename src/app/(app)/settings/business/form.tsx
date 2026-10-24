"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidGSTIN } from "@/lib/domain/gstin";

type Props = {
  initial: {
    name: string;
    ownerName: string;
    ownerPhone: string;
    gstin: string | null;
    registrationType: string;
    turnoverPaise: number;
    everCrossedEinvoiceThreshold: boolean;
    udyamRegistered: boolean;
    udyamType: string | null;
    upiId: string | null;
    safetyBufferPaise: number;
    address: { line1: string; city: string; state: string; pincode: string };
    bank: {
      accountName: string;
      accountNumberMasked: string;
      ifsc: string;
      bankName: string;
    } | null;
  };
};

export function BusinessProfileForm({ initial }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [gstin, setGstin] = useState(initial.gstin ?? "");
  const [regType, setRegType] = useState(initial.registrationType);
  const [turnover, setTurnover] = useState(String(Math.round(initial.turnoverPaise / 100)));
  const [everCrossed, setEverCrossed] = useState(initial.everCrossedEinvoiceThreshold);
  const [udyamRegistered, setUdyamRegistered] = useState(initial.udyamRegistered);
  const [udyamType, setUdyamType] = useState(initial.udyamType ?? "micro");
  const [upiId, setUpiId] = useState(initial.upiId ?? "");
  const [buffer, setBuffer] = useState(String(Math.round(initial.safetyBufferPaise / 100)));
  const [line1, setLine1] = useState(initial.address.line1);
  const [city, setCity] = useState(initial.address.city);
  const [state, setState] = useState(initial.address.state);
  const [pincode, setPincode] = useState(initial.address.pincode);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const gstinValid = gstin === "" || isValidGSTIN(gstin.toUpperCase()).valid;
  const gstinStateCode = gstin.length >= 2 ? gstin.slice(0, 2) : "";

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          gstin: gstin.trim() || null,
          registrationType: regType,
          turnoverPaise: Math.round(Number(turnover) * 100),
          everCrossedEinvoiceThreshold: everCrossed,
          udyamRegistered,
          udyamType: udyamRegistered ? udyamType : null,
          upiId: upiId.trim() || null,
          safetyBufferPaise: Math.round(Number(buffer) * 100),
          addressJson: {
            ...initial.address,
            line1,
            city,
            state,
            pincode,
          },
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Save failed");
      setMsg("Saved");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">Identity</h3>
        <div className="mt-2 space-y-2 text-xs">
          <Field label="Business name" value={name} onChange={setName} />
          <div className="text-[10px] text-[#5A6170]">
            Owner: {initial.ownerName} · {initial.ownerPhone}
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[#5A6170]">GSTIN</span>
            <input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              className={`rounded-lg border px-3 py-2 font-mono text-xs ${
                gstinValid ? "border-[#E4E7EC]" : "border-[#B42318]"
              }`}
            />
            {!gstinValid && gstin.length > 0 && (
              <span className="text-[10px] text-[#B42318]">Invalid GSTIN checksum</span>
            )}
            {gstinValid && gstin.length >= 14 && (
              <span className="text-[10px] text-[#067647]">
                ✓ Valid (state code {gstinStateCode})
              </span>
            )}
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[#5A6170]">Registration type</span>
            <select
              value={regType}
              onChange={(e) => setRegType(e.target.value)}
              className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs"
            >
              <option value="regular">Regular</option>
              <option value="composition">Composition</option>
              <option value="unregistered">Unregistered</option>
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">E-invoice threshold</h3>
        <div className="mt-2 space-y-2 text-xs">
          <Field
            label="Current-year turnover (₹)"
            value={turnover}
            onChange={setTurnover}
            type="number"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={everCrossed}
              onChange={(e) => setEverCrossed(e.target.checked)}
            />
            <span>Crossed ₹5 cr in a prior FY (e-invoicing applies)</span>
          </label>
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">Udyam (MSMED)</h3>
        <div className="mt-2 space-y-2 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={udyamRegistered}
              onChange={(e) => setUdyamRegistered(e.target.checked)}
            />
            <span>Registered under Udyam</span>
          </label>
          {udyamRegistered && (
            <label className="flex flex-col gap-1">
              <span className="text-[#5A6170]">Classification</span>
              <select
                value={udyamType}
                onChange={(e) => setUdyamType(e.target.value)}
                className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs"
              >
                <option value="micro">Micro</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">Address</h3>
        <div className="mt-2 space-y-2 text-xs">
          <Field label="Line 1" value={line1} onChange={setLine1} />
          <Field label="City" value={city} onChange={setCity} />
          <Field label="State" value={state} onChange={setState} />
          <Field label="Pincode" value={pincode} onChange={setPincode} />
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">Payment</h3>
        <div className="mt-2 space-y-2 text-xs">
          <Field label="UPI ID" value={upiId} onChange={setUpiId} mono />
        </div>
      </section>

      <section className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]">
        <h3 className="text-sm font-semibold">Forecast</h3>
        <div className="mt-2 space-y-2 text-xs">
          <Field label="Safety buffer (₹)" value={buffer} onChange={setBuffer} type="number" />
        </div>
      </section>

      {err && <p className="text-xs text-[#B42318]">{err}</p>}
      {msg && <p className="text-xs text-[#067647]">{msg}</p>}

      <button
        onClick={save}
        disabled={saving || !gstinValid}
        className="w-full rounded-lg bg-[#0F5C4E] px-4 py-3 text-sm font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  mono = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[#5A6170]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs ${
          mono ? "font-mono" : ""
        }`}
      />
    </label>
  );
}

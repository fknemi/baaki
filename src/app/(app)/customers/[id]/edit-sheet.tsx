"use client";


import { useState } from "react";
import { isValidGSTIN } from "@/lib/domain/gstin";

export type CustomerEditable = {
  id: string;
  name: string;
  gstin: string | null;
  stateCode: string | null;
  placeOfSupplyState: string | null;
  city: string | null;
  phoneMasked: string | null;
  email: string | null;
  creditDays: number;
  preferredLanguage: string;
};

export function CustomerEditSheet({
  customer,
  onClose,
  onSaved,
}: {
  customer: CustomerEditable;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer.name);
  const [gstin, setGstin] = useState(customer.gstin ?? "");
  const [city, setCity] = useState(customer.city ?? "");
  const [phone, setPhone] = useState(customer.phoneMasked ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [creditDays, setCreditDays] = useState(String(customer.creditDays));
  const [language, setLanguage] = useState<"en" | "hi">(
    customer.preferredLanguage === "hi" ? "hi" : "en",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const gstinTrim = gstin.trim().toUpperCase();
  const gstinValid = gstinTrim === "" || isValidGSTIN(gstinTrim).valid;
  const derivedStateCode = gstinTrim.length >= 2 ? gstinTrim.slice(0, 2) : "";

  async function save() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    if (!gstinValid) {
      setError("GSTIN checksum is invalid — check the last character.");
      return;
    }
    const cd = Number(creditDays);
    if (!Number.isInteger(cd) || cd < 0 || cd > 365) {
      setError("Credit days must be a whole number between 0 and 365.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gstin: gstinTrim || null,
          stateCode: derivedStateCode || customer.stateCode || null,
          placeOfSupplyState: customer.placeOfSupplyState,
          city: city.trim() || null,
          phoneMasked: phone.trim() || null,
          email: email.trim() || null,
          creditDays: cd,
          preferredLanguage: language,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Save failed");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit customer"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold">Edit customer</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-[#5A6170] hover:text-[#1A1D23] disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[#5A6170]">Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#5A6170]">GSTIN</span>
            <input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="27AAPFU0939F1ZV"
              className={`rounded-lg border px-3 py-2 text-xs font-mono ${
                gstinValid ? "border-[#E4E7EC]" : "border-[#B42318]"
              }`}
            />
            {!gstinValid && gstin.length > 0 && (
              <span className="text-[10px] text-[#B42318]">
                Invalid GSTIN checksum
              </span>
            )}
            {gstinValid && derivedStateCode && (
              <span className="text-[10px] text-[#067647]">
                ✓ Valid · state code {derivedStateCode}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#5A6170]">City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#5A6170]">Phone (masked)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-mono"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#5A6170]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#5A6170]">Credit days</span>
            <input
              type="number"
              min={0}
              max={365}
              value={creditDays}
              onChange={(e) => setCreditDays(e.target.value)}
              className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[#5A6170]">Preferred language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
              className="rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs"
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </label>

          {error && <p className="text-xs text-[#B42318]">{error}</p>}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-medium hover:bg-[#F7F8FA] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !gstinValid}
            className="flex-1 rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

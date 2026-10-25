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

const fieldSurface =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20";

export function CustomerEditSheet({
  customer,
  onClose,
  onSaved,
  onDeleted,
}: {
  customer: CustomerEditable;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
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

  // Delete flow: closed → confirming → deleting
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const gstinTrim = gstin.trim().toUpperCase();
  const gstinValid = gstinTrim === "" || isValidGSTIN(gstinTrim).valid;
  const derivedStateCode = gstinTrim.length >= 2 ? gstinTrim.slice(0, 2) : "";

  const busy = saving || deleting;

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

  async function doDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "DELETE",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 409 = customer has invoices; message from the route is human-
        // readable ("Customer has invoices. Cancel or reassign them…").
        throw new Error(j?.error?.message ?? "Delete failed");
      }
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setConfirming(false);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit customer"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-white">Edit customer</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-white/60 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Name *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldSurface}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">GSTIN</span>
            <input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="27AAPFU0939F1ZV"
              className={`w-full rounded-lg border bg-[#171717]/20 px-3 py-2 font-mono text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 ${
                gstinValid ? "border-white/10" : "border-[#B42318]/60"
              }`}
            />
            {!gstinValid && gstin.length > 0 && (
              <span className="text-[10px] text-[#FF9B8F]">
                Invalid GSTIN checksum
              </span>
            )}
            {gstinValid && derivedStateCode && (
              <span className="text-[10px] text-[#4ADE80]">
                ✓ Valid · state code {derivedStateCode}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">City</span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={fieldSurface}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Phone (masked)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${fieldSurface} font-mono`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldSurface}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Credit days</span>
            <input
              type="number"
              min={0}
              max={365}
              value={creditDays}
              onChange={(e) => setCreditDays(e.target.value)}
              className={fieldSurface}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Preferred language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
              className={`${fieldSurface} [&>option]:bg-[#192221] [&>option]:text-white`}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </label>

          {error && <p className="text-xs text-[#FF9B8F]">{error}</p>}
        </div>

        {/* Danger zone — only visible until the user starts the confirm flow */}
        <div className="mt-4 border-t border-white/10 pt-3">
          {!confirming ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              disabled={busy}
              className="text-xs font-medium text-[#FF9B8F] hover:text-[#FFB8AF] disabled:opacity-50"
            >
              Delete customer
            </button>
          ) : (
            <div className="rounded-lg border border-[#B42318]/60 bg-[#B42318]/10 p-3">
              <p className="text-xs text-white">
                Delete <span className="font-semibold">{customer.name}</span>?
                This cannot be undone. Customers with invoices must have them
                cancelled or reassigned first.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="flex-1 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50"
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={deleting}
                  className="flex-1 rounded-lg bg-[#B42318] px-3 py-2 text-xs font-medium text-white hover:bg-[#B42318]/90 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !gstinValid}
            className="flex-1 rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

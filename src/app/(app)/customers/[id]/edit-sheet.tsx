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

// fieldSurface — every plain <input> and native <select> in this sheet uses
// this. Height AND text scale together so the box never stretches while the
// text stays tiny inside it (the input-group bug in shadcn's InputGroup).
// Text caps at md:text-base like the Wizard's fieldSurface; the box continues
// to grow to h-12 (48 px) so the dialog has a comfortable tap/click target
// on lg/xl where the dialog widens to 672 px.
const fieldSurface =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 " +
  "h-9 px-3 text-xs " +
  "sm:h-10 sm:rounded-lg sm:px-3.5 sm:text-sm " +
  "md:h-11 md:rounded-xl md:px-4 md:text-base " +
  "lg:h-12 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:rounded-xl xl:px-5 xl:text-base";

// Shared secondary button chrome (Keep / Cancel).
const BTN_SECONDARY =
  "flex items-center justify-center font-medium text-white hover:bg-white/5 disabled:opacity-50 " +
  "h-9 rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-xs " +
  "sm:h-9 sm:rounded-lg sm:px-3.5 sm:text-sm " +
  "md:h-10 md:rounded-xl md:px-4 md:text-sm " +
  "lg:h-11 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:rounded-xl xl:px-5 xl:text-base";

// Shared primary button chrome (Save).
const BTN_PRIMARY =
  "flex items-center justify-center font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 " +
  "h-9 rounded-lg bg-[#0F5C4E] px-3 text-xs " +
  "sm:h-9 sm:rounded-lg sm:px-3.5 sm:text-sm " +
  "md:h-10 md:rounded-xl md:px-4 md:text-sm " +
  "lg:h-11 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:rounded-xl xl:px-5 xl:text-base";

// Shared danger button chrome (Delete).
const BTN_DANGER =
  "flex items-center justify-center font-medium text-white hover:bg-[#B42318]/90 disabled:opacity-50 " +
  "h-9 rounded-lg bg-[#B42318] px-3 text-xs " +
  "sm:h-9 sm:rounded-lg sm:px-3.5 sm:text-sm " +
  "md:h-10 md:rounded-xl md:px-4 md:text-sm " +
  "lg:h-11 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:rounded-xl xl:px-5 xl:text-base";

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4 md:p-6 lg:p-6 xl:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Edit customer"
    >
      {/* max-height constrained so on short viewports the sheet scrolls
          inside the dialog instead of pushing the whole page. The dialog
          itself widens md→xl so it stays proportional to the page below
          (CustomerDetailPage max-widths are max-w-md→max-w-4xl). */}
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl sm:max-h-[88vh] sm:rounded-xl sm:p-5 md:max-h-[86vh] md:max-w-lg md:rounded-2xl md:p-6 lg:max-h-[85vh] lg:max-w-xl lg:rounded-2xl lg:p-6 xl:max-h-[85vh] xl:max-w-2xl xl:rounded-3xl xl:p-7">
        <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
          <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
            Edit customer
          </h2>
          {/* Close button gets a fixed square hit-target at every size so
              the ✕ glyph never sits flush against the dialog edge; the
              glyph itself scales with the header text. */}
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-base text-white/60 hover:bg-white/5 hover:text-white disabled:opacity-50 sm:h-8 sm:w-8 sm:text-lg md:h-9 md:w-9 md:rounded-lg md:text-xl lg:h-9 lg:w-9 lg:rounded-lg lg:text-xl xl:h-10 xl:w-10 xl:rounded-lg xl:text-2xl"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-3 sm:mt-3 sm:space-y-3.5 md:mt-4 md:space-y-4 lg:mt-4 lg:space-y-4 xl:mt-5 xl:space-y-5">
          <label className="flex flex-col gap-1 sm:gap-1.5 md:gap-1.5 lg:gap-2 xl:gap-2">
            <span className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
              Name *
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldSurface}
            />
          </label>

          <label className="flex flex-col gap-1 sm:gap-1.5 md:gap-1.5 lg:gap-2 xl:gap-2">
            <span className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
              GSTIN
            </span>
            {/* Uses the shared fieldSurface so height and text scale with
                every other field. The invalid-state border uses the !
                modifier so it wins over fieldSurface's border-white/10
                regardless of utility-emit order. */}
            <input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="27AAPFU0939F1ZV"
              className={`${fieldSurface} font-mono ${
                gstinValid ? "" : "border-[#B42318]/60!"
              }`}
            />
            {!gstinValid && gstin.length > 0 && (
              <span className="text-[10px] text-[#FF9B8F] sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                Invalid GSTIN checksum
              </span>
            )}
            {gstinValid && derivedStateCode && (
              <span className="text-[10px] text-[#4ADE80] sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                ✓ Valid · state code {derivedStateCode}
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 sm:gap-1.5 md:gap-1.5 lg:gap-2 xl:gap-2">
            <span className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
              City
            </span>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={fieldSurface}
            />
          </label>

          <label className="flex flex-col gap-1 sm:gap-1.5 md:gap-1.5 lg:gap-2 xl:gap-2">
            <span className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
              Phone (masked)
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${fieldSurface} font-mono`}
            />
          </label>

          <label className="flex flex-col gap-1 sm:gap-1.5 md:gap-1.5 lg:gap-2 xl:gap-2">
            <span className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldSurface}
            />
          </label>

          <label className="flex flex-col gap-1 sm:gap-1.5 md:gap-1.5 lg:gap-2 xl:gap-2">
            <span className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
              Credit days
            </span>
            <input
              type="number"
              min={0}
              max={365}
              value={creditDays}
              onChange={(e) => setCreditDays(e.target.value)}
              className={fieldSurface}
            />
          </label>

          <label className="flex flex-col gap-1 sm:gap-1.5 md:gap-1.5 lg:gap-2 xl:gap-2">
            <span className="text-xs italic text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
              Preferred language
            </span>
            {/* Native <select> — same fieldSurface ladder as the <input>s
                above so the trigger and its text scale together. The
                option list is rendered by the browser and is unaffected
                by h-* on the element itself. */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "en" | "hi")}
              className={`${fieldSurface} [&>option]:bg-[#192221] [&>option]:text-white`}
            >
              <option value="en">English</option>
              <option value="hi">हिंदी</option>
            </select>
          </label>

          {error && (
            <p className="text-xs text-[#FF9B8F] sm:text-sm md:text-sm lg:text-base xl:text-base">
              {error}
            </p>
          )}
        </div>

        {/* Danger zone — text link until the user starts the confirm flow,
            then a bordered confirm panel. The link grows text-only; the
            panel scales its chrome AND its Keep/Delete buttons. */}
        <div className="mt-4 border-t border-white/10 pt-3 sm:mt-4 sm:pt-3 md:mt-5 md:pt-4 lg:mt-5 lg:pt-4 xl:mt-6 xl:pt-5">
          {!confirming ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirming(true);
              }}
              disabled={busy}
              className="text-xs font-medium text-[#FF9B8F] hover:text-[#FFB8AF] disabled:opacity-50 sm:text-sm md:text-sm lg:text-base xl:text-base"
            >
              Delete customer
            </button>
          ) : (
            <div className="rounded-lg border border-[#B42318]/60 bg-[#B42318]/10 p-3 sm:rounded-lg sm:p-3.5 md:rounded-xl md:p-4 lg:rounded-xl lg:p-4 xl:rounded-xl xl:p-5">
              <p className="text-xs text-white sm:text-sm md:text-sm lg:text-base xl:text-base">
                Delete <span className="font-semibold">{customer.name}</span>?
                This cannot be undone. Customers with invoices must have them
                cancelled or reassigned first.
              </p>
              <div className="mt-2 flex gap-2 sm:mt-2.5 sm:gap-2 md:mt-3 md:gap-2.5 lg:mt-3 lg:gap-3 xl:mt-4 xl:gap-3">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className={`${BTN_SECONDARY} flex-1`}
                >
                  Keep
                </button>
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={deleting}
                  className={`${BTN_DANGER} flex-1`}
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex gap-2 sm:mt-4 sm:gap-2 md:mt-5 md:gap-2.5 lg:mt-5 lg:gap-3 xl:mt-6 xl:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BTN_SECONDARY} flex-1`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy || !gstinValid}
            className={`${BTN_PRIMARY} flex-1`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

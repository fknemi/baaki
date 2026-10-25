"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidGSTIN } from "@/lib/domain/gstin";

type BankDetails = {
    accountName: string;
    accountNumberMasked: string;
    ifsc: string;
    bankName: string;
};

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
        bank: BankDetails | null;
        paymentMethods: string[];
    };
};

// ─── outline icon ────────────────────────────────────────────────────────────
// Capped at h-4 (16 px) on lg/xl. The caller-override at the "Valid (state
// code …)" line used `className="h-3 w-3"` which replaces the default and
// pins the glyph at 12 px forever — that call now merges via template
// literal instead.

const ICON_STD =
    "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

function IconCheck({ className = ICON_STD }: { className?: string }) {
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

// ─── shared styles ───────────────────────────────────────────────────────────

const CARD =
    "rounded-lg border border-white/10 p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-4 lg:rounded-2xl lg:p-5 xl:rounded-2xl xl:p-5";

// Section title. Mirrors the settings-page section headings.
const SECTION_H3 =
    "font-semibold text-white text-sm sm:text-base md:text-base lg:text-lg xl:text-lg";

// Field label. Used by every <label> wrapper inside the form.
const LABEL =
    "italic text-white text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base";

// Helper / hint text (owner line, UPI example, IFSC note, etc.).
const HINT =
    "italic text-white text-[10px] sm:text-[11px] md:text-xs lg:text-xs xl:text-sm";

// Field surface — text inputs, selects, mono inputs. Scales BOTH the box
// and the text inside so the field never stretches while the text stays
// tiny (the input-group bug from the OCR / MarkPaid passes).
const fieldSurface =
    "w-full rounded-lg border border-white/10 bg-[#171717]/20 text-white " +
    "placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 " +
    "[color-scheme:dark] " +
    "h-9 px-3 text-xs " +
    "sm:h-10 sm:px-3.5 sm:text-sm " +
    "md:h-11 md:rounded-xl md:px-4 md:text-base " +
    "lg:h-12 lg:rounded-xl lg:px-4 lg:text-base " +
    "xl:h-12 xl:rounded-xl xl:px-5 xl:text-lg";

const selectSurface = `${fieldSurface} [&>option]:bg-[#192221] [&>option]:text-white`;

// Checkbox — size grows with the label so the click target and glyph stay
// proportional to the text beside them.
const CHECKBOX =
    "accent-[#0F5C4E] h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-5 xl:w-5";

// Primary submit — same ladder as every other CTA in the app.
const SUBMIT_BTN =
    "flex w-full items-center justify-center font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 " +
    "h-11 rounded-lg bg-[#0F5C4E] px-3 text-sm " +
    "sm:h-11 sm:px-4 sm:text-sm " +
    "md:h-12 md:rounded-xl md:px-4 md:text-base " +
    "lg:h-12 lg:rounded-xl lg:px-5 lg:text-base " +
    "xl:h-14 xl:rounded-xl xl:px-6 xl:text-lg";

export function BusinessProfileForm({ initial }: Props) {
    const router = useRouter();
    const [name, setName] = useState(initial.name);
    const [gstin, setGstin] = useState(initial.gstin ?? "");
    const [regType, setRegType] = useState(initial.registrationType);
    const [turnover, setTurnover] = useState(
        String(Math.round(initial.turnoverPaise / 100)),
    );
    const [everCrossed, setEverCrossed] = useState(
        initial.everCrossedEinvoiceThreshold,
    );
    const [udyamRegistered, setUdyamRegistered] = useState(
        initial.udyamRegistered,
    );
    const [udyamType, setUdyamType] = useState(initial.udyamType ?? "micro");
    const [upiId, setUpiId] = useState(initial.upiId ?? "");
    const [buffer, setBuffer] = useState(
        String(Math.round(initial.safetyBufferPaise / 100)),
    );
    const [line1, setLine1] = useState(initial.address.line1);
    const [city, setCity] = useState(initial.address.city);
    const [state, setState] = useState(initial.address.state);
    const [pincode, setPincode] = useState(initial.address.pincode);

    // Bank fields
    const [bankName, setBankName] = useState(initial.bank?.bankName ?? "");
    const [accountName, setAccountName] = useState(
        initial.bank?.accountName ?? "",
    );
    const [accountNumberMasked, setAccountNumberMasked] = useState(
        initial.bank?.accountNumberMasked ?? "",
    );
    const [ifsc, setIfsc] = useState(initial.bank?.ifsc ?? "");

    // Payment method toggles
    const [enableUpi, setEnableUpi] = useState(
        initial.paymentMethods.includes("upi"),
    );
    const [enableBank, setEnableBank] = useState(
        initial.paymentMethods.includes("bank"),
    );

    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const gstinValid = gstin === "" || isValidGSTIN(gstin.toUpperCase()).valid;
    const gstinStateCode = gstin.length >= 2 ? gstin.slice(0, 2) : "";

    async function save() {
        // Validate payment methods
        if (!enableUpi && !enableBank) {
            setErr("Enable at least one payment method.");
            return;
        }
        if (enableUpi && !upiId.trim()) {
            setErr("UPI ID is required when UPI payments are enabled.");
            return;
        }
        if (
            enableBank &&
            (!bankName.trim() ||
                !accountName.trim() ||
                !accountNumberMasked.trim() ||
                !ifsc.trim())
        ) {
            setErr(
                "All bank fields (bank name, account holder, account number, IFSC) are required when bank transfer is enabled.",
            );
            return;
        }

        setSaving(true);
        setErr(null);
        setMsg(null);

        const paymentMethods: string[] = [];
        if (enableUpi) paymentMethods.push("upi");
        if (enableBank) paymentMethods.push("bank");

        const bank: BankDetails | null =
            accountName.trim() && accountNumberMasked.trim() && ifsc.trim() && bankName.trim()
                ? {
                    accountName: accountName.trim(),
                    accountNumberMasked: accountNumberMasked.trim(),
                    ifsc: ifsc.trim().toUpperCase(),
                    bankName: bankName.trim(),
                }
                : null;

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
                    upiId: enableUpi ? upiId.trim() || null : null,
                    safetyBufferPaise: Math.round(Number(buffer) * 100),
                    addressJson: {
                        ...initial.address,
                        line1,
                        city,
                        state,
                        pincode,
                    },
                    bankJson: bank,
                    paymentMethods,
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
        // auto-rows-fr grid so short sections (Udyam, Forecast) match the
        // height of the tallest section in their row — the borders line up
        // instead of stair-stepping. 1-col on mobile → 2-col on md, so on
        // a wide monitor each card has real breathing room instead of a
        // 720 px-wide sheet holding 2 fields.
        <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:gap-3 md:grid-cols-2 md:gap-4 lg:gap-4 xl:gap-5">
            <section className={CARD}>
                <h3 className={SECTION_H3}>Identity</h3>
                <div className="mt-2 space-y-2 sm:mt-2 sm:space-y-2 md:mt-2.5 md:space-y-3 lg:mt-3 lg:space-y-3 xl:mt-3 xl:space-y-3.5">
                    <Field label="Business name" value={name} onChange={setName} />
                    <div className={HINT}>
                        Owner: {initial.ownerName} · {initial.ownerPhone}
                    </div>
                    <label className="flex flex-col gap-1 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2">
                        <span className={LABEL}>GSTIN</span>
                        <input
                            value={gstin}
                            onChange={(e) => setGstin(e.target.value.toUpperCase())}
                            className={`${fieldSurface} font-mono ${
                                gstinValid ? "" : "border-[#B42318]/60!"
                            }`}
                        />
                        {!gstinValid && gstin.length > 0 && (
                            <span className="text-[10px] text-[#FF9B8F] sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
                                Invalid GSTIN checksum
                            </span>
                        )}
                        {gstinValid && gstin.length >= 14 && (
                            <span className={`flex items-center gap-1 ${HINT}`}>
                                <IconCheck />
                                Valid (state code {gstinStateCode})
                            </span>
                        )}
                    </label>
                    <label className="flex flex-col gap-1 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2">
                        <span className={LABEL}>Registration type</span>
                        <select
                            value={regType}
                            onChange={(e) => setRegType(e.target.value)}
                            className={selectSurface}
                        >
                            <option value="regular">Regular</option>
                            <option value="composition">Composition</option>
                            <option value="unregistered">Unregistered</option>
                        </select>
                    </label>
                </div>
            </section>

            <section className={CARD}>
                <h3 className={SECTION_H3}>E-invoice threshold</h3>
                <div className="mt-2 space-y-2 sm:mt-2 sm:space-y-2 md:mt-2.5 md:space-y-3 lg:mt-3 lg:space-y-3 xl:mt-3 xl:space-y-3.5">
                    <Field
                        label="Current-year turnover (₹)"
                        value={turnover}
                        onChange={setTurnover}
                        type="number"
                    />
                    <label className="flex cursor-pointer items-center gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3">
                        <input
                            type="checkbox"
                            checked={everCrossed}
                            onChange={(e) => setEverCrossed(e.target.checked)}
                            className={CHECKBOX}
                        />
                        <span className={`text-white ${LABEL}`}>
                            Crossed ₹5 cr in a prior FY (e-invoicing applies)
                        </span>
                    </label>
                </div>
            </section>

            <section className={CARD}>
                <h3 className={SECTION_H3}>Udyam (MSMED)</h3>
                <div className="mt-2 space-y-2 sm:mt-2 sm:space-y-2 md:mt-2.5 md:space-y-3 lg:mt-3 lg:space-y-3 xl:mt-3 xl:space-y-3.5">
                    <label className="flex cursor-pointer items-center gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3">
                        <input
                            type="checkbox"
                            checked={udyamRegistered}
                            onChange={(e) => setUdyamRegistered(e.target.checked)}
                            className={CHECKBOX}
                        />
                        <span className={`text-white ${LABEL}`}>
                            Registered under Udyam
                        </span>
                    </label>
                    {udyamRegistered && (
                        <label className="flex flex-col gap-1 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2">
                            <span className={LABEL}>Classification</span>
                            <select
                                value={udyamType}
                                onChange={(e) => setUdyamType(e.target.value)}
                                className={selectSurface}
                            >
                                <option value="micro">Micro</option>
                                <option value="small">Small</option>
                                <option value="medium">Medium</option>
                            </select>
                        </label>
                    )}
                </div>
            </section>

            <section className={CARD}>
                <h3 className={SECTION_H3}>Address</h3>
                <div className="mt-2 space-y-2 sm:mt-2 sm:space-y-2 md:mt-2.5 md:space-y-3 lg:mt-3 lg:space-y-3 xl:mt-3 xl:space-y-3.5">
                    <Field label="Line 1" value={line1} onChange={setLine1} />
                    {/* City / State / Pincode → 2-col on md+ so the three
                        short fields don't each take a full row. Line 1
                        stays full-width. */}
                    <div className="grid grid-cols-1 gap-2 sm:gap-2 md:grid-cols-2 md:gap-3 lg:gap-3 xl:gap-4">
                        <Field label="City" value={city} onChange={setCity} />
                        <Field label="State" value={state} onChange={setState} />
                    </div>
                    <Field label="Pincode" value={pincode} onChange={setPincode} />
                </div>
            </section>

            {/* Payment methods — spans both columns because the UPI + bank
                cards side-by-side make more sense than a narrow single
                column of stacked fields inside a 2-col form grid. */}
            <section className={`${CARD} md:col-span-2`}>
                <h3 className={SECTION_H3}>Payment methods</h3>
                <p className={`mt-1 sm:mt-1 md:mt-1.5 lg:mt-2 xl:mt-2 ${HINT}`}>
                    Shown to customers on the pay page. Enable one or both.
                </p>

                {/* UPI and Bank panels sit side-by-side on lg+ so the form
                    doesn't become a mile-long column of fields. Each is
                    self-contained; if bank is disabled its panel collapses
                    to just the toggle row. */}
                <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-3 sm:gap-3 md:mt-4 md:gap-3 lg:mt-4 lg:grid-cols-2 lg:gap-4 xl:mt-5 xl:gap-4">
                    {/* UPI */}
                    <div
                        className={`rounded-lg border p-3 sm:rounded-lg sm:p-3 md:rounded-xl md:p-3.5 lg:rounded-xl lg:p-4 xl:rounded-xl xl:p-4 ${
                            enableUpi ? "border-[#067647]/60" : "border-white/10"
                        }`}
                    >
                        <label className="flex cursor-pointer items-center justify-between gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3">
                            <span className={`font-medium text-white ${LABEL}`}>
                                UPI
                            </span>
                            <input
                                type="checkbox"
                                checked={enableUpi}
                                onChange={(e) => setEnableUpi(e.target.checked)}
                                className={CHECKBOX}
                            />
                        </label>
                        {enableUpi && (
                            <div className="mt-2 sm:mt-2 md:mt-2.5 lg:mt-3 xl:mt-3">
                                <Field
                                    label="UPI ID"
                                    value={upiId}
                                    onChange={setUpiId}
                                    mono
                                />
                                <p className={`mt-1 sm:mt-1 md:mt-1.5 lg:mt-2 xl:mt-2 ${HINT}`}>
                                    e.g. businessname@okhdfcbank
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Bank Transfer */}
                    <div
                        className={`rounded-lg border p-3 sm:rounded-lg sm:p-3 md:rounded-xl md:p-3.5 lg:rounded-xl lg:p-4 xl:rounded-xl xl:p-4 ${
                            enableBank ? "border-[#067647]/60" : "border-white/10"
                        }`}
                    >
                        <label className="flex cursor-pointer items-center justify-between gap-2 sm:gap-2 md:gap-2.5 lg:gap-3 xl:gap-3">
                            <span className={`font-medium text-white ${LABEL}`}>
                                Bank transfer
                            </span>
                            <input
                                type="checkbox"
                                checked={enableBank}
                                onChange={(e) => setEnableBank(e.target.checked)}
                                className={CHECKBOX}
                            />
                        </label>
                        {enableBank && (
                            <div className="mt-2 space-y-2 sm:mt-2 sm:space-y-2 md:mt-2.5 md:space-y-2.5 lg:mt-3 lg:space-y-3 xl:mt-3 xl:space-y-3">
                                <Field
                                    label="Bank name"
                                    value={bankName}
                                    onChange={setBankName}
                                />
                                <Field
                                    label="Account holder"
                                    value={accountName}
                                    onChange={setAccountName}
                                />
                                <Field
                                    label="Account number"
                                    value={accountNumberMasked}
                                    onChange={setAccountNumberMasked}
                                    mono
                                />
                                <Field
                                    label="IFSC"
                                    value={ifsc}
                                    onChange={(v) => setIfsc(v.toUpperCase())}
                                    mono
                                />
                                <p className={`${HINT}`}>
                                    Account number is displayed as entered. Use the masked form
                                    (e.g. XXXX XXXX 4821) for public sharing, or the full
                                    number if customers need it to transfer.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className={`${CARD} md:col-span-2`}>
                <h3 className={SECTION_H3}>Forecast</h3>
                <div className="mt-2 space-y-2 sm:mt-2 sm:space-y-2 md:mt-2.5 md:space-y-3 lg:mt-3 lg:space-y-3 xl:mt-3 xl:space-y-3.5">
                    <Field
                        label="Safety buffer (₹)"
                        value={buffer}
                        onChange={setBuffer}
                        type="number"
                    />
                </div>
            </section>

            {err && (
                <p className="text-xs text-[#FF9B8F] sm:text-sm md:text-sm lg:text-base xl:text-base md:col-span-2">
                    {err}
                </p>
            )}
            {msg && (
                <p className="flex items-center gap-1.5 text-xs text-white sm:text-sm md:text-sm lg:text-base xl:text-base md:col-span-2">
                    <IconCheck />
                    {msg}
                </p>
            )}

            <div className="md:col-span-2">
                <button
                    onClick={save}
                    disabled={saving || !gstinValid}
                    className={SUBMIT_BTN}
                >
                    {saving ? "Saving…" : "Save changes"}
                </button>
            </div>
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
        <label className="flex flex-col gap-1 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2">
            <span className={LABEL}>{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`${fieldSurface} ${mono ? "font-mono" : ""}`}
            />
        </label>
    );
}

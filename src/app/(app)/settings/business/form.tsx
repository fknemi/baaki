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

function IconCheck({ className = "h-3 w-3" }: { className?: string }) {
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

const CARD = "rounded-xl border border-white/10 p-4";
const fieldSurface =
    "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]";
const selectSurface = `${fieldSurface} [&>option]:bg-[#192221] [&>option]:text-white`;

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
        <div className="space-y-3">
            <section className={CARD}>
                <h3 className="text-sm font-semibold text-white">Identity</h3>
                <div className="mt-2 space-y-2 text-xs">
                    <Field label="Business name" value={name} onChange={setName} />
                    <div className="text-[10px] text-white italic">
                        Owner: {initial.ownerName} · {initial.ownerPhone}
                    </div>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs italic text-white">GSTIN</span>
                        <input
                            value={gstin}
                            onChange={(e) => setGstin(e.target.value.toUpperCase())}
                            className={`w-full rounded-lg border bg-[#171717]/20 px-3 py-2 font-mono text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 ${
                                gstinValid ? "border-white/10" : "border-[#B42318]/60"
                            }`}
                        />
                        {!gstinValid && gstin.length > 0 && (
                            <span className="text-[10px] text-[#FF9B8F]">
                                Invalid GSTIN checksum
                            </span>
                        )}
                        {gstinValid && gstin.length >= 14 && (
                            <span className="flex items-center gap-1 text-[10px] text-white">
                                <IconCheck className="h-3 w-3" />
                                Valid (state code {gstinStateCode})
                            </span>
                        )}
                    </label>
                    <label className="flex flex-col gap-1">
                        <span className="text-xs italic text-white">
                            Registration type
                        </span>
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
                <h3 className="text-sm font-semibold text-white">
                    E-invoice threshold
                </h3>
                <div className="mt-2 space-y-2 text-xs">
                    <Field
                        label="Current-year turnover (₹)"
                        value={turnover}
                        onChange={setTurnover}
                        type="number"
                    />
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={everCrossed}
                            onChange={(e) => setEverCrossed(e.target.checked)}
                            className="h-3.5 w-3.5 accent-[#0F5C4E]"
                        />
                        <span className="text-white">
                            Crossed ₹5 cr in a prior FY (e-invoicing applies)
                        </span>
                    </label>
                </div>
            </section>

            <section className={CARD}>
                <h3 className="text-sm font-semibold text-white">
                    Udyam (MSMED)
                </h3>
                <div className="mt-2 space-y-2 text-xs">
                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={udyamRegistered}
                            onChange={(e) => setUdyamRegistered(e.target.checked)}
                            className="h-3.5 w-3.5 accent-[#0F5C4E]"
                        />
                        <span className="text-white">Registered under Udyam</span>
                    </label>
                    {udyamRegistered && (
                        <label className="flex flex-col gap-1">
                            <span className="text-xs italic text-white">
                                Classification
                            </span>
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
                <h3 className="text-sm font-semibold text-white">Address</h3>
                <div className="mt-2 space-y-2 text-xs">
                    <Field label="Line 1" value={line1} onChange={setLine1} />
                    <Field label="City" value={city} onChange={setCity} />
                    <Field label="State" value={state} onChange={setState} />
                    <Field label="Pincode" value={pincode} onChange={setPincode} />
                </div>
            </section>

            <section className={CARD}>
                <h3 className="text-sm font-semibold text-white">
                    Payment methods
                </h3>
                <p className="mt-1 text-[10px] text-white italic">
                    Shown to customers on the pay page. Enable one or both.
                </p>

                <div className="mt-3 space-y-3">
                    {/* UPI */}
                    <div
                        className={`rounded-lg border p-3 ${
                            enableUpi ? "border-[#067647]/60" : "border-white/10"
                        }`}
                    >
                        <label className="flex cursor-pointer items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-white">UPI</span>
                            <input
                                type="checkbox"
                                checked={enableUpi}
                                onChange={(e) => setEnableUpi(e.target.checked)}
                                className="h-3.5 w-3.5 accent-[#0F5C4E]"
                            />
                        </label>
                        {enableUpi && (
                            <div className="mt-2">
                                <Field
                                    label="UPI ID"
                                    value={upiId}
                                    onChange={setUpiId}
                                    mono
                                />
                                <p className="mt-1 text-[10px] text-white italic">
                                    e.g. businessname@okhdfcbank
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Bank Transfer */}
                    <div
                        className={`rounded-lg border p-3 ${
                            enableBank ? "border-[#067647]/60" : "border-white/10"
                        }`}
                    >
                        <label className="flex cursor-pointer items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-white">
                                Bank transfer
                            </span>
                            <input
                                type="checkbox"
                                checked={enableBank}
                                onChange={(e) => setEnableBank(e.target.checked)}
                                className="h-3.5 w-3.5 accent-[#0F5C4E]"
                            />
                        </label>
                        {enableBank && (
                            <div className="mt-2 space-y-2">
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
                                <p className="text-[10px] text-white italic">
                                    Account number is displayed as entered. Use the masked form
                                    (e.g. XXXX XXXX 4821) for public sharing, or the full
                                    number if customers need it to transfer.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section className={CARD}>
                <h3 className="text-sm font-semibold text-white">Forecast</h3>
                <div className="mt-2 space-y-2 text-xs">
                    <Field
                        label="Safety buffer (₹)"
                        value={buffer}
                        onChange={setBuffer}
                        type="number"
                    />
                </div>
            </section>

            {err && <p className="text-xs text-[#FF9B8F]">{err}</p>}
            {msg && (
                <p className="flex items-center gap-1.5 text-xs text-white">
                    <IconCheck className="h-3 w-3" />
                    {msg}
                </p>
            )}

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
            <span className="text-xs italic text-white">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark] ${
                    mono ? "font-mono" : ""
                }`}
            />
        </label>
    );
}

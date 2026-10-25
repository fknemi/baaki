"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidGSTIN } from "@/lib/domain/gstin";

const fieldSurface =
    "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20";

function IconCheck({ className = "h-3 w-3" }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

export default function NewCustomerPage() {
    const router = useRouter();

    const [name, setName] = useState("");
    const [gstin, setGstin] = useState("");
    const [city, setCity] = useState("");
    const [phone, setPhone] = useState("");
    const [email, setEmail] = useState("");
    const [creditDays, setCreditDays] = useState("30");
    const [language, setLanguage] = useState<"en" | "hi">("en");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

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
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    gstin: gstinTrim || null,
                    stateCode: derivedStateCode || null,
                    city: city.trim() || null,
                    phoneMasked: phone.trim() || null,
                    email: email.trim() || null,
                    creditDays: cd,
                    preferredLanguage: language,
                }),
            });
            const j = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(j?.error?.message ?? "Failed to create customer");
            setDone(j?.data?.name ?? name.trim());
            router.refresh();
            setTimeout(() => router.push("/customers"), 800);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to create customer");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="mx-auto max-w-lg px-4 py-8 pt-14">

            <div
                role="dialog"
                aria-labelledby="new-customer-title"
                className="rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 id="new-customer-title" className="text-sm font-semibold text-white">
                        New customer
                    </h2>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="text-white/40 transition-colors hover:text-white"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                <div className="space-y-3 text-xs">
                    <label className="flex flex-col gap-1">
                        <span className="text-xs italic text-white">Name *</span>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Acme Pvt Ltd"
                            autoFocus
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
                            placeholder="Mumbai"
                            className={fieldSurface}
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs italic text-white">Phone</span>
                        <input
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="98765 *****"
                            className={`${fieldSurface} font-mono`}
                        />
                    </label>

                    <label className="flex flex-col gap-1">
                        <span className="text-xs italic text-white">Email</span>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="customer@business.com"
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
                    {done && (
                        <p className="flex items-center gap-1.5 text-xs text-white">
                            <IconCheck className="h-3 w-3" />
                            {done} created
                        </p>
                    )}
                </div>

                <div className="mt-4 flex gap-2">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        disabled={saving}
                        className="flex-1 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={save}
                        disabled={saving || !gstinValid || !!done}
                        className="flex-1 rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
                    >
                        {saving ? "Creating…" : done ? "Created" : "Create customer"}
                    </button>
                </div>
            </div>
        </div>
    );
}

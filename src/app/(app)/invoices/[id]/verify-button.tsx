"use client";
export const instant = false;
import { useState } from "react";

type VerifyResult = {
    valid: boolean;
    chain: { valid: true; eventCount: number } | { valid: false; failedAt: number; reason: string };
    totalsMatch: boolean;
    discrepancies: string[];
    eventCount: number;
    computed: { totalPaise: number };
};

export function VerifyButton({ invoiceId }: { invoiceId: string }) {
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<VerifyResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function onClick() {
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/invoices/${invoiceId}/verify`);
            if (!res.ok) throw new Error("Verify failed");
            const json = await res.json();
            setResult(json.data);
        } catch {
            setError("Could not verify.");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-2">
            <button
                onClick={onClick}
                disabled={busy}
                className="w-full rounded-lg bg-white px-4 py-3 text-sm font-medium ring-1 ring-[#E4E7EC] hover:bg-[#F7F8FA] disabled:opacity-50"
            >
                {busy ? "Verifying…" : "✓ Verify data"}
            </button>
            {result && (
                <div className={`rounded-lg p-3 text-xs ring-1 ${result.valid
                    ? "bg-green-50 text-green-900 ring-green-200"
                    : "bg-red-50 text-red-900 ring-red-200"
                    }`}>
                    <p className="font-semibold">
                        {result.valid ? "✓ Chain verified, totals match" : "✗ Tampered"}
                    </p>
                    <p className="mt-1">
                        {result.chain.valid ? `${result.chain.eventCount} events` : `Chain broken at seq ${result.chain.failedAt}`}
                    </p>
                    {result.discrepancies.length > 0 && (
                        <ul className="mt-1 list-disc pl-4">
                            {result.discrepancies.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                    )}
                </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
    );
}

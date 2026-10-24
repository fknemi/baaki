"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/domain/money";

type InboxItem = {
    id: string;
    type: "dispute" | "already_paid";
    status: "open" | "accepted" | "rejected" | "resolved";
    message: string | null;
    reference: string | null;
    invoiceId: string;
    invoiceNumber?: string;
    customerName?: string;
    createdAt: string;
    resolvedAt: string | null;
};



type TabKey = "disputes" | "already_paid" | "resolved";

const TABS: { key: TabKey; label: string }[] = [
    { key: "disputes", label: "Disputes" },
    { key: "already_paid", label: "Already paid" },
    { key: "resolved", label: "Resolved" },
];

function matchesTab(item: InboxItem, tab: TabKey): boolean {
    if (tab === "resolved") {
        // History of everything actioned
        return (
            item.status === "accepted" ||
            item.status === "rejected" ||
            item.status === "resolved"
        );
    }
    if (tab === "disputes") {
        // Action queue: open disputes
        return item.type === "dispute" && item.status === "open";
    }
    // already_paid — action queue: open claims
    return item.type === "already_paid" && item.status === "open";
}



export default function InboxPage() {
    const [allItems, setAllItems] = useState<InboxItem[] | null>(null);
    const [tab, setTab] = useState<TabKey>("disputes");
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<InboxItem | null>(null);

    const reload = useCallback(async () => {
        try {
            // Fetch all — filter client-side so API contract changes can't break tabs
            const res = await fetch("/api/inbox", { cache: "no-store" });
            const j = await res.json();
            if (j.error) {
                setError(j.error.message);
                return;
            }
            setAllItems(j.data ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to load");
        }
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    async function act(
        id: string,
        kind: "accept" | "reject" | "edit-invoice",
        payload: Record<string, unknown>,
    ) {
        const res = await fetch(`/api/inbox/${id}/${kind}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
            setError(j?.error?.message ?? "Action failed");
            return;
        }
        setSelected(null);
        await reload();
    }

    if (error && !allItems)
        return <main className="p-4 text-sm text-[#B42318]">{error}</main>;

    if (!allItems)
        return <main className="p-4 text-sm text-[#5A6170]">Loading…</main>;

    const items = allItems.filter((it) => matchesTab(it, tab));

    return (
        <main className="space-y-4 p-4 pb-24">
            <h1 className="text-xl font-semibold">Inbox</h1>

            <div className="flex gap-2 overflow-x-auto">
                {TABS.map((t) => {
                    const count = allItems.filter((it) => matchesTab(it, t.key)).length;
                    const isActive = tab === t.key;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${isActive
                                ? "bg-[#0F5C4E] text-white"
                                : "bg-white text-[#5A6170] ring-1 ring-[#E4E7EC]"
                                }`}
                        >
                            {t.label} ({count})
                        </button>
                    );
                })}
            </div>

            {error && <p className="text-xs text-[#B42318]">{error}</p>}

            {items.length === 0 && (
                <p className="rounded-lg bg-white p-4 text-xs text-[#5A6170] ring-1 ring-[#E4E7EC]">
                    No items in {TABS.find((t) => t.key === tab)?.label.toLowerCase()}.
                </p>
            )}

            {items.length > 0 && (
                <ul className="space-y-3">
                    {items.map((it) => (
                        <li
                            key={it.id}
                            className="rounded-xl bg-white p-4 ring-1 ring-[#E4E7EC]"
                        >
                            <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs text-[#5A6170]">
                                        {it.type === "dispute" ? "⚑ Dispute" : "✓ Already paid"} ·{" "}
                                        {it.customerName ?? "Customer"}
                                    </div>
                                    <div className="mt-0.5 text-xs font-mono">
                                        {it.invoiceNumber ?? it.invoiceId.slice(0, 8)}
                                    </div>
                                    {it.message && (
                                        <p className="mt-2 text-xs text-[#1A1D23]">
                                            &ldquo;{it.message}&rdquo;
                                        </p>
                                    )}
                                    {it.reference && (
                                        <p className="mt-1 text-[10px] text-[#5A6170]">
                                            Ref: {it.reference}
                                        </p>
                                    )}
                                </div>
                                {it.status === "open" && (
                                    <button
                                        onClick={() => setSelected(it)}
                                        className="ml-2 shrink-0 rounded-lg border border-[#E4E7EC] px-2 py-1 text-[10px] font-medium hover:bg-[#F7F8FA]"
                                    >
                                        Resolve
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[10px] text-[#5A6170]">
                                <span>{new Date(it.createdAt).toLocaleString()}</span>
                                <Link
                                    href={`/invoices/${it.invoiceId}`}
                                    className="text-[#175CD3] hover:underline"
                                >
                                    Open invoice →
                                </Link>
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {selected && (
                <ResolveSheet
                    item={selected}
                    onClose={() => setSelected(null)}
                    onAction={act}
                />
            )}
        </main>
    );
}

function ResolveSheet({
    item,
    onClose,
    onAction,
}: {
    item: InboxItem;
    onClose: () => void;
    onAction: (
        id: string,
        kind: "accept" | "reject" | "edit-invoice",
        payload: Record<string, unknown>,
    ) => void;
}) {
    const [mode, setMode] = useState<"menu" | "accept" | "reject" | "edit">(
        "menu",
    );
    const [creditPaise, setCreditPaise] = useState("");
    const [reply, setReply] = useState("");
    const [itemId, setItemId] = useState("");
    const [description, setDescription] = useState("");
    const [qty, setQty] = useState("");
    const [rate, setRate] = useState("");

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            role="dialog"
            aria-modal="true"
        >
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
                <div className="flex items-start justify-between">
                    <h2 className="text-lg font-semibold">
                        {item.type === "dispute"
                            ? "Resolve dispute"
                            : "Resolve already paid"}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-[#5A6170] hover:text-[#1A1D23]"
                        aria-label="Close"
                    >
                        ✕
                    </button>
                </div>

                {mode === "menu" && (
                    <div className="mt-4 space-y-2">
                        <button
                            onClick={() => setMode("accept")}
                            className="w-full rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
                        >
                            Accept
                        </button>
                        <button
                            onClick={() => setMode("reject")}
                            className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-medium hover:bg-[#F7F8FA]"
                        >
                            Reject
                        </button>
                        {item.type === "dispute" && (
                            <button
                                onClick={() => setMode("edit")}
                                className="w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-medium hover:bg-[#F7F8FA]"
                            >
                                Edit invoice
                            </button>
                        )}
                    </div>
                )}

                {mode === "accept" && item.type === "dispute" && (
                    <div className="mt-4 space-y-3">
                        <label className="block text-xs">
                            Credit note amount (₹)
                            <input
                                type="number"
                                min={0}
                                value={creditPaise}
                                onChange={(e) => setCreditPaise(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
                                placeholder="0"
                            />
                        </label>
                        <button
                            onClick={() =>
                                onAction(item.id, "accept", {
                                    creditNoteAmountPaise: Math.round(Number(creditPaise || 0) * 100),
                                })
                            }
                            className="w-full rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white"
                        >
                            Confirm accept
                        </button>
                    </div>
                )}

                {mode === "accept" && item.type === "already_paid" && (
                    <div className="mt-4 space-y-3">
                        <p className="text-xs text-[#5A6170]">
                            This marks the invoice as fully paid. Reference:{" "}
                            {item.reference ?? "none"}
                        </p>
                        <button
                            onClick={() => onAction(item.id, "accept", {})}
                            className="w-full rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white"
                        >
                            Mark invoice paid
                        </button>
                    </div>
                )}

                {mode === "reject" && (
                    <div className="mt-4 space-y-3">
                        <label className="block text-xs">
                            Reply (required)
                            <textarea
                                rows={3}
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
                            />
                        </label>
                        <button
                            onClick={() => onAction(item.id, "reject", { reply })}
                            disabled={reply.trim().length === 0}
                            className="w-full rounded-lg bg-[#B42318] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                        >
                            Send rejection
                        </button>
                    </div>
                )}

                {mode === "edit" && (
                    <div className="mt-4 space-y-3">
                        <p className="text-[10px] text-[#5A6170]">
                            Paste the invoice item UUID (find it via the invoice detail page).
                            A CORRECTION event will be appended with before/after values.
                        </p>
                        <label className="block text-xs">
                            Item ID
                            <input
                                type="text"
                                value={itemId}
                                onChange={(e) => setItemId(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-xs font-mono"
                            />
                        </label>
                        <label className="block text-xs">
                            New description (optional)
                            <input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
                            />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label className="block text-xs">
                                Qty
                                <input
                                    type="number"
                                    value={qty}
                                    onChange={(e) => setQty(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
                                />
                            </label>
                            <label className="block text-xs">
                                Rate ₹
                                <input
                                    type="number"
                                    value={rate}
                                    onChange={(e) => setRate(e.target.value)}
                                    className="mt-1 w-full rounded-lg border border-[#E4E7EC] px-3 py-2 text-sm"
                                />
                            </label>
                        </div>
                        <button
                            onClick={() => {
                                const patch: Record<string, unknown> = { itemId };
                                if (description) patch.description = description;
                                if (qty) patch.qty = Number(qty);
                                if (rate) patch.ratePaise = Math.round(Number(rate) * 100);
                                onAction(item.id, "edit-invoice", { corrections: [patch] });
                            }}
                            disabled={!itemId}
                            className="w-full rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
                        >
                            Apply correction
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

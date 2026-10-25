"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

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

// ─── outline icons ───────────────────────────────────────────────────────────

function IconFlag({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

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

function IconClose({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconArrowRight({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ─── shared styles ───────────────────────────────────────────────────────────

const fieldSurface =
  "mt-1 w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark]";
const labelStyle = "block text-xs italic text-white";

function matchesTab(item: InboxItem, tab: TabKey): boolean {
  if (tab === "resolved") {
    return (
      item.status === "accepted" ||
      item.status === "rejected" ||
      item.status === "resolved"
    );
  }
  if (tab === "disputes") {
    return item.type === "dispute" && item.status === "open";
  }
  return item.type === "already_paid" && item.status === "open";
}

export default function InboxPage() {
  const [allItems, setAllItems] = useState<InboxItem[] | null>(null);
  const [tab, setTab] = useState<TabKey>("disputes");
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InboxItem | null>(null);

  const reload = useCallback(async () => {
    try {
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
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
    return <main className="p-4 text-sm text-white">{error}</main>;

  if (!allItems)
    return <main className="p-4 text-sm text-white">Loading…</main>;

  const items = allItems.filter((it) => matchesTab(it, tab));

  return (
    <main className="space-y-4 p-4 pb-24 pt-14">
      <h1 className="text-xl font-semibold text-white">Inbox</h1>

      <nav
        aria-label="Filter inbox items"
        className="-mx-4 overflow-x-auto"
      >
        <ul className="flex gap-2 pb-1 px-4">
          {TABS.map((t) => {
            const count = allItems.filter((it) => matchesTab(it, t.key)).length;
            const isActive = tab === t.key;
            return (
              <li key={t.key}>
                <button
                  onClick={() => setTab(t.key)}
                  aria-pressed={isActive}
                  className={`inline-block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-white text-[#111]"
                      : "border border-white/10 bg-[#171717]/20 text-white hover:bg-white/5"
                  }`}
                >
                  {t.label} ({count})
                </button>
              </li>
            );
          })}
          <li aria-hidden="true" className="w-4 shrink-0" />
        </ul>
      </nav>

      {error && <p className="text-xs text-[#FF9B8F]">{error}</p>}

      {items.length === 0 && (
        <p className="rounded-lg border border-white/10 p-4 text-xs text-white italic">
          No items in {TABS.find((t) => t.key === tab)?.label.toLowerCase()}.
        </p>
      )}

      {items.length > 0 && (
        <ul className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {items.map((it) => (
            <li key={it.id} className="rounded-xl border border-white/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs text-white italic">
                    {it.type === "dispute" ? (
                      <IconFlag className="h-3 w-3 shrink-0" />
                    ) : (
                      <IconCheck className="h-3 w-3 shrink-0" />
                    )}
                    <span className="truncate">
                      {it.type === "dispute" ? "Dispute" : "Already paid"} ·{" "}
                      {it.customerName ?? "Customer"}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-white">
                    {it.invoiceNumber ?? it.invoiceId.slice(0, 8)}
                  </div>
                  {it.message && (
                    <p className="mt-2 text-xs text-white">
                      &ldquo;{it.message}&rdquo;
                    </p>
                  )}
                  {it.reference && (
                    <p className="mt-1 text-[10px] text-white italic">
                      Ref: {it.reference}
                    </p>
                  )}
                </div>
                {it.status === "open" && (
                  <button
                    onClick={() => setSelected(it)}
                    className="shrink-0 rounded-lg border border-white/10 bg-[#171717]/20 px-2 py-1 text-[10px] font-medium text-white hover:bg-white/5"
                  >
                    Resolve
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-white italic">
                <span className="truncate">
                  {new Date(it.createdAt).toLocaleString()}
                </span>
                <Link
                  href={`/invoices/${it.invoiceId}`}
                  className="flex shrink-0 items-center gap-1 underline underline-offset-4"
                >
                  Open invoice
                  <IconArrowRight className="h-2.5 w-2.5" />
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
  const [mode, setMode] = useState<"menu" | "accept" | "reject" | "edit">("menu");
  const [creditPaise, setCreditPaise] = useState("");
  const [reply, setReply] = useState("");
  const [itemId, setItemId] = useState("");
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            {item.type === "dispute" ? "Resolve dispute" : "Resolve already paid"}
          </h2>
          <button
            onClick={onClose}
            className="shrink-0 text-white/60 hover:text-white"
            aria-label="Close"
          >
            <IconClose />
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
              className="w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5"
            >
              Reject
            </button>
            {item.type === "dispute" && (
              <button
                onClick={() => setMode("edit")}
                className="w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5"
              >
                Edit invoice
              </button>
            )}
          </div>
        )}

        {mode === "accept" && item.type === "dispute" && (
          <div className="mt-4 space-y-3">
            <label className={labelStyle}>
              Credit note amount (₹)
              <input
                type="number"
                min={0}
                value={creditPaise}
                onChange={(e) => setCreditPaise(e.target.value)}
                className={fieldSurface}
                placeholder="0"
              />
            </label>
            <button
              onClick={() =>
                onAction(item.id, "accept", {
                  creditNoteAmountPaise: Math.round(Number(creditPaise || 0) * 100),
                })
              }
              className="w-full rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
            >
              Confirm accept
            </button>
          </div>
        )}

        {mode === "accept" && item.type === "already_paid" && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-white italic">
              This marks the invoice as fully paid. Reference:{" "}
              {item.reference ?? "none"}
            </p>
            <button
              onClick={() => onAction(item.id, "accept", {})}
              className="w-full rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90"
            >
              Mark invoice paid
            </button>
          </div>
        )}

        {mode === "reject" && (
          <div className="mt-4 space-y-3">
            <label className={labelStyle}>
              Reply (required)
              <textarea
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                className={fieldSurface}
              />
            </label>
            <button
              onClick={() => onAction(item.id, "reject", { reply })}
              disabled={reply.trim().length === 0}
              className="w-full rounded-lg bg-[#B42318] px-3 py-2 text-xs font-medium text-white hover:bg-[#B42318]/90 disabled:opacity-50"
            >
              Send rejection
            </button>
          </div>
        )}

        {mode === "edit" && (
          <div className="mt-4 space-y-3">
            <p className="text-[10px] text-white italic">
              Paste the invoice item UUID (find it via the invoice detail page).
              A CORRECTION event will be appended with before/after values.
            </p>
            <label className={labelStyle}>
              Item ID
              <input
                type="text"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className={`${fieldSurface} font-mono text-xs`}
              />
            </label>
            <label className={labelStyle}>
              New description (optional)
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={fieldSurface}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className={labelStyle}>
                Qty
                <input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  className={fieldSurface}
                />
              </label>
              <label className={labelStyle}>
                Rate ₹
                <input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className={fieldSurface}
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
              className="w-full rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
            >
              Apply correction
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

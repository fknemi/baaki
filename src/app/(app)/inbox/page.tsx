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

const ICON_TINY =
  "h-2.5 w-2.5 sm:h-3 sm:w-3 md:h-3.5 md:w-3.5 lg:h-3.5 lg:w-3.5 xl:h-4 xl:w-4";
const ICON_STD =
  "h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 lg:h-4 lg:w-4 xl:h-4 xl:w-4";

function IconFlag({ className = ICON_STD }: { className?: string }) {
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

function IconClose({ className = ICON_STD }: { className?: string }) {
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

function IconArrowRight({ className = ICON_TINY }: { className?: string }) {
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
  "mt-1 w-full rounded-lg border border-white/10 bg-[#171717]/20 text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 [color-scheme:dark] " +
  "px-3 py-2 text-xs " +
  "sm:px-3.5 sm:py-2 sm:text-sm " +
  "md:rounded-xl md:px-4 md:py-2.5 md:text-base " +
  "lg:rounded-xl lg:px-4 lg:py-3 lg:text-base " +
  "xl:rounded-xl xl:px-5 xl:py-3 xl:text-lg";

const labelStyle =
  "block italic text-white text-xs sm:text-xs md:text-sm lg:text-sm xl:text-base";

const MODAL_PRIMARY =
  "flex w-full items-center justify-center font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50 " +
  "h-9 rounded-lg bg-[#0F5C4E] px-3 text-xs " +
  "sm:h-9 sm:rounded-lg sm:px-3.5 sm:text-sm " +
  "md:h-10 md:rounded-xl md:px-4 md:text-sm " +
  "lg:h-11 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:rounded-xl xl:px-5 xl:text-base";

const MODAL_SECONDARY =
  "flex w-full items-center justify-center font-medium text-white hover:bg-white/5 disabled:opacity-50 " +
  "h-9 rounded-lg border border-white/10 bg-[#171717]/20 px-3 text-xs " +
  "sm:h-9 sm:rounded-lg sm:px-3.5 sm:text-sm " +
  "md:h-10 md:rounded-xl md:px-4 md:text-sm " +
  "lg:h-11 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:rounded-xl xl:px-5 xl:text-base";

const MODAL_DANGER =
  "flex w-full items-center justify-center font-medium text-white hover:bg-[#B42318]/90 disabled:opacity-50 " +
  "h-9 rounded-lg bg-[#B42318] px-3 text-xs " +
  "sm:h-9 sm:rounded-lg sm:px-3.5 sm:text-sm " +
  "md:h-10 md:rounded-xl md:px-4 md:text-sm " +
  "lg:h-11 lg:rounded-xl lg:px-4 lg:text-base " +
  "xl:h-12 xl:rounded-xl xl:px-5 xl:text-base";

// Resolve button — small inline action on each card. Kept as a named
// constant (not a className="..." + "..." inline) so the JSX attribute
// stays `className={RESOLVE_BTN}`, which is the only form the JSX parser
// accepts for a concatenated class string.
const RESOLVE_BTN =
  "flex shrink-0 items-center justify-center font-medium text-white hover:bg-white/5 " +
  "h-7 rounded-lg border border-white/10 bg-[#171717]/20 px-2 text-[10px] " +
  "sm:h-8 sm:px-2.5 sm:text-xs " +
  "md:h-9 md:rounded-lg md:px-3 md:text-xs " +
  "lg:h-9 lg:rounded-lg lg:px-3 lg:text-sm " +
  "xl:h-10 xl:rounded-lg xl:px-3.5 xl:text-sm";

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
    return (
      <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
        {error}
      </main>
    );

  if (!allItems)
    return (
      <main className="mx-auto w-full max-w-md p-3 pt-14 text-sm text-white sm:max-w-xl sm:p-4 sm:pt-16 sm:text-base md:max-w-2xl md:p-6 md:pt-20 md:text-base lg:max-w-3xl lg:p-6 lg:pt-24 lg:text-lg xl:max-w-4xl xl:p-8 xl:pt-24 xl:text-lg">
        Loading…
      </main>
    );

  const items = allItems.filter((it) => matchesTab(it, tab));

  return (
    <main className="mx-auto w-full max-w-7xl space-y-3 px-3 pb-24 pt-14 sm:space-y-4 sm:px-4 sm:pt-16 md:space-y-4 md:px-6 md:pt-20 lg:space-y-5 lg:px-8 lg:pt-24 xl:space-y-5 xl:pt-24">
      <h1 className="text-xl font-semibold text-white sm:text-2xl md:text-2xl lg:text-3xl xl:text-4xl">
        Inbox
      </h1>

      <nav
        aria-label="Filter inbox items"
        className="-mx-3 overflow-x-auto sm:-mx-4 md:-mx-6 lg:-mx-8"
      >
        <ul className="flex gap-2 px-3 pb-1 sm:gap-2 sm:px-4 md:gap-2.5 md:px-6 lg:gap-3 lg:px-8">
          {TABS.map((t) => {
            const count = allItems.filter((it) => matchesTab(it, t.key)).length;
            const isActive = tab === t.key;
            return (
              <li key={t.key}>
                <button
                  onClick={() => setTab(t.key)}
                  aria-pressed={isActive}
                  className={`inline-block whitespace-nowrap rounded-full font-medium transition-colors ${
                    "px-3 py-1.5 text-xs " +
                    "sm:px-3.5 sm:py-1.5 sm:text-xs " +
                    "md:px-4 md:py-2 md:text-sm " +
                    "lg:px-4 lg:py-2 lg:text-sm " +
                    "xl:px-5 xl:py-2.5 xl:text-base"
                  } ${
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
          <li aria-hidden="true" className="w-3 shrink-0 sm:w-4 md:w-4 lg:w-4 xl:w-5" />
        </ul>
      </nav>

      {error && (
        <p className="text-xs text-[#FF9B8F] sm:text-sm md:text-sm lg:text-base xl:text-base">
          {error}
        </p>
      )}

      {items.length === 0 && (
        <p className="rounded-lg border border-white/10 p-3 text-xs italic text-white sm:rounded-xl sm:p-4 sm:text-sm md:rounded-xl md:p-5 md:text-sm lg:rounded-2xl lg:p-5 lg:text-base xl:rounded-2xl xl:p-6 xl:text-base">
          No items in {TABS.find((t) => t.key === tab)?.label.toLowerCase()}.
        </p>
      )}

      {items.length > 0 && (
        <ul className="grid grid-cols-1 items-start gap-3 sm:gap-3 md:grid-cols-2 md:gap-4 lg:gap-4 xl:grid-cols-3 xl:gap-5">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex h-full flex-col rounded-lg border border-white/10 p-3 sm:rounded-xl sm:p-4 md:rounded-xl md:p-4 lg:rounded-2xl lg:p-5 xl:rounded-2xl xl:p-5"
            >
              <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] italic text-white sm:gap-1.5 sm:text-[11px] md:gap-2 md:text-xs lg:gap-2 lg:text-xs xl:gap-2.5 xl:text-sm">
                    {it.type === "dispute" ? <IconFlag /> : <IconCheck />}
                    <span className="truncate">
                      {it.type === "dispute" ? "Dispute" : "Already paid"} ·{" "}
                      {it.customerName ?? "Customer"}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-xs text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
                    {it.invoiceNumber ?? it.invoiceId.slice(0, 8)}
                  </div>
                  {it.message && (
                    <p className="mt-2 text-xs text-white sm:mt-2 sm:text-xs md:mt-2.5 md:text-sm lg:mt-3 lg:text-sm xl:mt-3 xl:text-base">
                      &ldquo;{it.message}&rdquo;
                    </p>
                  )}
                  {it.reference && (
                    <p className="mt-1 text-[10px] italic text-white sm:mt-1 sm:text-[11px] md:mt-1.5 md:text-xs lg:mt-2 lg:text-xs xl:mt-2 xl:text-sm">
                      Ref: {it.reference}
                    </p>
                  )}
                </div>
                {it.status === "open" && (
                  <button
                    onClick={() => setSelected(it)}
                    className={RESOLVE_BTN}
                  >
                    Resolve
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-[10px] italic text-white sm:mt-2 sm:text-[11px] md:mt-2.5 md:text-xs lg:mt-3 lg:text-xs xl:mt-3 xl:text-sm">
                <span className="truncate">
                  {new Date(it.createdAt).toLocaleString()}
                </span>
                <Link
                  href={`/invoices/${it.invoiceId}`}
                  className="flex shrink-0 items-center gap-1 underline underline-offset-4 sm:gap-1 md:gap-1.5 lg:gap-1.5 xl:gap-2"
                >
                  Open invoice
                  <IconArrowRight />
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-4 md:p-6 lg:p-6 xl:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl sm:max-h-[88vh] sm:rounded-xl sm:p-5 md:max-h-[86vh] md:max-w-lg md:rounded-2xl md:p-6 lg:max-h-[85vh] lg:max-w-xl lg:rounded-2xl lg:p-6 xl:max-h-[85vh] xl:max-w-2xl xl:rounded-3xl xl:p-7">
        <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-3 lg:gap-4 xl:gap-4">
          <h2 className="text-lg font-semibold text-white sm:text-xl md:text-2xl lg:text-2xl xl:text-3xl">
            {item.type === "dispute" ? "Resolve dispute" : "Resolve already paid"}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white sm:h-8 sm:w-8 md:h-9 md:w-9 md:rounded-lg lg:h-9 lg:w-9 lg:rounded-lg xl:h-10 xl:w-10 xl:rounded-lg"
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>

        {mode === "menu" && (
          <div className="mt-3 space-y-2 sm:mt-3 sm:space-y-2 md:mt-4 md:space-y-2.5 lg:mt-4 lg:space-y-3 xl:mt-5 xl:space-y-3">
            <button onClick={() => setMode("accept")} className={MODAL_PRIMARY}>
              Accept
            </button>
            <button onClick={() => setMode("reject")} className={MODAL_SECONDARY}>
              Reject
            </button>
            {item.type === "dispute" && (
              <button onClick={() => setMode("edit")} className={MODAL_SECONDARY}>
                Edit invoice
              </button>
            )}
          </div>
        )}

        {mode === "accept" && item.type === "dispute" && (
          <div className="mt-3 space-y-3 sm:mt-3 sm:space-y-3 md:mt-4 md:space-y-3.5 lg:mt-4 lg:space-y-4 xl:mt-5 xl:space-y-4">
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
              className={MODAL_PRIMARY}
            >
              Confirm accept
            </button>
          </div>
        )}

        {mode === "accept" && item.type === "already_paid" && (
          <div className="mt-3 space-y-3 sm:mt-3 sm:space-y-3 md:mt-4 md:space-y-3.5 lg:mt-4 lg:space-y-4 xl:mt-5 xl:space-y-4">
            <p className="text-xs italic text-white sm:text-xs md:text-sm lg:text-sm xl:text-base">
              This marks the invoice as fully paid. Reference:{" "}
              {item.reference ?? "none"}
            </p>
            <button
              onClick={() => onAction(item.id, "accept", {})}
              className={MODAL_PRIMARY}
            >
              Mark invoice paid
            </button>
          </div>
        )}

        {mode === "reject" && (
          <div className="mt-3 space-y-3 sm:mt-3 sm:space-y-3 md:mt-4 md:space-y-3.5 lg:mt-4 lg:space-y-4 xl:mt-5 xl:space-y-4">
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
              className={MODAL_DANGER}
            >
              Send rejection
            </button>
          </div>
        )}

        {mode === "edit" && (
          <div className="mt-3 space-y-3 sm:mt-3 sm:space-y-3 md:mt-4 md:space-y-3.5 lg:mt-4 lg:space-y-4 xl:mt-5 xl:space-y-4">
            <p className="text-[10px] italic text-white sm:text-[11px] md:text-xs lg:text-xs xl:text-sm">
              Paste the invoice item UUID (find it via the invoice detail page).
              A CORRECTION event will be appended with before/after values.
            </p>
            <label className={labelStyle}>
              Item ID
              <input
                type="text"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className={`${fieldSurface} font-mono`}
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
            <div className="grid grid-cols-2 gap-2 sm:gap-2 md:gap-3 lg:gap-3 xl:gap-4">
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
              className={MODAL_PRIMARY}
            >
              Apply correction
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { formatINR } from "@/lib/domain/money";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

const RECURRENCES = ["once", "monthly", "quarterly", "yearly"] as const;
type Recurrence = (typeof RECURRENCES)[number];

const fieldSurface =
  "w-full rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20";

type Expense = {
  id: string;
  label: string;
  category: string;
  amountPaise: number;
  recurrence: Recurrence;
  dayOfMonth: number | null;
  dueDate: string | null;
  paid: boolean;
};

function formatRecurrence(e: Expense): string {
  if (e.recurrence === "once") return "one-time";
  const cap = e.recurrence.charAt(0).toUpperCase() + e.recurrence.slice(1);
  return `${cap.toLowerCase()} · day ${e.dayOfMonth ?? "?"}`;
}

function DashedSeparator() {
  return (
    <svg
      width="100%"
      height="1"
      viewBox="0 0 100 1"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 0.25H100"
        strokeWidth="0.5"
        stroke="white"
        strokeOpacity="0.102"
      />
    </svg>
  );
}

export default function ExpensesSettingsPage() {
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/expenses");
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message ?? "Failed to load");
      setExpenses(j.data ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const list = expenses ?? [];
    if (filter === "unpaid") return list.filter((e) => !e.paid);
    if (filter === "paid") return list.filter((e) => e.paid);
    return list;
  }, [expenses, filter]);

  const totals = useMemo(() => {
    const list = expenses ?? [];
    const unpaid = list
      .filter((e) => !e.paid)
      .reduce((s, e) => s + e.amountPaise, 0);
    const monthly = list
      .filter((e) => e.recurrence === "monthly")
      .reduce((s, e) => s + e.amountPaise, 0);
    return { unpaid, monthly };
  }, [expenses]);

  async function togglePaid(e: Expense) {
    if (pending[e.id]) return;
    const next = !e.paid;

    setPending((p) => ({ ...p, [e.id]: true }));
    setExpenses((prev) =>
      prev ? prev.map((x) => (x.id === e.id ? { ...x, paid: next } : x)) : prev,
    );

    try {
      const res = await fetch(`/api/expenses/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Update failed");
      }
    } catch (err) {
      setExpenses((prev) =>
        prev
          ? prev.map((x) => (x.id === e.id ? { ...x, paid: !next } : x))
          : prev,
      );
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setPending((p) => {
        const { [e.id]: _, ...rest } = p;
        return rest;
      });
    }
  }

  async function doDelete(id: string) {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error?.message ?? "Delete failed");
      }
      setDeletingId(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-start justify-start pt-14">
      <div className="flex w-full items-center justify-end px-4">
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="border border-[#fff]/10 bg-[#171717]/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/5"
        >
          + New expense
        </button>
      </div>

      <div className="mt-4 flex w-full items-start justify-center">
        <div className="flex w-[90vw] flex-col items-center justify-center gap-4">
          {/* ── Summary ── */}
          <div className="flex w-full flex-row gap-4">
            <Card className="relative w-full !gap-0 !rounded-none !border-[#FFF]/10 !bg-transparent !py-3">
              <CardHeader className="!gap-4">
                <CardDescription className="font-heading text-lg !leading-tight !text-[#fff]">
                  unpaid
                </CardDescription>
                <CardDescription className="font-heading text-xl !leading-tight !text-[#fff] tabular-nums">
                  {formatINR(totals.unpaid)}
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="relative w-full !gap-0 !rounded-none !border-[#FFF]/10 !bg-transparent !py-3">
              <CardHeader className="!gap-4">
                <CardDescription className="font-heading text-lg !leading-tight !text-[#fff]">
                  monthly recurring
                </CardDescription>
                <CardDescription className="font-heading text-xl !leading-tight !text-[#fff] tabular-nums">
                  {formatINR(totals.monthly)}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* ── Filter — matches invoice tabs (white pill) ── */}
          <div className="flex w-full flex-row gap-2">
            {(["all", "unpaid", "paid"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-white text-[#111]"
                    : "bg-[#171717]/20 text-white border border-white/10 hover:bg-white/5"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {error && (
            <div className="w-full border border-[#B42318]/60 bg-[#B42318]/5 px-3 py-2 text-xs text-white">
              {error}
            </div>
          )}

          {/* ── Expenses list ── */}
          <Card className="relative w-full !gap-0 !rounded-none !border-[#FFF]/10 !bg-transparent !py-3">
            <CardHeader className="!gap-4">
              <CardDescription className="flex flex-col items-center justify-center gap-4 !leading-tight !text-[#fff]">
                {expenses === null ? (
                  <p className="text-sm italic whitespace-nowrap">Loading…</p>
                ) : filtered.length === 0 ? (
                  <p className="text-sm italic whitespace-nowrap">
                    no expenses set
                  </p>
                ) : (
                  <div className="flex w-full flex-col">
                    {filtered.map((e, idx) => (
                      <Fragment key={e.id}>
                        <div className="flex w-full flex-row items-start justify-between gap-3 py-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <h3
                                className={`text-base ${
                                  e.paid
                                    ? "text-white/60 line-through"
                                    : "text-white"
                                }`}
                              >
                                {e.label}
                              </h3>
                              {!e.paid && (
                                <span
                                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4ADE80]"
                                  aria-hidden="true"
                                />
                              )}
                            </div>
                            <p className="text-sm italic">
                              {e.category} · {formatRecurrence(e)}
                              {e.dueDate && ` · due ${e.dueDate}`}
                            </p>

                            {deletingId === e.id && (
                              <div className="mt-2 border border-[#B42318]/60 bg-[#B42318]/10 p-2">
                                <p className="text-xs text-white">
                                  Delete{" "}
                                  <span className="font-semibold">
                                    {e.label}
                                  </span>
                                  ?
                                </p>
                                <div className="mt-2 flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="flex-1 border border-white/10 text-white hover:bg-white/5"
                                    onClick={() => setDeletingId(null)}
                                  >
                                    Keep
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-[#B42318] text-white hover:bg-[#B42318]/90"
                                    onClick={() => doDelete(e.id)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="whitespace-nowrap text-base tabular-nums text-white font-heading">
                              {formatINR(e.amountPaise)}
                            </span>

                            {deletingId !== e.id && (
                              <div className="flex flex-row items-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className={`h-7 w-7 disabled:opacity-50 ${
                                    e.paid
                                      ? "text-white/50 hover:bg-white/5"
                                      : "text-[#4ADE80] hover:bg-[#4ADE80]/10"
                                  }`}
                                  onClick={() => togglePaid(e)}
                                  disabled={pending[e.id]}
                                  aria-label={
                                    e.paid ? "Mark unpaid" : "Mark paid"
                                  }
                                >
                                  {pending[e.id] ? "…" : e.paid ? "↺" : "✓"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-white/70 hover:bg-white/5"
                                  onClick={() => setEditing(e)}
                                  aria-label={`Edit ${e.label}`}
                                >
                                  ✎
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-[#FF9B8F] hover:bg-[#B42318]/20"
                                  onClick={() => setDeletingId(e.id)}
                                  aria-label={`Delete ${e.label}`}
                                >
                                  ✕
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {idx < filtered.length - 1 && <DashedSeparator />}
                      </Fragment>
                    ))}
                  </div>
                )}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>

      {editing && (
        <ExpenseForm
          expense={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
    </main>
  );
}

function ExpenseForm({
  expense,
  onClose,
  onSaved,
}: {
  expense: Expense | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = expense !== null;
  const [label, setLabel] = useState(expense?.label ?? "");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [amountRupees, setAmountRupees] = useState(
    expense ? (expense.amountPaise / 100).toFixed(2) : "",
  );
  const [recurrence, setRecurrence] = useState<Recurrence>(
    expense?.recurrence ?? "once",
  );
  const [dayOfMonth, setDayOfMonth] = useState(
    expense?.dayOfMonth ? String(expense.dayOfMonth) : "1",
  );
  const [dueDate, setDueDate] = useState(expense?.dueDate ?? "");
  const [paid, setPaid] = useState(expense?.paid ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!label.trim()) {
      setError("Label is required.");
      return;
    }
    if (!category.trim()) {
      setError("Category is required.");
      return;
    }

    const rawAmount = amountRupees.trim();
    if (!/^\d+(\.\d{1,2})?$/.test(rawAmount)) {
      setError("Amount must be a number (up to 2 decimals).");
      return;
    }
    const amountPaise = Math.round(parseFloat(rawAmount) * 100);
    if (amountPaise <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }

    let dom: number | null = null;
    if (recurrence !== "once") {
      const n = Number(dayOfMonth);
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        setError("Day of month must be between 1 and 31.");
        return;
      }
      dom = n;
    }

    let due: string | null = null;
    const rawDue = dueDate.trim();
    if (rawDue) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDue)) {
        setError("Due date must be YYYY-MM-DD.");
        return;
      }
      due = rawDue;
    }

    setSaving(true);
    setError(null);
    try {
      const body = {
        label: label.trim(),
        category: category.trim(),
        amountPaise,
        recurrence,
        dayOfMonth: dom,
        dueDate: due,
        paid,
      };
      const res = await fetch(
        isEdit ? `/api/expenses/${expense.id}` : "/api/expenses",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit expense" : "New expense"}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-[#192221] p-4 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? "Edit expense" : "New expense"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-white/60 hover:text-white disabled:opacity-50"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 space-y-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Label *</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Office rent"
              className={fieldSurface}
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Category *</span>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="rent"
              className={fieldSurface}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Amount (₹) *</span>
            <input
              type="text"
              inputMode="decimal"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              placeholder="5000.00"
              className={`${fieldSurface} tabular-nums`}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Recurrence</span>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence)}
              className={`${fieldSurface} [&>option]:bg-[#192221] [&>option]:text-white`}
            >
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          {recurrence !== "once" && (
            <label className="flex flex-col gap-1">
              <span className="text-xs italic text-white">Day of month</span>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(e.target.value)}
                className={`${fieldSurface} tabular-nums`}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs italic text-white">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={`${fieldSurface} tabular-nums`}
            />
          </label>

          <label className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              checked={paid}
              onChange={(e) => setPaid(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-[#171717]/20 accent-[#0F5C4E]"
            />
            <span className="text-xs italic text-white">Paid</span>
          </label>

          {error && <p className="text-xs text-[#FF9B8F]">{error}</p>}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg border border-white/10 bg-[#171717]/20 px-3 py-2 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-lg bg-[#0F5C4E] px-3 py-2 text-xs font-medium text-white hover:bg-[#0F5C4E]/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : isEdit ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Checkbox } from "@/components/ui/checkbox"

import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group"
import {
    Field,
    FieldLabel,
} from "@/components/ui/field"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StuckBox } from "@/components/domain/stuck-box";
import { StepProgress } from "@/components/domain/step-progress";
import { AnimatedRangeCalendar } from "@/components/animated-range-calendar";
import { computeTotals } from "@/lib/domain/gst";
import { numberToWordsIndian } from "@/lib/domain/words";
import { addDays } from "@/lib/domain/dates";
import { formatINR, formatINRDelta } from "@/lib/domain/money";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import Link from "next/link";

type Customer = {
    id: string;
    name: string;
    gstin: string | null;
    stateCode: string | null;
    city: string | null;
};

type Business = {
    id: string;
    name: string;
    gstin: string | null;
    stateCode: string;
    registrationType: string;
    everCrossedEinvoiceThreshold: boolean;
};

type ItemDraft = {
    id: string;
    description: string;
    hsnSac: string;
    qty: number;
    unit: string;
    ratePaise: number;
    discountType: "amount" | "pct";
    discountValue: number;
    gstRatePct: number;
};

const GST_RATES = [0, 5, 12, 18, 28];
const UNITS = ["pcs", "box", "kg", "m", "sqft", "roll", "set"];
const STEP_LABELS = ["Customer", "Items", "Dates", "Review", "Preview", "Save"];

// Only bg + border are overridden. Size / padding / radius / focus ring
// left at shadcn defaults.
const fieldSurface = "bg-[#171717]/20 border-white/10";

const unitItems = UNITS.map((u) => ({ label: u, value: u }));
const gstItems = GST_RATES.map((r) => ({ label: `${r}%`, value: String(r) }));
const discountTypeItems = [
    { label: "₹", value: "amount" },
    { label: "%", value: "pct" },
];

function newItem(): ItemDraft {
    return {
        id: crypto.randomUUID(),
        description: "",
        hsnSac: "",
        qty: 1,
        unit: "pcs",
        ratePaise: 0,
        discountType: "amount",
        discountValue: 0,
        gstRatePct: 18,
    };
}

function discountPaise(it: ItemDraft): number {
    if (it.discountType === "pct") {
        const gross = Math.round(it.qty * it.ratePaise);
        return Math.round((gross * it.discountValue) / 100);
    }
    return Math.round(it.discountValue * 100);
}

// ─── fuzzy search ────────────────────────────────────────────────────────────

type FuzzyResult = { score: number; indices: number[] };
type FieldMatch = FuzzyResult | null;

function fuzzyMatch(query: string, text: string): FuzzyResult | null {
    if (!query) return { score: 0, indices: [] };
    const q = query.toLowerCase();
    const t = text.toLowerCase();

    const indices: number[] = [];
    let ti = 0;
    for (let qi = 0; qi < q.length; qi++) {
        const idx = t.indexOf(q[qi], ti);
        if (idx === -1) return null;
        indices.push(idx);
        ti = idx + 1;
    }

    let score = 100;
    score -= indices[0] * 0.5;
    score -= (text.length - q.length) * 0.1;
    for (let i = 1; i < indices.length; i++) {
        const gap = indices[i] - indices[i - 1] - 1;
        score += gap === 0 ? 4 : -gap * 0.5;
    }
    return { score, indices };
}

type CustomerMatch = {
    matched: boolean;
    score: number;
    name: FieldMatch;
    gstin: FieldMatch;
    city: FieldMatch;
};

function matchCustomer(c: Customer, query: string): CustomerMatch {
    if (!query) {
        return { matched: true, score: 0, name: null, gstin: null, city: null };
    }
    const name = fuzzyMatch(query, c.name);
    const gstin = c.gstin ? fuzzyMatch(query, c.gstin) : null;
    const city = c.city ? fuzzyMatch(query, c.city) : null;

    const ranked = [name, gstin, city].filter((r): r is FuzzyResult => r !== null);
    if (ranked.length === 0) {
        return { matched: false, score: 0, name: null, gstin: null, city: null };
    }
    const score = Math.max(...ranked.map((r) => r.score));
    return { matched: true, score, name, gstin, city };
}

// ─── highlighting ────────────────────────────────────────────────────────────

function Highlight({
    text,
    indices,
}: {
    text: string;
    indices?: number[] | null;
}) {
    if (!indices || indices.length === 0) return <>{text}</>;
    const set = new Set(indices);

    const groups: { text: string; match: boolean }[] = [];
    for (let i = 0; i < text.length; i++) {
        const match = set.has(i);
        const last = groups[groups.length - 1];
        if (last && last.match === match) {
            last.text += text[i];
        } else {
            groups.push({ text: text[i], match });
        }
    }

    return (
        <>
            {groups.map((g, i) =>
                g.match ? (
                    <mark
                        key={i}
                        className="bg-yellow-400/40 text-inherit rounded-sm px-[1px]"
                    >
                        {g.text}
                    </mark>
                ) : (
                    <span key={i}>{g.text}</span>
                ),
            )}
        </>
    );
}

// ─── wizard ──────────────────────────────────────────────────────────────────

export function Wizard({
    customers,
    business,
    today,
}: {
    customers: Customer[];
    business: Business;
    today: string;
}) {
    const router = useRouter();

    const [step, setStep] = useState(1);
    const [customerId, setCustomerId] = useState("");
    const [search, setSearch] = useState("");
    const [invoiceDate, setInvoiceDate] = useState(today);
    const [dueDate, setDueDate] = useState(addDays(today, 30));
    const [placeOfSupply, setPlaceOfSupply] = useState(business.stateCode);
    const [reverseCharge, setReverseCharge] = useState(false);
    const [items, setItems] = useState<ItemDraft[]>([newItem()]);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [rangeDraft, setRangeDraft] = useState<DateRange | undefined>(undefined);

    const customer = customers.find((c) => c.id === customerId);

    // Seed the picker's working range from the committed dates each time it opens.
    useEffect(() => {
        if (datePickerOpen) {
            setRangeDraft({
                from: invoiceDate ? parseISO(invoiceDate) : undefined,
                to: dueDate ? parseISO(dueDate) : undefined,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [datePickerOpen]);

    function handleRangeChange(range: DateRange | undefined) {
        setRangeDraft(range);
        if (!range) return;
        if (range.from && range.to) {
            const [from, to] =
                range.from.getTime() <= range.to.getTime()
                    ? [range.from, range.to]
                    : [range.to, range.from];
            setInvoiceDate(format(from, "yyyy-MM-dd"));
            setDueDate(format(to, "yyyy-MM-dd"));
        } else if (range.from) {
            setInvoiceDate(format(range.from, "yyyy-MM-dd"));
        }
    }

    const totals = useMemo(() => {
        if (!customer) return null;
        const complete = items.every(
            (it) =>
                it.qty > 0 &&
                it.ratePaise > 0 &&
                discountPaise(it) <= Math.round(it.qty * it.ratePaise),
        );
        if (!complete) return null;
        return computeTotals(
            items.map((it) => ({
                qty: it.qty,
                ratePaise: it.ratePaise,
                discountPaise: discountPaise(it),
                gstRatePct: it.gstRatePct,
            })),
            {
                stateCode: business.stateCode,
                registrationType: business.registrationType as
                    | "regular"
                    | "composition"
                    | "unregistered",
            },
            { stateCode: customer.stateCode ?? business.stateCode },
        );
    }, [items, customer, business]);

    function updateItem(id: string, patch: Partial<ItemDraft>) {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    }

    function removeItem(id: string) {
        setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev));
    }

    async function save(send: boolean) {
        if (!customer || !totals) return;
        setBusy(true);
        setError(null);
        try {
            const res = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId,
                    invoiceDate,
                    dueDate,
                    placeOfSupplyStateCode: placeOfSupply,
                    reverseCharge,
                    items: items.map((it) => ({
                        description: it.description,
                        hsnSac: it.hsnSac,
                        qty: it.qty,
                        unit: it.unit,
                        ratePaise: it.ratePaise,
                        discountPaise: discountPaise(it),
                        gstRatePct: it.gstRatePct,
                    })),
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message ?? "Save failed");
            }
            const json = await res.json();
            const newId = json.data.id;
            if (send) {
                await fetch(`/api/invoices/${newId}/send`, { method: "POST" });
            }
            router.push(`/invoices/${newId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
        } finally {
            setBusy(false);
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim();
        if (!q) {
            return customers.map((c) => ({ customer: c, match: matchCustomer(c, "") }));
        }
        return customers
            .map((c) => ({ customer: c, match: matchCustomer(c, q) }))
            .filter((r) => r.match.matched)
            .sort((a, b) => b.match.score - a.match.score);
    }, [customers, search]);

    // ─── per-step content ────────────────────────────────────────────────────

    function renderStepContent() {
        switch (step) {
            // ── Step 1: pick a customer ──────────────────────────────────────
            case 1:
                return (
                    <div className="flex flex-col gap-4">

                        <InputGroup className="bg-[#171717]/20! w-full py-6 border-white/10 w-full ">
                            <InputGroupAddon className="bg-[#171717]/20!">
                                <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        d="M9.89181 4.9459C9.89181 2.21947 7.67233 0 4.9459 0C2.21947 0 0 2.21947 0 4.9459C0 7.67233 2.21947 9.89181 4.9459 9.89181C6.08964 9.89181 7.13447 9.50232 7.97527 8.84699L11.1283 12L12 11.1283L8.84699 7.97527C9.5218 7.10941 9.88937 6.04366 9.89181 4.9459ZM1.23648 4.9459C1.23648 2.89954 2.89954 1.23648 4.9459 1.23648C6.99227 1.23648 8.65533 2.89954 8.65533 4.9459C8.65533 6.99227 6.99227 8.65533 4.9459 8.65533C2.89954 8.65533 1.23648 6.99227 1.23648 4.9459Z"
                                        fill="white"
                                        fillOpacity="0.2"
                                    />
                                </svg>
                            </InputGroupAddon>
                            <InputGroupInput
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="placeholder:text-[#737373] !ring-0 !outline-none"
                                placeholder="Search..."
                            />
                        </InputGroup>


                        {filtered.length === 0 ? (
                            <StuckBox message="No customers found." />
                        ) : (
                            <ul className="max-h-56 overflow-y-auto gap-4 flex flex-col">
                                {filtered.map(({ customer: c, match }) => (
                                    <li
                                        key={c.id}
                                        onClick={() => setCustomerId(c.id)}
                                        className={[
                                            "flex flex-row items-center justify-start gap-20 border-2 p-2 cursor-pointer transition-colors",
                                            c.id === customerId
                                                ? "border-white/40"
                                                : "border-white/10",
                                        ].join(" ")}
                                    >
                                        <Checkbox
                                            checked={c.id === customerId}
                                            onCheckedChange={() => setCustomerId(c.id)}
                                            className="bg-transparent border-white/20"
                                        />
                                        <div className="flex flex-col gap-2 ">
                                            <span className="font-medium text-lg">
                                                <Highlight
                                                    text={c.name}
                                                    indices={match.name?.indices}
                                                />
                                            </span>
                                            {(c.gstin || c.city) && (
                                                <span className="text-md italic">
                                                    {c.gstin && (
                                                        <Highlight
                                                            text={c.gstin}
                                                            indices={match.gstin?.indices}
                                                        />
                                                    )}
                                                    {c.gstin && c.city && " · "}
                                                    {c.city && (
                                                        <Highlight
                                                            text={c.city}
                                                            indices={match.city?.indices}
                                                        />
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                );

            // ── Step 2: line items ───────────────────────────────────────────
            case 2:
                return (
                    <div className="space-y-4">
                        {items.map((it, idx) => (
                            <div key={it.id} className="rounded-md border border-white/10 p-3 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-muted-foreground">
                                        Item {idx + 1}
                                    </span>
                                    {items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeItem(it.id)}
                                            className="text-muted-foreground hover:text-destructive transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>

                                <Field>
                                    <FieldLabel htmlFor={`desc-${it.id}`}>Description</FieldLabel>
                                    <Input
                                        id={`desc-${it.id}`}
                                        placeholder="Item description"
                                        value={it.description}
                                        onChange={(e) => updateItem(it.id, { description: e.target.value })}
                                        className={fieldSurface}
                                    />
                                </Field>

                                <div className="grid grid-cols-2 gap-2">
                                    <Field>
                                        <FieldLabel htmlFor={`hsn-${it.id}`}>HSN / SAC</FieldLabel>
                                        <Input
                                            id={`hsn-${it.id}`}
                                            placeholder="e.g. 8471"
                                            value={it.hsnSac}
                                            onChange={(e) => updateItem(it.id, { hsnSac: e.target.value })}
                                            className={fieldSurface}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor={`unit-${it.id}`}>Unit</FieldLabel>
                                        <Select
                                            items={unitItems}
                                            value={it.unit}
                                            onValueChange={(v) => updateItem(it.id, { unit: String(v) })}
                                        >
                                            <SelectTrigger id={`unit-${it.id}`} className={fieldSurface}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {unitItems.map((item) => (
                                                    <SelectItem key={item.value} value={item.value}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Field>
                                        <FieldLabel htmlFor={`qty-${it.id}`}>Qty</FieldLabel>
                                        <Input
                                            id={`qty-${it.id}`}
                                            type="number"
                                            placeholder="1"
                                            min={1}
                                            value={it.qty}
                                            onChange={(e) =>
                                                updateItem(it.id, { qty: Number(e.target.value) })
                                            }
                                            className={fieldSurface}
                                        />
                                    </Field>
                                    <Field>
                                        <FieldLabel htmlFor={`rate-${it.id}`}>Rate (₹)</FieldLabel>
                                        <Input
                                            id={`rate-${it.id}`}
                                            type="number"
                                            placeholder="0.00"
                                            min={0}
                                            value={it.ratePaise ? it.ratePaise / 100 : ""}
                                            onChange={(e) =>
                                                updateItem(it.id, {
                                                    ratePaise: Math.round(Number(e.target.value) * 100),
                                                })
                                            }
                                            className={fieldSurface}
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Field>
                                        <FieldLabel htmlFor={`gst-${it.id}`}>GST %</FieldLabel>
                                        <Select
                                            items={gstItems}
                                            value={String(it.gstRatePct)}
                                            onValueChange={(v) =>
                                                updateItem(it.id, { gstRatePct: Number(v) })
                                            }
                                        >
                                            <SelectTrigger id={`gst-${it.id}`} className={fieldSurface}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {gstItems.map((item) => (
                                                    <SelectItem key={item.value} value={item.value}>
                                                        {item.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>

                                    <Field>
                                        <FieldLabel htmlFor={`disc-${it.id}`}>Discount</FieldLabel>
                                        <div className="flex gap-1">
                                            <Select
                                                items={discountTypeItems}
                                                value={it.discountType}
                                                onValueChange={(v) =>
                                                    updateItem(it.id, {
                                                        discountType: String(v) as "amount" | "pct",
                                                    })
                                                }
                                            >
                                                <SelectTrigger className={fieldSurface}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {discountTypeItems.map((item) => (
                                                        <SelectItem key={item.value} value={item.value}>
                                                            {item.label}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <Input
                                                id={`disc-${it.id}`}
                                                type="number"
                                                placeholder="0"
                                                min={0}
                                                value={it.discountValue || ""}
                                                onChange={(e) =>
                                                    updateItem(it.id, { discountValue: Number(e.target.value) })
                                                }
                                                className={fieldSurface}
                                            />
                                        </div>
                                    </Field>
                                </div>
                            </div>
                        ))}

                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setItems((prev) => [...prev, newItem()])}
                        >
                            + Add Item
                        </Button>
                    </div>
                );

            // ── Step 3: dates & supply settings ─────────────────────────────
            case 3:
                return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <Field>
                                <FieldLabel>Invoice Date</FieldLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={`${fieldSurface} w-full justify-start text-left font-normal`}
                                    onClick={() => setDatePickerOpen(true)}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {invoiceDate ? (
                                        format(parseISO(invoiceDate), "MMM d, yyyy")
                                    ) : (
                                        <span className="text-muted-foreground">Pick date</span>
                                    )}
                                </Button>
                            </Field>

                            <Field>
                                <FieldLabel>Due Date</FieldLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className={`${fieldSurface} w-full justify-start text-left font-normal`}
                                    onClick={() => setDatePickerOpen(true)}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dueDate ? (
                                        format(parseISO(dueDate), "MMM d, yyyy")
                                    ) : (
                                        <span className="text-muted-foreground">Pick date</span>
                                    )}
                                </Button>
                            </Field>
                        </div>

                        <Field>
                            <FieldLabel htmlFor="pos">Place of Supply (state code)</FieldLabel>
                            <Input
                                id="pos"
                                value={placeOfSupply}
                                onChange={(e) => setPlaceOfSupply(e.target.value)}
                                className={fieldSurface}
                            />
                        </Field>

                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                id="reverseCharge"
                                checked={reverseCharge}
                                onChange={(e) => setReverseCharge(e.target.checked)}
                                className="h-4 w-4 accent-primary"
                            />
                            <span className="text-sm">Reverse Charge Applicable</span>
                        </label>

                        <Dialog open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                            <DialogContent className="w-auto max-w-fit bg-[#192221]!">
                                <DialogHeader className="">
                                    <DialogTitle className="font-sans">Select invoice &amp; due date</DialogTitle>
                                </DialogHeader>
                                <AnimatedRangeCalendar
                                    value={rangeDraft}
                                    onChange={handleRangeChange}
                                />
                                <DialogFooter>
                                    <Button onClick={() => setDatePickerOpen(false)}>Done</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                );

            // ── Step 4: review summary ───────────────────────────────────────
            case 4:
                return (
                    <div className="space-y-3 text-sm">
                        <div className="rounded-md border divide-y divide-border">
                            <Row label="Customer" value={customer?.name ?? "—"} bold />
                            <Row label="GSTIN" value={customer?.gstin ?? "—"} />
                            <Row label="Invoice Date" value={invoiceDate} />
                            <Row label="Due Date" value={dueDate} />
                            <Row label="Place of Supply" value={placeOfSupply} />
                            <Row label="Items" value={String(items.length)} />
                            {totals && (
                                <>
                                    <Row label="Subtotal" value={formatINR(totals.subtotalPaise)} />
                                    {totals.cgstPaise > 0 && (
                                        <Row label="CGST" value={formatINRDelta(totals.cgstPaise)} />
                                    )}
                                    {totals.sgstPaise > 0 && (
                                        <Row label="SGST" value={formatINRDelta(totals.sgstPaise)} />
                                    )}
                                    {totals.igstPaise > 0 && (
                                        <Row label="IGST" value={formatINRDelta(totals.igstPaise)} />
                                    )}
                                    <Row
                                        label="Grand Total"
                                        value={formatINR(totals.grandTotalPaise)}
                                        bold
                                    />
                                </>
                            )}
                        </div>

                        {totals && (
                            <p className="text-xs text-muted-foreground italic px-1">
                                {numberToWordsIndian(Math.round(totals.grandTotalPaise / 100))} Rupees only
                            </p>
                        )}

                        {!totals && (
                            <StuckBox message="Fill in all items with a valid qty, rate, and discount to see totals." />
                        )}
                    </div>
                );

            // ── Step 5: preview ──────────────────────────────────────────────
            case 5:
                return (
                    <div className="flex flex-col items-center justify-center py-10 gap-2 text-sm text-muted-foreground">
                        <p>Invoice preview will render here.</p>
                        <p className="text-xs">(Wire up a PDF renderer or iframe.)</p>
                    </div>
                );

            // ── Step 6: save ─────────────────────────────────────────────────
            case 6:
                return (
                    <div className="space-y-4">
                        {error && (
                            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <p className="text-sm text-muted-foreground">
                            Ready to save the invoice for{" "}
                            <span className="font-medium text-foreground">{customer?.name}</span>?
                        </p>

                        <div className="flex flex-col gap-2">
                            <Button
                                className="w-full"
                                disabled={busy || !totals}
                                onClick={() => save(false)}
                            >
                                {busy ? "Saving…" : "Save Invoice"}
                            </Button>
                            <Button
                                variant="outline"
                                className="w-full"
                                disabled={busy || !totals}
                                onClick={() => save(true)}
                            >
                                {busy ? "Saving…" : "Save & Send"}
                            </Button>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    }

    // ─── shell ───────────────────────────────────────────────────────────────

    return (
        <main className="pt-14">
            <Dialog open onOpenChange={(open) => { if (!open) setStep(1); }}>
                <DialogContent className="sm:max-w-sm bg-[#192221]!">
                    <DialogHeader className="flex flex-row items-center justify-between pr-0">
                        <DialogTitle>New Invoice</DialogTitle>
                        <DialogClose className="rounded-sm opacity-50 hover:opacity-100 transition-opacity">
                            <X className="h-4 w-4" />
                        </DialogClose>
                    </DialogHeader>

                    <StepProgress
                        labels={STEP_LABELS}
                        current={step}
                        className="py-4"
                    />

                    <div className="overflow-y-auto max-h-[60vh] px-0.5">
                        {renderStepContent()}
                    </div>

                    <DialogFooter className="!bg-[transparent] !border-0">
                        {step === 6 ? (
                            <Button
                                variant="outline"
                                render={<Link href="/invoices">Back to invoices</Link>}
                            />
                        ) : (
                            <>
                                {step > 1 && (
                                    <Button
                                        variant="outline"
                                        onClick={() => setStep((s) => Math.max(s - 1, 1))}
                                    >
                                        Back
                                    </Button>
                                )}
                                <Button onClick={() => setStep((s) => Math.min(s + 1, 6))}>
                                    Next
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}

// ─── tiny helper ─────────────────────────────────────────────────────────────

function Row({
    label,
    value,
    bold,
}: {
    label: string;
    value: string;
    bold?: boolean;
}) {
    return (
        <div className="flex items-center justify-between px-3 py-2">
            <span className="text-muted-foreground">{label}</span>
            <span className={bold ? "font-semibold" : ""}>{value}</span>
        </div>
    );
}

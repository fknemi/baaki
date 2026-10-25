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
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, CheckCircle2, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StuckBox } from "@/components/domain/stuck-box";
import { StepProgress } from "@/components/domain/step-progress";
import { AnimatedRangeCalendar } from "@/components/animated-range-calendar";
import { computeTotals } from "@/lib/domain/gst";
import type { GstTotals } from "@/lib/domain/gst";
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
    address?: {
        line1?: string | null;
        city?: string | null;
        state?: string | null;
        pincode?: string | null;
    } | null;
    upiId?: string | null;
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
    const [busyAction, setBusyAction] = useState<"draft" | "send" | null>(null);
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [rangeDraft, setRangeDraft] = useState<DateRange | undefined>(undefined);

    // Step-6 completion state
    const [sentInfo, setSentInfo] = useState<{
        number: string;
        id: string;
        payLink: string;
    } | null>(null);
    const [copied, setCopied] = useState(false);
    const [previewNumber, setPreviewNumber] = useState<string | null>(null);
    const [previewFetched, setPreviewFetched] = useState(false);

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

    // Best-effort preview of the next invoice number. If the endpoint
    // doesn't exist we silently fall back to "Draft" in the UI.
    useEffect(() => {
        if (step === 6 && !sentInfo && !previewFetched) {
            setPreviewFetched(true);
            fetch("/api/invoices/next-number")
                .then((r) => (r.ok ? r.json() : null))
                .then((j) => setPreviewNumber(j?.data?.number ?? null))
                .catch(() => setPreviewNumber(null));
        }
    }, [step, sentInfo, previewFetched]);

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

    const totals = useMemo<GstTotals | null>(() => {
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

    function buildPayload() {
        return {
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
        };
    }

    async function saveAsDraft() {
        if (!customer || !totals) return;
        setBusyAction("draft");
        setError(null);
        try {
            const res = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload()),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message ?? "Save failed");
            }
            router.push("/invoices");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Save failed");
            setBusyAction(null);
        }
    }

    async function sendInvoice() {
        if (!customer || !totals) return;
        setBusyAction("send");
        setError(null);
        try {
            const res = await fetch("/api/invoices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload()),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error?.message ?? "Save failed");
            }
            const json = await res.json();
            const newId: string = json.data.id;

            const sendRes = await fetch(`/api/invoices/${newId}/send`, {
                method: "POST",
            });
            if (!sendRes.ok) {
                const body = await sendRes.json().catch(() => ({}));
                throw new Error(body?.error?.message ?? "Send failed");
            }
            const sendJson = await sendRes.json().catch(() => ({}));
            const number: string =
                sendJson?.data?.number ?? json?.data?.number ?? "—";

            // Public share/pay link. Adjust the route if your app uses
            // /pay/[id], /i/[id], etc.
            const payLink = `${window.location.origin}/invoices/${newId}`;

            setSentInfo({ number, id: newId, payLink });
            setBusyAction(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Send failed");
            setBusyAction(null);
        }
    }

    async function copyPayLink() {
        if (!sentInfo) return;
        try {
            await navigator.clipboard.writeText(sentInfo.payLink);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API may fail on insecure origins; fail silently.
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
                            <DialogContent className="w-full bg-[#192221]!">
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
                    <div className="space-y-3 text-sm px-2">
                        {/* Bill to */}
                        <div className="rounded-md border border-white/10 p-3">
                            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                                Bill To
                            </div>
                            <div className="font-semibold">{customer?.name ?? "—"}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                {customer?.city && (
                                    <>
                                        {customer.city}
                                        <br />
                                    </>
                                )}
                                {customer?.gstin && (
                                    <>
                                        GSTIN: {customer.gstin}
                                        <br />
                                    </>
                                )}
                                {customer?.stateCode && <>State code: {customer.stateCode}</>}
                            </div>
                        </div>

                        {/* Invoice meta */}
                        <div className="rounded-md border border-white/10 p-3 grid grid-cols-2 gap-y-2 gap-x-3 text-xs">
                            <div>
                                <div className="text-muted-foreground">Invoice Date</div>
                                <div className="font-medium tabular-nums">
                                    {invoiceDate
                                        ? format(parseISO(invoiceDate), "dd MMM yyyy")
                                        : "—"}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Due Date</div>
                                <div className="font-medium tabular-nums">
                                    {dueDate ? format(parseISO(dueDate), "dd MMM yyyy") : "—"}
                                </div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Place of Supply</div>
                                <div className="font-medium">{placeOfSupply || "—"}</div>
                            </div>
                            <div>
                                <div className="text-muted-foreground">Reverse Charge</div>
                                <div className="font-medium">{reverseCharge ? "Yes" : "No"}</div>
                            </div>
                        </div>

                        {/* Items */}
                        <div className="rounded-md border border-white/10 overflow-hidden">
                            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 border-b border-white/10">
                                Items ({items.length})
                            </div>
                            <table className="w-full text-xs">
                                <thead className="text-muted-foreground">
                                    <tr className="border-b border-white/10">
                                        <th className="text-left px-2 py-1.5 font-medium">Description</th>
                                        <th className="text-left px-2 py-1.5 font-medium">HSN</th>
                                        <th className="text-right px-2 py-1.5 font-medium">Qty</th>
                                        <th className="text-right px-2 py-1.5 font-medium">Rate</th>
                                        <th className="text-right px-2 py-1.5 font-medium">Taxable</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((it) => {
                                        const taxable =
                                            Math.round(it.qty * it.ratePaise) - discountPaise(it);
                                        return (
                                            <tr
                                                key={it.id}
                                                className="border-b border-white/5 last:border-0"
                                            >
                                                <td className="px-2 py-1.5 truncate max-w-[140px]">
                                                    {it.description || (
                                                        <span className="text-muted-foreground italic">
                                                            Untitled
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-1.5 text-muted-foreground">
                                                    {it.hsnSac || "—"}
                                                </td>
                                                <td className="px-2 py-1.5 text-right tabular-nums">
                                                    {it.qty} {it.unit}
                                                </td>
                                                <td className="px-2 py-1.5 text-right tabular-nums">
                                                    {formatINR(it.ratePaise)}
                                                </td>
                                                <td className="px-2 py-1.5 text-right tabular-nums">
                                                    {formatINR(taxable)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Totals */}
                        {totals ? (
                            <div className="rounded-md border border-white/10 p-3 text-xs">
                                <div className="flex justify-between py-0.5">
                                    <span className="text-muted-foreground">Taxable Value</span>
                                    <span className="tabular-nums">
                                        {formatINR(totals.taxablePaise)}
                                    </span>
                                </div>
                                {totals.hasTax && !totals.isInterState && (
                                    <>
                                        <div className="flex justify-between py-0.5">
                                            <span className="text-muted-foreground">CGST</span>
                                            <span className="tabular-nums">
                                                {formatINR(totals.cgstPaise)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between py-0.5">
                                            <span className="text-muted-foreground">SGST</span>
                                            <span className="tabular-nums">
                                                {formatINR(totals.sgstPaise)}
                                            </span>
                                        </div>
                                    </>
                                )}
                                {totals.hasTax && totals.isInterState && (
                                    <div className="flex justify-between py-0.5">
                                        <span className="text-muted-foreground">IGST</span>
                                        <span className="tabular-nums">
                                            {formatINR(totals.igstPaise)}
                                        </span>
                                    </div>
                                )}
                                {totals.roundOffPaise !== 0 && (
                                    <div className="flex justify-between py-0.5">
                                        <span className="text-muted-foreground">Round Off</span>
                                        <span className="tabular-nums">
                                            {formatINRDelta(totals.roundOffPaise)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between mt-1.5 pt-2 border-t border-white/10 font-semibold text-sm">
                                    <span>Total</span>
                                    <span className="tabular-nums">
                                        {formatINR(totals.totalPaise)}
                                    </span>
                                </div>
                                <div className="text-[11px] text-muted-foreground italic pt-2">
                                    {numberToWordsIndian(totals.totalPaise / 100)} Rupees only
                                </div>
                            </div>
                        ) : (
                            <StuckBox message="Fill in all items with a valid qty, rate, and discount to see totals." />
                        )}
                    </div>
                );

            // ── Step 5: preview ──────────────────────────────────────────────
            case 5:
                if (!customer || !totals) {
                    return (
                        <StuckBox message="Complete the customer and items to see the invoice preview." />
                    );
                }
                return (
                    <div className="space-y-3">
                        <p className="text-xs text-muted-foreground text-center">
                            Live preview — the final invoice number is assigned when you save.
                        </p>
                        <div
                            className="mx-auto overflow-auto rounded-lg border border-white/10"
                            style={{ maxHeight: "65vh", maxWidth: "100%", background: "#e5e7eb" }}
                        >
                            <div style={{ zoom: 0.65, padding: "4mm" }}>
                                <div style={{ background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }}>
                                    <InvoicePreview
                                        business={business}
                                        customer={customer}
                                        invoiceDate={invoiceDate}
                                        dueDate={dueDate}
                                        placeOfSupply={placeOfSupply}
                                        reverseCharge={reverseCharge}
                                        items={items}
                                        totals={totals}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            // ── Step 6: save / send ──────────────────────────────────────────
            case 6:
                // ── Success state ────────────────────────────────────────────
                if (sentInfo) {
                    return (
                        <div className="space-y-4 flex flex-col gap-4">
                            <div className="rounded-md p-4 bg-[#235C49]">
                                <div className="flex items-center gap-2 text-white-500 font-semibold">
                                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                                    <span>Invoice sent successfully</span>
                                </div>
                                <div className="text-sm text-white mt-1 ml-7">
                                    {sentInfo.number} · {customer?.name}
                                </div>

                                <button
                                    type="button"
                                    onClick={copyPayLink}
                                    className="mt-4 w-full gap-2 rounded-md flex flex-row items-center justify-center bg-white  p-3 text-left transition-colors"
                                >
                                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.18305 10.1842C1.44966 10.1842 0.849609 9.58413 0.849609 8.85074V2.18354C0.849609 1.45015 1.44966 0.850098 2.18305 0.850098H8.85025C9.58364 0.850098 10.1837 1.45015 10.1837 2.18354M6.18337 4.85042H12.8506C13.587 4.85042 14.184 5.44742 14.184 6.18386V12.8511C14.184 13.5875 13.587 14.1845 12.8506 14.1845H6.18337C5.44693 14.1845 4.84993 13.5875 4.84993 12.8511V6.18386C4.84993 5.44742 5.44693 4.85042 6.18337 4.85042Z" strokeWidth="1.7" strokeLinecap="round" stroke="#235C49" />
                                    </svg>

                                    <div className="text-xs text-[#235C49]">
                                        {copied ? "Copied to clipboard!" : "Copy pay link"}
                                    </div>


                                </button>
                            </div>

                            <Link
                                href="/invoices"
                                className="flex font-medium items-center justify-center rounded-md border border-white/10  text-lg text-white bg-[#144733]  py-2 px-2"
                            >
                                Back To Invoices
                            </Link>
                        </div>
                    );
                }

                // ── Preview / confirm state ──────────────────────────────────
                return (
                    <div className="space-y-4">
                        {error && (
                            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <div>
                            <div className="text-base font-semibold">Invoice Created</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Your Tax Invoice is ready for{" "}
                                <span className="text-foreground font-medium">
                                    {customer?.name ?? "—"}
                                </span>
                                .
                            </div>
                        </div>

                        <div className="rounded-md border border-white/10 p-4">
                            <div className="text-center">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                    {previewNumber ?? "Draft"}
                                </div>
                                <div className="font-semibold mt-1">
                                    {customer?.name ?? "—"}
                                </div>
                                {(customer?.stateCode || customer?.gstin) && (
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                        ({customer.gstin ?? customer.stateCode ?? customer.city})
                                    </div>
                                )}
                                <div className="text-2xl font-semibold tabular-nums mt-3">
                                    {totals ? formatINR(totals.totalPaise) : "—"}
                                </div>
                                <div className="border-t border-white/10 mt-3 pt-3 text-xs space-y-1.5 text-left">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            Invoice date
                                        </span>
                                        <span className="tabular-nums">
                                            {invoiceDate
                                                ? format(parseISO(invoiceDate), "dd MMM yyyy")
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Due date</span>
                                        <span className="tabular-nums">
                                            {dueDate
                                                ? format(parseISO(dueDate), "dd MMM yyyy")
                                                : "—"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-white">
                            <span>Invoice

                                {busyAction === "send" ? " sent " : " created "}

                                · actions complete</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                disabled={busyAction !== null || !totals}
                                onClick={saveAsDraft}
                                className="bg-[transparent]! text-white rounded-sm"
                            >
                                {busyAction === "draft" ? "Saving…" : "Save as Draft"}
                            </Button>
                            <Button
                                disabled={busyAction !== null || !totals}
                                onClick={sendInvoice}
                                className="bg-[#144733]/63! text-white rounded-sm"

                            >
                                {busyAction === "send" ? "Sending…" : "Send Invoice"}
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
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) {
                        if (sentInfo) {
                            router.push("/invoices");
                        } else {
                            setStep(1);
                        }
                    }
                }}
            >
                <DialogContent
                    className={`bg-[#192221]! ${step === 5 ? "sm:max-w-2xl" : "sm:max-w-sm"}`}
                >
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
                        {step !== 6 && (
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

// ─── live A4 invoice preview ─────────────────────────────────────────────────

function InvoicePreview({
    business,
    customer,
    invoiceDate,
    dueDate,
    placeOfSupply,
    reverseCharge,
    items,
    totals,
}: {
    business: Business;
    customer: Customer;
    invoiceDate: string;
    dueDate: string;
    placeOfSupply: string;
    reverseCharge: boolean;
    items: ItemDraft[];
    totals: GstTotals;
}) {
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    const docTitle = totals.hasTax ? "TAX INVOICE" : "BILL OF SUPPLY";
    const upiUri =
        business.upiId && totals.totalPaise > 0
            ? `upi://pay?pa=${encodeURIComponent(business.upiId)}&pn=${encodeURIComponent(
                business.name,
            )}&am=${(totals.totalPaise / 100).toFixed(2)}&cu=INR&tn=${encodeURIComponent(
                "DRAFT",
            )}`
            : null;

    useEffect(() => {
        if (!upiUri) {
            setQrDataUrl(null);
            return;
        }
        let cancelled = false;
        import("qrcode").then((QRCode) =>
            QRCode.toDataURL(upiUri, { errorCorrectionLevel: "M", margin: 1, width: 140 })
                .then((url) => {
                    if (!cancelled) setQrDataUrl(url);
                })
                .catch(() => {
                    if (!cancelled) setQrDataUrl(null);
                }),
        );
        return () => {
            cancelled = true;
        };
    }, [upiUri]);

    const cell: CSSProperties = { padding: "4px 6px", fontSize: "10pt" };
    const cellNum: CSSProperties = {
        ...cell,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
    };
    const head: CSSProperties = {
        ...cell,
        borderBottom: "1px solid #1A1D23",
        textAlign: "left",
    };
    const headNum: CSSProperties = { ...head, textAlign: "right" };
    const hr: CSSProperties = {
        margin: "12px 0",
        border: 0,
        borderBottom: "1px solid #E4E7EC",
    };

    return (
        <div
            className="invoice-preview"
            style={{
                fontFamily: "system-ui, sans-serif",
                fontSize: "11pt",
                color: "#1A1D23",
                background: "white",
                padding: "16mm",
                width: "210mm",
                minHeight: "297mm",
                boxSizing: "border-box",
            }}
        >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                    <div style={{ fontSize: "18pt", fontWeight: 600 }}>{business.name}</div>
                    {business.address && (
                        <div style={{ fontSize: "9pt", color: "#5A6170" }}>
                            {business.address.line1}
                            {business.address.line1 && ", "}
                            {business.address.city} {business.address.state}{" "}
                            {business.address.pincode}
                        </div>
                    )}
                    {business.gstin && (
                        <div style={{ fontSize: "9pt" }}>GSTIN: {business.gstin}</div>
                    )}
                </div>
                <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "14pt", fontWeight: 600 }}>{docTitle}</div>
                    <div
                        style={{
                            fontSize: "10pt",
                            fontFamily: "monospace",
                            color: "#8A8F99",
                        }}
                    >
                        DRAFT
                    </div>
                    <div style={{ fontSize: "9pt" }}>
                        Date: {invoiceDate ? format(parseISO(invoiceDate), "dd MMM yyyy") : "—"}
                    </div>
                    <div style={{ fontSize: "9pt" }}>
                        Due: {dueDate ? format(parseISO(dueDate), "dd MMM yyyy") : "—"}
                    </div>
                </div>
            </div>

            <hr style={hr} />

            {/* Bill to + supply info */}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                    <div style={{ fontSize: "9pt", color: "#5A6170" }}>BILL TO</div>
                    <div style={{ fontWeight: 600 }}>{customer.name}</div>
                    {customer.city && (
                        <div style={{ fontSize: "9pt" }}>{customer.city}</div>
                    )}
                    {customer.gstin && (
                        <div style={{ fontSize: "9pt" }}>GSTIN: {customer.gstin}</div>
                    )}
                </div>
                <div style={{ textAlign: "right", fontSize: "9pt" }}>
                    <div>
                        <strong>Place of supply:</strong> {placeOfSupply}
                    </div>
                    <div>
                        <strong>Reverse charge:</strong> {reverseCharge ? "Yes" : "No"}
                    </div>
                </div>
            </div>

            {/* Items table */}
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: 16,
                }}
            >
                <thead>
                    <tr>
                        <th style={head}>Description</th>
                        <th style={head}>HSN</th>
                        <th style={headNum}>Qty</th>
                        <th style={headNum}>Rate</th>
                        <th style={headNum}>Taxable</th>
                        {totals.hasTax && !totals.isInterState && (
                            <>
                                <th style={headNum}>CGST</th>
                                <th style={headNum}>SGST</th>
                            </>
                        )}
                        {totals.hasTax && totals.isInterState && (
                            <th style={headNum}>IGST</th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {items.map((it) => {
                        const taxable =
                            Math.round(it.qty * it.ratePaise) - discountPaise(it);
                        const half = taxable * (it.gstRatePct / 200);
                        return (
                            <tr key={it.id} style={{ borderBottom: "1px solid #E4E7EC" }}>
                                <td style={cell}>{it.description || "—"}</td>
                                <td style={cell}>{it.hsnSac || "—"}</td>
                                <td style={cellNum}>
                                    {it.qty} {it.unit}
                                </td>
                                <td style={cellNum}>{formatINR(it.ratePaise)}</td>
                                <td style={cellNum}>{formatINR(taxable)}</td>
                                {totals.hasTax && !totals.isInterState && (
                                    <>
                                        <td style={cellNum}>{formatINR(Math.round(half))}</td>
                                        <td style={cellNum}>{formatINR(Math.round(half))}</td>
                                    </>
                                )}
                                {totals.hasTax && totals.isInterState && (
                                    <td style={cellNum}>
                                        {formatINR(
                                            Math.round(taxable * (it.gstRatePct / 100)),
                                        )}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <table style={{ width: "50%", borderCollapse: "collapse" }}>
                    <tbody>
                        <tr>
                            <td style={cell}>Taxable</td>
                            <td style={cellNum}>{formatINR(totals.taxablePaise)}</td>
                        </tr>
                        {totals.hasTax && !totals.isInterState && (
                            <>
                                <tr>
                                    <td style={cell}>CGST</td>
                                    <td style={cellNum}>{formatINR(totals.cgstPaise)}</td>
                                </tr>
                                <tr>
                                    <td style={cell}>SGST</td>
                                    <td style={cellNum}>{formatINR(totals.sgstPaise)}</td>
                                </tr>
                            </>
                        )}
                        {totals.hasTax && totals.isInterState && (
                            <tr>
                                <td style={cell}>IGST</td>
                                <td style={cellNum}>{formatINR(totals.igstPaise)}</td>
                            </tr>
                        )}
                        <tr>
                            <td style={cell}>Round off</td>
                            <td style={cellNum}>
                                {formatINRDelta(totals.roundOffPaise)}
                            </td>
                        </tr>
                        <tr style={{ borderTop: "1px solid #1A1D23", fontWeight: 600 }}>
                            <td style={cell}>Total</td>
                            <td style={cellNum}>{formatINR(totals.totalPaise)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p style={{ marginTop: 8, fontSize: "9pt", fontStyle: "italic" }}>
                Amount in words: {numberToWordsIndian(totals.totalPaise / 100)} Rupees only
            </p>

            <hr style={hr} />

            {/* UPI / signature */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "9pt",
                }}
            >
                <div>
                    {qrDataUrl && (
                        <>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                Pay by UPI
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={qrDataUrl}
                                    alt="UPI QR"
                                    style={{ width: 140, height: 140, display: "block" }}
                                />
                                <div
                                    style={{
                                        fontFamily: "monospace",
                                        fontSize: "8pt",
                                        wordBreak: "break-all",
                                        maxWidth: 200,
                                    }}
                                >
                                    {business.upiId}
                                    <br />
                                    DRAFT
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <div style={{ textAlign: "right" }}>
                    <div
                        style={{
                            marginTop: 32,
                            borderTop: "1px solid #1A1D23",
                            paddingTop: 4,
                        }}
                    >
                        For {business.name}
                    </div>
                </div>
            </div>

            <hr style={hr} />

            <p style={{ fontSize: "8pt", color: "#5A6170", textAlign: "center" }}>
                Preview — invoice not saved yet.
            </p>
        </div>
    );
}

import { createHash } from "node:crypto";

export type BankLine = {
    id: string;
    date: string;
    description: string;
    creditPaise: number;
    ref: string;
};

export type OpenInvoice = {
    id: string;
    number: string;
    customerName: string;
    outstandingPaise: number;
    taxablePaise: number;
    dueDate: string;
};

export type MatcherConfig = {
    tdsCandidateShortfallsPct: readonly number[];
};

export type ProposedMatch = {
    invoiceIds: string[];
    confidence: number;
    flags: string[];
    reason: string;
    split?: number[];
};

function sha256(s: string): string {
    return createHash("sha256").update(s).digest("hex");
}

function normalizeName(s: string): string {
    return s
        .toLowerCase()
        .replace(/\b(?:m\/s|pvt|ltd|llp|and)\b/g, "")
        .replace(/&/g, "")
        .replace(/[^a-z0-9]/g, "");
}
export function lineKey(line: BankLine): string {
    return sha256(`${line.date}|${line.creditPaise}|${line.ref}`);
}

export function proposeMatches(
    line: BankLine,
    invoices: OpenInvoice[],
    cfg: MatcherConfig,
    existingKeys: Set<string> = new Set(),
): ProposedMatch[] {
    if (existingKeys.has(lineKey(line))) {
        return [{
            invoiceIds: [],
            confidence: 0,
            flags: ["duplicate"],
            reason: "Duplicate of a previously recorded payment.",
        }];
    }

    const sorted = [...invoices].sort((a, b) => {
        if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        return a.id.localeCompare(b.id);
    });

    const normLine = normalizeName(line.description);
    const proposals: ProposedMatch[] = [];

    for (const inv of sorted) {
        const digits = inv.number.replace(/\D/g, "").slice(-4);
        const lineHasNumber =
            line.description.includes(inv.number) ||
            line.description.includes(inv.number.replace(/\//g, " ")) ||
            line.description.includes(digits);
        const normCust = normalizeName(inv.customerName);
        const lineHasCustomer = normLine.includes(normCust);

        if (!lineHasNumber && !lineHasCustomer) continue;

        if (line.creditPaise === inv.outstandingPaise) {
            proposals.push({
                invoiceIds: [inv.id],
                confidence: 0.95,
                flags: [],
                reason: `Exact match: ₹${(line.creditPaise / 100).toFixed(2)} equals outstanding on ${inv.number}.`,
            });
            continue;
        }

        if (line.creditPaise < inv.outstandingPaise) {
            const shortfall = inv.outstandingPaise - line.creditPaise;
            let isTds = false;
            for (const pct of cfg.tdsCandidateShortfallsPct) {
                if (shortfall === Math.round(inv.taxablePaise * pct / 100)) {
                    isTds = true;
                    break;
                }
            }
            proposals.push({
                invoiceIds: [inv.id],
                confidence: isTds ? 0.80 : 0.75,
                flags: isTds ? ["part", "tdsShortfall"] : ["part"],
                reason: isTds
                    ? `Part payment: shortfall matches ${shortfall} paise, a TDS withholding on the taxable amount.`
                    : `Part payment: ₹${(line.creditPaise / 100).toFixed(2)} against ₹${(inv.outstandingPaise / 100).toFixed(2)}.`,
            });
            continue;
        }

        proposals.push({
            invoiceIds: [inv.id],
            confidence: 0.60,
            flags: ["overpayment"],
            reason: `Overpayment: line exceeds ${inv.number} outstanding by ₹${((line.creditPaise - inv.outstandingPaise) / 100).toFixed(2)}.`,
        });
    }

    if (proposals.length === 0) {
        for (let i = 0; i < sorted.length; i++) {
            for (let j = i + 1; j < sorted.length; j++) {
                const a = sorted[i]!;
                const b = sorted[j]!;

                // Multi-invoice splits only make sense for one customer's invoices.
                // Two unrelated transfers won't be combined in one bank credit.
                if (a.customerName !== b.customerName) continue;
                if (a.outstandingPaise + b.outstandingPaise === line.creditPaise) {
                    proposals.push({
                        invoiceIds: [a.id, b.id],
                        confidence: 0.85,
                        flags: ["multi"],
                        reason: `Covers 2 invoices: ${a.number} + ${b.number}.`,
                        split: [a.outstandingPaise, b.outstandingPaise],
                    });
                }
            }
        }
    }

    if (proposals.length === 0) {
        proposals.push({
            invoiceIds: [],
            confidence: 0,
            flags: ["unmatched"],
            reason: "No matching invoice found.",
        });
    }

    proposals.sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return a.invoiceIds.join(",").localeCompare(b.invoiceIds.join(","));
    });

    return proposals;
}

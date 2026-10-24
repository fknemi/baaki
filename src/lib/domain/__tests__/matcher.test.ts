import { describe, it, expect } from "vitest";
import { proposeMatches, lineKey } from "../matcher";
import type { BankLine, OpenInvoice, MatcherConfig } from "../matcher";

const cfg: MatcherConfig = { tdsCandidateShortfallsPct: [1, 2, 10] };
const invoices: OpenInvoice[] = [
    {
        id: "i1",
        number: "INV/26-27/0012",
        customerName: "Krishna Traders",
        outstandingPaise: 11_800_000,
        taxablePaise: 10_000_000,
        dueDate: "2026-11-01",
    },
    {
        id: "i2",
        number: "INV/26-27/0011",
        customerName: "Patel Brothers",
        outstandingPaise: 8_650_000,
        taxablePaise: 8_000_000,
        dueDate: "2026-10-25",
    },
    {
        id: "i3",
        number: "INV/26-27/0010",
        customerName: "Krishna Traders",
        outstandingPaise: 8_650_000,
        taxablePaise: 8_000_000,
        dueDate: "2026-10-28",
    },
];

describe("proposeMatches", () => {
    it("exact match → 0.95, no flags", () => {
        const line: BankLine = {
            id: "l1",
            date: "2026-11-05",
            description: "NEFT KRISHNA TRADERS INV/26-27/0012",
            creditPaise: 11_800_000,
            ref: "T1",
        };
        const [p] = proposeMatches(line, invoices, cfg);
        expect(p!.confidence).toBe(0.95);
        expect(p!.flags).toEqual([]);
        expect(p!.invoiceIds).toEqual(["i1"]);
    });

    it("part payment → part flag", () => {
        const line: BankLine = {
            id: "l2",
            date: "2026-11-05",
            description: "NEFT KRISHNA TRADERS",
            creditPaise: 5_000_000,
            ref: "T2",
        };
        const [p] = proposeMatches(line, invoices, cfg);
        expect(p!.flags).toContain("part");
    });

    it("exact 2% TDS shortfall → tdsShortfall flag", () => {
        // taxable=10,000,000; 2% = 200,000; shortfall = 200,000 exactly
        const line: BankLine = {
            id: "l3",
            date: "2026-11-05",
            description: "NEFT KRISHNA TRADERS",
            creditPaise: 11_600_000,
            ref: "T3",
        };
        const [p] = proposeMatches(line, invoices, cfg);
        expect(p!.flags).toContain("tdsShortfall");
    });

    it("shortfall not exact → no tdsShortfall", () => {
        const line: BankLine = {
            id: "l4",
            date: "2026-11-05",
            description: "NEFT KRISHNA TRADERS",
            creditPaise: 11_500_000,
            ref: "T4",
        };
        const [p] = proposeMatches(line, invoices, cfg);
        expect(p!.flags).not.toContain("tdsShortfall");
        expect(p!.flags).toContain("part");
    });

    it("overpayment flag", () => {
        const line: BankLine = {
            id: "l5",
            date: "2026-11-05",
            description: "NEFT KRISHNA TRADERS",
            creditPaise: 12_000_000,
            ref: "T5",
        };
        const [p] = proposeMatches(line, invoices, cfg);
        expect(p!.flags).toContain("overpayment");
    });

    it("multi-invoice split sums exactly", () => {
        const line: BankLine = {
            id: "l6",
            date: "2026-11-05",
            description: "NEFT MULTI",
            creditPaise: 20_450_000,
            ref: "T6",
        };
        const [p] = proposeMatches(line, invoices, cfg);
        expect(p!.flags).toContain("multi");
        const splitSum = (p!.split ?? []).reduce((s, v) => s + v, 0);
        expect(splitSum).toBe(line.creditPaise);
    });

    it("multi-invoice split rejects cross-customer pairs", () => {
        // i1 (Krishna, 11,800,000) + i2 (Patel, 8,650,000) sum to 20,450,000,
        // the same credit as the multi test — but they belong to different
        // customers, so the matcher must not propose them as a pair.
        const crossOnly: OpenInvoice[] = [invoices[0]!, invoices[1]!];
        const line: BankLine = {
            id: "l6b",
            date: "2026-11-05",
            description: "NEFT MULTI",
            creditPaise: 20_450_000,
            ref: "T6b",
        };
        const [p] = proposeMatches(line, crossOnly, cfg);
        expect(p!.flags).toEqual(["unmatched"]);
    });
    it("unmatched when nothing fits", () => {
        const line: BankLine = {
            id: "l7",
            date: "2026-11-05",
            description: "RANDOM DEPOSIT",
            creditPaise: 999_000,
            ref: "T7",
        };
        const [p] = proposeMatches(line, invoices, cfg);
        expect(p!.flags).toContain("unmatched");
        expect(p!.confidence).toBe(0);
    });

    it("duplicate detection", () => {
        const line: BankLine = {
            id: "l8",
            date: "2026-11-05",
            description: "NEFT KRISHNA TRADERS",
            creditPaise: 5_000_000,
            ref: "T8",
        };
        const [first] = proposeMatches(line, invoices, cfg);
        expect(first!.flags).not.toContain("duplicate");

        // Add its key to existing set, re-propose
        const keys = new Set([lineKey(line)]);
        const [second] = proposeMatches(line, invoices, cfg, keys);
        expect(second!.flags).toContain("duplicate");
    });

    it("deterministic across shuffled input", () => {
        const line: BankLine = {
            id: "l9",
            date: "2026-11-05",
            description: "NEFT KRISHNA TRADERS",
            creditPaise: 5_000_000,
            ref: "T9",
        };
        const baseline = proposeMatches(line, invoices, cfg);
        for (let i = 0; i < 20; i++) {
            const shuffled = [...invoices].sort(() => Math.random() - 0.5);
            const result = proposeMatches(line, shuffled, cfg);
            expect(result.map((p) => p.invoiceIds.join(","))).toEqual(
                baseline.map((p) => p.invoiceIds.join(",")),
            );
            expect(result.map((p) => p.confidence)).toEqual(
                baseline.map((p) => p.confidence),
            );
        }
    });
});

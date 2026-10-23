import { describe, it, expect } from "vitest";
import { nextInvoiceNumber } from "../numbering";

describe("nextInvoiceNumber", () => {
    it("starts at 0001 for fresh FY", () => {
        const r = nextInvoiceNumber("26-27", {});
        expect(r.number).toBe("INV/26-27/0001");
        expect(r.sequence).toBe(1);
    });

    it("increments from existing sequence", () => {
        const r = nextInvoiceNumber("26-27", { "26-27": 12 });
        expect(r.number).toBe("INV/26-27/0013");
        expect(r.sequence).toBe(13);
    });

    it("isolates FY sequences", () => {
        const r = nextInvoiceNumber("27-28", { "26-27": 12 });
        expect(r.number).toBe("INV/27-28/0001");
    });

    it("number is ≤ 16 chars", () => {
        const r = nextInvoiceNumber("26-27", { "26-27": 9998 });
        expect(r.number.length).toBeLessThanOrEqual(16);
    });

    it("throws at sequence overflow", () => {
        expect(() => nextInvoiceNumber("26-27", { "26-27": 9999 })).toThrow(
            /BAK-INV-001/,
        );
    });
    it("throws when number exceeds 16 chars", () => {
        expect(() => nextInvoiceNumber("2026-2027", {})).toThrow(/BAK-INV-001/);
    });
});

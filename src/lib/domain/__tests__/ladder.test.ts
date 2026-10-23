import { describe, it, expect } from "vitest";
import { deriveStage } from "../ladder";

const base = {
    dueDate: "2026-11-01",
    paid: false,
    disputed: false,
    resolved: false,
    promiseToPayDate: null,
    sentStageKeys: [] as string[],
};

describe("deriveStage — spec §12.3 vectors", () => {
    it("Oct 29 (day -3) → headsUp", () => {
        expect(deriveStage({ ...base, today: "2026-10-29" })?.key).toBe("headsUp");
    });

    it("Oct 30 (day -2) → headsUp", () => {
        expect(deriveStage({ ...base, today: "2026-10-30" })?.key).toBe("headsUp");
    });

    it("Nov 1 (day 0) → dueDate", () => {
        expect(deriveStage({ ...base, today: "2026-11-01" })?.key).toBe("dueDate");
    });

    it("Nov 8 (day 7) → firm", () => {
        expect(deriveStage({ ...base, today: "2026-11-08" })?.key).toBe("firm");
    });

    it("Nov 16 (day 15) → finalCall", () => {
        expect(deriveStage({ ...base, today: "2026-11-16" })?.key).toBe("finalCall");
    });

    it("Dec 1 (day 30) → demandLetter", () => {
        expect(deriveStage({ ...base, today: "2026-12-01" })?.key).toBe("demandLetter");
    });

    it("Dec 16 (day 45) → nextSteps", () => {
        expect(deriveStage({ ...base, today: "2026-12-16" })?.key).toBe("nextSteps");
    });

    it("too early (day -4) → null", () => {
        expect(deriveStage({ ...base, today: "2026-10-28" })).toBeNull();
    });

    it("paid → null at any day", () => {
        expect(deriveStage({ ...base, today: "2026-12-01", paid: true })).toBeNull();
    });

    it("disputed unresolved → null at every day", () => {
        for (const d of ["2026-10-29", "2026-11-01", "2026-11-08", "2026-11-16", "2026-12-01", "2026-12-16"]) {
            expect(deriveStage({ ...base, today: d, disputed: true, resolved: false })).toBeNull();
        }
    });

    it("disputed resolved → stage resumes", () => {
        expect(deriveStage({ ...base, today: "2026-11-08", disputed: true, resolved: true })?.key).toBe("firm");
    });

    it("promise 2026-12-10, today 2026-12-05 → null", () => {
        expect(deriveStage({ ...base, today: "2026-12-05", promiseToPayDate: "2026-12-10" })).toBeNull();
    });

    it("promise passed → reappears", () => {
        // Promise was 2026-12-10, today 2026-12-11 (day 40 after due)
        // Most recent applicable stage: day 30 = demandLetter
        expect(
            deriveStage({ ...base, today: "2026-12-11", promiseToPayDate: "2026-12-10" })?.key,
        ).toBe("demandLetter");
    });
    it("stage already sent is skipped", () => {
        const r = deriveStage({ ...base, today: "2026-11-08", sentStageKeys: ["headsUp", "dueDate"] });
        expect(r?.key).toBe("firm");
    });

    it("all stages up to today sent → null", () => {
        const r = deriveStage({ ...base, today: "2026-11-08", sentStageKeys: ["headsUp", "dueDate", "firm"] });
        expect(r).toBeNull();
    });
});

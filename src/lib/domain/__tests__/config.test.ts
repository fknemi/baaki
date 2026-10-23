import { describe, it, expect } from "vitest";
import { config, assertConfig } from "../config";

describe("config", () => {
    it("passes its own assertion", () => {
        expect(() => assertConfig()).not.toThrow();
    });

    it("priority weights sum to 1.0", () => {
        const w = config.priorityWeights;
        expect(w.amount + w.age + w.reliability + w.gap).toBeCloseTo(1, 10);
    });

    it("ladder days strictly increase", () => {
        for (let i = 1; i < config.ladder.length; i++) {
            expect(config.ladder[i]!.day).toBeGreaterThan(config.ladder[i - 1]!.day);
        }
    });
    it("rejects priority weights that don't sum to 1", () => {
        expect(() =>
            assertConfig({
                ...config,
                // Sum = 0.5 + 0.3 + 0.15 + 0.10 = 1.05 — deliberately over 1
                priorityWeights: { amount: 0.5, age: 0.3, reliability: 0.15, gap: 0.10 },
            }),
        ).toThrow(/BAK-CFG-001/);
    });

    it("rejects non-increasing ladder", () => {
        expect(() =>
            assertConfig({
                ...config,
                ladder: [
                    { day: 0, key: "a" },
                    { day: 0, key: "b" },
                ],
            }),
        ).toThrow(/BAK-CFG-001/);
    });

    it("rejects unexpected GST rate", () => {
        expect(() =>
            assertConfig({
                ...config,
                gstRatesPct: [0, 7, 18],
            }),
        ).toThrow(/BAK-CFG-001/);
    });
});

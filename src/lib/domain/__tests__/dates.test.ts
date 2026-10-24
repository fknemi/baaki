import { describe, it, expect } from "vitest";
import { wholeDaysBetween, addDays, todayIST, atIso } from "../dates";

describe("wholeDaysBetween", () => {
  it("returns 0 for same day", () => {
    expect(wholeDaysBetween("2026-11-01", "2026-11-01")).toBe(0);
  });
  it("returns positive for later date", () => {
    expect(wholeDaysBetween("2026-11-01", "2026-11-08")).toBe(7);
    expect(wholeDaysBetween("2026-11-01", "2026-12-01")).toBe(30);
    expect(wholeDaysBetween("2026-11-01", "2026-12-16")).toBe(45);
  });
  it("returns negative for earlier date", () => {
    expect(wholeDaysBetween("2026-11-01", "2026-10-29")).toBe(-3);
  });
});

describe("addDays", () => {
  it("adds within month", () => {
    expect(addDays("2026-11-01", 7)).toBe("2026-11-08");
  });
  it("crosses month", () => {
    expect(addDays("2026-11-28", 5)).toBe("2026-12-03");
  });
  it("crosses year", () => {
    expect(addDays("2026-12-30", 5)).toBe("2027-01-04");
  });
  it("subtracts", () => {
    expect(addDays("2026-11-01", -3)).toBe("2026-10-29");
  });
});

describe("todayIST", () => {
  it("returns YYYY-MM-DD", () => {
    expect(todayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("atIso", () => {
  it("builds ISO timestamp with +05:30 offset", () => {
    expect(atIso("2026-11-01")).toBe("2026-11-01T10:00:00+05:30");
  });
  it("accepts custom time", () => {
    expect(atIso("2026-11-01", 15, 30, 45)).toBe("2026-11-01T15:30:45+05:30");
  });
});

import { describe, expect, it } from "vitest";
import { calculateAge, calculateEddCountdown, formatDisplayDate } from "./dates";

describe("calculateAge", () => {
  const today = new Date(2026, 7, 22); // 22 Aug 2026

  it("returns null for no date of birth", () => {
    expect(calculateAge(null, today)).toBeNull();
  });

  it("computes age when birthday has already passed this year", () => {
    expect(calculateAge("2000-01-15", today)).toBe(26);
  });

  it("computes age when birthday hasn't happened yet this year", () => {
    expect(calculateAge("2000-12-15", today)).toBe(25);
  });

  it("handles a birthday that is today", () => {
    expect(calculateAge("2000-08-22", today)).toBe(26);
  });
});

describe("calculateEddCountdown", () => {
  const today = new Date(2026, 7, 22); // 22 Aug 2026

  it("returns null for no EDD", () => {
    expect(calculateEddCountdown(null, today)).toBeNull();
  });

  it("reports days to go for a future EDD", () => {
    const result = calculateEddCountdown("2026-09-05", today); // 14 days out
    expect(result?.isPast).toBe(false);
    expect(result?.days).toBe(14);
    expect(result?.label).toContain("to go");
  });

  it("reports overdue for a past EDD", () => {
    const result = calculateEddCountdown("2026-08-10", today); // 12 days ago
    expect(result?.isPast).toBe(true);
    expect(result?.days).toBe(-12);
    expect(result?.label).toContain("overdue");
  });

  it("reports due today", () => {
    const result = calculateEddCountdown("2026-08-22", today);
    expect(result?.days).toBe(0);
    expect(result?.label).toBe("Due today");
  });
});

describe("formatDisplayDate", () => {
  it("returns an em dash for null", () => {
    expect(formatDisplayDate(null)).toBe("—");
  });

  it("formats a valid date", () => {
    expect(formatDisplayDate("2026-08-22")).toMatch(/22 Aug 2026/);
  });

  it("returns an em dash for an invalid date string", () => {
    expect(formatDisplayDate("not-a-date")).toBe("—");
  });
});

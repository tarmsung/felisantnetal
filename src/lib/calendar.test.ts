import { describe, expect, it } from "vitest";
import { getDayRange, getWeekRange, getMonthRange, shiftDateKey } from "./calendar";

describe("getDayRange", () => {
  it("spans exactly one Harare-local day, expressed in UTC", () => {
    const { startIso, endIso } = getDayRange("2026-08-22");
    // Harare is UTC+2, so local midnight is 22:00 UTC the previous day.
    expect(startIso).toBe("2026-08-21T22:00:00.000Z");
    expect(endIso).toBe("2026-08-22T22:00:00.000Z");
  });
});

describe("getWeekRange", () => {
  it("starts on the Sunday of the given date's week", () => {
    // 22 Aug 2026 is a Saturday.
    const { days } = getWeekRange("2026-08-22");
    expect(days[0]).toBe("2026-08-16"); // Sunday
    expect(days[6]).toBe("2026-08-22"); // Saturday
    expect(days).toHaveLength(7);
  });

  it("spans exactly 7 Harare-local days", () => {
    const { startIso, endIso } = getWeekRange("2026-08-22");
    const diffDays = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 86_400_000;
    expect(diffDays).toBe(7);
  });
});

describe("getMonthRange", () => {
  it("includes every day of the month plus leading/trailing days to fill whole weeks", () => {
    // August 2026: 1 Aug is a Saturday, 31 Aug is a Monday.
    const { weeks } = getMonthRange("2026-08-15");
    const allDays = weeks.flat();

    expect(allDays).toContain("2026-08-01");
    expect(allDays).toContain("2026-08-31");
    expect(allDays.length % 7).toBe(0);
    weeks.forEach((week) => expect(week).toHaveLength(7));

    // Every week starts on a Sunday: 1 Aug 2026 is a Saturday, so the
    // grid's first day should be 26 Jul 2026 (the preceding Sunday).
    expect(weeks[0][0]).toBe("2026-07-26");
  });

  it("ends the grid on the Saturday after the month's last day", () => {
    // 31 Aug 2026 is a Monday, so the grid should run through Saturday 5 Sep.
    const { weeks } = getMonthRange("2026-08-15");
    const lastWeek = weeks[weeks.length - 1];
    expect(lastWeek[lastWeek.length - 1]).toBe("2026-09-05");
  });
});

describe("shiftDateKey", () => {
  it("moves a day view by one day", () => {
    expect(shiftDateKey("2026-08-22", "day", 1)).toBe("2026-08-23");
    expect(shiftDateKey("2026-08-22", "day", -1)).toBe("2026-08-21");
  });

  it("moves a week view by seven days", () => {
    expect(shiftDateKey("2026-08-22", "week", 1)).toBe("2026-08-29");
  });

  it("moves a month view to the 1st of the adjacent month", () => {
    expect(shiftDateKey("2026-08-15", "month", 1)).toBe("2026-09-01");
    expect(shiftDateKey("2026-08-15", "month", -1)).toBe("2026-07-01");
  });

  it("handles a month shift from the 31st without overflowing", () => {
    // Naively adding a month to Jan 31 can land on Mar 3 in a 28-day Feb.
    expect(shiftDateKey("2026-01-31", "month", 1)).toBe("2026-02-01");
  });
});

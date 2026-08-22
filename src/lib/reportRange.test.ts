import { describe, expect, it } from "vitest";
import {
  resolveReportRange,
  startOfWeekKey,
  startOfMonthKey,
  pickBucketGranularity,
  enumerateWeekStarts,
  enumerateMonthStarts,
} from "./reportRange";

const TODAY = "2026-08-22"; // a Saturday

describe("resolveReportRange", () => {
  it("defaults to the last 30 days, inclusive of today", () => {
    const range = resolveReportRange(TODAY, "30d");
    expect(range.endKey).toBe(TODAY);
    expect(range.startKey).toBe("2026-07-24");
  });

  it("resolves 7d and 90d relative to today", () => {
    expect(resolveReportRange(TODAY, "7d").startKey).toBe("2026-08-16");
    expect(resolveReportRange(TODAY, "90d").startKey).toBe("2026-05-25");
  });

  it("resolves this_month to the 1st of the current month", () => {
    expect(resolveReportRange(TODAY, "this_month")).toMatchObject({
      startKey: "2026-08-01",
      endKey: TODAY,
    });
  });

  it("resolves 12m by subtracting a year-ish, handling month/day rollover", () => {
    const range = resolveReportRange(TODAY, "12m");
    expect(range.startKey).toBe("2025-08-22");
  });

  it("accepts a valid custom range and normalizes reversed order", () => {
    const range = resolveReportRange(TODAY, "custom", "2026-02-01", "2026-01-01");
    expect(range.startKey).toBe("2026-01-01");
    expect(range.endKey).toBe("2026-02-01");
  });

  it("falls back to 30d when custom is requested without valid dates", () => {
    const range = resolveReportRange(TODAY, "custom");
    expect(range.preset).toBe("30d");
  });
});

describe("startOfWeekKey / startOfMonthKey", () => {
  it("finds the Sunday of the week containing a date", () => {
    expect(startOfWeekKey("2026-08-22")).toBe("2026-08-16"); // Saturday -> preceding Sunday
    expect(startOfWeekKey("2026-08-16")).toBe("2026-08-16"); // already Sunday
  });

  it("finds the 1st of the month", () => {
    expect(startOfMonthKey("2026-08-22")).toBe("2026-08-01");
  });
});

describe("pickBucketGranularity", () => {
  it("picks week for short ranges and month for long ones", () => {
    expect(pickBucketGranularity("2026-08-01", "2026-08-22")).toBe("week");
    expect(pickBucketGranularity("2025-01-01", "2026-08-22")).toBe("month");
  });
});

describe("enumerateWeekStarts / enumerateMonthStarts", () => {
  it("lists each Sunday between two dates, inclusive", () => {
    const weeks = enumerateWeekStarts("2026-08-01", "2026-08-22");
    expect(weeks).toEqual(["2026-07-26", "2026-08-02", "2026-08-09", "2026-08-16"]);
  });

  it("lists each month start between two dates, inclusive", () => {
    const months = enumerateMonthStarts("2026-06-15", "2026-09-01");
    expect(months).toEqual(["2026-06-01", "2026-07-01", "2026-08-01", "2026-09-01"]);
  });

  it("handles a range within a single week/month", () => {
    expect(enumerateWeekStarts("2026-08-18", "2026-08-19")).toEqual(["2026-08-16"]);
    expect(enumerateMonthStarts("2026-08-05", "2026-08-20")).toEqual(["2026-08-01"]);
  });
});

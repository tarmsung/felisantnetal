/**
 * Pure date-range resolution for the Reports/Dashboard module (spec
 * section 43, Phase 6) — no I/O, so it's directly unit-testable the
 * same way lib/dates.ts and lib/calendar.ts are (see
 * reportRange.test.ts). Every boundary is a clinic-local calendar day
 * key ("YYYY-MM-DD"), converted to a queryable [start, end) instant
 * range by the caller via lib/calendar.ts's getDayRange, so a report
 * for "1–31 Aug" never drifts by a few hours depending on server
 * timezone the way a bare `new Date()` range would.
 */
import { addDaysToIsoDate } from "@/lib/dates";

export type ReportRangePreset = "7d" | "30d" | "90d" | "this_month" | "12m" | "custom";

export const REPORT_RANGE_PRESETS: Array<{ value: ReportRangePreset; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "this_month", label: "This month" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

export interface ResolvedReportRange {
  startKey: string;
  endKey: string; // inclusive
  preset: ReportRangePreset;
  label: string;
}

function daysAgoKey(todayKey: string, days: number): string {
  return addDaysToIsoDate(todayKey, -days) ?? todayKey;
}

function monthsAgoKey(todayKey: string, months: number): string {
  const [year, month, day] = todayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 - months, Math.min(day, 28)));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Resolves a preset (or explicit custom start/end) against `todayKey`
 * (pass calendar.ts's `todayKey()` at call sites — kept as a parameter
 * here, not called internally, so this stays pure and testable without
 * mocking the system clock).
 */
export function resolveReportRange(
  todayKey: string,
  preset: ReportRangePreset = "30d",
  customStart?: string,
  customEnd?: string,
): ResolvedReportRange {
  const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

  if (preset === "custom" && customStart && customEnd && DATE_ONLY.test(customStart) && DATE_ONLY.test(customEnd)) {
    const [startKey, endKey] = customStart <= customEnd ? [customStart, customEnd] : [customEnd, customStart];
    return { startKey, endKey, preset, label: `${startKey} to ${endKey}` };
  }

  if (preset === "this_month") {
    const [year, month] = todayKey.split("-").map(Number);
    const startKey = `${year}-${String(month).padStart(2, "0")}-01`;
    return { startKey, endKey: todayKey, preset, label: "This month" };
  }

  if (preset === "90d") {
    return { startKey: daysAgoKey(todayKey, 89), endKey: todayKey, preset, label: "Last 90 days" };
  }
  if (preset === "12m") {
    return { startKey: monthsAgoKey(todayKey, 12), endKey: todayKey, preset, label: "Last 12 months" };
  }
  if (preset === "7d") {
    return { startKey: daysAgoKey(todayKey, 6), endKey: todayKey, preset, label: "Last 7 days" };
  }

  // Default / "30d"
  return { startKey: daysAgoKey(todayKey, 29), endKey: todayKey, preset: "30d", label: "Last 30 days" };
}

/** Sunday date-key of the week containing `dateKey`. */
export function startOfWeekKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDaysToIsoDate(dateKey, -weekday) ?? dateKey;
}

/** First-of-month date-key of the month containing `dateKey`. */
export function startOfMonthKey(dateKey: string): string {
  const [year, month] = dateKey.split("-").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** More than ~12 weeks of range is unwieldy as a weekly bar chart — fall back to monthly buckets. */
export function pickBucketGranularity(startKey: string, endKey: string): "week" | "month" {
  const days = Math.round(
    (new Date(`${endKey}T00:00:00Z`).getTime() - new Date(`${startKey}T00:00:00Z`).getTime()) / 86_400_000,
  );
  return days > 90 ? "month" : "week";
}

/** Every week-start key from startOfWeekKey(startKey) through startOfWeekKey(endKey), inclusive. */
export function enumerateWeekStarts(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let cursor = startOfWeekKey(startKey);
  const last = startOfWeekKey(endKey);
  let guard = 0;
  while (cursor <= last && guard < 500) {
    keys.push(cursor);
    cursor = addDaysToIsoDate(cursor, 7) ?? cursor;
    guard += 1;
  }
  return keys;
}

/** "16 Aug" for a week bucket, "Aug 2026" for a month bucket — used as chart axis labels and report table headers. */
export function formatBucketLabel(bucketKey: string, granularity: "week" | "month"): string {
  const date = new Date(`${bucketKey}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return bucketKey;
  return granularity === "week"
    ? date.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    : date.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** Every month-start key from startOfMonthKey(startKey) through startOfMonthKey(endKey), inclusive. */
export function enumerateMonthStarts(startKey: string, endKey: string): string[] {
  const keys: string[] = [];
  let [year, month] = startOfMonthKey(startKey).split("-").map(Number);
  const [lastYear, lastMonth] = startOfMonthKey(endKey).split("-").map(Number);
  let guard = 0;
  while ((year < lastYear || (year === lastYear && month <= lastMonth)) && guard < 500) {
    keys.push(`${year}-${String(month).padStart(2, "0")}-01`);
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    guard += 1;
  }
  return keys;
}

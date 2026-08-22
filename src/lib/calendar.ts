/**
 * Pure calendar math for the appointments calendar (spec section 8).
 * Every boundary is computed in clinic-local time (see lib/dates.ts) —
 * "today" and day/week/month boundaries must reflect Harare's calendar,
 * not the server process's or a distant viewer's.
 */
import { addDaysToIsoDate, clinicLocalDateTimeToIso, clinicDateKey } from "@/lib/dates";

export type CalendarView = "day" | "week" | "month";

export interface DateRange {
  startIso: string;
  endIso: string;
}

/** [start, end) in clinic-local time for a single day. */
export function getDayRange(dateKey: string): DateRange {
  const nextDay = addDaysToIsoDate(dateKey, 1) ?? dateKey;
  return {
    startIso: clinicLocalDateTimeToIso(`${dateKey}T00:00`) ?? new Date().toISOString(),
    endIso: clinicLocalDateTimeToIso(`${nextDay}T00:00`) ?? new Date().toISOString(),
  };
}

/** Sunday-to-Saturday week containing dateKey, as a [start, end) clinic-local range plus each day's key. */
export function getWeekRange(dateKey: string): DateRange & { days: string[] } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay(); // 0 = Sunday
  const sunday = addDaysToIsoDate(dateKey, -weekday) ?? dateKey;
  const days = Array.from({ length: 7 }, (_, i) => addDaysToIsoDate(sunday, i) ?? sunday);
  const nextSunday = addDaysToIsoDate(sunday, 7) ?? sunday;

  return {
    startIso: clinicLocalDateTimeToIso(`${sunday}T00:00`) ?? new Date().toISOString(),
    endIso: clinicLocalDateTimeToIso(`${nextSunday}T00:00`) ?? new Date().toISOString(),
    days,
  };
}

/** The full weeks (Sun-Sat) needed to display dateKey's month, as a [start, end) clinic-local range plus a week-by-week day grid. */
export function getMonthRange(dateKey: string): DateRange & { weeks: string[][] } {
  const [year, month] = dateKey.split("-").map(Number);
  const firstOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const gridStart = addDaysToIsoDate(firstOfMonth, -firstWeekday) ?? firstOfMonth;

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lastOfMonth = `${year}-${String(month).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const lastWeekday = new Date(Date.UTC(year, month - 1, daysInMonth)).getUTCDay();
  const gridEnd = addDaysToIsoDate(lastOfMonth, 6 - lastWeekday) ?? lastOfMonth;

  const totalDays =
    Math.round(
      (new Date(`${gridEnd}T00:00:00Z`).getTime() - new Date(`${gridStart}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1;

  const allDays = Array.from(
    { length: totalDays },
    (_, i) => addDaysToIsoDate(gridStart, i) ?? gridStart,
  );
  const weeks: string[][] = [];
  for (let i = 0; i < allDays.length; i += 7) weeks.push(allDays.slice(i, i + 7));

  const gridEndExclusive = addDaysToIsoDate(gridEnd, 1) ?? gridEnd;

  return {
    startIso: clinicLocalDateTimeToIso(`${gridStart}T00:00`) ?? new Date().toISOString(),
    endIso: clinicLocalDateTimeToIso(`${gridEndExclusive}T00:00`) ?? new Date().toISOString(),
    weeks,
  };
}

export function getRangeForView(view: CalendarView, dateKey: string): DateRange {
  if (view === "day") return getDayRange(dateKey);
  if (view === "week") return getWeekRange(dateKey);
  return getMonthRange(dateKey);
}

export function shiftDateKey(dateKey: string, view: CalendarView, direction: 1 | -1): string {
  if (view === "day") return addDaysToIsoDate(dateKey, direction) ?? dateKey;
  if (view === "week") return addDaysToIsoDate(dateKey, direction * 7) ?? dateKey;

  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + direction, Math.min(day, 28)));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function todayKey(): string {
  return clinicDateKey(new Date().toISOString());
}

/**
 * Small date helpers shared across the patient module. Kept pure/no
 * dependencies so they're trivially unit-testable — see dates.test.ts.
 * Values are derived at render/query time, never stored (see
 * ARCHITECTURE.md: "age is never stored").
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `new Date("2026-08-22")` parses as UTC midnight per the ISO 8601
 * spec, then any local-timezone formatting of it can land on the wrong
 * calendar day for viewers west of UTC (Zimbabwe's UTC+2 never
 * triggers this, but nothing about this codebase guarantees every
 * future deployment/viewer stays in a positive-offset timezone). For a
 * pure date value — date_of_birth, EDD, LMP, registration_date, all
 * Postgres `date` columns with no time component — the fix is to parse
 * the y/m/d fields directly into a *local* Date instead of going
 * through the UTC-then-reformat round trip.
 */
function parseDateOnly(value: string): Date | null {
  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateAge(dateOfBirth: string | null, today = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = parseDateOnly(dateOfBirth);
  if (!dob) return null;

  let age = today.getFullYear() - dob.getFullYear();
  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export interface EddCountdown {
  days: number;
  isPast: boolean;
  label: string;
}

/** "3 weeks, 2 days to go" / "5 days overdue" style summary for the patient header. */
export function calculateEddCountdown(edd: string | null, today = new Date()): EddCountdown | null {
  if (!edd) return null;
  const eddDate = parseDateOnly(edd);
  if (!eddDate) return null;

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const end = new Date(eddDate.getFullYear(), eddDate.getMonth(), eddDate.getDate());
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  const isPast = diffDays < 0;
  const absDays = Math.abs(diffDays);
  const weeks = Math.floor(absDays / 7);
  const remainderDays = absDays % 7;

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks} week${weeks === 1 ? "" : "s"}`);
  if (remainderDays > 0 || weeks === 0) {
    parts.push(`${remainderDays} day${remainderDays === 1 ? "" : "s"}`);
  }

  const label = diffDays === 0
    ? "Due today"
    : isPast
      ? `${parts.join(", ")} overdue`
      : `${parts.join(", ")} to go`;

  return { days: diffDays, isPast, label };
}

/** Formats a date (date-only or timestamp) for display, e.g. "21 Aug 2026". */
export function formatDisplayDate(value: string | null): string {
  if (!value) return "—";
  const date = parseDateOnly(value);
  if (!date) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Pure calendar-date arithmetic ("YYYY-MM-DD" in, "YYYY-MM-DD" out) in a
 * fixed UTC-as-calendar frame, so the result never depends on the
 * server process's own timezone setting (unlike using JS's "local" Date
 * methods, which reflect whatever timezone the Node runtime happens to
 * be configured with). `days` may be negative.
 */
export function addDaysToIsoDate(isoDate: string, days: number): string | null {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Felis Clinic's single timezone. Appointments (`scheduled_date`) are a
 * real `timestamptz`, not a date-only column, so — unlike everything
 * above — the *time of day* matters and the server/viewer's own
 * timezone must never leak into either storing or displaying it.
 * Harare does not observe DST, so a fixed +02:00 offset is safe and
 * correct year-round; this would need generalizing (a real IANA-aware
 * conversion, e.g. via a library) if the clinic ever operated across
 * multiple timezones, but that's not this deployment.
 */
export const CLINIC_TIMEZONE = "Africa/Harare";
const CLINIC_UTC_OFFSET = "+02:00";

/**
 * Converts a `<input type="datetime-local">` value (e.g.
 * "2026-09-01T09:00", always in the *viewer's* wall-clock notation with
 * no timezone info) into a UTC ISO string for storage, treating the
 * input as clinic-local time regardless of where the browser itself is.
 * `Date` has no built-in way to parse a wall-clock string against an
 * IANA zone name — hence the hardcoded offset rather than
 * `CLINIC_TIMEZONE` here (display formatting below uses the IANA name
 * instead, since `Intl` *can* format-by-zone natively).
 */
export function clinicLocalDateTimeToIso(localDateTime: string): string | null {
  if (!localDateTime) return null;
  const date = new Date(`${localDateTime}:00${CLINIC_UTC_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Inverse of clinicLocalDateTimeToIso, for prefilling a datetime-local input from a stored timestamp. */
export function isoToClinicDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";

  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** Formats a timestamptz for display in clinic-local time, e.g. "1 Sep 2026, 09:00". */
export function formatClinicDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    timeZone: CLINIC_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Just the time portion in clinic-local time, e.g. "09:00". */
export function formatClinicTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", {
    timeZone: CLINIC_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Calendar-day key (YYYY-MM-DD) for a timestamp, in clinic-local time — for grouping appointments by day. */
export function clinicDateKey(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

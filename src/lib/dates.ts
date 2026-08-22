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

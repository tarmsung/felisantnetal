import { z } from "zod";
import { todayKey } from "@/lib/calendar";

/**
 * Shared data-entry rules (Phase 11 — field validation). Pure and
 * dependency-light so the same functions run in the browser (the
 * react-hook-form resolver) and on the server (every server action
 * re-validates; the browser is never trusted) — a rule that only lived
 * in the form could be skipped by calling the action directly.
 *
 * These are data-quality guards, not clinical judgement. Clinical
 * thresholds stay administrator-configured (riskRules.ts) — nothing
 * here decides whether a reading is "abnormal".
 */

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` that is a REAL calendar date — the regex alone accepts 2026-02-31 and 2026-13-45. */
export function isRealDate(key: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Whole days from `a` to `b` (positive when b is later). Both must be real dates. */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

export function addDays(key: string, n: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Completed years between a birth date and `today` (both YYYY-MM-DD). */
export function ageInYears(dob: string, today: string): number {
  const [by, bm, bd] = dob.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

/** Bounds for an ANC patient's age — outside this is almost certainly a typo in the year. */
export const MIN_PATIENT_AGE = 10;
export const MAX_PATIENT_AGE = 60;
/** LMP older than this (44 weeks) can't belong to a current pregnancy. */
export const MAX_LMP_AGE_DAYS = 308;
/** An EDD this far past is no longer a live ANC pregnancy. */
export const MAX_EDD_OVERDUE_DAYS = 28;
/** An EDD further out than this (42 weeks + slack) can't be a real pregnancy. */
export const MAX_EDD_AHEAD_DAYS = 294;
/** EDD should sit ~280 days after LMP; allow generous slack for ultrasound-dated EDDs. */
export const MIN_LMP_TO_EDD_DAYS = 245;
export const MAX_LMP_TO_EDD_DAYS = 315;

export interface DateIssue {
  path: "date_of_birth" | "lmp" | "edd";
  message: string;
}

/**
 * Cross-field date sanity for a patient + pregnancy. `today` is injectable for tests.
 *
 * `mode`: the "how long ago" rules (LMP more than 44 weeks back, EDD more
 * than 4 weeks past) only make sense when a pregnancy is being REGISTERED.
 * On an edit they'd lock out every mother whose due date has passed —
 * even just correcting her phone number — so "edit" skips them and keeps
 * every rule that's wrong at any time (impossible dates, future birth
 * date, EDD ~40 weeks after LMP, EDD absurdly far ahead).
 */
export function checkPatientDates(
  d: { date_of_birth?: string; lmp?: string; edd?: string },
  today: string = todayKey(),
  mode: "register" | "edit" = "register",
): DateIssue[] {
  const registering = mode === "register";
  const issues: DateIssue[] = [];

  if (d.date_of_birth) {
    if (!isRealDate(d.date_of_birth)) {
      issues.push({ path: "date_of_birth", message: "That isn't a real calendar date." });
    } else if (d.date_of_birth > today) {
      issues.push({ path: "date_of_birth", message: "Date of birth can't be in the future." });
    } else {
      const age = ageInYears(d.date_of_birth, today);
      if (age < MIN_PATIENT_AGE) {
        issues.push({ path: "date_of_birth", message: `That makes the patient ${age} — check the year.` });
      } else if (age > MAX_PATIENT_AGE) {
        issues.push({ path: "date_of_birth", message: `That makes the patient ${age} — check the year.` });
      }
    }
  }

  if (d.lmp) {
    if (!isRealDate(d.lmp)) {
      issues.push({ path: "lmp", message: "That isn't a real calendar date." });
    } else if (d.lmp > today) {
      issues.push({ path: "lmp", message: "Last menstrual period can't be in the future." });
    } else if (registering && daysBetween(d.lmp, today) > MAX_LMP_AGE_DAYS) {
      issues.push({
        path: "lmp",
        message: "That's more than 44 weeks ago — too long for a current pregnancy. Check the date.",
      });
    }
  }

  if (d.edd) {
    if (!isRealDate(d.edd)) {
      issues.push({ path: "edd", message: "That isn't a real calendar date." });
    } else if (registering && daysBetween(d.edd, today) > MAX_EDD_OVERDUE_DAYS) {
      issues.push({ path: "edd", message: "That's more than 4 weeks in the past. Check the date." });
    } else if (daysBetween(today, d.edd) > MAX_EDD_AHEAD_DAYS) {
      issues.push({ path: "edd", message: "That's more than 42 weeks away — too far ahead. Check the date." });
    }
  }

  // Only compare LMP and EDD with each other when both are real dates and individually sane.
  if (d.lmp && d.edd && isRealDate(d.lmp) && isRealDate(d.edd) && !issues.some((i) => i.path === "lmp" || i.path === "edd")) {
    const gap = daysBetween(d.lmp, d.edd);
    if (gap <= 0) {
      issues.push({ path: "edd", message: "The due date must be after the last menstrual period." });
    } else if (gap < MIN_LMP_TO_EDD_DAYS || gap > MAX_LMP_TO_EDD_DAYS) {
      issues.push({
        path: "edd",
        message: `The due date is normally about 40 weeks after the LMP — these are ${gap} days apart. Check one of them.`,
      });
    }
  }

  return issues;
}

/** A visit/appointment booked further out than this (10 months) is a typo, not a plan. */
export const MAX_APPOINTMENT_AHEAD_DAYS = 300;
/** Recording a visit older than this (a full pregnancy and a bit) is a typo in the date. */
export const MAX_VISIT_AGE_DAYS = 330;
/** Booking "right now" is fine; this grace stops a just-passed minute from rejecting it. */
export const APPOINTMENT_PAST_GRACE_MINUTES = 15;

/**
 * Validates a `<input type="datetime-local">` value ("2026-12-01T09:30",
 * clinic-local wall-clock) for a NEW or RESCHEDULED appointment.
 * Returns an error message, or null when fine. A past time is rejected
 * because the missed-visit sweep would flip it to "missed" the moment it
 * was saved — an appointment that can never happen.
 */
export function checkAppointmentDateTime(local: string, nowMs: number = Date.now()): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m || !isRealDate(m[1]) || Number(m[2]) > 23 || Number(m[3]) > 59) {
    return "That isn't a real date and time.";
  }
  const at = Date.parse(`${local}:00+02:00`); // clinic-local (Africa/Harare, UTC+2, no DST)
  if (Number.isNaN(at)) return "That isn't a real date and time.";
  if (at < nowMs - APPOINTMENT_PAST_GRACE_MINUTES * 60_000) {
    return "That time has already passed — pick a date and time from now onwards.";
  }
  if (at > nowMs + MAX_APPOINTMENT_AHEAD_DAYS * DAY_MS) {
    return "That's more than 10 months away — check the date.";
  }
  return null;
}

/** Validates the date a clinical visit took place on (YYYY-MM-DD). Returns an error message, or null. */
export function checkVisitDate(date: string, today: string = todayKey()): string | null {
  if (!isRealDate(date)) return "That isn't a real calendar date.";
  if (date > today) return "A visit can't be recorded for a future date.";
  if (daysBetween(date, today) > MAX_VISIT_AGE_DAYS) {
    return "That's more than 11 months ago — too long for a current pregnancy. Check the date.";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Zimbabwean national ID
// ---------------------------------------------------------------------------

/**
 * Zimbabwean national ID: 2-digit registration-district code, a 6- or
 * 7-digit serial, one check letter, then a 2-digit district-of-origin
 * code — written 63-123456 A 42 or 63-1234567-A-42, with the separators
 * and spaces varying in practice. This validates the *shape* only; it
 * can't tell whether a well-formed number is actually issued to anyone.
 *
 * Stored in ONE canonical form — `63-123456A42` (the clinic's existing
 * records already use this style) — so duplicate detection, which
 * compares stored strings, can't be dodged by typing the same ID with
 * different spacing.
 */
const ZIM_NATIONAL_ID = /^(\d{2})[-\s]?(\d{6,7})[-\s]?([A-Za-z])[-\s]?(\d{2})$/;

export function normalizeZimNationalId(raw: string): string | null {
  const m = ZIM_NATIONAL_ID.exec(raw.trim());
  if (!m) return null;
  const [, reg, serial, letter, district] = m;
  if (reg === "00" || district === "00") return null;
  return `${reg}-${serial}${letter.toUpperCase()}${district}`;
}

export const NATIONAL_ID_MESSAGE =
  "Enter a valid Zimbabwean national ID, e.g. 63-123456A42 (2 digits, 6–7 digits, a letter, 2 digits).";

// ---------------------------------------------------------------------------
// Zimbabwean phone numbers
// ---------------------------------------------------------------------------

/**
 * Accepts 0771234567, 077 123 4567, +263 77 123 4567, 263771234567 (and
 * a bare 771234567). Mobile numbers (national number starting 7) must be
 * exactly 9 digits on a real operator prefix — 71 NetOne, 73 Telecel,
 * 77/78 Econet; other numbers (landlines) must be 7–9 digits starting 2–6
 * or 8. Normalised to local form `0771234567` so duplicate detection
 * compares like with like. Format check only — says nothing about
 * whether the line exists or has WhatsApp.
 */
export function normalizeZimPhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, "");
  const m = /^(?:\+263|00263|263|0)?(\d{7,9})$/.exec(cleaned);
  if (!m) return null;
  const national = m[1];
  if (national.startsWith("7")) {
    return /^7[1378]\d{7}$/.test(national) ? `0${national}` : null;
  }
  return /^[2-68]\d{6,8}$/.test(national) ? `0${national}` : null;
}

export const PHONE_MESSAGE =
  "Enter a valid Zimbabwean number, e.g. 0771234567 or +263 77 123 4567.";

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/** Letters (any script), spaces, apostrophes, hyphens and full stops; at least 2 characters, no digits. */
const NAME = /^\p{L}[\p{L}\p{M}'’.\- ]+$/u;

export function normalizeName(raw: string): string | null {
  const collapsed = raw.trim().replace(/\s+/g, " ");
  return NAME.test(collapsed) ? collapsed : null;
}

export const NAME_MESSAGE = "Use letters only (spaces, hyphens and apostrophes are fine) — no digits or symbols.";

// ---------------------------------------------------------------------------
// Zod building blocks
// ---------------------------------------------------------------------------

/** Required name field: trimmed, whitespace collapsed, letters only. */
export const nameField = (label: string, max = 200) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max)
    .refine((v) => normalizeName(v) !== null, { message: NAME_MESSAGE })
    .transform((v) => normalizeName(v)!);

/** Optional name field (blank allowed). */
export const optionalNameField = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || normalizeName(v) !== null, { message: NAME_MESSAGE })
    .transform((v) => (v ? normalizeName(v)! : undefined));

/** Optional Zimbabwean phone (blank allowed); stored normalised. */
export const optionalPhoneField = () =>
  z
    .string()
    .trim()
    .max(32)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || normalizeZimPhone(v) !== null, { message: PHONE_MESSAGE })
    .transform((v) => (v ? normalizeZimPhone(v)! : undefined));

/** Optional Zimbabwean national ID (blank allowed); stored in canonical form. */
export const optionalNationalIdField = () =>
  z
    .string()
    .trim()
    .max(32)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || normalizeZimNationalId(v) !== null, { message: NATIONAL_ID_MESSAGE })
    .transform((v) => (v ? normalizeZimNationalId(v)! : undefined));

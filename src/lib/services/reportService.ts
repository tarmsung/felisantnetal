import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDayRange } from "@/lib/calendar";
import {
  pickBucketGranularity,
  enumerateWeekStarts,
  enumerateMonthStarts,
  startOfWeekKey,
  startOfMonthKey,
  formatBucketLabel,
} from "@/lib/reportRange";
import { clinicDateKey } from "@/lib/dates";
import { listMissedAppointments, type MissedAppointmentRow } from "@/lib/services/appointmentService";
import type { AppointmentStatus, PatientStatus, RiskSeverity, RiskStatus } from "@/types/database";

/**
 * Phase 6 (spec section 43): monthly attendance, missed-visit,
 * high-risk and patient-summary reports, plus the dashboard's trend
 * charts — all built on real aggregate queries over a caller-supplied
 * clinic-local date range (see lib/reportRange.ts), never sample data.
 * A small clinic's appointment/patient volume makes "fetch the rows in
 * range, bucket/aggregate in JS" the simplest correct approach — no
 * need for a materialized view or a raw SQL aggregate this scale
 * doesn't call for.
 */

function rangeToIso(startKey: string, endKey: string): { startIso: string; endIso: string } {
  return {
    startIso: getDayRange(startKey).startIso,
    // endKey is inclusive, so the exclusive upper bound is the start of the day *after* it.
    endIso: getDayRange(endKey).endIso,
  };
}

function bucketKeyFor(dateKey: string, granularity: "week" | "month"): string {
  return granularity === "week" ? startOfWeekKey(dateKey) : startOfMonthKey(dateKey);
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export interface AttendanceTrendPoint {
  bucketKey: string;
  label: string;
  scheduled: number;
  completed: number;
  missed: number;
  cancelled: number;
  rescheduled: number;
  total: number;
}

export interface AttendanceReport {
  granularity: "week" | "month";
  trend: AttendanceTrendPoint[];
  statusBreakdown: Array<{ status: AppointmentStatus; count: number }>;
  summary: {
    total: number;
    scheduled: number;
    completed: number;
    missed: number;
    cancelled: number;
    rescheduled: number;
    /** completed / (completed + missed) — null when neither has happened yet in range. */
    adherenceRate: number | null;
  };
}

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "completed",
  "missed",
  "cancelled",
  "rescheduled",
];

/** Backs both the Dashboard's attendance trend/status charts and the Reports page's Attendance tab. */
export async function getAttendanceReport(startKey: string, endKey: string): Promise<AttendanceReport> {
  const supabase = await createSupabaseServerClient();
  const { startIso, endIso } = rangeToIso(startKey, endKey);

  const { data, error } = await supabase
    .from("appointments")
    .select("scheduled_date, status")
    .gte("scheduled_date", startIso)
    .lt("scheduled_date", endIso);

  if (error) throw new Error(`Failed to load attendance data: ${error.message}`);
  const rows = data ?? [];

  const granularity = pickBucketGranularity(startKey, endKey);
  const bucketKeys =
    granularity === "week" ? enumerateWeekStarts(startKey, endKey) : enumerateMonthStarts(startKey, endKey);

  const trendByBucket = new Map<string, AttendanceTrendPoint>(
    bucketKeys.map((key) => [
      key,
      { bucketKey: key, label: formatBucketLabel(key, granularity), scheduled: 0, completed: 0, missed: 0, cancelled: 0, rescheduled: 0, total: 0 },
    ]),
  );

  const summary = { total: 0, scheduled: 0, completed: 0, missed: 0, cancelled: 0, rescheduled: 0 };
  const statusCounts = new Map<AppointmentStatus, number>(APPOINTMENT_STATUSES.map((s) => [s, 0]));

  for (const row of rows) {
    summary.total += 1;
    summary[row.status] += 1;
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);

    const bucketKey = bucketKeyFor(clinicDateKey(row.scheduled_date), granularity);
    const point = trendByBucket.get(bucketKey);
    if (point) {
      point[row.status] += 1;
      point.total += 1;
    }
  }

  const adherenceDenominator = summary.completed + summary.missed;

  return {
    granularity,
    trend: Array.from(trendByBucket.values()),
    statusBreakdown: APPOINTMENT_STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    summary: {
      ...summary,
      adherenceRate:
        adherenceDenominator === 0 ? null : Math.round((summary.completed / adherenceDenominator) * 100),
    },
  };
}

// ---------------------------------------------------------------------------
// Risk overview
// ---------------------------------------------------------------------------

const RISK_SEVERITIES: RiskSeverity[] = ["low", "medium", "high", "critical"];

/** Current snapshot (not range-scoped — "how much active risk is there right now"), backs the Dashboard's risk chart. */
export async function getActiveRiskBySeverity(): Promise<Array<{ severity: RiskSeverity; count: number }>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("risk_flags").select("severity").eq("status", "active");
  if (error) throw new Error(`Failed to load active risk flags: ${error.message}`);

  const counts = new Map<RiskSeverity, number>(RISK_SEVERITIES.map((s) => [s, 0]));
  for (const row of data ?? []) counts.set(row.severity, (counts.get(row.severity) ?? 0) + 1);
  return RISK_SEVERITIES.map((severity) => ({ severity, count: counts.get(severity) ?? 0 }));
}

export interface HighRiskReportRow {
  patientFullName: string;
  patientNumber: string;
  severity: RiskSeverity;
  reason: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface HighRiskReport {
  activeBySeverity: Array<{ severity: RiskSeverity; count: number }>;
  flagsRaisedInRange: number;
  resolvedInRange: number;
  avgResolutionDays: number | null;
  rows: HighRiskReportRow[];
}

/** Backs the Reports page's High Risk tab — a current active-flags snapshot plus what happened within the selected range. */
export async function getHighRiskReport(startKey: string, endKey: string): Promise<HighRiskReport> {
  const supabase = await createSupabaseServerClient();
  const { startIso, endIso } = rangeToIso(startKey, endKey);

  const [activeBySeverity, { data: flagRows, error }] = await Promise.all([
    getActiveRiskBySeverity(),
    supabase
      .from("risk_flags")
      .select("patient_id, severity, reason, status, created_at, resolved_at")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: false }),
  ]);

  if (error) throw new Error(`Failed to load risk flags: ${error.message}`);
  const flags = flagRows ?? [];

  const patientIds = Array.from(new Set(flags.map((f) => f.patient_id)));
  const { data: patients } = patientIds.length
    ? await supabase.from("patients").select("id, full_name, patient_number").in("id", patientIds)
    : { data: [] as { id: string; full_name: string; patient_number: string }[] };
  const patientById = new Map((patients ?? []).map((p) => [p.id, p]));

  const resolved = flags.filter((f) => f.status === "resolved" && f.resolved_at);
  const avgResolutionDays =
    resolved.length === 0
      ? null
      : Math.round(
          (resolved.reduce(
            (sum, f) => sum + (new Date(f.resolved_at as string).getTime() - new Date(f.created_at).getTime()),
            0,
          ) /
            resolved.length /
            86_400_000) *
            10,
        ) / 10;

  return {
    activeBySeverity,
    flagsRaisedInRange: flags.length,
    resolvedInRange: resolved.length,
    avgResolutionDays,
    rows: flags.map((f) => ({
      patientFullName: patientById.get(f.patient_id)?.full_name ?? "Unknown patient",
      patientNumber: patientById.get(f.patient_id)?.patient_number ?? "—",
      severity: f.severity,
      reason: f.reason,
      status: f.status,
      createdAt: f.created_at,
      resolvedAt: f.resolved_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Missed visits
// ---------------------------------------------------------------------------

export interface MissedVisitReport {
  totalMissed: number;
  avgDaysOverdue: number | null;
  byChw: Array<{ chwName: string; count: number }>;
  rows: MissedAppointmentRow[];
}

/** Scopes appointmentService.listMissedAppointments (Phase 3) to a date range rather than duplicating its patient/CHW join logic. */
export async function getMissedVisitReport(startKey: string, endKey: string): Promise<MissedVisitReport> {
  const { startIso, endIso } = rangeToIso(startKey, endKey);
  const rows = await listMissedAppointments({ scheduledFromIso: startIso, scheduledToIso: endIso });

  const byChwMap = new Map<string, number>();
  for (const row of rows) {
    const name = row.community_health_worker_name ?? "Unassigned";
    byChwMap.set(name, (byChwMap.get(name) ?? 0) + 1);
  }

  return {
    totalMissed: rows.length,
    avgDaysOverdue:
      rows.length === 0
        ? null
        : Math.round((rows.reduce((sum, r) => sum + r.daysOverdue, 0) / rows.length) * 10) / 10,
    byChw: Array.from(byChwMap.entries())
      .map(([chwName, count]) => ({ chwName, count }))
      .sort((a, b) => b.count - a.count),
    rows,
  };
}

// ---------------------------------------------------------------------------
// Patient summary (registrations + current composition)
// ---------------------------------------------------------------------------

export interface PatientSummaryReportRow {
  fullName: string;
  patientNumber: string;
  registrationDate: string;
  status: PatientStatus;
  riskStatus: RiskStatus;
  chwName: string | null;
}

export interface PatientSummaryReport {
  totalRegistered: number;
  byStatus: Array<{ status: PatientStatus; count: number }>;
  byRisk: Array<{ status: RiskStatus; count: number }>;
  byChw: Array<{ chwName: string; count: number }>;
  registrationTrend: {
    granularity: "week" | "month";
    trend: Array<{ bucketKey: string; label: string; count: number }>;
  };
  rows: PatientSummaryReportRow[];
}

const PATIENT_STATUSES: PatientStatus[] = ["active", "inactive", "transferred"];
const RISK_STATUSES: RiskStatus[] = ["normal", "high_risk"];

/** Backs the Reports page's Patient Summary tab and the Dashboard's registration trend chart. */
export async function getPatientSummaryReport(startKey: string, endKey: string): Promise<PatientSummaryReport> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("patients")
    .select("full_name, patient_number, registration_date, status, risk_status, community_health_worker_id")
    .is("deleted_at", null)
    .gte("registration_date", startKey)
    .lte("registration_date", endKey);

  if (error) throw new Error(`Failed to load patient registrations: ${error.message}`);
  const rows = data ?? [];

  const chwIds = Array.from(
    new Set(rows.map((r) => r.community_health_worker_id).filter((id): id is string => Boolean(id))),
  );
  const { data: chwRows } = chwIds.length
    ? await supabase.from("community_health_workers").select("id, full_name").in("id", chwIds)
    : { data: [] as { id: string; full_name: string }[] };
  const chwNameById = new Map((chwRows ?? []).map((c) => [c.id, c.full_name]));

  const granularity = pickBucketGranularity(startKey, endKey);
  const bucketKeys =
    granularity === "week" ? enumerateWeekStarts(startKey, endKey) : enumerateMonthStarts(startKey, endKey);
  const trendByBucket = new Map<string, number>(bucketKeys.map((k) => [k, 0]));

  const statusCounts = new Map<PatientStatus, number>(PATIENT_STATUSES.map((s) => [s, 0]));
  const riskCounts = new Map<RiskStatus, number>(RISK_STATUSES.map((s) => [s, 0]));
  const byChwMap = new Map<string, number>();

  for (const row of rows) {
    statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
    riskCounts.set(row.risk_status, (riskCounts.get(row.risk_status) ?? 0) + 1);
    const chwName = row.community_health_worker_id ? (chwNameById.get(row.community_health_worker_id) ?? "Unknown") : "Unassigned";
    byChwMap.set(chwName, (byChwMap.get(chwName) ?? 0) + 1);

    const bucketKey = bucketKeyFor(row.registration_date, granularity);
    if (trendByBucket.has(bucketKey)) trendByBucket.set(bucketKey, (trendByBucket.get(bucketKey) ?? 0) + 1);
  }

  return {
    totalRegistered: rows.length,
    byStatus: PATIENT_STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    byRisk: RISK_STATUSES.map((status) => ({ status, count: riskCounts.get(status) ?? 0 })),
    byChw: Array.from(byChwMap.entries())
      .map(([chwName, count]) => ({ chwName, count }))
      .sort((a, b) => b.count - a.count),
    registrationTrend: {
      granularity,
      trend: bucketKeys.map((key) => ({
        bucketKey: key,
        label: formatBucketLabel(key, granularity),
        count: trendByBucket.get(key) ?? 0,
      })),
    },
    rows: rows.map((r) => ({
      fullName: r.full_name,
      patientNumber: r.patient_number,
      registrationDate: r.registration_date,
      status: r.status,
      riskStatus: r.risk_status,
      chwName: r.community_health_worker_id ? (chwNameById.get(r.community_health_worker_id) ?? null) : null,
    })),
  };
}

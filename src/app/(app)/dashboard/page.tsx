import type { Metadata } from "next";
import Link from "next/link";
import {
  Users2,
  UserCheck,
  CalendarClock,
  CalendarDays,
  CalendarX2,
  AlertTriangle,
  Stethoscope,
  Gauge,
} from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sweepMissedAppointments } from "@/lib/services/appointmentService";
import { getDayRange, todayKey } from "@/lib/calendar";
import { resolveReportRange } from "@/lib/reportRange";
import {
  getAttendanceReport,
  getActiveRiskBySeverity,
  getPatientSummaryReport,
} from "@/lib/services/reportService";
import { MetricCard } from "@/components/shared/metric-card";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { AttendanceTrendChart } from "@/components/reports/attendance-trend-chart";
import { StatusBreakdownChart } from "@/components/reports/status-breakdown-chart";
import { RiskSeverityChart } from "@/components/reports/risk-severity-chart";
import { RegistrationTrendChart } from "@/components/reports/registration-trend-chart";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Every count and chart below is a live query — there is no seeded/demo
 * dashboard data (spec section 12 explicitly forbids that once the
 * database exists). On a fresh database this legitimately renders
 * zeros and empty charts. The four trend charts reuse reportService
 * (Phase 6) with fixed, dashboard-appropriate ranges rather than a
 * user-adjustable one — that's what the Reports page is for.
 */
export default async function DashboardPage() {
  await sweepMissedAppointments();
  const supabase = await createSupabaseServerClient();

  // Clinic-local ("Africa/Harare") day boundaries, not the server
  // process's own timezone (see lib/dates.ts) — otherwise "today" could
  // be off by a couple of hours around midnight depending on where the
  // app happens to be deployed.
  const { startIso: startOfToday, endIso: endOfToday } = getDayRange(todayKey());
  const [year, month] = todayKey().split("-").map(Number);
  const startOfMonth = `${year}-${String(month).padStart(2, "0")}-01`;

  const [
    totalPatients,
    activePatients,
    todaysAppointments,
    upcomingAppointments,
    missedAppointments,
    completedAppointments,
    highRiskPatients,
    visitsThisMonth,
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null),
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "active"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .gte("scheduled_date", startOfToday)
      .lt("scheduled_date", endOfToday),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .gte("scheduled_date", endOfToday),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "missed"),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("risk_status", "high_risk"),
    supabase
      .from("clinical_visits")
      .select("id", { count: "exact", head: true })
      .gte("visit_date", startOfMonth),
  ]);

  const completed = completedAppointments.count ?? 0;
  const missed = missedAppointments.count ?? 0;
  const adherenceDenominator = completed + missed;
  const adherenceRate =
    adherenceDenominator === 0
      ? null
      : Math.round((completed / adherenceDenominator) * 100);

  // Fixed, dashboard-appropriate ranges — a user-adjustable range lives
  // on the Reports page, not here. 90 days buckets weekly
  // (pickBucketGranularity), 12 months buckets monthly.
  const attendanceRange = resolveReportRange(todayKey(), "90d");
  const registrationRange = resolveReportRange(todayKey(), "12m");
  const [attendance, riskBySeverity, patientSummary] = await Promise.all([
    getAttendanceReport(attendanceRange.startKey, attendanceRange.endKey),
    getActiveRiskBySeverity(),
    getPatientSummaryReport(registrationRange.startKey, registrationRange.endKey),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total ANC Patients"
          value={totalPatients.count ?? 0}
          icon={Users2}
        />
        <MetricCard
          label="Active ANC Patients"
          value={activePatients.count ?? 0}
          icon={UserCheck}
          tone="success"
        />
        <MetricCard
          label="Today's Appointments"
          value={todaysAppointments.count ?? 0}
          icon={CalendarClock}
        />
        <MetricCard
          label="Upcoming Appointments"
          value={upcomingAppointments.count ?? 0}
          icon={CalendarDays}
        />
        <MetricCard
          label="Missed Appointments"
          value={missed}
          icon={CalendarX2}
          tone={missed > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="High-Risk Patients"
          value={highRiskPatients.count ?? 0}
          icon={AlertTriangle}
          tone={(highRiskPatients.count ?? 0) > 0 ? "destructive" : "default"}
        />
        <MetricCard
          label="Visits Completed This Month"
          value={visitsThisMonth.count ?? 0}
          icon={Stethoscope}
        />
        <MetricCard
          label="Appointment Adherence"
          value={adherenceRate === null ? "—" : `${adherenceRate}%`}
          icon={Gauge}
          note={
            adherenceDenominator === 0
              ? "No completed or missed appointments recorded yet"
              : `${completed} completed / ${missed} missed`
          }
        />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Trends</h2>
        <Link href="/reports" className="text-sm font-medium text-primary hover:underline">
          View full reports →
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Attendance trend (last 90 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <AttendanceTrendChart data={attendance.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Appointment status (last 90 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart data={attendance.statusBreakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active risk flags by severity</CardTitle>
          </CardHeader>
          <CardContent>
            <RiskSeverityChart data={riskBySeverity} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Registration trend (last 12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <RegistrationTrendChart data={patientSummary.registrationTrend.trend} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

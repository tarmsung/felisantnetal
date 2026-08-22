import type { Metadata } from "next";
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
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Every count below is a live query — there is no seeded/demo dashboard
 * data (spec section 12 explicitly forbids that once the database
 * exists). On a fresh database this legitimately renders zeros.
 *
 * Charts (attendance trend, appointment status split, risk overview,
 * registration trend) are intentionally not built yet: the spec's own
 * phase plan (section 43, Phase 6) pairs "Dashboard and reports" with
 * the analytics/reporting module, which needs the reportService and
 * filtering this phase hasn't built. Building ad-hoc charts here now
 * would just be redone in Phase 6.
 */
export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const startOfMonth = new Date(
    startOfToday.getFullYear(),
    startOfToday.getMonth(),
    1,
  );

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
      .gte("scheduled_date", startOfToday.toISOString())
      .lt("scheduled_date", endOfToday.toISOString()),
    supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("status", "scheduled")
      .gte("scheduled_date", endOfToday.toISOString()),
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
      .gte("visit_date", startOfMonth.toISOString().slice(0, 10)),
  ]);

  const completed = completedAppointments.count ?? 0;
  const missed = missedAppointments.count ?? 0;
  const adherenceDenominator = completed + missed;
  const adherenceRate =
    adherenceDenominator === 0
      ? null
      : Math.round((completed / adherenceDenominator) * 100);

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

      <EmptyState
        icon={BarChart3}
        title="Attendance & risk charts arrive with the Reports module"
        description="Trend charts for ANC attendance, appointment status, risk overview and registrations are built together with reportService in a later phase, once there's real appointment and visit data to chart."
      />
    </div>
  );
}

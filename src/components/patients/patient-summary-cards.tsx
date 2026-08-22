import { CalendarCheck, CalendarClock, CalendarX2, AlertTriangle } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { formatDisplayDate } from "@/lib/dates";
import type { PatientSummary } from "@/lib/services/patientService";

export function PatientSummaryCards({ summary }: { summary: PatientSummary }) {
  const remaining = Math.max(0, summary.ancVisitsConfigured - summary.ancVisitsCompleted);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MetricCard
        label="ANC Visits Completed"
        value={summary.ancVisitsCompleted}
        icon={CalendarCheck}
      />
      <MetricCard
        label="ANC Visits Remaining"
        value={summary.ancVisitsConfigured > 0 ? remaining : "—"}
        icon={CalendarClock}
        note={summary.ancVisitsConfigured === 0 ? "Schedule not configured yet" : undefined}
      />
      <MetricCard
        label="Next Appointment"
        value={summary.nextAppointmentDate ? formatDisplayDate(summary.nextAppointmentDate) : "None"}
        icon={CalendarClock}
      />
      <MetricCard
        label="Missed Appointments"
        value={summary.missedAppointments}
        icon={CalendarX2}
        tone={summary.missedAppointments > 0 ? "warning" : "default"}
      />
      <MetricCard
        label="Active Risk Flags"
        value={summary.activeRiskFlags}
        icon={AlertTriangle}
        tone={summary.activeRiskFlags > 0 ? "destructive" : "default"}
        className="col-span-2 sm:col-span-1"
      />
    </div>
  );
}

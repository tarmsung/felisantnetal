import { CalendarX2 } from "lucide-react";
import { formatClinicTime } from "@/lib/dates";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import { RiskBadge } from "@/components/shared/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { AppointmentListRow } from "@/lib/services/appointmentService";

export function DayView({
  appointments,
  onSelect,
}: {
  appointments: AppointmentListRow[];
  onSelect: (appointment: AppointmentListRow) => void;
}) {
  const sorted = [...appointments].sort((a, b) =>
    a.scheduled_date.localeCompare(b.scheduled_date),
  );

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title="No appointments this day"
        description='Use "Add appointment" to schedule one.'
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((appointment) => (
        <button
          key={appointment.id}
          type="button"
          onClick={() => onSelect(appointment)}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/50"
        >
          <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">
            {formatClinicTime(appointment.scheduled_date)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-medium">{appointment.patient_full_name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {appointment.patient_number}
              {appointment.visit_number ? ` · Visit ${appointment.visit_number}` : ""} ·{" "}
              {appointment.appointment_type}
            </span>
          </div>
          <RiskBadge status={appointment.patient_risk_status} />
          <AppointmentStatusBadge status={appointment.status} />
        </button>
      ))}
    </div>
  );
}

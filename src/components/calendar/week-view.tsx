import { cn } from "@/lib/utils";
import { clinicDateKey, formatClinicTime } from "@/lib/dates";
import { todayKey as getTodayKey } from "@/lib/calendar";
import { AppointmentStatusBadge } from "@/components/appointments/appointment-status-badge";
import type { AppointmentListRow } from "@/lib/services/appointmentService";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekView({
  days,
  appointments,
  onSelect,
}: {
  days: string[];
  appointments: AppointmentListRow[];
  onSelect: (appointment: AppointmentListRow) => void;
}) {
  const byDay = new Map<string, AppointmentListRow[]>();
  for (const appointment of appointments) {
    const key = clinicDateKey(appointment.scheduled_date);
    const list = byDay.get(key) ?? [];
    list.push(appointment);
    byDay.set(key, list);
  }

  const today = getTodayKey();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
      {days.map((dayKey, i) => {
        const dayAppointments = (byDay.get(dayKey) ?? []).sort((a, b) =>
          a.scheduled_date.localeCompare(b.scheduled_date),
        );
        const isToday = dayKey === today;

        return (
          <div
            key={dayKey}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-2"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {WEEKDAY_LABELS[i]}
              </span>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {Number(dayKey.slice(-2))}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {dayAppointments.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">No appointments</p>
              ) : (
                dayAppointments.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => onSelect(appointment)}
                    className="flex min-w-0 flex-col items-start gap-1 rounded-lg border border-border p-2 text-left text-xs hover:bg-muted"
                  >
                    <span className="font-semibold tabular-nums">
                      {formatClinicTime(appointment.scheduled_date)}
                    </span>
                    <span className="w-full truncate font-medium">
                      {appointment.patient_full_name}
                    </span>
                    <AppointmentStatusBadge
                      status={appointment.status}
                      className="max-w-full overflow-hidden px-1.5 text-[10px] text-ellipsis"
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

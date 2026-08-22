import { cn } from "@/lib/utils";
import { clinicDateKey } from "@/lib/dates";
import { todayKey as getTodayKey } from "@/lib/calendar";
import { AppointmentChip } from "@/components/calendar/appointment-chip";
import type { AppointmentListRow } from "@/lib/services/appointmentService";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_PER_DAY = 3;

export function MonthView({
  weeks,
  monthKey,
  appointments,
  onSelect,
}: {
  weeks: string[][];
  /** "YYYY-MM" of the month actually being viewed, to dim leading/trailing days from adjacent months. */
  monthKey: string;
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
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((dayKey) => {
          const dayAppointments = (byDay.get(dayKey) ?? []).sort((a, b) =>
            a.scheduled_date.localeCompare(b.scheduled_date),
          );
          const isCurrentMonth = dayKey.startsWith(monthKey);
          const isToday = dayKey === today;
          const dayNumber = Number(dayKey.slice(-2));

          return (
            <div
              key={dayKey}
              className={cn(
                "flex min-h-28 flex-col gap-0.5 border-r border-b border-border p-1.5 last:border-r-0",
                !isCurrentMonth && "bg-muted/20",
              )}
            >
              <span
                className={cn(
                  "self-start rounded-full px-1.5 text-[11px] font-semibold",
                  !isCurrentMonth && "text-muted-foreground/50",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {dayNumber}
              </span>
              <div className="flex flex-col gap-0.5">
                {dayAppointments.slice(0, MAX_VISIBLE_PER_DAY).map((appointment) => (
                  <AppointmentChip
                    key={appointment.id}
                    appointment={appointment}
                    onClick={() => onSelect(appointment)}
                  />
                ))}
                {dayAppointments.length > MAX_VISIBLE_PER_DAY ? (
                  <span className="px-1.5 text-[11px] font-medium text-muted-foreground">
                    +{dayAppointments.length - MAX_VISIBLE_PER_DAY} more
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

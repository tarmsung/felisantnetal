import { cn } from "@/lib/utils";
import { formatClinicTime } from "@/lib/dates";
import type { AppointmentListRow } from "@/lib/services/appointmentService";
import type { AppointmentStatus } from "@/types/database";

const DOT_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: "bg-info",
  completed: "bg-success",
  missed: "bg-destructive",
  cancelled: "bg-muted-foreground",
  rescheduled: "bg-warning",
};

/**
 * Compact month-view chip. The colored dot is a glanceable secondary
 * signal only — the status is always in the accessible name (via
 * `title`) too, never color-only (spec section 8).
 */
export function AppointmentChip({
  appointment,
  onClick,
}: {
  appointment: AppointmentListRow;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${appointment.patient_full_name} — ${appointment.status}`}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-tight hover:bg-muted",
        appointment.status === "cancelled" && "opacity-60 line-through",
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASSES[appointment.status])} />
      <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
        {formatClinicTime(appointment.scheduled_date)}
      </span>
      <span className="truncate">{appointment.patient_full_name}</span>
    </button>
  );
}

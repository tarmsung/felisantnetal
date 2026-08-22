import { StatusBadge } from "@/components/shared/status-badge";
import type { AppointmentStatus } from "@/types/database";

const CONFIG: Record<AppointmentStatus, { label: string; tone: "info" | "success" | "warning" | "default" | "destructive" }> = {
  scheduled: { label: "Scheduled", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  missed: { label: "Missed", tone: "destructive" },
  cancelled: { label: "Cancelled", tone: "default" },
  rescheduled: { label: "Rescheduled", tone: "warning" },
};

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const config = CONFIG[status];
  return <StatusBadge label={config.label} tone={config.tone} className={className} />;
}

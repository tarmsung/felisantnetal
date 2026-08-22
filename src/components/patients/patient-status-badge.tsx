import { StatusBadge } from "@/components/shared/status-badge";
import type { PatientStatus } from "@/types/database";

const CONFIG: Record<PatientStatus, { label: string; tone: "success" | "default" | "info" }> = {
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "default" },
  transferred: { label: "Transferred", tone: "info" },
};

export function PatientStatusBadge({ status }: { status: PatientStatus }) {
  const config = CONFIG[status];
  return <StatusBadge label={config.label} tone={config.tone} />;
}

import { StatusBadge } from "@/components/shared/status-badge";
import type { UserRole } from "@/types/database";

export function UserRoleBadge({ role }: { role: UserRole }) {
  return role === "administrator" ? (
    <StatusBadge label="Administrator" tone="info" />
  ) : (
    <StatusBadge label="Nurse" tone="default" />
  );
}

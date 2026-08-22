import { EmptyState } from "@/components/shared/empty-state";
import { ScrollText } from "lucide-react";
import type { AuditLogEntry } from "@/lib/services/auditService";

const ACTION_LABELS: Record<string, string> = {
  "patient.create": "Patient registered",
  "patient.update": "Patient details updated",
};

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PatientAuditHistory({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="No changes recorded yet"
        description="Every create and edit to this patient's record will appear here, permanently."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              {ACTION_LABELS[entry.action] ?? entry.action}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(entry.created_at)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">By {entry.actor_name}</span>
          {entry.new_values ? (
            <pre className="mt-1 overflow-x-auto rounded-md bg-muted/60 p-2 text-[11px] text-muted-foreground">
              {JSON.stringify(entry.new_values, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { formatClinicDateTime } from "@/lib/dates";
import type { AuditLogEntry } from "@/lib/services/auditService";

function DiffTable({ oldValues, newValues }: { oldValues: Record<string, unknown> | null; newValues: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})]));
  if (keys.length === 0) return <p className="text-sm text-muted-foreground">No field-level detail recorded.</p>;

  return (
    <div className="flex flex-col gap-2">
      {keys.map((key) => (
        <div key={key} className="rounded-lg border border-border p-2.5 text-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{key}</p>
          <div className="flex flex-col gap-1">
            {oldValues && key in oldValues ? (
              <p className="text-destructive/80 line-through">{JSON.stringify(oldValues[key])}</p>
            ) : null}
            {newValues && key in newValues ? <p className="text-foreground">{JSON.stringify(newValues[key])}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AuditLogDetailSheet({
  entry,
  open,
  onOpenChange,
}: {
  entry: AuditLogEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!entry) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-5 overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{entry.action}</SheetTitle>
          <SheetDescription>{formatClinicDateTime(entry.created_at)}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">By</dt>
            <dd>{entry.actor_name}</dd>
            <dt className="text-muted-foreground">Record type</dt>
            <dd>{entry.entity_type}</dd>
            {entry.entity_id ? (
              <>
                <dt className="text-muted-foreground">Record ID</dt>
                <dd className="break-all font-mono text-xs">{entry.entity_id}</dd>
              </>
            ) : null}
            {entry.ip_address ? (
              <>
                <dt className="text-muted-foreground">IP address</dt>
                <dd>{entry.ip_address}</dd>
              </>
            ) : null}
          </dl>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              What changed
            </p>
            <DiffTable oldValues={entry.old_values} newValues={entry.new_values} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

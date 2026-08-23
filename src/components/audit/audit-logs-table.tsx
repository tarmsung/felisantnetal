"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditLogDetailSheet } from "@/components/audit/audit-log-detail-sheet";
import { formatClinicDateTime } from "@/lib/dates";
import type { AuditLogEntry } from "@/lib/services/auditService";

export function AuditLogsTable({ entries }: { entries: AuditLogEntry[] }) {
  // Derived by id from `entries` — same pattern as every other
  // click-a-row-to-open-a-sheet list in this app (see Phase 3's
  // appointment-calendar.tsx comment for why).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selected = entries.find((e) => e.id === selectedId) ?? null;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>By</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Record type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedId(entry.id);
                  setOpen(true);
                }}
              >
                <TableCell className="text-muted-foreground">{formatClinicDateTime(entry.created_at)}</TableCell>
                <TableCell>{entry.actor_name}</TableCell>
                <TableCell className="font-medium">{entry.action}</TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {entry.entity_type.replace(/_/g, " ")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AuditLogDetailSheet entry={selected} open={open} onOpenChange={setOpen} />
    </>
  );
}

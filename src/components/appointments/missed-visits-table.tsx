"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RiskBadge } from "@/components/shared/risk-badge";
import { AppointmentDetailSheet } from "@/components/appointments/appointment-detail-sheet";
import { formatDisplayDate } from "@/lib/dates";
import type { MissedAppointmentRow } from "@/lib/services/appointmentService";

export function MissedVisitsTable({ rows }: { rows: MissedAppointmentRow[] }) {
  const router = useRouter();
  // Derived from `rows` by id (see appointment-calendar.tsx's comment)
  // rather than a stored copy — once resolved (completed/rescheduled/
  // cancelled), a row drops out of this list on refresh and the sheet
  // naturally has nothing left to show instead of displaying stale data.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Visit</TableHead>
              <TableHead>Originally scheduled</TableHead>
              <TableHead>Days overdue</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>CHW</TableHead>
              <TableHead className="text-right">Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedId(row.id);
                  setOpen(true);
                }}
              >
                <TableCell>
                  <span className="flex flex-col">
                    <span className="font-medium">{row.patient_full_name}</span>
                    <span className="text-xs text-muted-foreground">{row.patient_number}</span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.patient_phone ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.visit_number ? `Visit ${row.visit_number}` : row.appointment_type}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDisplayDate(row.scheduled_date)}
                </TableCell>
                <TableCell className="font-medium text-warning">
                  {row.daysOverdue} day{row.daysOverdue === 1 ? "" : "s"}
                </TableCell>
                <TableCell>
                  <RiskBadge status={row.patient_risk_status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.community_health_worker_name ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {row.patient_phone ? (
                    <Button
                      variant="outline"
                      size="icon-sm"
                      render={<a href={`tel:${row.patient_phone}`} onClick={(e) => e.stopPropagation()} />}
                      nativeButton={false}
                      aria-label={`Call ${row.patient_full_name}`}
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AppointmentDetailSheet
        appointment={selected}
        open={open}
        onOpenChange={setOpen}
        onChanged={() => router.refresh()}
      />
    </>
  );
}

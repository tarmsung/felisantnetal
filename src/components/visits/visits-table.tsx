"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VisitDetailSheet } from "@/components/visits/visit-detail-sheet";
import { formatDisplayDate } from "@/lib/dates";
import type { ClinicalVisitListRow } from "@/lib/services/clinicalVisitService";

export function VisitsTable({ rows, isAdmin }: { rows: ClinicalVisitListRow[]; isAdmin: boolean }) {
  const router = useRouter();
  // Derived by id from the (server-refreshed) `rows` prop, not a stored
  // copy — see appointment-calendar.tsx's comment (Phase 3) for why.
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
              <TableHead>Visit</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>BP</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Recorded by</TableHead>
              <TableHead>Risk</TableHead>
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
                  <Link
                    href={`/patients/${row.patient_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-col hover:underline"
                  >
                    <span className="font-medium">{row.patient_full_name}</span>
                    <span className="text-xs text-muted-foreground">{row.patient_number}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">Visit {row.visit_number}</TableCell>
                <TableCell className="text-muted-foreground">{formatDisplayDate(row.visit_date)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.blood_pressure_systolic != null && row.blood_pressure_diastolic != null
                    ? `${row.blood_pressure_systolic}/${row.blood_pressure_diastolic}`
                    : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.weight_kg != null ? `${row.weight_kg} kg` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.recorded_by_name}</TableCell>
                <TableCell>
                  {row.risk_flag ? (
                    <span className="text-xs font-semibold text-destructive">Flagged</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <VisitDetailSheet
        visit={selected}
        open={open}
        onOpenChange={setOpen}
        onChanged={() => router.refresh()}
        isAdmin={isAdmin}
      />
    </>
  );
}

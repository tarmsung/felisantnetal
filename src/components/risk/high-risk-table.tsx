"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import { SeverityBadge } from "@/components/shared/severity-badge";
import { RiskFlagItem } from "@/components/risk/risk-flag-item";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { listRiskFlagsForPatientAction } from "@/app/(app)/high-risk/actions";
import { formatClinicDateTime } from "@/lib/dates";
import type { HighRiskPatientRow } from "@/lib/services/riskService";
import type { RiskFlagRow } from "@/types/database";

interface SelectedPatient {
  patientId: string;
  patientFullName: string;
  patientNumber: string;
}

export function HighRiskTable({ rows }: { rows: HighRiskPatientRow[] }) {
  const router = useRouter();
  // Deliberately NOT derived from `rows` by id (unlike Phase 3's
  // pattern elsewhere): resolving a patient's last active flag makes
  // them drop out of `rows` entirely on refresh (they're no longer
  // high-risk), which is the expected, successful outcome here — not
  // staleness to guard against. Captured directly at click time so the
  // sheet's header keeps showing who it's about after that refresh.
  const [selected, setSelected] = useState<SelectedPatient | null>(null);
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState<RiskFlagRow[] | null>(null);

  function loadFlags(patientId: string) {
    listRiskFlagsForPatientAction(patientId).then((result) =>
      setFlags(result.filter((f) => f.status === "active")),
    );
  }

  useEffect(() => {
    if (!selected || !open) return;
    let cancelled = false;
    listRiskFlagsForPatientAction(selected.patientId).then((result) => {
      if (!cancelled) setFlags(result.filter((f) => f.status === "active"));
    });
    return () => {
      cancelled = true;
    };
  }, [selected, open]);

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>CHW</TableHead>
              <TableHead>Active flags</TableHead>
              <TableHead>Highest severity</TableHead>
              <TableHead>Latest reason</TableHead>
              <TableHead>Flagged</TableHead>
              <TableHead className="text-right">Contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.patientId}
                className="cursor-pointer"
                onClick={() => {
                  setFlags(null);
                  setSelected({
                    patientId: row.patientId,
                    patientFullName: row.patientFullName,
                    patientNumber: row.patientNumber,
                  });
                  setOpen(true);
                }}
              >
                <TableCell>
                  <Link
                    href={`/patients/${row.patientId}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex flex-col hover:underline"
                  >
                    <span className="font-medium">{row.patientFullName}</span>
                    <span className="text-xs text-muted-foreground">{row.patientNumber}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.patientPhone ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.communityHealthWorkerName ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.activeFlagCount}</TableCell>
                <TableCell>
                  <SeverityBadge severity={row.highestSeverity} />
                </TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">{row.latestReason}</TableCell>
                <TableCell className="text-muted-foreground">{formatClinicDateTime(row.latestFlaggedAt)}</TableCell>
                <TableCell className="text-right">
                  {row.patientPhone ? (
                    <Button
                      variant="outline"
                      size="icon-sm"
                      render={<a href={`tel:${row.patientPhone}`} onClick={(e) => e.stopPropagation()} />}
                      nativeButton={false}
                      aria-label={`Call ${row.patientFullName}`}
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex flex-col gap-4 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{selected?.patientFullName}</SheetTitle>
            <SheetDescription>{selected?.patientNumber} · Active risk flags</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4">
            {flags === null ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : flags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No more active risk flags for this patient.</p>
            ) : (
              flags.map((flag) => (
                <RiskFlagItem
                  key={flag.id}
                  flag={flag}
                  patientId={selected?.patientId ?? ""}
                  onChanged={() => {
                    router.refresh();
                    if (selected) loadFlags(selected.patientId);
                  }}
                />
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

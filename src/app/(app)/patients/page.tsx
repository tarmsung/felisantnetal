import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus, Users2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { searchPatients } from "@/lib/services/patientService";
import { Button } from "@/components/ui/button";
import { PatientSearchBar } from "@/components/patients/patient-search-bar";
import { PatientStatusBadge } from "@/components/patients/patient-status-badge";
import { RiskBadge } from "@/components/shared/risk-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SimplePagination } from "@/components/shared/simple-pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireUser();
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const { rows, total, pageSize } = await searchPatients({ query: q, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function buildHref(nextPage: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("page", String(nextPage));
    return `/patients?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PatientSearchBar />
        <Button render={<Link href="/patients/new" />} nativeButton={false}>
          <UserPlus className="h-4 w-4" />
          Register patient
        </Button>
      </div>

      {total === 0 ? (
        <EmptyState
          icon={Users2}
          title={q ? `No patients match "${q}"` : "No patients registered yet"}
          description={
            q
              ? "Try a different patient number, name, national ID, or phone number."
              : "Register the clinic's first ANC patient to get started."
          }
          action={
            !q ? (
              <Button
                render={<Link href="/patients/new" />}
                nativeButton={false}
                variant="outline"
              >
                Register patient
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>CHW</TableHead>
                  <TableHead>EDD</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((patient) => (
                  <TableRow key={patient.id} className="cursor-pointer">
                    <TableCell>
                      <Link
                        href={`/patients/${patient.id}`}
                        className="flex flex-col hover:underline"
                      >
                        <span className="font-medium text-foreground">
                          {patient.full_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {patient.patient_number}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.phone ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {patient.community_health_worker_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDisplayDate(patient.edd)}
                    </TableCell>
                    <TableCell>
                      <RiskBadge status={patient.risk_status} />
                    </TableCell>
                    <TableCell>
                      <PatientStatusBadge status={patient.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <SimplePagination page={page} totalPages={totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}

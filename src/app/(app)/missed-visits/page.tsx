import type { Metadata } from "next";
import { CalendarCheck2 } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listMissedAppointments } from "@/lib/services/appointmentService";
import { MissedVisitsTable } from "@/components/appointments/missed-visits-table";
import { MissedVisitsFilters } from "@/components/appointments/missed-visits-filters";
import { EmptyState } from "@/components/shared/empty-state";
import type { RiskStatus } from "@/types/database";

export const metadata: Metadata = { title: "Missed Visits" };

export default async function MissedVisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ minDays?: string; risk?: string }>;
}) {
  await requireUser();
  const { minDays, risk } = await searchParams;

  const rows = await listMissedAppointments({
    minDaysOverdue: minDays ? Number(minDays) : undefined,
    riskStatus: risk === "high_risk" || risk === "normal" ? (risk as RiskStatus) : undefined,
  });

  return (
    <div className="flex flex-col gap-5">
      <MissedVisitsFilters />

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarCheck2}
          title="No missed appointments"
          description="Everything scheduled so far has been kept, cancelled properly, or hasn't come due yet."
        />
      ) : (
        <MissedVisitsTable rows={rows} />
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { Stethoscope } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listRecentVisits } from "@/lib/services/clinicalVisitService";
import { RecordVisitDialog } from "@/components/visits/record-visit-dialog";
import { VisitsTable } from "@/components/visits/visits-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SimplePagination } from "@/components/shared/simple-pagination";

export const metadata: Metadata = { title: "ANC Visits" };

export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const { rows, total, pageSize } = await listRecentVisits(page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Every clinical visit recorded across the clinic, most recent first.
          </p>
        </div>
        <RecordVisitDialog />
      </div>

      {total === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="No ANC visits recorded yet"
          description="Record a patient's first clinical visit to get started."
        />
      ) : (
        <>
          <VisitsTable rows={rows} isAdmin={user.role === "administrator"} />
          <SimplePagination
            page={page}
            totalPages={totalPages}
            buildHref={(nextPage) => `/visits?page=${nextPage}`}
          />
        </>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { listAuditLogs, listAuditLogEntityTypes } from "@/lib/services/auditService";
import { todayKey, getDayRange } from "@/lib/calendar";
import { resolveReportRange, REPORT_RANGE_PRESETS, type ReportRangePreset } from "@/lib/reportRange";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { AuditEntityTypeFilter } from "@/components/audit/audit-entity-type-filter";
import { AuditLogsTable } from "@/components/audit/audit-logs-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SimplePagination } from "@/components/shared/simple-pagination";
import { formatDisplayDate } from "@/lib/dates";
import { ScrollText } from "lucide-react";

export const metadata: Metadata = { title: "Audit Logs" };

const AUDIT_RANGE_PRESETS = [{ value: "all", label: "All time" }, ...REPORT_RANGE_PRESETS];

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    entityType?: string;
    preset?: string;
    start?: string;
    end?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  // "All time" (no preset picked yet) is the natural default for an
  // audit trail, unlike Reports' "last 30 days" — an administrator
  // investigating something is just as likely to be looking for last
  // month's change as this week's. Only resolve a range once a preset
  // is actually chosen.
  const range = params.preset
    ? resolveReportRange(todayKey(), (params.preset as ReportRangePreset) ?? "30d", params.start, params.end)
    : null;

  const [entityTypes, result] = await Promise.all([
    listAuditLogEntityTypes(),
    listAuditLogs(
      {
        entityType: params.entityType,
        startIso: range ? getDayRange(range.startKey).startIso : undefined,
        endIso: range ? getDayRange(range.endKey).endIso : undefined,
      },
      page,
    ),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  function buildHref(nextPage: number) {
    const query = new URLSearchParams();
    if (params.entityType) query.set("entityType", params.entityType);
    if (params.preset) query.set("preset", params.preset);
    if (params.start) query.set("start", params.start);
    if (params.end) query.set("end", params.end);
    query.set("page", String(nextPage));
    return `/audit-logs?${query.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Every create/update across the system (spec section 25) — administrator-only. Deletions
        never appear here because the database doesn&apos;t allow them (migration 0007).
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <AuditEntityTypeFilter entityTypes={entityTypes} />
        <DateRangeFilter presets={AUDIT_RANGE_PRESETS} defaultPreset="all" defaultLabel="All time" />
      </div>
      {range ? (
        <p className="text-xs text-muted-foreground">
          Showing {range.label.toLowerCase()} ({formatDisplayDate(range.startKey)} – {formatDisplayDate(range.endKey)})
        </p>
      ) : null}

      {result.rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No matching audit log entries" />
      ) : (
        <>
          <AuditLogsTable entries={result.rows} />
          <SimplePagination page={result.page} totalPages={totalPages} buildHref={buildHref} />
        </>
      )}
    </div>
  );
}

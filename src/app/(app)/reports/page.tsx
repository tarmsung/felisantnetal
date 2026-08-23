import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { todayKey } from "@/lib/calendar";
import { resolveReportRange, type ReportRangePreset } from "@/lib/reportRange";
import {
  getAttendanceReport,
  getMissedVisitReport,
  getHighRiskReport,
  getPatientSummaryReport,
} from "@/lib/services/reportService";
import { ReportTypeNav } from "@/components/reports/report-type-nav";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { AttendanceTrendChart } from "@/components/reports/attendance-trend-chart";
import { StatusBreakdownChart } from "@/components/reports/status-breakdown-chart";
import { RiskSeverityChart } from "@/components/reports/risk-severity-chart";
import { RegistrationTrendChart } from "@/components/reports/registration-trend-chart";
import { ExportCsvButton } from "@/components/reports/export-csv-button";
import { ExportPdfButton } from "@/components/reports/export-pdf-button";
import { MetricCard } from "@/components/shared/metric-card";
import { EmptyState } from "@/components/shared/empty-state";
import { SeverityBadge } from "@/components/shared/severity-badge";
import { RiskBadge } from "@/components/shared/risk-badge";
import { PatientStatusBadge } from "@/components/patients/patient-status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDisplayDate, formatClinicDateTime } from "@/lib/dates";
import {
  CalendarClock,
  CalendarX2,
  AlertTriangle,
  Users2,
  Gauge,
} from "lucide-react";

export const metadata: Metadata = { title: "Reports" };

const REPORT_TYPE_KEYS = ["attendance", "missed", "high-risk", "patients"] as const;
type ReportType = (typeof REPORT_TYPE_KEYS)[number];

function isReportType(value: string | undefined): value is ReportType {
  return REPORT_TYPE_KEYS.includes(value as ReportType);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; preset?: string; start?: string; end?: string }>;
}) {
  await requireUser();
  const params = await searchParams;
  const type: ReportType = isReportType(params.type) ? params.type : "attendance";
  const range = resolveReportRange(
    todayKey(),
    (params.preset as ReportRangePreset) ?? "30d",
    params.start,
    params.end,
  );

  const exportParams = new URLSearchParams({ type, preset: range.preset });
  if (range.preset === "custom") {
    exportParams.set("start", range.startKey);
    exportParams.set("end", range.endKey);
  }
  const pdfHref = `/reports/export?${exportParams.toString()}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ReportTypeNav activeType={type} />
        <DateRangeFilter />
      </div>
      <p className="text-xs text-muted-foreground">
        Showing {range.label.toLowerCase()} ({formatDisplayDate(range.startKey)} – {formatDisplayDate(range.endKey)})
      </p>

      {type === "attendance" ? (
        <AttendanceReportSection startKey={range.startKey} endKey={range.endKey} pdfHref={pdfHref} />
      ) : null}
      {type === "missed" ? (
        <MissedVisitReportSection startKey={range.startKey} endKey={range.endKey} pdfHref={pdfHref} />
      ) : null}
      {type === "high-risk" ? (
        <HighRiskReportSection startKey={range.startKey} endKey={range.endKey} pdfHref={pdfHref} />
      ) : null}
      {type === "patients" ? (
        <PatientSummaryReportSection startKey={range.startKey} endKey={range.endKey} pdfHref={pdfHref} />
      ) : null}
    </div>
  );
}

async function AttendanceReportSection({
  startKey,
  endKey,
  pdfHref,
}: {
  startKey: string;
  endKey: string;
  pdfHref: string;
}) {
  const report = await getAttendanceReport(startKey, endKey);
  const csvRows = report.trend.map((p) => ({
    period: p.label,
    scheduled: p.scheduled,
    completed: p.completed,
    missed: p.missed,
    cancelled: p.cancelled,
    rescheduled: p.rescheduled,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total Appointments" value={report.summary.total} icon={CalendarClock} />
        <MetricCard label="Completed" value={report.summary.completed} icon={Gauge} tone="success" />
        <MetricCard
          label="Missed"
          value={report.summary.missed}
          icon={CalendarX2}
          tone={report.summary.missed > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Adherence Rate"
          value={report.summary.adherenceRate === null ? "—" : `${report.summary.adherenceRate}%`}
          icon={Gauge}
          note={report.summary.adherenceRate === null ? "No completed or missed appointments yet" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Attendance trend</CardTitle>
            <div className="flex gap-2">
              <ExportCsvButton filename="attendance-trend.csv" rows={csvRows} />
              <ExportPdfButton href={pdfHref} />
            </div>
          </CardHeader>
          <CardContent>
            <AttendanceTrendChart data={report.trend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdownChart data={report.statusBreakdown} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function MissedVisitReportSection({
  startKey,
  endKey,
  pdfHref,
}: {
  startKey: string;
  endKey: string;
  pdfHref: string;
}) {
  const report = await getMissedVisitReport(startKey, endKey);
  const csvRows = report.rows.map((r) => ({
    patient: r.patient_full_name,
    patient_number: r.patient_number,
    phone: r.patient_phone ?? "",
    originally_scheduled: r.scheduled_date,
    days_overdue: r.daysOverdue,
    chw: r.community_health_worker_name ?? "Unassigned",
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Missed Visits"
          value={report.totalMissed}
          icon={CalendarX2}
          tone={report.totalMissed > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Average Days Overdue"
          value={report.avgDaysOverdue ?? "—"}
          icon={CalendarClock}
        />
        <MetricCard label="Community Health Workers Involved" value={report.byChw.length} icon={Users2} />
      </div>

      {report.rows.length === 0 ? (
        <EmptyState icon={CalendarX2} title="No missed visits in this range" />
      ) : (
        <>
          <div className="flex items-center justify-end gap-2">
            <ExportCsvButton filename="missed-visits.csv" rows={csvRows} />
            <ExportPdfButton href={pdfHref} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Originally scheduled</TableHead>
                  <TableHead>Days overdue</TableHead>
                  <TableHead>CHW</TableHead>
                  <TableHead>Risk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link href={`/patients/${row.patient_id}`} className="flex flex-col hover:underline">
                        <span className="font-medium">{row.patient_full_name}</span>
                        <span className="text-xs text-muted-foreground">{row.patient_number}</span>
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDisplayDate(row.scheduled_date)}</TableCell>
                    <TableCell className="font-medium text-warning">{row.daysOverdue}</TableCell>
                    <TableCell className="text-muted-foreground">{row.community_health_worker_name ?? "—"}</TableCell>
                    <TableCell>
                      <RiskBadge status={row.patient_risk_status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

async function HighRiskReportSection({
  startKey,
  endKey,
  pdfHref,
}: {
  startKey: string;
  endKey: string;
  pdfHref: string;
}) {
  const report = await getHighRiskReport(startKey, endKey);
  const csvRows = report.rows.map((r) => ({
    patient: r.patientFullName,
    patient_number: r.patientNumber,
    severity: r.severity,
    reason: r.reason,
    status: r.status,
    raised_at: r.createdAt,
    resolved_at: r.resolvedAt ?? "",
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard
          label="Flags Raised"
          value={report.flagsRaisedInRange}
          icon={AlertTriangle}
          tone={report.flagsRaisedInRange > 0 ? "destructive" : "default"}
        />
        <MetricCard label="Resolved" value={report.resolvedInRange} icon={Gauge} tone="success" />
        <MetricCard
          label="Avg. Days to Resolve"
          value={report.avgResolutionDays ?? "—"}
          icon={CalendarClock}
        />
        <MetricCard
          label="Currently Active"
          value={report.activeBySeverity.reduce((sum, s) => sum + s.count, 0)}
          icon={AlertTriangle}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active flags by severity (current snapshot)</CardTitle>
        </CardHeader>
        <CardContent>
          <RiskSeverityChart data={report.activeBySeverity} />
        </CardContent>
      </Card>

      {report.rows.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No risk flags raised in this range" />
      ) : (
        <>
          <div className="flex items-center justify-end gap-2">
            <ExportCsvButton filename="high-risk-flags.csv" rows={csvRows} />
            <ExportPdfButton href={pdfHref} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Raised</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {row.patientFullName}
                      <span className="block text-xs font-normal text-muted-foreground">{row.patientNumber}</span>
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={row.severity} />
                    </TableCell>
                    <TableCell className="max-w-sm truncate text-muted-foreground">{row.reason}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{row.status}</TableCell>
                    <TableCell className="text-muted-foreground">{formatClinicDateTime(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

async function PatientSummaryReportSection({
  startKey,
  endKey,
  pdfHref,
}: {
  startKey: string;
  endKey: string;
  pdfHref: string;
}) {
  const report = await getPatientSummaryReport(startKey, endKey);
  const csvRows = report.rows.map((r) => ({
    patient: r.fullName,
    patient_number: r.patientNumber,
    registered: r.registrationDate,
    status: r.status,
    risk_status: r.riskStatus,
    chw: r.chwName ?? "Unassigned",
  }));
  const highRiskCount = report.byRisk.find((r) => r.status === "high_risk")?.count ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="New Registrations" value={report.totalRegistered} icon={Users2} />
        <MetricCard
          label="Active"
          value={report.byStatus.find((s) => s.status === "active")?.count ?? 0}
          icon={Users2}
          tone="success"
        />
        <MetricCard
          label="High Risk"
          value={highRiskCount}
          icon={AlertTriangle}
          tone={highRiskCount > 0 ? "destructive" : "default"}
        />
        <MetricCard label="Community Health Workers" value={report.byChw.length} icon={Users2} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registration trend</CardTitle>
        </CardHeader>
        <CardContent>
          <RegistrationTrendChart data={report.registrationTrend.trend} />
        </CardContent>
      </Card>

      {report.rows.length === 0 ? (
        <EmptyState icon={Users2} title="No patients registered in this range" />
      ) : (
        <>
          <div className="flex items-center justify-end gap-2">
            <ExportCsvButton filename="patient-summary.csv" rows={csvRows} />
            <ExportPdfButton href={pdfHref} />
          </div>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>CHW</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {row.fullName}
                      <span className="block text-xs font-normal text-muted-foreground">{row.patientNumber}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDisplayDate(row.registrationDate)}</TableCell>
                    <TableCell>
                      <PatientStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell>
                      <RiskBadge status={row.riskStatus} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.chwName ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

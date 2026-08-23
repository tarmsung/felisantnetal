import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { getPatientById, getLatestPregnancy, getCommunityHealthWorkerName } from "@/lib/services/patientService";
import { listVisitsForPatient } from "@/lib/services/clinicalVisitService";
import { listAppointmentsForPatient } from "@/lib/services/appointmentService";
import { getClinicSettings } from "@/lib/services/settingsService";
import {
  getAttendanceReport,
  getMissedVisitReport,
  getHighRiskReport,
  getPatientSummaryReport,
} from "@/lib/services/reportService";
import { formatDisplayDate, formatClinicDateTime } from "@/lib/dates";
import { PatientCardDocument } from "@/lib/pdf/PatientCardDocument";
import { ReportDocument, type ReportPdfData } from "@/lib/pdf/ReportDocument";

/**
 * Phase 7 (spec section 43): PDF generation — the patient ANC card and
 * printable versions of the four Reports-page reports — using
 * @react-pdf/renderer (installed since Phase 1). Every template lives
 * in lib/pdf/ as plain components built from @react-pdf/renderer's own
 * primitives (Document/Page/View/Text), not the app's regular
 * Tailwind/DOM components — the two component sets render to
 * completely different targets and can't be mixed. This file is the
 * only place that touches @react-pdf/renderer's `renderToBuffer`; the
 * route handlers in app/(app)/.../route.ts just call these functions
 * and stream the result. `.tsx` (not `.ts`) because it renders JSX
 * directly into `renderToBuffer`. Clinic settings now live in
 * settingsService.ts (Phase 8, which also builds the admin UI to edit
 * them) — this file just consumes it.
 */

export async function generatePatientCardPdf(
  patientId: string,
  generatedByName: string,
): Promise<Buffer> {
  const patient = await getPatientById(patientId);
  if (!patient) throw new Error("Patient not found.");

  const [clinicSettings, pregnancy, visits, appointments] = await Promise.all([
    getClinicSettings(),
    getLatestPregnancy(patientId),
    listVisitsForPatient(patientId),
    listAppointmentsForPatient(patientId),
  ]);
  const chwName = await getCommunityHealthWorkerName(patient.community_health_worker_id);

  const nextAppointment = appointments
    .filter((a) => a.status === "scheduled")
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0];

  return renderToBuffer(
    <PatientCardDocument
      clinicSettings={clinicSettings}
      patient={patient}
      pregnancy={pregnancy}
      chwName={chwName}
      visits={visits}
      nextAppointmentDate={nextAppointment?.scheduled_date ?? null}
      generatedAtIso={new Date().toISOString()}
      generatedByName={generatedByName}
    />,
  );
}

export type ReportPdfType = "attendance" | "missed" | "high-risk" | "patients";

/** Cap on printed rows — a PDF with thousands of table rows stops being a usable printout; the CSV export (Phase 6) is the right tool for the full dataset. Never a silent cap: ReportDocument prints a "showing first N of M" note whenever this actually trims something. */
const MAX_REPORT_PDF_ROWS = 300;

export async function generateReportPdf(
  type: ReportPdfType,
  startKey: string,
  endKey: string,
  rangeLabel: string,
  generatedByName: string,
): Promise<Buffer> {
  const clinicSettings = await getClinicSettings();
  const generatedAtIso = new Date().toISOString();
  const base = { clinicSettings, rangeLabel, generatedAtIso, generatedByName };

  const data = await buildReportPdfData(type, startKey, endKey);
  const doc: ReportPdfData = { ...base, ...data };
  return renderToBuffer(<ReportDocument {...doc} />);
}

async function buildReportPdfData(
  type: ReportPdfType,
  startKey: string,
  endKey: string,
): Promise<Pick<ReportPdfData, "reportTitle" | "metrics" | "tableHeaders" | "tableColumnWidths" | "tableRows" | "totalRowCount">> {
  if (type === "attendance") {
    const report = await getAttendanceReport(startKey, endKey);
    return {
      reportTitle: "Attendance Report",
      metrics: [
        { label: "Total Appointments", value: String(report.summary.total) },
        { label: "Completed", value: String(report.summary.completed) },
        { label: "Missed", value: String(report.summary.missed) },
        {
          label: "Adherence Rate",
          value: report.summary.adherenceRate === null ? "—" : `${report.summary.adherenceRate}%`,
        },
      ],
      tableHeaders: ["Period", "Scheduled", "Completed", "Missed", "Cancelled", "Rescheduled"],
      tableColumnWidths: [22, 15.5, 15.5, 15.5, 15.5, 16],
      tableRows: report.trend
        .slice(0, MAX_REPORT_PDF_ROWS)
        .map((p) => [p.label, String(p.scheduled), String(p.completed), String(p.missed), String(p.cancelled), String(p.rescheduled)]),
      totalRowCount: report.trend.length,
    };
  }

  if (type === "missed") {
    const report = await getMissedVisitReport(startKey, endKey);
    return {
      reportTitle: "Missed Visits Report",
      metrics: [
        { label: "Missed Visits", value: String(report.totalMissed) },
        { label: "Avg. Days Overdue", value: report.avgDaysOverdue == null ? "—" : String(report.avgDaysOverdue) },
        { label: "CHWs Involved", value: String(report.byChw.length) },
      ],
      tableHeaders: ["Patient", "Originally Scheduled", "Days Overdue", "CHW", "Risk"],
      tableColumnWidths: [30, 20, 15, 20, 15],
      tableRows: report.rows.slice(0, MAX_REPORT_PDF_ROWS).map((r) => [
        `${r.patient_full_name} (${r.patient_number})`,
        formatDisplayDate(r.scheduled_date),
        String(r.daysOverdue),
        r.community_health_worker_name ?? "Unassigned",
        r.patient_risk_status === "high_risk" ? "High risk" : "Normal",
      ]),
      totalRowCount: report.rows.length,
    };
  }

  if (type === "high-risk") {
    const report = await getHighRiskReport(startKey, endKey);
    return {
      reportTitle: "High Risk Report",
      metrics: [
        { label: "Flags Raised", value: String(report.flagsRaisedInRange) },
        { label: "Resolved", value: String(report.resolvedInRange) },
        { label: "Avg. Days to Resolve", value: report.avgResolutionDays == null ? "—" : String(report.avgResolutionDays) },
        { label: "Currently Active", value: String(report.activeBySeverity.reduce((sum, s) => sum + s.count, 0)) },
      ],
      tableHeaders: ["Patient", "Severity", "Reason", "Status", "Raised"],
      tableColumnWidths: [20, 12, 36, 12, 20],
      tableRows: report.rows.slice(0, MAX_REPORT_PDF_ROWS).map((r) => [
        `${r.patientFullName} (${r.patientNumber})`,
        r.severity,
        r.reason,
        r.status,
        formatClinicDateTime(r.createdAt),
      ]),
      totalRowCount: report.rows.length,
    };
  }

  const report = await getPatientSummaryReport(startKey, endKey);
  return {
    reportTitle: "Patient Summary Report",
    metrics: [
      { label: "New Registrations", value: String(report.totalRegistered) },
      { label: "Active", value: String(report.byStatus.find((s) => s.status === "active")?.count ?? 0) },
      { label: "High Risk", value: String(report.byRisk.find((r) => r.status === "high_risk")?.count ?? 0) },
      { label: "CHWs", value: String(report.byChw.length) },
    ],
    tableHeaders: ["Patient", "Registered", "Status", "Risk", "CHW"],
    tableColumnWidths: [28, 18, 16, 16, 22],
    tableRows: report.rows.slice(0, MAX_REPORT_PDF_ROWS).map((r) => [
      `${r.fullName} (${r.patientNumber})`,
      formatDisplayDate(r.registrationDate),
      r.status,
      r.riskStatus === "high_risk" ? "High risk" : "Normal",
      r.chwName ?? "Unassigned",
    ]),
    totalRowCount: report.rows.length,
  };
}

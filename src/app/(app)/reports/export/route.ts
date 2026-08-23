import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { todayKey } from "@/lib/calendar";
import { resolveReportRange, type ReportRangePreset } from "@/lib/reportRange";
import { generateReportPdf, type ReportPdfType } from "@/lib/services/pdfService";
import { formatDisplayDate } from "@/lib/dates";

export const runtime = "nodejs";

const VALID_TYPES: ReportPdfType[] = ["attendance", "missed", "high-risk", "patients"];
const REPORT_FILENAMES: Record<ReportPdfType, string> = {
  attendance: "attendance-report.pdf",
  missed: "missed-visits-report.pdf",
  "high-risk": "high-risk-report.pdf",
  patients: "patient-summary-report.pdf",
};

/** Same type/preset/start/end params the Reports page itself uses (see app/(app)/reports/page.tsx) — this route just renders the identical range as a PDF instead of the on-screen view. */
export async function GET(request: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);

  const typeParam = searchParams.get("type");
  const type: ReportPdfType = VALID_TYPES.includes(typeParam as ReportPdfType)
    ? (typeParam as ReportPdfType)
    : "attendance";
  const preset = (searchParams.get("preset") as ReportRangePreset | null) ?? "30d";
  const start = searchParams.get("start") ?? undefined;
  const end = searchParams.get("end") ?? undefined;

  const range = resolveReportRange(todayKey(), preset, start, end);
  const rangeLabel = `${range.label} (${formatDisplayDate(range.startKey)} – ${formatDisplayDate(range.endKey)})`;

  const buffer = await generateReportPdf(type, range.startKey, range.endKey, rangeLabel, user.full_name);

  // NextResponse's BodyInit type doesn't accept a Node Buffer directly —
  // a plain Uint8Array view over the same bytes satisfies it with no copy.
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${REPORT_FILENAMES[type]}"`,
    },
  });
}

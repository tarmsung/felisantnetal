import { Document, Page, View, Text } from "@react-pdf/renderer";
import { sharedStyles as s } from "@/lib/pdf/styles";
import { formatDisplayDate, calculateAge } from "@/lib/dates";
import type { ClinicalVisitWithRecorder } from "@/lib/services/clinicalVisitService";
import type { ClinicSettingsRow, PatientRow, PregnancyRow } from "@/types/database";

export interface PatientCardData {
  clinicSettings: ClinicSettingsRow | null;
  patient: PatientRow;
  pregnancy: PregnancyRow | null;
  chwName: string | null;
  /** Every recorded visit — the template itself picks only the objective-vitals columns to print. */
  visits: ClinicalVisitWithRecorder[];
  nextAppointmentDate: string | null;
  generatedAtIso: string;
  generatedByName: string;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Text style={s.fieldValue}>{value || "—"}</Text>
    </View>
  );
}

/** Weeks of gestation as of `atIso`, from LMP alone — plain obstetric arithmetic, never invented (same rule ancService follows for scheduling suggestions). Null when LMP isn't on file. */
function gestationalWeeksAt(lmp: string | null, atIso: string): number | null {
  if (!lmp) return null;
  const lmpDate = new Date(`${lmp}T00:00:00Z`);
  const at = new Date(atIso);
  if (Number.isNaN(lmpDate.getTime()) || Number.isNaN(at.getTime())) return null;
  const days = Math.floor((at.getTime() - lmpDate.getTime()) / 86_400_000);
  return days >= 0 ? Math.floor(days / 7) : null;
}

/**
 * The patient's printable ANC card (spec section 16: "no unnecessary
 * sensitive detail"). Deliberately excludes `clinical_notes` (free-text
 * staff narrative) and risk_flags entirely (severity/reason are a
 * clinical judgement call for staff review, not something to hand a
 * patient on a card) — it prints exactly the objective measurements a
 * visit already produced (weight, BP, fundal height, FHR, Hb), the same
 * five fields the configurable risk-rules engine (riskService)
 * evaluates, and nothing about what those numbers might mean.
 */
export function PatientCardDocument({
  clinicSettings,
  patient,
  pregnancy,
  chwName,
  visits,
  nextAppointmentDate,
  generatedAtIso,
  generatedByName,
}: PatientCardData) {
  const age = calculateAge(patient.date_of_birth);
  const weeks = gestationalWeeksAt(pregnancy?.lmp ?? null, generatedAtIso);
  const sortedVisits = [...visits].sort((a, b) => a.visit_number - b.visit_number);

  return (
    <Document title={`${patient.full_name} - ANC Card`}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.clinicName}>{clinicSettings?.clinic_name ?? "Felis Clinic"}</Text>
            <Text style={s.clinicMeta}>{clinicSettings?.address ?? "Marondera, Zimbabwe"}</Text>
            {clinicSettings?.phone ? <Text style={s.clinicMeta}>{clinicSettings.phone}</Text> : null}
          </View>
          <View>
            <Text style={s.docTitle}>Antenatal Care Card</Text>
            <Text style={s.docMeta}>{patient.patient_number}</Text>
            <Text style={s.docMeta}>Generated {formatDisplayDate(generatedAtIso)}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Patient</Text>
        <View style={s.fieldGrid}>
          <Field label="Full name" value={patient.full_name} />
          <Field label="Patient number" value={patient.patient_number} />
          <Field
            label="Date of birth"
            value={patient.date_of_birth ? `${formatDisplayDate(patient.date_of_birth)} (age ${age})` : ""}
          />
          <Field label="Phone" value={patient.phone ?? ""} />
          <Field label="Address" value={patient.address ?? ""} />
          <Field label="Community health worker" value={chwName ?? ""} />
          <Field label="Emergency contact" value={patient.emergency_contact_name ?? ""} />
          <Field label="Emergency contact phone" value={patient.emergency_contact_phone ?? ""} />
        </View>

        <Text style={s.sectionTitle}>Current pregnancy</Text>
        {pregnancy ? (
          <View style={s.fieldGrid}>
            <Field label="Pregnancy" value={`#${pregnancy.pregnancy_number}`} />
            <Field
              label="Gravida / Para"
              value={`${pregnancy.gravida ?? "—"} / ${pregnancy.para ?? "—"}`}
            />
            <Field label="Last menstrual period" value={pregnancy.lmp ? formatDisplayDate(pregnancy.lmp) : ""} />
            <Field label="Estimated date of delivery" value={formatDisplayDate(pregnancy.edd)} />
            <Field label="Gestational age" value={weeks !== null ? `${weeks} weeks` : ""} />
            <Field
              label="Next appointment"
              value={nextAppointmentDate ? formatDisplayDate(nextAppointmentDate) : "Not scheduled"}
            />
          </View>
        ) : (
          <Text style={s.fieldValue}>No pregnancy on file.</Text>
        )}

        <Text style={s.sectionTitle}>ANC visit record</Text>
        {sortedVisits.length === 0 ? (
          <Text style={s.fieldValue}>No visits recorded yet.</Text>
        ) : (
          <View style={s.table}>
            <View style={s.tableHeaderRow}>
              <Text style={[s.tableHeaderCell, { width: "10%" }]}>Visit</Text>
              <Text style={[s.tableHeaderCell, { width: "16%" }]}>Date</Text>
              <Text style={[s.tableHeaderCell, { width: "18%" }]}>Weight</Text>
              <Text style={[s.tableHeaderCell, { width: "18%" }]}>BP</Text>
              <Text style={[s.tableHeaderCell, { width: "19%" }]}>Fundal ht.</Text>
              <Text style={[s.tableHeaderCell, { width: "19%" }]}>FHR / Hb</Text>
            </View>
            {sortedVisits.map((visit, i) => (
              <View key={visit.id} style={i === sortedVisits.length - 1 ? s.tableRowLast : s.tableRow}>
                <Text style={[s.tableCell, { width: "10%" }]}>{visit.visit_number}</Text>
                <Text style={[s.tableCell, { width: "16%" }]}>{formatDisplayDate(visit.visit_date)}</Text>
                <Text style={[s.tableCell, { width: "18%" }]}>
                  {visit.weight_kg != null ? `${visit.weight_kg} kg` : "—"}
                </Text>
                <Text style={[s.tableCell, { width: "18%" }]}>
                  {visit.blood_pressure_systolic != null && visit.blood_pressure_diastolic != null
                    ? `${visit.blood_pressure_systolic}/${visit.blood_pressure_diastolic}`
                    : "—"}
                </Text>
                <Text style={[s.tableCell, { width: "19%" }]}>
                  {visit.fundal_height_cm != null ? `${visit.fundal_height_cm} cm` : "—"}
                </Text>
                <Text style={[s.tableCell, { width: "19%" }]}>
                  {visit.fetal_heart_rate != null ? `${visit.fetal_heart_rate} bpm` : "—"}
                  {visit.hb_g_dl != null ? ` / ${visit.hb_g_dl} g/dL` : ""}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.note}>
          This card summarizes recorded ANC visit measurements only. It is not a clinical record and
          does not include clinical assessments — contact the clinic directly with any medical questions.
        </Text>

        <Text style={s.footer} fixed>
          Generated by {generatedByName} on {formatDisplayDate(generatedAtIso)} · Felis Clinic ANC Management
          System
        </Text>
      </Page>
    </Document>
  );
}

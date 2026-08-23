import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getPatientById,
  getLatestPregnancy,
  getCommunityHealthWorkerName,
  getPatientSummary,
} from "@/lib/services/patientService";
import { listAppointmentsForPatient } from "@/lib/services/appointmentService";
import { listVisitsForPatient } from "@/lib/services/clinicalVisitService";
import { listRiskFlagsForPatient } from "@/lib/services/riskService";
import { listAuditLogsForEntity } from "@/lib/services/auditService";
import { PatientHeader } from "@/components/patients/patient-header";
import { PatientSummaryCards } from "@/components/patients/patient-summary-cards";
import { PatientOverview } from "@/components/patients/patient-overview";
import { PatientAppointments } from "@/components/patients/patient-appointments";
import { PatientVisits } from "@/components/patients/patient-visits";
import { PatientClinicalHistory } from "@/components/patients/patient-clinical-history";
import { PatientRiskFlags } from "@/components/patients/patient-risk-flags";
import { PatientDocuments } from "@/components/patients/patient-documents";
import { PatientAuditHistory } from "@/components/patients/patient-audit-history";
import { PatientTabs } from "@/components/patients/patient-tabs";
import { SetPageHeader } from "@/components/layout/set-page-header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const patient = await getPatientById(id);
  return { title: patient ? patient.full_name : "Patient" };
}

export default async function PatientProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const patient = await getPatientById(id);
  if (!patient) notFound();

  const [pregnancy, chwName, summary, appointments, visits, riskFlags, auditEntries] = await Promise.all([
    getLatestPregnancy(id),
    getCommunityHealthWorkerName(patient.community_health_worker_id),
    getPatientSummary(id),
    listAppointmentsForPatient(id),
    listVisitsForPatient(id),
    listRiskFlagsForPatient(id),
    user.role === "administrator" ? listAuditLogsForEntity("patient", id) : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <SetPageHeader
        title={patient.full_name}
        subtitle={`${patient.patient_number} · Patient profile`}
      />

      <PatientHeader patient={patient} pregnancy={pregnancy} />
      <PatientSummaryCards summary={summary} />
      <PatientTabs
        overview={
          <PatientOverview patient={patient} pregnancy={pregnancy} chwName={chwName} />
        }
        appointments={
          <PatientAppointments
            patientId={patient.id}
            pregnancyId={pregnancy?.id ?? null}
            patientName={patient.full_name}
            patientNumber={patient.patient_number}
            appointments={appointments}
          />
        }
        visits={
          <PatientVisits
            patientId={patient.id}
            pregnancyId={pregnancy?.id ?? null}
            patientName={patient.full_name}
            patientNumber={patient.patient_number}
            patientRiskStatus={patient.risk_status}
            visits={visits}
            isAdmin={user.role === "administrator"}
          />
        }
        clinicalHistory={<PatientClinicalHistory visits={visits} flags={riskFlags} />}
        riskFlags={<PatientRiskFlags patientId={patient.id} flags={riskFlags} />}
        documents={<PatientDocuments patientId={patient.id} />}
        auditHistory={
          auditEntries ? <PatientAuditHistory entries={auditEntries} /> : undefined
        }
      />
    </div>
  );
}

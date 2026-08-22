import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getPatientById,
  getLatestPregnancy,
  getCommunityHealthWorkerName,
  getPatientSummary,
} from "@/lib/services/patientService";
import { listAuditLogsForEntity } from "@/lib/services/auditService";
import { PatientHeader } from "@/components/patients/patient-header";
import { PatientSummaryCards } from "@/components/patients/patient-summary-cards";
import { PatientOverview } from "@/components/patients/patient-overview";
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

  const [pregnancy, chwName, summary, auditEntries] = await Promise.all([
    getLatestPregnancy(id),
    getCommunityHealthWorkerName(patient.community_health_worker_id),
    getPatientSummary(id),
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
        auditHistory={
          auditEntries ? <PatientAuditHistory entries={auditEntries} /> : undefined
        }
      />
    </div>
  );
}

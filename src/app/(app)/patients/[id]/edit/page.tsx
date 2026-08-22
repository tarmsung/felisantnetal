import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getPatientById, getLatestPregnancy } from "@/lib/services/patientService";
import { listActiveCommunityHealthWorkers } from "@/lib/services/chwService";
import { EditPatientForm } from "@/components/patients/edit-patient-form";
import { SetPageHeader } from "@/components/layout/set-page-header";
import type { PatientFormValues } from "@/lib/validation/patientSchemas";

export const metadata: Metadata = { title: "Edit Patient" };

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [patient, pregnancy, chws] = await Promise.all([
    getPatientById(id),
    getLatestPregnancy(id),
    listActiveCommunityHealthWorkers(),
  ]);

  if (!patient) notFound();

  const defaultValues: PatientFormValues = {
    full_name: patient.full_name,
    national_id: patient.national_id ?? "",
    date_of_birth: patient.date_of_birth ?? "",
    phone: patient.phone ?? "",
    alternative_phone: patient.alternative_phone ?? "",
    address: patient.address ?? "",
    emergency_contact_name: patient.emergency_contact_name ?? "",
    emergency_contact_phone: patient.emergency_contact_phone ?? "",
    community_health_worker_id: patient.community_health_worker_id ?? "",
    notes: patient.notes ?? "",
    gravida: pregnancy?.gravida != null ? String(pregnancy.gravida) : "",
    para: pregnancy?.para != null ? String(pregnancy.para) : "",
    lmp: pregnancy?.lmp ?? "",
    edd: pregnancy?.edd ?? "",
    gestational_information: pregnancy?.gestational_information ?? "",
  };

  return (
    <div className="mx-auto max-w-2xl">
      <SetPageHeader title={`Edit ${patient.full_name}`} subtitle={patient.patient_number} />
      <EditPatientForm
        patientId={patient.id}
        pregnancyId={pregnancy?.id ?? null}
        chws={chws}
        defaultValues={defaultValues}
      />
    </div>
  );
}

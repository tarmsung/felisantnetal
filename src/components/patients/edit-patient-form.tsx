"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PatientForm } from "@/components/patients/patient-form";
import { updatePatientAction } from "@/app/(app)/patients/[id]/edit/actions";
import type { PatientFormValues } from "@/lib/validation/patientSchemas";
import type { CommunityHealthWorkerRow } from "@/types/database";

export function EditPatientForm({
  patientId,
  pregnancyId,
  chws,
  defaultValues,
}: {
  patientId: string;
  pregnancyId: string | null;
  chws: CommunityHealthWorkerRow[];
  defaultValues: PatientFormValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | undefined>();

  return (
    <PatientForm
      chws={chws}
      defaultValues={defaultValues}
      submitLabel="Save changes"
      pending={pending}
      serverError={serverError}
      onSubmit={(data) => {
        setServerError(undefined);
        startTransition(async () => {
          const result = await updatePatientAction(patientId, pregnancyId, data);
          if (result.status === "error") {
            setServerError(result.message);
            return;
          }
          toast.success("Patient updated.");
          router.push(`/patients/${patientId}`);
        });
      }}
    />
  );
}

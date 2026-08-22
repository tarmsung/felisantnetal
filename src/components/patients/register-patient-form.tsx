"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PatientForm } from "@/components/patients/patient-form";
import { DuplicateWarningDialog } from "@/components/patients/duplicate-warning-dialog";
import {
  registerPatientAction,
  type PatientDuplicateMatch,
} from "@/app/(app)/patients/new/actions";
import type { PatientFormInput } from "@/lib/validation/patientSchemas";
import type { CommunityHealthWorkerRow } from "@/types/database";

export function RegisterPatientForm({ chws }: { chws: CommunityHealthWorkerRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | undefined>();
  const [duplicates, setDuplicates] = useState<PatientDuplicateMatch[]>([]);
  const [pendingData, setPendingData] = useState<PatientFormInput | null>(null);

  function submit(data: PatientFormInput, skipDuplicateCheck: boolean) {
    setServerError(undefined);
    startTransition(async () => {
      const result = await registerPatientAction(data, skipDuplicateCheck);

      if (result.status === "duplicates") {
        setPendingData(data);
        setDuplicates(result.matches);
        return;
      }

      if (result.status === "error") {
        setServerError(result.message);
        return;
      }

      setDuplicates([]);
      toast.success(`${data.full_name} registered.`);
      router.push(`/patients/${result.patientId}`);
    });
  }

  return (
    <>
      <PatientForm
        chws={chws}
        onSubmit={(data) => submit(data, false)}
        submitLabel="Register patient"
        pending={pending}
        serverError={serverError}
      />
      <DuplicateWarningDialog
        open={duplicates.length > 0}
        matches={duplicates}
        pending={pending}
        onOpenChange={(open) => {
          if (!open) setDuplicates([]);
        }}
        onConfirm={() => {
          if (pendingData) submit(pendingData, true);
        }}
      />
    </>
  );
}

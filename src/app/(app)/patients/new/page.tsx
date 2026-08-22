import type { Metadata } from "next";
import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listActiveCommunityHealthWorkers } from "@/lib/services/chwService";
import { RegisterPatientForm } from "@/components/patients/register-patient-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { SetPageHeader } from "@/components/layout/set-page-header";

export const metadata: Metadata = { title: "Register Patient" };

export default async function NewPatientPage() {
  const user = await requireUser();
  const chws = await listActiveCommunityHealthWorkers();

  if (chws.length === 0) {
    return (
      <>
        <SetPageHeader title="Register Patient" subtitle="Add a new ANC patient" />
        <EmptyState
          icon={HeartHandshake}
          title="Add a community health worker first"
          description={
            user.role === "administrator"
              ? "Every patient record links to a community health worker. Add at least one, then come back to register a patient."
              : "Every patient record links to a community health worker. Ask a clinic administrator to add one, then come back to register a patient."
          }
          action={
            user.role === "administrator" ? (
              <Button
                render={<Link href="/community-health-workers" />}
                nativeButton={false}
                variant="outline"
              >
                Go to Community Health Workers
              </Button>
            ) : undefined
          }
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <SetPageHeader title="Register Patient" subtitle="Add a new ANC patient" />
      <RegisterPatientForm chws={chws} />
    </div>
  );
}

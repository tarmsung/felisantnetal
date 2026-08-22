import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage() {
  await requireUser();
  return <ComingSoon moduleName="Patient registration, search and profiles" phase={2} />;
}

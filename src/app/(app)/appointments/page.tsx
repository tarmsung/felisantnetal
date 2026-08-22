import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Appointments" };

export default async function AppointmentsPage() {
  await requireUser();
  return <ComingSoon moduleName="The appointment calendar" phase={3} />;
}

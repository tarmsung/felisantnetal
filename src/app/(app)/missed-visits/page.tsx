import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Missed Visits" };

export default async function MissedVisitsPage() {
  await requireUser();
  return <ComingSoon moduleName="The missed-appointment follow-up page" phase={3} />;
}

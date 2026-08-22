import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await requireUser();
  return <ComingSoon moduleName="Attendance, missed-visit and high-risk reports" phase={6} />;
}

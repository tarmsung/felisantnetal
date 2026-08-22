import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "ANC Visits" };

export default async function VisitsPage() {
  await requireUser();
  return <ComingSoon moduleName="The clinical visit recording form" phase={4} />;
}

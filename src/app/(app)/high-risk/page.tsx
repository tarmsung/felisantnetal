import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "High Risk" };

export default async function HighRiskPage() {
  await requireUser();
  return <ComingSoon moduleName="The high-risk patient dashboard" phase={4} />;
}

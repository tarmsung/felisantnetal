import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Audit Logs" };

export default async function AuditLogsPage() {
  await requireAdmin();
  return <ComingSoon moduleName="The audit log viewer" phase={8} />;
}

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  await requireAdmin();
  return <ComingSoon moduleName="Staff account management" phase={8} />;
}

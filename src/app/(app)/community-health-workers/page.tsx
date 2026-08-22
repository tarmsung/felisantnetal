import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Community Health Workers" };

export default async function CommunityHealthWorkersPage() {
  await requireUser();
  return <ComingSoon moduleName="Community health worker management" phase={2} />;
}

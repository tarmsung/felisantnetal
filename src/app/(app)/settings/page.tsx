import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  return (
    <ComingSoon
      moduleName="Clinic, ANC schedule, clinical rule and notification settings"
      phase={8}
    />
  );
}

import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { getClinicSettings } from "@/lib/services/settingsService";
import { listAllAncScheduleTemplates } from "@/lib/services/ancService";
import { listAllClinicalRules } from "@/lib/services/riskService";
import {
  listNotificationTemplates,
  getNotificationSettings,
} from "@/lib/services/notificationService";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { ClinicSettingsForm } from "@/components/settings/clinic-settings-form";
import { AncScheduleTable } from "@/components/settings/anc-schedule-table";
import { ClinicalRulesTable } from "@/components/settings/clinical-rules-table";
import { NotificationSettingsSection } from "@/components/settings/notification-settings-section";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();

  const [clinicSettings, scheduleTemplates, clinicalRules, notificationTemplates, notificationSettings] =
    await Promise.all([
      getClinicSettings(),
      listAllAncScheduleTemplates(),
      listAllClinicalRules(),
      listNotificationTemplates(),
      getNotificationSettings(),
    ]);

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Clinic details, the ANC visit schedule, clinical review thresholds, and notification
        settings — administrator-only (spec section 35). Nothing here is ever pre-filled with an
        invented clinical value; every threshold and timing starts blank until you set it.
      </p>

      <SettingsTabs
        clinic={<ClinicSettingsForm settings={clinicSettings} />}
        schedule={<AncScheduleTable templates={scheduleTemplates} />}
        rules={<ClinicalRulesTable rules={clinicalRules} />}
        notifications={
          <NotificationSettingsSection templates={notificationTemplates} settings={notificationSettings} />
        }
      />
    </div>
  );
}

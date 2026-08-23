import "server-only";
import type { NotificationProvider } from "./types";
import { consoleProvider } from "./consoleProvider";
import { baileysProvider } from "./baileysProvider";

export type { NotificationProvider, NotificationSendResult } from "./types";
export { renderTemplate } from "./template";
export { formatPhoneForWhatsapp } from "./phone";

/**
 * Selected at runtime by notification_settings.whatsapp_provider
 * (administrator-configurable, Settings → Notifications), per
 * ARCHITECTURE.md's "Notifications" section — never a hardcoded choice.
 * Falls back to the console provider for any unset/unrecognized value
 * rather than throwing, so a misconfigured or not-yet-configured
 * project degrades to "logs instead of sending" instead of breaking the
 * reminder sweep outright.
 */
export function getNotificationProvider(providerName: string | null | undefined): NotificationProvider {
  switch (providerName) {
    case "baileys":
      return baileysProvider;
    case "console":
    default:
      return consoleProvider;
  }
}

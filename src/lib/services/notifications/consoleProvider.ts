import type { NotificationProvider, NotificationSendResult } from "./types";

/**
 * The default until an administrator switches notification_settings.
 * whatsapp_provider to "baileys" (Settings -> Notifications) — logs
 * instead of sending, so the reminder scheduler and "send now" button
 * are fully exercisable without a paired WhatsApp session or the
 * whatsapp-service running at all.
 */
export const consoleProvider: NotificationProvider = {
  async send(to: string, body: string): Promise<NotificationSendResult> {
    console.log(`[consoleProvider] would send to ${to}:\n${body}`);
    return { success: true, providerMessageId: `console-${Date.now()}` };
  },
};

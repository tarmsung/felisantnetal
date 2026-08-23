/**
 * The swappable-provider facade ARCHITECTURE.md's "Notifications"
 * section describes. `to` is already a channel-specific address (a
 * WhatsApp JID for the baileys provider) — normalizing a patient's raw
 * phone number into that shape is the caller's job (see phone.ts), not
 * this interface's.
 */
export interface NotificationProvider {
  send(to: string, body: string): Promise<NotificationSendResult>;
}

export interface NotificationSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

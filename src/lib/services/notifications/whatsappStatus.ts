import "server-only";

export interface WhatsAppConnectionStatus {
  reachable: boolean;
  connected: boolean;
  qr: string | null;
  error?: string;
}

/**
 * Backs the Settings → Notifications tab's connection card. Calls the
 * whatsapp-service directly (not through the generic NotificationProvider
 * interface — connection/pairing status isn't a concept the "send a
 * message" facade needs to know about) so an administrator can see
 * whether pairing is needed without leaving the app, and the service's
 * API key never reaches the browser.
 */
export async function getWhatsAppConnectionStatus(): Promise<WhatsAppConnectionStatus> {
  const baseUrl = process.env.WHATSAPP_SERVICE_URL;
  const apiKey = process.env.WHATSAPP_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) {
    return { reachable: false, connected: false, qr: null, error: "WhatsApp service is not configured." };
  }

  try {
    const response = await fetch(`${baseUrl}/status`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return { reachable: false, connected: false, qr: null, error: `whatsapp-service returned ${response.status}.` };
    }
    const data = (await response.json()) as { connected: boolean; qr: string | null };
    return { reachable: true, connected: data.connected, qr: data.qr };
  } catch (err) {
    return {
      reachable: false,
      connected: false,
      qr: null,
      error: err instanceof Error ? `Could not reach whatsapp-service: ${err.message}` : "Could not reach whatsapp-service.",
    };
  }
}

/** Backs a "Log out / re-pair" button — ends the session and clears stored credentials on the service side. */
export async function logoutWhatsAppConnection(): Promise<{ success: boolean; error?: string }> {
  const baseUrl = process.env.WHATSAPP_SERVICE_URL;
  const apiKey = process.env.WHATSAPP_SERVICE_API_KEY;
  if (!baseUrl || !apiKey) {
    return { success: false, error: "WhatsApp service is not configured." };
  }

  try {
    const response = await fetch(`${baseUrl}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return { success: false, error: `whatsapp-service returned ${response.status}.` };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? `Could not reach whatsapp-service: ${err.message}` : "Could not reach whatsapp-service.",
    };
  }
}

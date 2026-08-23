import "server-only";
import type { NotificationProvider, NotificationSendResult } from "./types";

/**
 * Thin HTTP client for the whatsapp-service (see /whatsapp-service —
 * a separate, standalone process holding the actual WhatsApp
 * connection; see that directory's README before pairing a real
 * number). This provider never touches Baileys directly — it's a REST
 * call, same shape as any other NotificationProvider would be for an
 * official API. The service's API key never reaches the browser: this
 * file only ever runs server-side ("server-only" guard above).
 */
export const baileysProvider: NotificationProvider = {
  async send(to: string, body: string): Promise<NotificationSendResult> {
    const baseUrl = process.env.WHATSAPP_SERVICE_URL;
    const apiKey = process.env.WHATSAPP_SERVICE_API_KEY;
    if (!baseUrl || !apiKey) {
      return {
        success: false,
        error: "WHATSAPP_SERVICE_URL / WHATSAPP_SERVICE_API_KEY are not configured.",
      };
    }

    try {
      const response = await fetch(`${baseUrl}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ to, message: body }),
      });

      const data = (await response.json().catch(() => null)) as NotificationSendResult | null;
      if (!response.ok || !data) {
        return { success: false, error: data?.error ?? `whatsapp-service returned ${response.status}.` };
      }
      return data;
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? `Could not reach whatsapp-service: ${err.message}` : "Could not reach whatsapp-service.",
      };
    }
  },
};

/**
 * WhatsApp connection management via @whiskeysockets/baileys (Phase 5).
 *
 * ⚠️ Baileys is an unofficial, reverse-engineered WhatsApp Web client,
 * not the sanctioned WhatsApp Business API. Automated/bulk messaging —
 * exactly what appointment reminders are — is a known way WhatsApp bans
 * a number. That risk is inherent to this whole approach and applies to
 * whichever number gets paired here; see this service's README.md
 * before pointing it at a real clinic phone number.
 *
 * Session persistence: `useMultiFileAuthState` (Baileys' own documented,
 * officially-supported storage mechanism) writes credentials to
 * ./auth_info on disk. In Docker that directory is a named volume (see
 * docker-compose.yml) so re-pairing isn't needed on every container
 * restart. A custom database-backed auth-state store was considered and
 * rejected for this first cut — Baileys' own multi-file implementation
 * is the best-tested path, and a hand-rolled one is a well-known source
 * of subtle session-corruption bugs if the signal-key storage isn't
 * implemented exactly right.
 */
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import { pino } from "pino";
import { rm } from "node:fs/promises";

const AUTH_DIR = process.env.AUTH_DIR ?? "./auth_info";
const logger = pino({ level: process.env.LOG_LEVEL ?? "warn" });

let sock: WASocket | null = null;
let latestQrDataUrl: string | null = null;
let connected = false;
// Set only by an explicit /logout call, so the reconnect handler below
// knows not to reconnect into a session that was deliberately ended.
let loggedOutByRequest = false;

export interface ConnectionStatus {
  connected: boolean;
  qr: string | null;
}

export function getStatus(): ConnectionStatus {
  return { connected, qr: connected ? null : latestQrDataUrl };
}

export async function startBaileysConnection(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger,
    browser: [process.env.BOT_NAME ?? "Felis Clinic ANC", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQrDataUrl = await QRCode.toDataURL(qr);
      connected = false;
    }

    if (connection === "open") {
      connected = true;
      latestQrDataUrl = null;
      logger.info("WhatsApp connection open.");
    }

    if (connection === "close") {
      connected = false;
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = !loggedOutByRequest && statusCode !== DisconnectReason.loggedOut;
      logger.warn({ statusCode, shouldReconnect }, "WhatsApp connection closed.");
      if (shouldReconnect) {
        void startBaileysConnection();
      } else {
        loggedOutByRequest = false;
      }
    }
  });
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

/** `jid` must already be normalized to "<countrycode><number>@s.whatsapp.net" — this module has no opinion on phone-number formats. */
export async function sendText(jid: string, text: string): Promise<SendResult> {
  if (!sock || !connected) {
    return { success: false, error: "WhatsApp is not connected. Pair a device first (see /status)." };
  }
  try {
    const result = await sock.sendMessage(jid, { text });
    return { success: true, providerMessageId: result?.key.id ?? undefined };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to send message." };
  }
}

/** Ends the session and wipes stored credentials so a fresh QR pairing can start. */
export async function logoutAndReset(): Promise<void> {
  loggedOutByRequest = true;
  try {
    await sock?.logout();
  } catch {
    // Already disconnected — still proceed to clear local state below.
  }
  sock = null;
  connected = false;
  latestQrDataUrl = null;
  await rm(AUTH_DIR, { recursive: true, force: true });
}

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
// Guards resetSession() so a logged-out close event and an explicit
// /logout call arriving together don't both wipe and restart.
let resetting = false;

export interface ConnectionStatus {
  connected: boolean;
  qr: string | null;
}

export function getStatus(): ConnectionStatus {
  return { connected, qr: connected ? null : latestQrDataUrl };
}

/**
 * Wipes the stored session and starts a brand-new connection, which
 * produces a fresh pairing QR. Used whenever WhatsApp ends the session
 * (the linked device was removed from the phone, or the phone didn't
 * come online for roughly two weeks and WhatsApp unlinked it — status
 * 401 / DisconnectReason.loggedOut) and when an administrator asks to
 * re-pair. Before this, a logout left the service permanently idle:
 * "not connected", no QR, and the Settings page waiting forever until
 * someone restarted the process by hand.
 */
async function resetSession(): Promise<void> {
  if (resetting) return;
  resetting = true;
  try {
    sock = null;
    connected = false;
    latestQrDataUrl = null;
    await rm(AUTH_DIR, { recursive: true, force: true });
    await startBaileysConnection();
  } finally {
    resetting = false;
  }
}

export async function startBaileysConnection(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const thisSock = makeWASocket({
    auth: state,
    logger,
    browser: [process.env.BOT_NAME ?? "Felis Clinic ANC", "Chrome", "1.0.0"],
  });
  sock = thisSock;

  thisSock.ev.on("creds.update", saveCreds);

  thisSock.ev.on("connection.update", async (update) => {
    // A replaced socket's late events must not clobber the live one's state.
    if (sock !== thisSock) return;
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
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      logger.warn({ statusCode, loggedOut }, "WhatsApp connection closed.");
      // Logged out: the stored credentials are dead — start over for a
      // fresh QR. Anything else (network blip, the normal post-pairing
      // restart): reconnect with the same session.
      void (loggedOut ? resetSession() : startBaileysConnection());
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

/** Ends the session, wipes stored credentials, and starts a fresh pairing (new QR) — see resetSession(). */
export async function logoutAndReset(): Promise<void> {
  const before = sock;
  try {
    // Tells WhatsApp to unlink this device. That normally also fires a
    // loggedOut close event, whose handler runs resetSession() itself.
    await sock?.logout();
  } catch {
    // Already disconnected — fall through to reset directly.
  }
  // Only reset here if that handler hasn't already replaced the socket;
  // otherwise we'd wipe the brand-new session and start a second
  // connection. (If the handler fires later instead, it's ignored: it
  // belongs to a socket that's no longer current — see the
  // `sock !== thisSock` check in startBaileysConnection.)
  if (sock === before) await resetSession();
}

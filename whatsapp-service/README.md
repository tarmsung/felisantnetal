# Felis Clinic WhatsApp service

A small, standalone REST wrapper around [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys)
that lets the main Felis Clinic app send appointment-reminder WhatsApp
messages (Phase 5). It's deliberately separate from the Next.js app: a
WhatsApp connection is a long-lived, stateful WebSocket with on-disk
session credentials, which doesn't fit a request-scoped Next.js
deployment model. This service is the one thing that holds that state;
the main app just calls it over HTTP.

## Read this before pairing a real clinic phone number

**Baileys is an unofficial, reverse-engineered WhatsApp Web client, not
the sanctioned WhatsApp Business API.** Its own README puts the
responsibility on whoever operates it to use it "in a fair way," and
explicitly warns against spam/bulk automated messaging — which is
close to what an appointment-reminder system does, even at a small
clinic's volume. Using this carries a real, inherent risk that
WhatsApp/Meta could ban the phone number connected here, with no
appeal path through an official support channel (there is none — this
isn't the Business API). That risk exists regardless of how carefully
this service itself is written; it's a property of the approach, not a
bug to fix. Before pairing a real number:

- Consider using a number that isn't the clinic's only line of contact,
  in case it gets banned.
- Keep reminder volume proportional to a real clinic's patient load —
  this was never built or tested for bulk/marketing-style sending.
- If this clinic ever has budget for the official WhatsApp Business
  API, that's the sanctioned alternative with no ban risk of this kind
  — this service's `NotificationProvider` interface (see the main
  app's `src/lib/services/notifications/`) was built specifically so
  swapping to that later doesn't require touching anything upstream of
  the provider itself.

## How pairing works

1. Start this service (see "Running" below).
2. From the main app's Settings → Notifications tab, an administrator
   sees a live connection status. While unpaired, it shows a QR code.
3. Open WhatsApp on the clinic's phone → Linked Devices → Link a
   Device → scan the QR code shown in Settings.
4. Once paired, the status flips to "Connected" and the QR disappears.
   Session credentials are now on disk (`./auth_info` — a Docker named
   volume in production) and survive a restart of this service; you
   won't need to re-scan unless the session is explicitly logged out or
   WhatsApp itself invalidates it (e.g. the phone unlinks the device).

## API

Every endpoint except `/health` requires `Authorization: Bearer <API_KEY>`.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{ status: "ok" }` — no auth required, used by this service's own Docker `HEALTHCHECK`. |
| GET | `/status` | — | `{ connected: boolean, qr: string \| null }` — `qr` is a data URL PNG, present only while unpaired. |
| POST | `/send` | `{ "to": "263771234567", "message": "..." }` | `{ success: boolean, providerMessageId?: string, error?: string }`. `to` must already be in `<countrycode><number>` form, digits only — this service does no phone-number normalization (see the main app's `lib/services/notifications/phone.ts` for that). |
| POST | `/logout` | — | `{ status: "ok" }` — ends the session and deletes stored credentials, so a fresh QR pairing can start (e.g. to re-pair a different number). |

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `API_KEY` | Yes | Shared secret the main app sends as a Bearer token. Generate one (`openssl rand -hex 32`) — this service refuses to start without it. |
| `PORT` | No | Default `3100`. |
| `AUTH_DIR` | No | Default `./auth_info`. Where session credentials are stored — must be a persistent volume in production. |
| `LOG_LEVEL` | No | Default `warn` (pino log level). |
| `BOT_NAME` | No | Default `Felis Clinic ANC` — the device name shown in WhatsApp's Linked Devices list. |

## Running

```bash
npm install
npm run dev    # tsx watch, for local development
```

```bash
npm run build
npm run start  # compiled output, matches the Docker image
```

Or via the main repo's `docker-compose.yml`, which runs this alongside
the app with a named volume for `auth_info`.

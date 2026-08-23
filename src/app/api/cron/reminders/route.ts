import { NextResponse } from "next/server";
import { runReminderSweep } from "@/lib/services/notificationService";

export const runtime = "nodejs";

/**
 * Phase 5's real scheduled job (see notificationService.runReminderSweep's
 * comment). This app has no built-in scheduler — trigger this on an
 * external schedule (system cron, a hosting platform's scheduled
 * trigger, GitHub Actions' `schedule` event, etc.) with e.g.:
 *
 *   curl -X POST https://your-app/api/cron/reminders \
 *     -H "Authorization: Bearer $CRON_SECRET"
 *
 * CRON_SECRET (.env.example) is the only thing standing between this
 * and an arbitrary public request being able to trigger WhatsApp sends
 * — this route deliberately does NOT use requireUser()/requireAdmin(),
 * since a cron trigger has no staff session to check.
 */
export async function POST(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runReminderSweep();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Reminder sweep failed." },
      { status: 500 },
    );
  }
}

import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/services/auditService";
import { formatClinicDateTime } from "@/lib/dates";
import type { AppointmentRow, RiskStatus } from "@/types/database";

export interface AppointmentListRow extends AppointmentRow {
  patient_full_name: string;
  patient_number: string;
  patient_phone: string | null;
  patient_risk_status: RiskStatus;
}

/** Every visit_number already claimed by an appointment for this pregnancy (any status) — feeds ancService.suggestNextVisit. */
export async function getUsedVisitNumbers(pregnancyId: string): Promise<number[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("visit_number")
    .eq("pregnancy_id", pregnancyId)
    .not("visit_number", "is", null);

  if (error) throw new Error(`Failed to load existing visits: ${error.message}`);
  return (data ?? [])
    .map((row) => row.visit_number)
    .filter((n): n is number => n != null);
}

/**
 * Batch-attaches patient display info to a page of appointments — the
 * same "fetch the page, then one follow-up `.in()` query for the
 * lookups" pattern as patientService's CHW-name attachment, avoiding
 * both a per-row query and relying on postgrest embedding (which our
 * Database type doesn't model — see types/database.ts).
 */
async function attachPatientInfo(rows: AppointmentRow[]): Promise<AppointmentListRow[]> {
  if (rows.length === 0) return [];
  const supabase = await createSupabaseServerClient();

  const patientIds = Array.from(new Set(rows.map((r) => r.patient_id)));
  const { data: patients } = await supabase
    .from("patients")
    .select("id, full_name, patient_number, phone, risk_status")
    .in("id", patientIds);

  const byId = new Map((patients ?? []).map((p) => [p.id, p]));

  return rows.map((row) => {
    const patient = byId.get(row.patient_id);
    return {
      ...row,
      patient_full_name: patient?.full_name ?? "Unknown patient",
      patient_number: patient?.patient_number ?? "—",
      patient_phone: patient?.phone ?? null,
      patient_risk_status: patient?.risk_status ?? "normal",
    };
  });
}

/**
 * Interim stand-in for Phase 5's real background job (spec section 27
 * lists "missed appointment detection" as a scheduled job). Called
 * opportunistically at the top of the calendar/missed-visits/summary
 * read paths below so `status` stays accurate without needing cron
 * infrastructure this phase doesn't build yet. Attributed to no user
 * (`user_id: null`) in the audit log — RLS's audit_logs_insert policy
 * explicitly allows that for system-initiated entries — since no staff
 * member actually took this action.
 */
export async function sweepMissedAppointments(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .update({ status: "missed" })
    .eq("status", "scheduled")
    .lt("scheduled_date", nowIso)
    .select("id, patient_id, scheduled_date");

  if (error) {
    console.error("[appointmentService] sweepMissedAppointments failed:", error.message);
    return 0;
  }

  // Best-effort, separate from the update above: an appointment that
  // already passed with no reminder ever sent no longer needs one
  // (Phase 5). Deliberately scoped to reminder_status = 'pending' only —
  // a reminder that already went out ('sent'/'delivered') or failed
  // stays as-is, since that's real delivery history worth keeping, not
  // something this sweep should silently overwrite.
  await supabase
    .from("appointments")
    .update({ reminder_status: "not_applicable" })
    .eq("status", "missed")
    .eq("reminder_status", "pending")
    .lt("scheduled_date", nowIso);

  for (const row of data ?? []) {
    await logAuditEvent({
      userId: null,
      action: "appointment.auto_missed",
      entityType: "appointment",
      entityId: row.id,
      newValues: { status: "missed", scheduled_date: row.scheduled_date },
    });
  }

  return data?.length ?? 0;
}

export async function listAppointmentsForRange(
  startIso: string,
  endIso: string,
): Promise<AppointmentListRow[]> {
  await sweepMissedAppointments();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .gte("scheduled_date", startIso)
    .lt("scheduled_date", endIso)
    .order("scheduled_date", { ascending: true });

  if (error) throw new Error(`Failed to load appointments: ${error.message}`);
  return attachPatientInfo(data ?? []);
}

export async function listAppointmentsForPatient(
  patientId: string,
): Promise<AppointmentListRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("patient_id", patientId)
    .order("scheduled_date", { ascending: false });

  if (error) throw new Error(`Failed to load appointments: ${error.message}`);
  return attachPatientInfo(data ?? []);
}

export async function getAppointmentById(id: string): Promise<AppointmentListRow | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load appointment: ${error.message}`);
  if (!data) return null;
  const [withPatient] = await attachPatientInfo([data]);
  return withPatient;
}

export interface MissedAppointmentFilters {
  minDaysOverdue?: number;
  riskStatus?: RiskStatus;
  createdBy?: string;
  /** Original scheduled_date bounds, clinic-local day keys' ISO instants — added for the Reports module (Phase 6) so a "missed visits this month" report can scope the same underlying list rather than duplicating this query. */
  scheduledFromIso?: string;
  scheduledToIso?: string;
}

export interface MissedAppointmentRow extends AppointmentListRow {
  daysOverdue: number;
  community_health_worker_name: string | null;
}

/** Backs the dedicated Missed Visits page (spec section 13). */
export async function listMissedAppointments(
  filters: MissedAppointmentFilters = {},
): Promise<MissedAppointmentRow[]> {
  await sweepMissedAppointments();
  const supabase = await createSupabaseServerClient();

  let builder = supabase.from("appointments").select("*").eq("status", "missed");
  if (filters.createdBy) builder = builder.eq("created_by", filters.createdBy);
  if (filters.scheduledFromIso) builder = builder.gte("scheduled_date", filters.scheduledFromIso);
  if (filters.scheduledToIso) builder = builder.lt("scheduled_date", filters.scheduledToIso);

  const { data, error } = await builder.order("scheduled_date", { ascending: true });
  if (error) throw new Error(`Failed to load missed appointments: ${error.message}`);

  const withPatients = await attachPatientInfo(data ?? []);
  const now = Date.now();

  const patientIds = Array.from(new Set(withPatients.map((r) => r.patient_id)));
  const { data: patientRows } = await supabase
    .from("patients")
    .select("id, community_health_worker_id")
    .in("id", patientIds.length > 0 ? patientIds : ["00000000-0000-0000-0000-000000000000"]);

  const chwIdByPatientId = new Map(
    (patientRows ?? []).map((p) => [p.id, p.community_health_worker_id]),
  );
  const chwIds = Array.from(
    new Set(Array.from(chwIdByPatientId.values()).filter((id): id is string => Boolean(id))),
  );
  const { data: chwRows } = chwIds.length
    ? await supabase.from("community_health_workers").select("id, full_name").in("id", chwIds)
    : { data: [] as { id: string; full_name: string }[] };
  const chwNameById = new Map((chwRows ?? []).map((c) => [c.id, c.full_name]));

  return withPatients
    .map((row) => {
      const chwId = chwIdByPatientId.get(row.patient_id) ?? null;
      return {
        ...row,
        daysOverdue: Math.max(
          0,
          Math.floor((now - new Date(row.scheduled_date).getTime()) / 86_400_000),
        ),
        community_health_worker_name: chwId ? (chwNameById.get(chwId) ?? null) : null,
      };
    })
    .filter((row) => {
      if (filters.minDaysOverdue != null && row.daysOverdue < filters.minDaysOverdue) return false;
      if (filters.riskStatus && row.patient_risk_status !== filters.riskStatus) return false;
      return true;
    });
}

export interface CreateAppointmentInput {
  patientId: string;
  pregnancyId: string;
  visitNumber?: number;
  appointmentType: string;
  scheduledDateIso: string;
  notes?: string;
}

export async function createAppointment(
  input: CreateAppointmentInput,
  actingUserId: string,
): Promise<AppointmentRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: input.patientId,
      pregnancy_id: input.pregnancyId,
      visit_number: input.visitNumber ?? null,
      appointment_type: input.appointmentType,
      scheduled_date: input.scheduledDateIso,
      notes: input.notes ?? null,
      status: "scheduled",
      created_by: actingUserId,
      updated_by: actingUserId,
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(`Failed to create appointment: ${error?.message ?? "unknown error"}`);

  await logAuditEvent({
    userId: actingUserId,
    action: "appointment.create",
    entityType: "appointment",
    entityId: data.id,
    newValues: {
      patient_id: data.patient_id,
      visit_number: data.visit_number,
      appointment_type: data.appointment_type,
      scheduled_date: data.scheduled_date,
    },
  });

  return data;
}

/**
 * Retains the original appointment (spec section 7: "retain the
 * original scheduled date") by marking it `rescheduled` rather than
 * moving its date, and creates a new row carrying `rescheduled_from`.
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newScheduledDateIso: string,
  reason: string,
  actingUserId: string,
): Promise<AppointmentRow> {
  const supabase = await createSupabaseServerClient();

  const { data: original, error: fetchError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", appointmentId)
    .single();

  if (fetchError || !original) {
    throw new Error(`Appointment not found: ${fetchError?.message ?? "unknown error"}`);
  }

  const { error: updateError } = await supabase
    .from("appointments")
    .update({ status: "rescheduled", updated_by: actingUserId })
    .eq("id", appointmentId);

  if (updateError) throw new Error(`Failed to reschedule appointment: ${updateError.message}`);

  // Best-effort — see sweepMissedAppointments' comment on why this is a
  // separate, conditional update rather than folded into the one above.
  // The new row created below gets its own fresh reminder_status='pending'.
  await supabase
    .from("appointments")
    .update({ reminder_status: "not_applicable" })
    .eq("id", appointmentId)
    .eq("reminder_status", "pending");

  const { data: created, error: createError } = await supabase
    .from("appointments")
    .insert({
      patient_id: original.patient_id,
      pregnancy_id: original.pregnancy_id,
      visit_number: original.visit_number,
      appointment_type: original.appointment_type,
      scheduled_date: newScheduledDateIso,
      rescheduled_from: appointmentId,
      reschedule_reason: reason,
      status: "scheduled",
      created_by: actingUserId,
      updated_by: actingUserId,
    })
    .select("*")
    .single();

  if (createError || !created) {
    throw new Error(`Failed to create rescheduled appointment: ${createError?.message ?? "unknown error"}`);
  }

  await logAuditEvent({
    userId: actingUserId,
    action: "appointment.reschedule",
    entityType: "appointment",
    entityId: appointmentId,
    oldValues: { scheduled_date: original.scheduled_date, status: original.status },
    newValues: {
      new_appointment_id: created.id,
      new_scheduled_date: created.scheduled_date,
      reason,
    },
  });

  return created;
}

export async function cancelAppointment(
  appointmentId: string,
  reason: string,
  actingUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("appointments")
    .select("status")
    .eq("id", appointmentId)
    .single();

  const { error } = await supabase
    .from("appointments")
    .update({ status: "cancelled", cancellation_reason: reason, updated_by: actingUserId })
    .eq("id", appointmentId);

  if (error) throw new Error(`Failed to cancel appointment: ${error.message}`);

  // Best-effort — see sweepMissedAppointments' comment on why this is a
  // separate, conditional update.
  await supabase
    .from("appointments")
    .update({ reminder_status: "not_applicable" })
    .eq("id", appointmentId)
    .eq("reminder_status", "pending");

  await logAuditEvent({
    userId: actingUserId,
    action: "appointment.cancel",
    entityType: "appointment",
    entityId: appointmentId,
    oldValues: { status: before?.status ?? null },
    newValues: { status: "cancelled", reason },
  });
}

export async function completeAppointment(
  appointmentId: string,
  actingUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("appointments")
    .update({ status: "completed", completed_at: nowIso, updated_by: actingUserId })
    .eq("id", appointmentId);

  if (error) throw new Error(`Failed to complete appointment: ${error.message}`);

  // Best-effort — see sweepMissedAppointments' comment on why this is a
  // separate, conditional update.
  await supabase
    .from("appointments")
    .update({ reminder_status: "not_applicable" })
    .eq("id", appointmentId)
    .eq("reminder_status", "pending");

  await logAuditEvent({
    userId: actingUserId,
    action: "appointment.complete",
    entityType: "appointment",
    entityId: appointmentId,
    newValues: { status: "completed", completed_at: nowIso },
  });
}

/** Manual override — a nurse marking a visit missed ahead of the automatic sweep (see sweepMissedAppointments). */
export async function markAppointmentMissed(
  appointmentId: string,
  actingUserId: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: "missed", updated_by: actingUserId })
    .eq("id", appointmentId);

  if (error) throw new Error(`Failed to mark appointment missed: ${error.message}`);

  // Best-effort — see sweepMissedAppointments' comment on why this is a
  // separate, conditional update.
  await supabase
    .from("appointments")
    .update({ reminder_status: "not_applicable" })
    .eq("id", appointmentId)
    .eq("reminder_status", "pending");

  await logAuditEvent({
    userId: actingUserId,
    action: "appointment.mark_missed",
    entityType: "appointment",
    entityId: appointmentId,
    newValues: { status: "missed" },
  });
}

/**
 * Appends rather than overwrites (migration 20260101000012's comment) —
 * a follow-up history is the point of the Missed Visits "Add note"
 * action (spec section 13).
 */
export async function addAppointmentNote(
  appointmentId: string,
  note: string,
  actingUserId: string,
  actingUserName: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: fetchError } = await supabase
    .from("appointments")
    .select("notes")
    .eq("id", appointmentId)
    .single();

  if (fetchError) throw new Error(`Appointment not found: ${fetchError.message}`);

  const entry = `[${formatClinicDateTime(new Date().toISOString())}] ${actingUserName}: ${note}`;
  const updatedNotes = existing?.notes ? `${entry}\n\n${existing.notes}` : entry;

  const { error } = await supabase
    .from("appointments")
    .update({ notes: updatedNotes, updated_by: actingUserId })
    .eq("id", appointmentId);

  if (error) throw new Error(`Failed to add note: ${error.message}`);

  await logAuditEvent({
    userId: actingUserId,
    action: "appointment.add_note",
    entityType: "appointment",
    entityId: appointmentId,
    newValues: { note },
  });
}

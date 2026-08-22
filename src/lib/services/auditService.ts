import "server-only";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuditLogRow } from "@/types/database";

export interface AuditLogInput {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}

/**
 * Central place every other service calls after a mutation, per spec
 * section 4/25: "who created/edited a record, when, what changed, old
 * value, new value". Writes go through the caller's own session (RLS
 * policy audit_logs_insert requires user_id = auth.uid()), so a nurse
 * can never forge an entry attributed to someone else.
 *
 * Deliberately swallows its own errors after logging to the server
 * console: a failed audit write must never block the user-facing
 * operation it's describing (spec section 24: robust error handling),
 * but a silent audit gap is also a problem worth surfacing to ops, hence
 * the console.error rather than a bare catch.
 */
export async function logAuditEvent(input: AuditLogInput): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const requestHeaders = await headers();

    const { error } = await supabase.from("audit_logs").insert({
      user_id: input.userId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      old_values: input.oldValues ?? null,
      new_values: input.newValues ?? null,
      ip_address: requestHeaders.get("x-forwarded-for"),
      user_agent: requestHeaders.get("user-agent"),
    });

    if (error) {
      console.error("[auditService] failed to write audit log:", error.message);
    }
  } catch (err) {
    console.error("[auditService] unexpected failure:", err);
  }
}

/**
 * Reduces a before/after pair down to only the fields that actually
 * changed, so audit_logs.old_values/new_values reads as a real diff
 * (spec section 25) instead of two full-row dumps. Returns null when
 * nothing changed, so callers can skip writing a no-op audit entry.
 */
export function diffForAudit(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Pick<AuditLogInput, "oldValues" | "newValues"> | null {
  const oldValues: Record<string, unknown> = {};
  const newValues: Record<string, unknown> = {};

  for (const key of Object.keys(after)) {
    const beforeVal = before[key];
    const afterVal = after[key];
    const changed =
      beforeVal instanceof Date || afterVal instanceof Date
        ? String(beforeVal) !== String(afterVal)
        : JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
    if (changed) {
      oldValues[key] = beforeVal ?? null;
      newValues[key] = afterVal ?? null;
    }
  }

  if (Object.keys(newValues).length === 0) return null;
  return { oldValues, newValues };
}

export interface AuditLogEntry extends AuditLogRow {
  actor_name: string | null;
}

/**
 * Backs the "Audit History" tab on a patient's profile (spec section
 * 6). RLS (audit_logs_select_admin, migration 0009) restricts SELECT
 * to administrators only — this function doesn't add its own role
 * check, it relies on that: a nurse's session simply gets an empty
 * result here (or the page hides the tab entirely; see
 * app/(app)/patients/[id]/page.tsx).
 */
export async function listAuditLogsForEntity(
  entityType: string,
  entityId: string,
): Promise<AuditLogEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const userIds = Array.from(
    new Set(data.map((row) => row.user_id).filter((id): id is string => Boolean(id))),
  );

  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name")
      .in("id", userIds);
    for (const u of users ?? []) nameById.set(u.id, u.full_name);
  }

  return data.map((row) => ({
    ...row,
    actor_name: row.user_id ? (nameById.get(row.user_id) ?? "Unknown user") : "System",
  }));
}

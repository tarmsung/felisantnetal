import "server-only";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

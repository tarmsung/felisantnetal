import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CommunityHealthWorkerRow } from "@/types/database";

/**
 * Deliberately thin — CHWs don't log in and don't have their own module
 * of business rules yet, they're mainly a lookup used by patient
 * registration. RLS (chw_select / chw_insert_admin, migration 0009)
 * still does the real access control: any active staff member can list
 * them, only an administrator can create one.
 */

export async function listActiveCommunityHealthWorkers(): Promise<
  CommunityHealthWorkerRow[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("community_health_workers")
    .select("*")
    .eq("status", "active")
    .order("full_name");

  if (error) {
    throw new Error(`Failed to load community health workers: ${error.message}`);
  }
  return data ?? [];
}

export async function listAllCommunityHealthWorkers(): Promise<
  CommunityHealthWorkerRow[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("community_health_workers")
    .select("*")
    .order("full_name");

  if (error) {
    throw new Error(`Failed to load community health workers: ${error.message}`);
  }
  return data ?? [];
}

export interface CreateChwInput {
  full_name: string;
  phone?: string;
  area?: string;
}

export async function createCommunityHealthWorker(
  input: CreateChwInput,
): Promise<CommunityHealthWorkerRow> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("community_health_workers")
    .insert({
      full_name: input.full_name,
      phone: input.phone ?? null,
      area: input.area ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create community health worker: ${error?.message ?? "unknown error"}`);
  }
  return data;
}

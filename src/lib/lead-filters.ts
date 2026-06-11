/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface LeadFilterParams {
  q?: string;
  status?: string;
  source?: string;
  city?: string;
  base?: string; // search id
  asignado?: string; // 'sin' | user id
  prod?: string; // product id
  min?: string; // score mínimo (requiere prod)
  tel?: string; // 'con' | 'sin'
  campania?: string; // campaign id
}

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

/** ¿El filtro por score requiere inner join con lead_scores? */
export function needsScoreJoin(f: LeadFilterParams) {
  return Boolean(f.prod && f.min);
}

/** Resuelve los filtros que necesitan subconsulta (base → runs, campaña → leads). */
export async function resolveFilterIds(supabase: SupabaseClient, f: LeadFilterParams) {
  let runIds: string[] | null = null;
  let leadIds: string[] | null = null;

  if (f.base) {
    const { data } = await supabase.from("search_runs").select("id").eq("search_id", f.base);
    runIds = (data ?? []).map((r) => r.id as string);
  }
  if (f.campania) {
    const { data } = await supabase
      .from("campaign_leads")
      .select("lead_id")
      .eq("campaign_id", f.campania)
      .limit(10000);
    leadIds = (data ?? []).map((r) => r.lead_id as string);
  }
  return { runIds, leadIds };
}

export function applyLeadFilters<T>(
  query: T,
  f: LeadFilterParams,
  ids: { runIds: string[] | null; leadIds: string[] | null }
): T {
  let q = query as any;
  if (f.q?.trim()) q = q.ilike("name", `%${f.q.trim()}%`);
  if (f.status) q = q.eq("status", f.status);
  if (f.source) q = q.eq("source", f.source);
  if (f.city?.trim()) q = q.ilike("city", `%${f.city.trim()}%`);
  if (f.asignado === "sin") q = q.is("assigned_to", null);
  else if (f.asignado) q = q.eq("assigned_to", f.asignado);
  if (f.tel === "con") q = q.not("phone_e164", "is", null);
  else if (f.tel === "sin") q = q.is("phone_e164", null);
  if (ids.runIds) {
    q = ids.runIds.length ? q.in("search_run_id", ids.runIds) : q.eq("id", NIL_UUID);
  }
  if (ids.leadIds) {
    q = ids.leadIds.length ? q.in("id", ids.leadIds) : q.eq("id", NIL_UUID);
  }
  if (needsScoreJoin(f)) {
    q = q.eq("lead_scores.product_id", f.prod).gte("lead_scores.score", parseInt(f.min!, 10) || 0);
  }
  return q as T;
}

"use server";

import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";
import { normalizePhoneAR } from "@/lib/phone";
import { rootDomain } from "@/lib/domain";
import type { CanonicalLeadRow, ImportStats } from "@/lib/types";

/** Crea la búsqueda + corrida para una importación CSV y devuelve el run id. */
export async function createCsvRun(
  name: string
): Promise<{ ok: true; runId: string } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Solo managers y owners importan bases." };

  const { data: search, error: searchError } = await ctx.supabase
    .from("searches")
    .insert({
      org_id: ctx.org.id,
      created_by: ctx.userId,
      name: name.trim() || "Importación CSV",
      sources: ["csv"],
    })
    .select("id")
    .single();
  if (searchError) return { ok: false, error: searchError.message };

  const { data: run, error: runError } = await ctx.supabase
    .from("search_runs")
    .insert({
      search_id: search.id,
      org_id: ctx.org.id,
      status: "corriendo",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (runError) return { ok: false, error: runError.message };

  return { ok: true, runId: run.id };
}

/**
 * Importa un lote de filas canónicas (el cliente parsea el CSV y manda chunks).
 * La dedup y el conteo lo hace la función SQL import_leads (on conflict do nothing).
 */
export async function importChunk(
  runId: string,
  rows: CanonicalLeadRow[]
): Promise<{ ok: true; stats: ImportStats } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  if (!rows.length) return { ok: true, stats: { found: 0, inserted: 0, duplicates: 0 } };

  const normalized = rows.map((r) => ({
    ...r,
    name: r.name?.trim(),
    phone_e164: normalizePhoneAR(r.phone),
    domain: rootDomain(r.website),
    instagram: r.instagram?.trim().replace(/^@/, "") || null,
  }));

  const { data, error } = await ctx.supabase.rpc("import_leads", {
    p_org: ctx.org.id,
    p_run: runId,
    p_source: "csv",
    p_rows: normalized,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bases");
  revalidatePath("/leads");
  return { ok: true, stats: data as ImportStats };
}

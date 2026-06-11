import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startGmapsRun } from "./apify";
import { appUrl } from "./flags";

interface SearchRecipe {
  id: string;
  org_id: string;
  niche: string | null;
  location: string | null;
  target_count: number;
}

/**
 * Lanza una corrida de Google Maps para una búsqueda (alta inicial, re-ejecución
 * manual o cron). El dedup garantiza que solo entren negocios nuevos.
 */
export async function launchGmapsRun(
  db: SupabaseClient,
  search: SearchRecipe
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!search.niche || !search.location)
    return { ok: false, error: "La búsqueda no tiene nicho/zona (¿es una base CSV?)." };

  const webhookToken = randomBytes(16).toString("hex");
  const { data: run, error: runError } = await db
    .from("search_runs")
    .insert({
      search_id: search.id,
      org_id: search.org_id,
      status: "corriendo",
      started_at: new Date().toISOString(),
      stats: { webhook_token: webhookToken },
    })
    .select("id")
    .single();
  if (runError) return { ok: false, error: runError.message };

  const base = appUrl();
  const webhookUrl = base.startsWith("https://")
    ? `${base}/api/apify/webhook?run=${run.id}&token=${webhookToken}`
    : undefined;

  try {
    const apifyRunId = await startGmapsRun({
      niche: search.niche,
      location: search.location,
      count: search.target_count,
      webhookUrl,
    });
    await db.from("search_runs").update({ apify_run_id: apifyRunId }).eq("id", run.id);
    return { ok: true };
  } catch (e) {
    await db
      .from("search_runs")
      .update({ status: "fallido", error: e instanceof Error ? e.message : "Error al iniciar Apify" })
      .eq("id", run.id);
    return { ok: false, error: "No se pudo iniciar la búsqueda en Apify." };
  }
}

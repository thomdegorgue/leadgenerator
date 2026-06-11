import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDatasetItems, fetchRunStatus, mapGmapsItem } from "@/lib/apify";
import { normalizePhoneAR } from "@/lib/phone";
import { rootDomain } from "@/lib/domain";

const CHUNK = 1000;

type AdminClient = ReturnType<typeof createAdminClient>;

/** Baja el dataset de Apify, normaliza e importa con dedup (función SQL import_leads). */
export async function importApifyDataset(
  admin: AdminClient,
  runId: string,
  orgId: string,
  datasetId: string
): Promise<number> {
  const items = await fetchDatasetItems(datasetId);
  const rows = items
    .map(mapGmapsItem)
    .filter((r) => r.name)
    .map((r) => ({
      ...r,
      phone_e164: normalizePhoneAR(r.phone),
      domain: rootDomain(r.website),
    }));

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin.rpc("import_leads", {
      p_org: orgId,
      p_run: runId,
      p_source: "gmaps",
      p_rows: rows.slice(i, i + CHUNK),
    });
    if (error) throw new Error(error.message);
  }

  if (rows.length === 0) {
    await admin
      .from("search_runs")
      .update({ status: "completado", finished_at: new Date().toISOString() })
      .eq("id", runId);
  }

  return rows.length;
}

/**
 * Polling de corridas en progreso. Es el camino principal en local (Apify no
 * puede llegar a localhost con webhooks) y red de seguridad en producción.
 * Se llama desde la página de Bases en cada render mientras haya corridas.
 */
export async function syncRunningApifyRuns(orgId: string): Promise<void> {
  if (!process.env.APIFY_TOKEN) return;

  const admin = createAdminClient();
  const { data: runs } = await admin
    .from("search_runs")
    .select("id, org_id, apify_run_id")
    .eq("org_id", orgId)
    .eq("status", "corriendo")
    .not("apify_run_id", "is", null);

  for (const run of runs ?? []) {
    try {
      const info = await fetchRunStatus(run.apify_run_id as string);
      if (info.status === "SUCCEEDED" && info.datasetId) {
        await importApifyDataset(admin, run.id, run.org_id, info.datasetId);
      } else if (["FAILED", "ABORTED", "TIMED-OUT"].includes(info.status)) {
        await admin
          .from("search_runs")
          .update({
            status: "fallido",
            finished_at: new Date().toISOString(),
            error: `Apify: ${info.status}`,
          })
          .eq("id", run.id);
      }
      // READY / RUNNING: sigue corriendo, el próximo poll lo levanta.
    } catch {
      // Error transitorio de red/API: no marcar fallido, reintenta el próximo poll.
    }
  }
}

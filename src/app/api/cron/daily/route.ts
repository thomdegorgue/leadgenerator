import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { launchGmapsRun } from "@/lib/gmaps-launch";
import { apifyEnabled } from "@/lib/flags";

export const maxDuration = 300;

/**
 * Cron diario (Vercel Cron → vercel.json):
 * 1. Reciclaje: leads contactados sin respuesta hace N días vuelven a la cola
 *    de seguimiento (aparecen en "Para hoy" y en el Modo Focus).
 * 2. Re-ejecución semanal de búsquedas con auto_rerun (solo entran negocios nuevos).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const summary: Record<string, number> = { recycled: 0, reruns: 0 };

  // 1. Reciclaje por organización (settings.recycle_days, default 4)
  const { data: orgs } = await admin.from("organizations").select("id, settings");
  for (const org of orgs ?? []) {
    const days = Number((org.settings as Record<string, unknown>)?.recycle_days) || 4;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { count } = await admin
      .from("leads")
      .update({ next_followup_at: new Date().toISOString() }, { count: "exact" })
      .eq("org_id", org.id)
      .eq("status", "contactado")
      .is("next_followup_at", null)
      .lt("updated_at", cutoff);
    summary.recycled += count ?? 0;
  }

  // 2. Re-ejecución semanal de búsquedas auto_rerun
  if (apifyEnabled()) {
    const { data: searches } = await admin
      .from("searches")
      .select("*")
      .eq("auto_rerun", true)
      .eq("archived", false)
      .contains("sources", ["gmaps"]);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const search of searches ?? []) {
      const { data: lastRun } = await admin
        .from("search_runs")
        .select("created_at, status")
        .eq("search_id", search.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const isRunning = lastRun?.status === "corriendo" || lastRun?.status === "pendiente";
      const isDue = !lastRun || lastRun.created_at < weekAgo;
      if (isDue && !isRunning) {
        const result = await launchGmapsRun(admin, search);
        if (result.ok) summary.reruns += 1;
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary });
}

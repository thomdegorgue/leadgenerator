"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";
import { apifyEnabled, appUrl } from "@/lib/flags";
import { startGmapsRun } from "@/lib/apify";

export async function startGmapsSearch(input: {
  name: string;
  niche: string;
  location: string;
  count: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Solo managers y owners generan bases." };
  if (!apifyEnabled()) return { ok: false, error: "Apify no está configurado (APIFY_TOKEN)." };
  if (!input.niche.trim() || !input.location.trim())
    return { ok: false, error: "Nicho y zona son obligatorios." };

  const count = Math.min(Math.max(input.count || 100, 1), 10_000);

  const { data: search, error: searchError } = await ctx.supabase
    .from("searches")
    .insert({
      org_id: ctx.org.id,
      created_by: ctx.userId,
      name: input.name.trim() || `${input.niche} — ${input.location}`,
      sources: ["gmaps"],
      niche: input.niche.trim(),
      location: input.location.trim(),
      target_count: count,
    })
    .select("id")
    .single();
  if (searchError) return { ok: false, error: searchError.message };

  const webhookToken = randomBytes(16).toString("hex");
  const { data: run, error: runError } = await ctx.supabase
    .from("search_runs")
    .insert({
      search_id: search.id,
      org_id: ctx.org.id,
      status: "corriendo",
      started_at: new Date().toISOString(),
      stats: { webhook_token: webhookToken },
    })
    .select("id")
    .single();
  if (runError) return { ok: false, error: runError.message };

  try {
    const apifyRunId = await startGmapsRun({
      niche: input.niche.trim(),
      location: input.location.trim(),
      count,
      webhookUrl: `${appUrl()}/api/apify/webhook?run=${run.id}&token=${webhookToken}`,
    });
    await ctx.supabase.from("search_runs").update({ apify_run_id: apifyRunId }).eq("id", run.id);
  } catch (e) {
    await ctx.supabase
      .from("search_runs")
      .update({ status: "fallido", error: e instanceof Error ? e.message : "Error al iniciar Apify" })
      .eq("id", run.id);
    return { ok: false, error: "No se pudo iniciar la búsqueda en Apify. Revisá el token." };
  }

  revalidatePath("/bases");
  return { ok: true };
}

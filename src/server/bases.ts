"use server";

import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { apifyEnabled } from "@/lib/flags";
import { launchGmapsRun } from "@/lib/gmaps-launch";
import type { DistributionMode } from "@/server/team";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function startGmapsSearch(input: {
  name: string;
  niche: string;
  location: string;
  count: number;
  productId?: string | null;
  autoRerun?: boolean;
}): Promise<ActionResult> {
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
      product_id: input.productId || null,
      auto_rerun: Boolean(input.autoRerun),
    })
    .select("*")
    .single();
  if (searchError) return { ok: false, error: searchError.message };

  const result = await launchGmapsRun(ctx.supabase, search);
  revalidatePath("/bases");
  return result;
}

export async function rerunSearch(searchId: string): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  if (!apifyEnabled()) return { ok: false, error: "Apify no está configurado." };

  const { data: search } = await ctx.supabase
    .from("searches")
    .select("*")
    .eq("id", searchId)
    .maybeSingle();
  if (!search) return { ok: false, error: "Búsqueda no encontrada." };

  const result = await launchGmapsRun(ctx.supabase, search);
  revalidatePath("/bases");
  revalidatePath(`/bases/${searchId}`);
  return result;
}

export async function updateSearch(
  searchId: string,
  fields: { name?: string; notes?: string; productId?: string | null; autoRerun?: boolean }
): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };

  const { error } = await ctx.supabase
    .from("searches")
    .update({
      ...(fields.name !== undefined ? { name: fields.name.trim() } : {}),
      ...(fields.notes !== undefined ? { notes: fields.notes.trim() || null } : {}),
      ...(fields.productId !== undefined ? { product_id: fields.productId || null } : {}),
      ...(fields.autoRerun !== undefined ? { auto_rerun: fields.autoRerun } : {}),
    })
    .eq("id", searchId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bases");
  revalidatePath(`/bases/${searchId}`);
  return { ok: true };
}

export async function setSearchArchived(searchId: string, archived: boolean): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  const { error } = await ctx.supabase.from("searches").update({ archived }).eq("id", searchId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bases");
  return { ok: true };
}

/**
 * Borra la base. Si deleteUncontacted: elimina también sus leads que nunca
 * fueron trabajados (nuevo/asignado sin actividad). El resto de los leads
 * queda en el sistema (pierden la referencia a la base).
 */
export async function deleteSearch(
  searchId: string,
  deleteUncontacted: boolean
): Promise<{ ok: true; deletedLeads: number } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!(ctx.profile.is_super_admin || ctx.role === "owner"))
    return { ok: false, error: "Solo el owner borra bases." };

  const admin = createAdminClient();
  let deletedLeads = 0;

  if (deleteUncontacted) {
    const { data: runs } = await admin.from("search_runs").select("id").eq("search_id", searchId);
    const runIds = (runs ?? []).map((r) => r.id);
    if (runIds.length) {
      const { count } = await admin
        .from("leads")
        .delete({ count: "exact" })
        .in("search_run_id", runIds)
        .in("status", ["nuevo", "asignado"]);
      deletedLeads = count ?? 0;
    }
  }

  const { error } = await admin.from("searches").delete().eq("id", searchId).eq("org_id", ctx.org.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/bases");
  revalidatePath("/leads");
  return { ok: true, deletedLeads };
}

/** Reparte los leads sin asignar de UNA base a un equipo o vendedor. */
export async function distributeBase(
  searchId: string,
  target: { teamId?: string; userId?: string },
  mode: DistributionMode
): Promise<{ ok: true; assigned: number } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };

  const admin = createAdminClient();

  const [{ data: search }, { data: runs }] = await Promise.all([
    admin.from("searches").select("product_id").eq("id", searchId).single(),
    admin.from("search_runs").select("id").eq("search_id", searchId),
  ]);
  const runIds = (runs ?? []).map((r) => r.id);
  if (!runIds.length) return { ok: true, assigned: 0 };

  // Destinatarios
  let sellerIds: string[] = [];
  if (target.userId) {
    sellerIds = [target.userId];
  } else if (target.teamId) {
    const { data: sellers } = await admin
      .from("memberships")
      .select("user_id")
      .eq("org_id", ctx.org.id)
      .eq("team_id", target.teamId)
      .eq("role", "vendedor");
    sellerIds = (sellers ?? []).map((s) => s.user_id);
  }
  if (!sellerIds.length) return { ok: false, error: "No hay vendedores en el destino elegido." };

  // Leads de la base sin asignar, con score (del producto objetivo si hay)
  const { data: leadsRaw } = await admin
    .from("leads")
    .select("id, lead_scores(score, product_id)")
    .eq("org_id", ctx.org.id)
    .in("search_run_id", runIds)
    .is("assigned_to", null)
    .in("status", ["nuevo"])
    .limit(2000);

  let leads = (leadsRaw ?? []).map((l) => {
    const scores = (l.lead_scores as { score: number; product_id: string }[] | null) ?? [];
    const relevant = search?.product_id
      ? scores.filter((s) => s.product_id === search.product_id)
      : scores;
    return { id: l.id as string, score: Math.max(0, ...relevant.map((s) => s.score)) };
  });
  if (!leads.length) return { ok: true, assigned: 0 };

  if (mode === "por_score") leads = [...leads].sort((a, b) => b.score - a.score);

  const now = new Date().toISOString();
  const buckets = new Map<string, string[]>();

  if (mode === "por_carga" && sellerIds.length > 1) {
    const loads = new Map<string, number>();
    await Promise.all(
      sellerIds.map(async (id) => {
        const { count } = await admin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", id)
          .not("status", "in", "(cliente,descartado)");
        loads.set(id, count ?? 0);
      })
    );
    for (const lead of leads) {
      const seller = [...loads.entries()].sort((a, b) => a[1] - b[1])[0][0];
      buckets.set(seller, [...(buckets.get(seller) ?? []), lead.id]);
      loads.set(seller, (loads.get(seller) ?? 0) + 1);
    }
  } else {
    leads.forEach((lead, i) => {
      const seller = sellerIds[i % sellerIds.length];
      buckets.set(seller, [...(buckets.get(seller) ?? []), lead.id]);
    });
  }

  for (const [sellerId, leadIds] of buckets) {
    const { error } = await admin
      .from("leads")
      .update({ assigned_to: sellerId, assigned_at: now, status: "asignado" })
      .in("id", leadIds);
    if (error) return { ok: false, error: error.message };
    await admin.from("activities").insert(
      leadIds.map((leadId) => ({
        org_id: ctx.org.id,
        lead_id: leadId,
        user_id: ctx.userId,
        type: "asignacion",
        payload: { assigned_to: sellerId, base: searchId, auto: true },
      }))
    );
  }

  revalidatePath(`/bases/${searchId}`);
  revalidatePath("/leads");
  return { ok: true, assigned: leads.length };
}

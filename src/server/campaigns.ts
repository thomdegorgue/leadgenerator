"use server";

import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Crea una campaña con filtro (producto + score mínimo + ciudad) y le carga
 * los leads que matchean hoy. Después se le pueden sumar más desde Leads.
 */
export async function createCampaign(input: {
  name: string;
  productId: string | null;
  minScore: number;
  city?: string;
  teamId?: string | null;
}): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Solo managers y owners crean campañas." };
  if (!input.name.trim()) return { ok: false, error: "El nombre es obligatorio." };

  const admin = createAdminClient();

  const { data: campaign, error } = await admin
    .from("campaigns")
    .insert({
      org_id: ctx.org.id,
      name: input.name.trim(),
      product_id: input.productId,
      team_id: input.teamId || null,
      filters: { min_score: input.minScore, city: input.city || null },
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Leads que matchean el filtro hoy
  let query = admin
    .from("leads")
    .select(input.productId ? "id, lead_scores!inner(score, product_id)" : "id")
    .eq("org_id", ctx.org.id)
    .not("status", "in", "(cliente,descartado)")
    .limit(2000);
  if (input.city?.trim()) query = query.ilike("city", `%${input.city.trim()}%`);
  if (input.productId) {
    query = query
      .eq("lead_scores.product_id", input.productId)
      .gte("lead_scores.score", input.minScore);
  }

  const { data: leads } = await query;
  const leadIds = ((leads ?? []) as unknown as { id: string }[]).map((l) => l.id);

  if (leadIds.length) {
    await admin.from("campaign_leads").upsert(
      leadIds.map((leadId) => ({ campaign_id: campaign.id, lead_id: leadId })),
      { onConflict: "campaign_id,lead_id", ignoreDuplicates: true }
    );
  }

  revalidatePath("/campanas");
  return { ok: true, added: leadIds.length };
}

export async function setCampaignStatus(id: string, status: string): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  const { error } = await ctx.supabase.from("campaigns").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/campanas");
  return { ok: true };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  const { error } = await ctx.supabase.from("campaigns").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/campanas");
  return { ok: true };
}

/** Reparte los leads sin asignar de la campaña entre los vendedores de su equipo. */
export async function distributeCampaign(
  campaignId: string
): Promise<{ ok: true; assigned: number } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };

  const admin = createAdminClient();
  const { data: campaign } = await admin
    .from("campaigns")
    .select("team_id")
    .eq("id", campaignId)
    .single();
  if (!campaign?.team_id)
    return { ok: false, error: "La campaña no tiene equipo asignado (editá la campaña)." };

  const [{ data: sellers }, { data: links }] = await Promise.all([
    admin
      .from("memberships")
      .select("user_id")
      .eq("org_id", ctx.org.id)
      .eq("team_id", campaign.team_id)
      .eq("role", "vendedor"),
    admin.from("campaign_leads").select("lead_id").eq("campaign_id", campaignId).limit(5000),
  ]);
  if (!sellers?.length) return { ok: false, error: "El equipo no tiene vendedores." };

  const leadIds = (links ?? []).map((l) => l.lead_id);
  if (!leadIds.length) return { ok: true, assigned: 0 };

  const { data: unassigned } = await admin
    .from("leads")
    .select("id")
    .in("id", leadIds)
    .is("assigned_to", null)
    .eq("status", "nuevo");
  if (!unassigned?.length) return { ok: true, assigned: 0 };

  const now = new Date().toISOString();
  const buckets = new Map<string, string[]>();
  unassigned.forEach((lead, i) => {
    const seller = sellers[i % sellers.length].user_id;
    buckets.set(seller, [...(buckets.get(seller) ?? []), lead.id]);
  });

  for (const [sellerId, ids] of buckets) {
    await admin
      .from("leads")
      .update({ assigned_to: sellerId, assigned_at: now, status: "asignado" })
      .in("id", ids);
    await admin.from("activities").insert(
      ids.map((leadId) => ({
        org_id: ctx.org.id,
        lead_id: leadId,
        user_id: ctx.userId,
        type: "asignacion",
        payload: { assigned_to: sellerId, campaign: campaignId, auto: true },
      }))
    );
  }

  revalidatePath("/campanas");
  revalidatePath("/leads");
  return { ok: true, assigned: unassigned.length };
}

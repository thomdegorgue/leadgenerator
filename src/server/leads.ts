"use server";

import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";
import { normalizePhoneAR } from "@/lib/phone";
import { rootDomain } from "@/lib/domain";
import type { LeadStatus } from "@/lib/types";

type ActionResult = { ok: true } | { ok: false; error: string };

async function logActivity(
  ctx: Awaited<ReturnType<typeof getCtx>>,
  leadId: string,
  type: string,
  fields: { result?: string | null; note?: string | null; payload?: Record<string, unknown> } = {}
) {
  await ctx.supabase.from("activities").insert({
    org_id: ctx.org.id,
    lead_id: leadId,
    user_id: ctx.userId,
    type,
    result: fields.result ?? null,
    note: fields.note ?? null,
    payload: fields.payload ?? {},
  });
}

export async function createLead(input: {
  name: string;
  category?: string;
  phone?: string;
  email?: string;
  website?: string;
  instagram?: string;
  address?: string;
  city?: string;
  province?: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "No tenés permisos para crear leads." };
  if (!input.name?.trim()) return { ok: false, error: "El nombre es obligatorio." };

  const { data, error } = await ctx.supabase
    .from("leads")
    .insert({
      org_id: ctx.org.id,
      source: "manual",
      name: input.name.trim(),
      category: input.category?.trim() || null,
      phone: input.phone?.trim() || null,
      phone_e164: normalizePhoneAR(input.phone),
      email: input.email?.trim() || null,
      website: input.website?.trim() || null,
      domain: rootDomain(input.website),
      instagram: input.instagram?.trim().replace(/^@/, "") || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "Ya existe un lead con ese teléfono, web o lugar de Google." };
    return { ok: false, error: error.message };
  }

  await ctx.supabase.rpc("compute_rule_scores", { p_lead: data.id });
  revalidatePath("/leads");
  return { ok: true, id: data.id };
}

export async function updateLeadStatus(leadId: string, status: LeadStatus): Promise<ActionResult> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase.from("leads").update({ status }).eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  await logActivity(ctx, leadId, "cambio_estado", { result: status });
  revalidatePath("/pipeline");
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function assignLead(leadId: string, userId: string | null): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Solo managers y owners asignan leads." };

  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .single();

  const { error } = await ctx.supabase
    .from("leads")
    .update({
      assigned_to: userId,
      assigned_at: userId ? new Date().toISOString() : null,
      ...(userId && lead?.status === "nuevo" ? { status: "asignado" satisfies LeadStatus } : {}),
    })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  await logActivity(ctx, leadId, "asignacion", { payload: { assigned_to: userId } });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

/** Se registra al abrir el link de WhatsApp: contacto saliente. */
export async function logWhatsAppContact(leadId: string, templateName: string): Promise<ActionResult> {
  const ctx = await getCtx();

  await logActivity(ctx, leadId, "whatsapp", { note: `Plantilla: ${templateName}` });

  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .single();
  if (lead && (lead.status === "nuevo" || lead.status === "asignado")) {
    await ctx.supabase.from("leads").update({ status: "contactado" }).eq("id", leadId);
  }

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Resultado en 1 tap después de enviar el WhatsApp. */
export async function logWhatsAppResult(
  leadId: string,
  result: "respondio" | "sin_respuesta" | "numero_invalido"
): Promise<ActionResult> {
  const ctx = await getCtx();
  await logActivity(ctx, leadId, "respuesta", { result });

  if (result === "respondio") {
    await ctx.supabase.from("leads").update({ status: "respondio", next_followup_at: null }).eq("id", leadId);
  } else if (result === "sin_respuesta") {
    const followup = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await ctx.supabase.from("leads").update({ next_followup_at: followup }).eq("id", leadId);
  }

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function addNote(leadId: string, note: string): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!note.trim()) return { ok: false, error: "La nota está vacía." };
  await logActivity(ctx, leadId, "nota", { note: note.trim() });
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function discardLead(leadId: string, reason?: string): Promise<ActionResult> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase
    .from("leads")
    .update({ status: "descartado", next_followup_at: null, discard_reason: reason ?? "otro" })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  await logActivity(ctx, leadId, "descarte", { result: reason ?? "otro" });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
  return { ok: true };
}

/** Edición completa de los datos del lead. Re-normaliza claves de dedup y re-puntúa. */
export async function updateLead(
  leadId: string,
  input: {
    name: string;
    category?: string;
    phone?: string;
    email?: string;
    website?: string;
    instagram?: string;
    address?: string;
    city?: string;
    province?: string;
  }
): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!input.name?.trim()) return { ok: false, error: "El nombre es obligatorio." };

  const { error } = await ctx.supabase
    .from("leads")
    .update({
      name: input.name.trim(),
      category: input.category?.trim() || null,
      phone: input.phone?.trim() || null,
      phone_e164: normalizePhoneAR(input.phone),
      email: input.email?.trim() || null,
      website: input.website?.trim() || null,
      domain: rootDomain(input.website),
      instagram: input.instagram?.trim().replace(/^@/, "") || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      province: input.province?.trim() || null,
    })
    .eq("id", leadId);

  if (error) {
    if (error.code === "23505")
      return { ok: false, error: "Otro lead ya tiene ese teléfono, web o lugar de Google." };
    return { ok: false, error: error.message };
  }

  await ctx.supabase.rpc("compute_rule_scores", { p_lead: leadId });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  return { ok: true };
}

export async function scheduleFollowup(leadId: string, days: number): Promise<ActionResult> {
  const ctx = await getCtx();
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await ctx.supabase
    .from("leads")
    .update({ next_followup_at: date })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  await logActivity(ctx, leadId, "nota", { note: `Seguimiento agendado en ${days} días` });
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Cierre con datos: marca cliente y registra qué se vendió y por cuánto. */
export async function registerDeal(
  leadId: string,
  productId: string | null,
  monthlyValue: number | null
): Promise<ActionResult> {
  const ctx = await getCtx();
  const { error } = await ctx.supabase
    .from("leads")
    .update({
      status: "cliente",
      deal_product_id: productId,
      deal_value: monthlyValue,
      next_followup_at: null,
    })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  await logActivity(ctx, leadId, "cierre", {
    payload: { product_id: productId, monthly_value: monthlyValue },
    note: monthlyValue ? `Venta cerrada: $${monthlyValue}/mes` : "Venta cerrada",
  });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
  return { ok: true };
}

export type BulkAction =
  | { type: "assign_user"; userId: string | null }
  | { type: "assign_team"; teamId: string }
  | { type: "status"; status: LeadStatus }
  | { type: "discard"; reason: string }
  | { type: "campaign"; campaignId: string };

/** Acciones masivas sobre una selección de leads (solo admins). */
export async function bulkLeads(
  leadIds: string[],
  action: BulkAction
): Promise<{ ok: true; affected: number } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Solo managers y owners." };
  const ids = leadIds.slice(0, 1000);
  if (!ids.length) return { ok: true, affected: 0 };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const activityRows = (type: string, extra: Record<string, unknown> = {}) =>
    ids.map((leadId) => ({
      org_id: ctx.org.id,
      lead_id: leadId,
      user_id: ctx.userId,
      type,
      ...extra,
    }));

  switch (action.type) {
    case "assign_user": {
      // Cambia el dueño sin pisar el estado de los avanzados...
      const { error } = await admin
        .from("leads")
        .update({ assigned_to: action.userId, assigned_at: action.userId ? now : null })
        .in("id", ids)
        .eq("org_id", ctx.org.id);
      if (error) return { ok: false, error: error.message };
      // ...y solo los "nuevo" pasan a "asignado"
      if (action.userId) {
        await admin
          .from("leads")
          .update({ status: "asignado" })
          .in("id", ids)
          .eq("org_id", ctx.org.id)
          .eq("status", "nuevo");
      }
      await admin.from("activities").insert(activityRows("asignacion", { payload: { assigned_to: action.userId, bulk: true } }));
      break;
    }
    case "assign_team": {
      const { data: sellers } = await admin
        .from("memberships")
        .select("user_id")
        .eq("org_id", ctx.org.id)
        .eq("team_id", action.teamId)
        .eq("role", "vendedor");
      if (!sellers?.length) return { ok: false, error: "Ese equipo no tiene vendedores." };

      // Round-robin entre los vendedores del equipo
      const buckets = new Map<string, string[]>();
      ids.forEach((leadId, i) => {
        const seller = sellers[i % sellers.length].user_id;
        buckets.set(seller, [...(buckets.get(seller) ?? []), leadId]);
      });
      for (const [seller, leadGroup] of buckets) {
        const { error } = await admin
          .from("leads")
          .update({ assigned_to: seller, assigned_at: now })
          .in("id", leadGroup)
          .eq("org_id", ctx.org.id);
        if (error) return { ok: false, error: error.message };
      }
      await admin
        .from("leads")
        .update({ status: "asignado" })
        .in("id", ids)
        .eq("org_id", ctx.org.id)
        .eq("status", "nuevo");
      await admin.from("activities").insert(activityRows("asignacion", { payload: { team_id: action.teamId, bulk: true } }));
      break;
    }
    case "status": {
      const { error } = await admin
        .from("leads")
        .update({ status: action.status })
        .in("id", ids)
        .eq("org_id", ctx.org.id);
      if (error) return { ok: false, error: error.message };
      await admin.from("activities").insert(activityRows("cambio_estado", { result: action.status }));
      break;
    }
    case "discard": {
      const { error } = await admin
        .from("leads")
        .update({ status: "descartado", discard_reason: action.reason, next_followup_at: null })
        .in("id", ids)
        .eq("org_id", ctx.org.id);
      if (error) return { ok: false, error: error.message };
      await admin.from("activities").insert(activityRows("descarte", { result: action.reason }));
      break;
    }
    case "campaign": {
      const { error } = await admin.from("campaign_leads").upsert(
        ids.map((leadId) => ({ campaign_id: action.campaignId, lead_id: leadId })),
        { onConflict: "campaign_id,lead_id", ignoreDuplicates: true }
      );
      if (error) return { ok: false, error: error.message };
      break;
    }
  }

  revalidatePath("/leads");
  revalidatePath("/pipeline");
  return { ok: true, affected: ids.length };
}

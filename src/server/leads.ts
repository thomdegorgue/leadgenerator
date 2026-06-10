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
    .update({ status: "descartado", next_followup_at: null })
    .eq("id", leadId);
  if (error) return { ok: false, error: error.message };
  await logActivity(ctx, leadId, "descarte", { note: reason ?? null });
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline");
  return { ok: true };
}

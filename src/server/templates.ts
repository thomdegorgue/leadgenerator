"use server";

import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function upsertTemplate(input: {
  id?: string;
  name: string;
  stage: string;
  body: string;
  product_id?: string | null;
}): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Solo managers y owners editan plantillas." };
  if (!input.name.trim() || !input.body.trim())
    return { ok: false, error: "Nombre y mensaje son obligatorios." };

  const row = {
    org_id: ctx.org.id,
    name: input.name.trim(),
    stage: input.stage,
    body: input.body.trim(),
    product_id: input.product_id || null,
  };

  const { error } = input.id
    ? await ctx.supabase.from("message_templates").update(row).eq("id", input.id)
    : await ctx.supabase.from("message_templates").insert(row);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/plantillas");
  return { ok: true };
}

export async function toggleTemplate(id: string, active: boolean): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  const { error } = await ctx.supabase.from("message_templates").update({ active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/plantillas");
  return { ok: true };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  const { error } = await ctx.supabase.from("message_templates").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/plantillas");
  return { ok: true };
}

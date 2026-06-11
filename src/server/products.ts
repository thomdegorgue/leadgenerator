"use server";

import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";

type ActionResult = { ok: true } | { ok: false; error: string };

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function canManageProducts(ctx: Awaited<ReturnType<typeof getCtx>>) {
  return ctx.profile.is_super_admin || ctx.role === "owner";
}

export async function upsertProduct(input: {
  id?: string;
  name: string;
  description?: string;
  pitch?: string;
  priceFrom?: string;
  categoryKeywords: string[];
  scoreRules: Record<string, number>;
  active: boolean;
}): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!canManageProducts(ctx)) return { ok: false, error: "Solo el owner gestiona productos." };
  if (!input.name.trim()) return { ok: false, error: "El nombre es obligatorio." };

  // Solo reglas con puntaje válido
  const rules = Object.fromEntries(
    Object.entries(input.scoreRules).filter(([, pts]) => Number.isFinite(pts) && pts > 0)
  );

  const row = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    pitch: input.pitch?.trim() || null,
    price_from: input.priceFrom?.trim() || null,
    category_keywords: input.categoryKeywords.map((k) => k.trim().toLowerCase()).filter(Boolean),
    score_rules: rules,
    active: input.active,
  };

  const { error } = input.id
    ? await ctx.supabase.from("products").update(row).eq("id", input.id)
    : await ctx.supabase
        .from("products")
        .insert({ ...row, org_id: ctx.org.id, slug: slugify(input.name) || `producto-${Date.now()}` });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya existe un producto con ese nombre." };
    return { ok: false, error: error.message };
  }

  revalidatePath("/productos");
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!canManageProducts(ctx)) return { ok: false, error: "Solo el owner borra productos." };
  const { error } = await ctx.supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/productos");
  return { ok: true };
}

/** Recalcula los scores por reglas de toda la base (los de IA no se pisan). */
export async function recalcAllScores(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };

  const { data, error } = await ctx.supabase.rpc("recompute_org_scores", { p_org: ctx.org.id });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/leads");
  return { ok: true, count: (data as number) ?? 0 };
}

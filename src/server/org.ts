"use server";

import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";

/** Configuración de la organización (reciclaje, meta diaria). Solo owner. */
export async function updateOrgSettings(input: {
  recycleDays: number;
  dailyGoal: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!(ctx.profile.is_super_admin || ctx.role === "owner"))
    return { ok: false, error: "Solo el owner cambia la configuración." };

  const { data: org } = await ctx.supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.org.id)
    .single();

  const { error } = await ctx.supabase
    .from("organizations")
    .update({
      settings: {
        ...((org?.settings as Record<string, unknown>) ?? {}),
        recycle_days: Math.min(Math.max(input.recycleDays, 1), 60),
        daily_goal: Math.min(Math.max(input.dailyGoal, 1), 500),
      },
    })
    .eq("id", ctx.org.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/ajustes");
  return { ok: true };
}

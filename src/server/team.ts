"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/types";

type ActionResult = { ok: true } | { ok: false; error: string };

function canManageMembers(ctx: Awaited<ReturnType<typeof getCtx>>) {
  return ctx.profile.is_super_admin || ctx.role === "owner";
}

/** Crea el usuario en Auth + membresía. Devuelve la contraseña temporal (se muestra una sola vez). */
export async function inviteUser(input: {
  email: string;
  fullName: string;
  role: Role;
  teamId?: string | null;
}): Promise<{ ok: true; password: string } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!canManageMembers(ctx)) return { ok: false, error: "Solo el owner puede invitar usuarios." };

  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Email inválido." };

  const admin = createAdminClient();
  const password = randomBytes(9).toString("base64url");

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
  });
  if (createError) return { ok: false, error: createError.message };

  // El trigger handle_new_user crea el perfil; aseguramos el nombre.
  await admin
    .from("profiles")
    .update({ full_name: input.fullName.trim() })
    .eq("id", created.user.id);

  const { error: memberError } = await admin.from("memberships").insert({
    org_id: ctx.org.id,
    user_id: created.user.id,
    role: input.role,
    team_id: input.teamId || null,
  });
  if (memberError) return { ok: false, error: memberError.message };

  revalidatePath("/equipo");
  return { ok: true, password };
}

export async function createTeam(name: string): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  const { error } = await ctx.supabase.from("teams").insert({ org_id: ctx.org.id, name: name.trim() });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipo");
  return { ok: true };
}

export async function updateMember(
  membershipId: string,
  fields: { role?: Role; teamId?: string | null }
): Promise<ActionResult> {
  const ctx = await getCtx();
  if (!canManageMembers(ctx)) return { ok: false, error: "Solo el owner modifica miembros." };

  const { error } = await ctx.supabase
    .from("memberships")
    .update({
      ...(fields.role ? { role: fields.role } : {}),
      ...(fields.teamId !== undefined ? { team_id: fields.teamId } : {}),
    })
    .eq("id", membershipId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/equipo");
  return { ok: true };
}

/** Distribución automática: reparte los leads sin asignar entre los vendedores, round-robin. */
export async function distributeLeads(): Promise<
  { ok: true; assigned: number; sellers: number } | { ok: false; error: string }
> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Solo managers y owners distribuyen leads." };

  const admin = createAdminClient();

  const [{ data: sellers }, { data: leads }] = await Promise.all([
    admin
      .from("memberships")
      .select("user_id")
      .eq("org_id", ctx.org.id)
      .eq("role", "vendedor"),
    admin
      .from("leads")
      .select("id")
      .eq("org_id", ctx.org.id)
      .is("assigned_to", null)
      .in("status", ["nuevo"])
      .order("created_at", { ascending: true })
      .limit(2000),
  ]);

  if (!sellers?.length) return { ok: false, error: "No hay vendedores en el equipo todavía." };
  if (!leads?.length) return { ok: true, assigned: 0, sellers: sellers.length };

  const now = new Date().toISOString();
  const buckets = new Map<string, string[]>();
  leads.forEach((lead, i) => {
    const seller = sellers[i % sellers.length].user_id;
    buckets.set(seller, [...(buckets.get(seller) ?? []), lead.id]);
  });

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
        payload: { assigned_to: sellerId, auto: true },
      }))
    );
  }

  revalidatePath("/leads");
  revalidatePath("/equipo");
  return { ok: true, assigned: leads.length, sellers: sellers.length };
}

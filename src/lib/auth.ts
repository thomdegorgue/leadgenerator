import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Organization, Profile, Role } from "@/lib/types";

export interface SessionCtx {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  profile: Profile;
  membership: Membership;
  org: Organization;
  role: Role;
  /** owner, manager o super admin: puede importar, asignar y configurar. */
  isAdmin: boolean;
}

/** Contexto de sesión para páginas y server actions. Redirige si no hay acceso. */
export async function getCtx(): Promise<SessionCtx> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("memberships")
      .select("*, organizations(*)")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!profile || !membership) redirect("/sin-acceso");

  const org = (membership as { organizations: Organization }).organizations;
  const role = membership.role as Role;

  return {
    supabase,
    userId: user.id,
    profile: profile as Profile,
    membership: membership as Membership,
    org,
    role,
    isAdmin: (profile as Profile).is_super_admin || role === "owner" || role === "manager",
  };
}

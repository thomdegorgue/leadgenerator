import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/utils";
import type { Role, Team } from "@/lib/types";
import { EquipoActions, InviteButton } from "./equipo-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipo" };

const ROLE_BADGES: Record<Role, string> = {
  owner: "bg-accent/10 text-accent border-accent/30",
  manager: "bg-violet-400/10 text-violet-300 border-violet-400/25",
  vendedor: "bg-slate-400/10 text-slate-300 border-slate-400/25",
};

export default async function EquipoPage() {
  const ctx = await getCtx();
  if (!ctx.isAdmin) redirect("/");

  const [{ data: members }, { data: teams }, { count: unassigned }] = await Promise.all([
    ctx.supabase
      .from("memberships")
      .select("id, role, team_id, user_id, profiles(full_name)")
      .eq("org_id", ctx.org.id)
      .order("created_at"),
    ctx.supabase.from("teams").select("*").eq("org_id", ctx.org.id).order("name"),
    ctx.supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("assigned_to", null)
      .eq("status", "nuevo"),
  ]);

  const memberRows = await Promise.all(
    (members ?? []).map(async (m) => {
      const { count } = await ctx.supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", m.user_id)
        .not("status", "in", "(cliente,descartado)");
      return {
        id: m.id as string,
        userId: m.user_id as string,
        role: m.role as Role,
        teamId: m.team_id as string | null,
        name:
          (m.profiles as unknown as { full_name: string | null } | null)?.full_name ??
          "Sin nombre",
        activeLeads: count ?? 0,
      };
    })
  );

  const isOwner = ctx.profile.is_super_admin || ctx.role === "owner";
  const typedTeams = (teams ?? []) as Team[];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Equipo</h1>
          <p className="text-sm text-muted">{ctx.org.name} · {memberRows.length} miembros</p>
        </div>
        {isOwner && <InviteButton teams={typedTeams} />}
      </header>

      <EquipoActions unassignedCount={unassigned ?? 0} teams={typedTeams} />

      <section className="space-y-2">
        {memberRows.map((m) => {
          const team = typedTeams.find((t) => t.id === m.teamId);
          return (
            <Card key={m.id} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface2 text-xs font-semibold text-accent">
                {initials(m.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="text-xs text-muted">{team?.name ?? "Sin equipo"}</p>
              </div>
              <p className="numeric text-sm text-muted">
                <span className="text-fg">{m.activeLeads}</span> activos
              </p>
              <Badge className={ROLE_BADGES[m.role]}>{m.role}</Badge>
            </Card>
          );
        })}
      </section>
    </div>
  );
}

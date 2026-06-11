import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { timeAgo } from "@/lib/utils";
import type { LeadStatus, Role, Team } from "@/lib/types";
import { EquipoActions, InviteButton, MemberRow } from "./equipo-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipo" };

export default async function EquipoPage() {
  const ctx = await getCtx();
  if (!ctx.isAdmin) redirect("/");

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: members }, { data: teams }, { count: unassigned }, { data: stalled }] =
    await Promise.all([
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
      ctx.supabase
        .from("leads")
        .select("id, name, status, updated_at, assignee:profiles!leads_assigned_to_fkey(full_name)")
        .not("assigned_to", "is", null)
        .not("status", "in", "(cliente,descartado,nuevo)")
        .lt("updated_at", weekAgo)
        .order("updated_at", { ascending: true })
        .limit(10),
    ]);

  const memberRows = await Promise.all(
    (members ?? []).map(async (m) => {
      const [active, contacts7d, respondieron, clientes] = await Promise.all([
        ctx.supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", m.user_id)
          .not("status", "in", "(cliente,descartado)"),
        ctx.supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("user_id", m.user_id)
          .eq("type", "whatsapp")
          .gte("created_at", weekAgo),
        ctx.supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", m.user_id)
          .in("status", ["respondio", "reunion", "propuesta"]),
        ctx.supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", m.user_id)
          .eq("status", "cliente"),
      ]);
      return {
        id: m.id as string,
        userId: m.user_id as string,
        role: m.role as Role,
        teamId: m.team_id as string | null,
        name:
          (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "Sin nombre",
        activeLeads: active.count ?? 0,
        contacts7d: contacts7d.count ?? 0,
        responded: respondieron.count ?? 0,
        clients: clientes.count ?? 0,
      };
    })
  );

  const isOwner = ctx.profile.is_super_admin || ctx.role === "owner";
  const typedTeams = (teams ?? []) as Team[];

  return (
    <div className="space-y-6">
      <PageHeader index="10" title="Equipo" sub={`${ctx.org.name} · ${memberRows.length} miembros`}>
        {isOwner && <InviteButton teams={typedTeams} />}
      </PageHeader>

      <EquipoActions unassignedCount={unassigned ?? 0} teams={typedTeams} />

      <section>
        <h2 className="microlabel mb-3 text-fg">Rendimiento</h2>
        <div className="overflow-hidden border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Miembro</th>
                <th className="numeric px-3 py-3 text-right font-medium">Activos</th>
                <th className="numeric px-3 py-3 text-right font-medium">Contactos 7d</th>
                <th className="numeric px-3 py-3 text-right font-medium">En charla</th>
                <th className="numeric px-3 py-3 text-right font-medium">Clientes</th>
                <th className="px-3 py-3 font-medium">Rol / Equipo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {memberRows.map((m) => (
                <MemberRow key={m.id} member={m} teams={typedTeams} isOwner={isOwner} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(stalled?.length ?? 0) > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="size-4 text-warn" />
            <h2 className="microlabel text-fg">Leads estancados (+7 días sin actividad)</h2>
          </div>
          <Card className="divide-y divide-line p-0 sm:p-0">
            {stalled!.map((lead) => (
              <Link
                key={lead.id}
                href={`/leads/${lead.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface2/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{lead.name}</p>
                  <p className="text-xs text-muted">
                    {(lead.assignee as unknown as { full_name: string | null } | null)?.full_name ?? "—"} ·
                    sin tocar {timeAgo(lead.updated_at)}
                  </p>
                </div>
                <StatusBadge status={lead.status as LeadStatus} />
              </Link>
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

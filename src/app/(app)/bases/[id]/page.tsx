import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Radar } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { Card, StatCard, StatStrip } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { timeAgo } from "@/lib/utils";
import { apifyEnabled } from "@/lib/flags";
import type { LeadStatus, RunStatus, Search, SearchRun } from "@/lib/types";
import { BaseActions } from "./base-actions";
import { AutoRefresh } from "../auto-refresh";

export const dynamic = "force-dynamic";

const RUN_LABELS: Record<RunStatus, string> = {
  pendiente: "Pendiente",
  corriendo: "Corriendo",
  completado: "Completado",
  fallido: "Fallido",
};

export default async function BaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  if (!ctx.isAdmin) redirect("/");

  const { data: search } = await ctx.supabase
    .from("searches")
    .select("*, products(name)")
    .eq("id", id)
    .maybeSingle();
  if (!search) notFound();

  const { data: runs } = await ctx.supabase
    .from("search_runs")
    .select("*")
    .eq("search_id", id)
    .order("created_at", { ascending: false });

  const runIds = (runs ?? []).map((r) => r.id);

  const leadCount = (statuses?: LeadStatus[], unassigned?: boolean) => {
    let q = ctx.supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .in("search_run_id", runIds.length ? runIds : ["00000000-0000-0000-0000-000000000000"]);
    if (statuses) q = q.in("status", statuses);
    if (unassigned) q = q.is("assigned_to", null);
    return q;
  };

  const [total, sinAsignar, contactados, respondieron, clientes, { data: recentLeads }, teams, members, products] =
    await Promise.all([
      leadCount(),
      leadCount(["nuevo"], true),
      leadCount(["contactado", "respondio", "reunion", "propuesta", "cliente"]),
      leadCount(["respondio", "reunion", "propuesta", "cliente"]),
      leadCount(["cliente"]),
      runIds.length
        ? ctx.supabase
            .from("leads")
            .select("id, name, city, status")
            .in("search_run_id", runIds)
            .order("created_at", { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [] }),
      ctx.supabase.from("teams").select("id, name").eq("org_id", ctx.org.id).then((r) => r.data ?? []),
      ctx.supabase
        .from("memberships")
        .select("user_id, profiles(full_name)")
        .eq("org_id", ctx.org.id)
        .eq("role", "vendedor")
        .then(({ data }) =>
          (data ?? []).map((m) => ({
            id: m.user_id as string,
            name: (m.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "Vendedor",
          }))
        ),
      ctx.supabase.from("products").select("id, name").eq("active", true).then((r) => r.data ?? []),
    ]);

  const typedSearch = search as Search & { products: { name: string } | null };
  const hasRunning = (runs ?? []).some((r) => r.status === "corriendo" || r.status === "pendiente");
  const tasaRespuesta =
    (contactados.count ?? 0) > 0
      ? Math.round(((respondieron.count ?? 0) / (contactados.count ?? 1)) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <AutoRefresh active={hasRunning} />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-semibold tracking-tight">{typedSearch.name}</h1>
            {typedSearch.archived && <Badge className="border-line text-muted">Archivada</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {typedSearch.sources.join(", ")}
            {typedSearch.niche && ` · ${typedSearch.niche}`}
            {typedSearch.location && ` · ${typedSearch.location}`}
            {" · "}creada {timeAgo(typedSearch.created_at)}
          </p>
          {typedSearch.products?.name && (
            <Badge className="mt-2 border-accent/30 bg-accent/10 text-accent">
              🎯 Producto objetivo: {typedSearch.products.name}
            </Badge>
          )}
          {typedSearch.notes && <p className="mt-2 max-w-xl text-sm text-muted">{typedSearch.notes}</p>}
        </div>
        <Link href="/bases" className="text-sm text-muted hover:text-accent">
          ← Bases
        </Link>
      </header>

      <StatStrip cols={5}>
        <StatCard label="Leads" value={total.count ?? 0} />
        <StatCard label="Sin asignar" value={sinAsignar.count ?? 0} accent={(sinAsignar.count ?? 0) > 0} />
        <StatCard label="Contactados" value={contactados.count ?? 0} />
        <StatCard label="Tasa respuesta" value={`${tasaRespuesta}%`} />
        <StatCard label="Clientes" value={clientes.count ?? 0} />
      </StatStrip>

      <BaseActions
        search={{
          id: typedSearch.id,
          name: typedSearch.name,
          notes: typedSearch.notes,
          productId: typedSearch.product_id,
          autoRerun: typedSearch.auto_rerun,
          archived: typedSearch.archived,
          isGmaps: typedSearch.sources.includes("gmaps"),
        }}
        unassignedCount={sinAsignar.count ?? 0}
        teams={teams}
        members={members}
        products={products}
        apify={apifyEnabled()}
        isOwner={ctx.profile.is_super_admin || ctx.role === "owner"}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider">Últimos leads</h2>
            <Link
              href={`/leads?base=${typedSearch.id}`}
              className="flex items-center gap-1 text-xs text-accent hover:underline"
            >
              Ver todos <ArrowRight className="size-3" />
            </Link>
          </div>
          {recentLeads?.length ? (
            <Card className="divide-y divide-line p-0 sm:p-0">
              {recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface2/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{lead.name}</p>
                    <p className="text-xs text-muted">{lead.city ?? "—"}</p>
                  </div>
                  <StatusBadge status={lead.status as LeadStatus} />
                </Link>
              ))}
            </Card>
          ) : (
            <p className="text-sm text-muted">Todavía no hay leads en esta base.</p>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">Corridas</h2>
          <Card className="divide-y divide-line p-0 sm:p-0">
            {(runs ?? []).map((run) => {
              const r = run as SearchRun;
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <Radar className="size-4 shrink-0 text-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">{timeAgo(r.created_at)}</p>
                    {r.status === "completado" && (
                      <p className="numeric text-xs">
                        <span className="text-success">{r.stats.inserted ?? 0} nuevos</span> ·{" "}
                        {r.stats.duplicates ?? 0} duplicados
                      </p>
                    )}
                    {r.error && <p className="truncate text-xs text-danger">{r.error}</p>}
                  </div>
                  <span className="text-xs text-muted">{RUN_LABELS[r.status]}</span>
                </div>
              );
            })}
          </Card>
        </section>
      </div>
    </div>
  );
}

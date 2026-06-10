import Link from "next/link";
import { Plus, Search, Target } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import { initials } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type LeadRow = Lead & { assignee: { full_name: string | null } | null };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page: pageParam } = await searchParams;
  const ctx = await getCtx();
  const page = Math.max(parseInt(pageParam ?? "1", 10) || 1, 1);

  let query = ctx.supabase
    .from("leads")
    .select("*, assignee:profiles!leads_assigned_to_fkey(full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);
  if (status && STATUS_ORDER.includes(status as LeadStatus))
    query = query.eq("status", status);

  const { data, count } = await query;
  const leads = (data ?? []) as LeadRow[];
  const totalPages = Math.max(Math.ceil((count ?? 0) / PAGE_SIZE), 1);

  const params = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { q, status, ...overrides };
    Object.entries(merged).forEach(([k, v]) => v && sp.set(k, v));
    const s = sp.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="numeric text-sm text-muted">{count ?? 0} en tu vista</p>
        </div>
        {ctx.isAdmin && (
          <Link
            href="/leads/nuevo"
            className="glow-accent inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-bg hover:bg-accent-strong"
          >
            <Plus className="size-4" /> Nuevo
          </Link>
        )}
      </header>

      <form className="flex flex-wrap gap-2" action="/leads">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre…"
            className="h-10 w-full rounded-lg border border-line bg-surface2 pl-9 pr-3 text-sm placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
          />
        </div>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-lg border border-line bg-surface2 px-3 text-sm"
        >
          <option value="">Todos los estados</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-lg border border-line bg-surface2 px-4 text-sm hover:border-accent/40">
          Filtrar
        </button>
      </form>

      {leads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No hay leads con estos filtros"
          description={
            ctx.isAdmin
              ? "Generá una base desde Bases (Google Maps o CSV) o creá un lead manual."
              : "Cuando te asignen leads, los vas a ver acá."
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="space-y-2 md:hidden">
            {leads.map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`} className="block">
                <Card className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{lead.name}</p>
                    <p className="truncate text-xs text-muted">
                      {[lead.category, lead.city].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <StatusBadge status={lead.status} />
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop: tabla */}
          <div className="hidden overflow-hidden rounded-xl border border-line md:block">
            <table className="w-full text-sm">
              <thead className="bg-surface text-left text-[11px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Negocio</th>
                  <th className="px-4 py-3 font-medium">Ciudad</th>
                  <th className="px-4 py-3 font-medium">Teléfono</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Asignado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leads.map((lead) => (
                  <tr key={lead.id} className="bg-surface/50 transition-colors hover:bg-surface2/60">
                    <td className="px-4 py-3">
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:text-accent">
                        {lead.name}
                      </Link>
                      {lead.category && <p className="text-xs text-muted">{lead.category}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted">{lead.city ?? "—"}</td>
                    <td className="numeric px-4 py-3 text-muted">
                      {lead.phone_e164 ?? lead.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3">
                      {lead.assignee?.full_name ? (
                        <span
                          className="flex size-7 items-center justify-center rounded-full bg-surface2 text-[10px] font-semibold text-accent"
                          title={lead.assignee.full_name}
                        >
                          {initials(lead.assignee.full_name)}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm">
              {page > 1 && (
                <Link className="text-accent hover:underline" href={`/leads${params({ page: String(page - 1) })}`}>
                  ← Anterior
                </Link>
              )}
              <span className="numeric text-muted">
                {page} / {totalPages}
              </span>
              {page < totalPages && (
                <Link className="text-accent hover:underline" href={`/leads${params({ page: String(page + 1) })}`}>
                  Siguiente →
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

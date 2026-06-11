import Link from "next/link";
import { Plus, Target } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { EmptyState } from "@/components/ui/empty";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import {
  applyLeadFilters,
  needsScoreJoin,
  resolveFilterIds,
  type LeadFilterParams,
} from "@/lib/lead-filters";
import type { Lead, LeadStatus } from "@/lib/types";
import { LeadsTable, type LeadRow } from "./leads-table";
import { ExportButton } from "./export-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const SOURCES = ["gmaps", "csv", "manual", "instagram", "facebook", "website"];

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const ctx = await getCtx();
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);

  const filters: LeadFilterParams = {
    q: sp.q,
    status: sp.status,
    source: sp.source,
    city: sp.ciudad,
    base: sp.base,
    asignado: sp.asignado,
    prod: sp.prod,
    min: sp.min,
    tel: sp.tel,
    campania: sp.campania,
  };

  const ids = await resolveFilterIds(ctx.supabase, filters);
  const scoreJoin = needsScoreJoin(filters) ? "!inner" : "";

  let query = ctx.supabase
    .from("leads")
    .select(
      `*, assignee:profiles!leads_assigned_to_fkey(full_name), lead_scores${scoreJoin}(score, product_id, products(name))`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  query = applyLeadFilters(query, filters, ids);

  const [{ data, count }, members, teams, campaigns, products, searches] = await Promise.all([
    query,
    ctx.supabase
      .from("memberships")
      .select("user_id, profiles(full_name)")
      .eq("org_id", ctx.org.id)
      .then(({ data: m }) =>
        (m ?? []).map((row) => ({
          id: row.user_id as string,
          name:
            (row.profiles as unknown as { full_name: string | null } | null)?.full_name ??
            "Sin nombre",
        }))
      ),
    ctx.isAdmin
      ? ctx.supabase.from("teams").select("id, name").eq("org_id", ctx.org.id).then((r) => r.data ?? [])
      : Promise.resolve([]),
    ctx.isAdmin
      ? ctx.supabase
          .from("campaigns")
          .select("id, name")
          .eq("org_id", ctx.org.id)
          .eq("status", "activa")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
    ctx.supabase
      .from("products")
      .select("id, name")
      .eq("org_id", ctx.org.id)
      .eq("active", true)
      .then((r) => r.data ?? []),
    ctx.isAdmin
      ? ctx.supabase
          .from("searches")
          .select("id, name")
          .eq("org_id", ctx.org.id)
          .eq("archived", false)
          .order("created_at", { ascending: false })
          .limit(30)
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);

  type RawLead = Lead & {
    assignee: { full_name: string | null } | null;
    lead_scores: { score: number; product_id: string; products: { name: string } | null }[] | null;
  };

  const rows: LeadRow[] = ((data ?? []) as RawLead[]).map((l) => {
    const top = (l.lead_scores ?? []).reduce<{ score: number; product: string } | null>(
      (best, s) =>
        !best || s.score > best.score
          ? { score: s.score, product: s.products?.name ?? "Producto" }
          : best,
      null
    );
    return {
      id: l.id,
      name: l.name,
      category: l.category,
      city: l.city,
      phone: l.phone_e164 ?? l.phone,
      status: l.status as LeadStatus,
      assignedTo: l.assigned_to,
      assigneeName: l.assignee?.full_name ?? null,
      topScore: top,
    };
  });

  const totalPages = Math.max(Math.ceil((count ?? 0) / PAGE_SIZE), 1);
  const params = (overrides: Record<string, string | undefined>) => {
    const spOut = new URLSearchParams();
    const merged: Record<string, string | undefined> = { ...sp, page: undefined, ...overrides };
    Object.entries(merged).forEach(([k, v]) => v && spOut.set(k, v));
    const s = spOut.toString();
    return s ? `?${s}` : "";
  };

  const selectCls =
    "h-10 rounded-lg border border-line bg-surface2 px-2.5 text-sm focus:border-accent/60 focus:outline-none";

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="numeric text-sm text-muted">{count ?? 0} en tu vista</p>
        </div>
        <div className="flex items-center gap-2">
          {ctx.isAdmin && <ExportButton filters={filters} />}
          {ctx.isAdmin && (
            <Link
              href="/leads/nuevo"
              className="glow-accent inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-bg hover:bg-accent-strong"
            >
              <Plus className="size-4" /> Nuevo
            </Link>
          )}
        </div>
      </header>

      <form className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6" action="/leads">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Buscar nombre…"
          className={`${selectCls} col-span-2 placeholder:text-muted/60`}
        />
        <select name="status" defaultValue={sp.status ?? ""} className={selectCls}>
          <option value="">Estado</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
        <select name="asignado" defaultValue={sp.asignado ?? ""} className={selectCls}>
          <option value="">Asignado a…</option>
          <option value="sin">Sin asignar</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          name="ciudad"
          defaultValue={sp.ciudad ?? ""}
          placeholder="Ciudad…"
          className={`${selectCls} placeholder:text-muted/60`}
        />
        <select name="source" defaultValue={sp.source ?? ""} className={selectCls}>
          <option value="">Fuente</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {ctx.isAdmin && (
          <select name="base" defaultValue={sp.base ?? ""} className={`${selectCls} col-span-2`}>
            <option value="">Base de origen</option>
            {searches.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <select name="prod" defaultValue={sp.prod ?? ""} className={selectCls}>
          <option value="">Producto</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="min" defaultValue={sp.min ?? ""} className={selectCls}>
          <option value="">Score mín.</option>
          {[50, 60, 70, 80, 90].map((n) => (
            <option key={n} value={n}>
              ≥ {n}
            </option>
          ))}
        </select>
        <select name="tel" defaultValue={sp.tel ?? ""} className={selectCls}>
          <option value="">Teléfono</option>
          <option value="con">Con WhatsApp</option>
          <option value="sin">Sin teléfono</option>
        </select>
        {sp.campania && <input type="hidden" name="campania" value={sp.campania} />}
        <button className="h-10 rounded-lg bg-surface2 border border-line px-4 text-sm hover:border-accent/40">
          Filtrar
        </button>
      </form>

      {rows.length === 0 ? (
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
          <LeadsTable
            rows={rows}
            isAdmin={ctx.isAdmin}
            members={members}
            teams={teams}
            campaigns={campaigns}
          />
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

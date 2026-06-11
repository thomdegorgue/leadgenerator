import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { Card, StatCard, StatStrip, PageHeader } from "@/components/ui/card";
import { SegmentGauge } from "@/components/ui/segment-gauge";
import { STATUS, STATUS_ORDER } from "@/lib/status";
import type { LeadStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const fmtARS = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

export default async function DashboardPage() {
  const ctx = await getCtx();
  if (!ctx.isAdmin) redirect("/");

  const ninetyDays = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const headCount = (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => build(base());
  const base = () => ctx.supabase.from("leads").select("id", { count: "exact", head: true });

  // Funnel por estado
  const statusCounts = await Promise.all(
    STATUS_ORDER.map(async (s) => ({ status: s, count: (await headCount((q) => q.eq("status", s))).count ?? 0 }))
  );

  // Por fuente
  const SOURCES = ["gmaps", "csv", "manual", "instagram", "facebook", "website"];
  const sourceCounts = (
    await Promise.all(
      SOURCES.map(async (s) => ({ source: s, count: (await headCount((q) => q.eq("source", s))).count ?? 0 }))
    )
  ).filter((s) => s.count > 0);

  // Evolución: leads nuevos por semana (últimas 8)
  const weeks = await Promise.all(
    Array.from({ length: 8 }, async (_, i) => {
      const from = new Date(Date.now() - (8 - i) * 7 * 24 * 60 * 60 * 1000);
      const to = new Date(Date.now() - (7 - i) * 7 * 24 * 60 * 60 * 1000);
      const { count } = await headCount((q) =>
        q.gte("created_at", from.toISOString()).lt("created_at", to.toISOString())
      );
      return { label: `${from.getDate()}/${from.getMonth() + 1}`, count: count ?? 0 };
    })
  );

  // Facturación (cierres con datos)
  const { data: deals } = await ctx.supabase
    .from("leads")
    .select("deal_value, product:products!leads_deal_product_id_fkey(name)")
    .eq("status", "cliente");
  const totalRevenue = (deals ?? []).reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
  const byProduct = new Map<string, { count: number; revenue: number }>();
  (deals ?? []).forEach((d) => {
    const name = (d.product as unknown as { name: string } | null)?.name ?? "Sin especificar";
    const prev = byProduct.get(name) ?? { count: 0, revenue: 0 };
    byProduct.set(name, { count: prev.count + 1, revenue: prev.revenue + (Number(d.deal_value) || 0) });
  });

  // Métricas por plantilla (90 días): envíos y leads que respondieron después
  const [{ data: sends }, { data: replies }] = await Promise.all([
    ctx.supabase
      .from("activities")
      .select("lead_id, note, created_at")
      .eq("type", "whatsapp")
      .gte("created_at", ninetyDays)
      .order("created_at", { ascending: true })
      .limit(5000),
    ctx.supabase
      .from("activities")
      .select("lead_id, created_at")
      .eq("type", "respuesta")
      .eq("result", "respondio")
      .gte("created_at", ninetyDays)
      .limit(5000),
  ]);

  const templateStats = new Map<string, { sends: number; replies: number }>();
  const lastTemplateByLead = new Map<string, string>();
  (sends ?? []).forEach((a) => {
    const tpl = (a.note ?? "").replace("Plantilla: ", "") || "—";
    lastTemplateByLead.set(a.lead_id, tpl);
    const s = templateStats.get(tpl) ?? { sends: 0, replies: 0 };
    templateStats.set(tpl, { ...s, sends: s.sends + 1 });
  });
  (replies ?? []).forEach((a) => {
    const tpl = lastTemplateByLead.get(a.lead_id);
    if (!tpl) return;
    const s = templateStats.get(tpl);
    if (s) templateStats.set(tpl, { ...s, replies: s.replies + 1 });
  });

  const totalLeads = statusCounts.reduce((a, b) => a + b.count, 0);
  const contactadosPlus = statusCounts
    .filter((s) => ["contactado", "respondio", "reunion", "propuesta", "cliente"].includes(s.status))
    .reduce((a, b) => a + b.count, 0);
  const respondioPlus = statusCounts
    .filter((s) => ["respondio", "reunion", "propuesta", "cliente"].includes(s.status))
    .reduce((a, b) => a + b.count, 0);
  const clientes = statusCounts.find((s) => s.status === "cliente")?.count ?? 0;
  const maxStatus = Math.max(...statusCounts.map((s) => s.count), 1);
  const maxWeek = Math.max(...weeks.map((w) => w.count), 1);

  return (
    <div className="space-y-6">
      <PageHeader index="09" title="Dashboard ejecutivo" sub={`${ctx.org.name} · números en vivo`} />

      <StatStrip cols={4}>
        <StatCard label="Leads totales" value={totalLeads} />
        <StatCard
          label="Tasa de respuesta"
          value={`${contactadosPlus > 0 ? Math.round((respondioPlus / contactadosPlus) * 100) : 0}%`}
          hint={`${respondioPlus} de ${contactadosPlus} contactados`}
        />
        <StatCard label="Clientes" value={clientes} accent />
        <StatCard
          label="Facturación mensual"
          value={fmtARS(totalRevenue)}
          hint="suma de cierres registrados"
        />
      </StatStrip>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="microlabel mb-3 text-fg">Funnel</h2>
          <Card className="space-y-2">
            {statusCounts.map(({ status, count }) => (
              <div key={status} className="flex items-center gap-3 py-0.5">
                <span className="w-24 shrink-0 text-xs text-muted">{STATUS[status as LeadStatus].label}</span>
                <SegmentGauge
                  ratio={count / maxStatus}
                  segments={16}
                  size="sm"
                  tone={status === "cliente" ? "success" : status === "descartado" ? "warn" : "accent"}
                  className="flex-1"
                />
                <span className="numeric w-12 shrink-0 text-right text-sm">{count}</span>
              </div>
            ))}
          </Card>
        </section>

        <section>
          <h2 className="microlabel mb-3 text-fg">Leads nuevos por semana</h2>
          <Card>
            <div className="flex h-36 items-end gap-2">
              {weeks.map((w, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="numeric text-[10px] text-muted">{w.count}</span>
                  <div
                    className="w-full bg-accent/60"
                    style={{ height: `${(w.count / maxWeek) * 100}%`, minHeight: w.count > 0 ? 4 : 1 }}
                  />
                  <span className="text-[9px] text-dim">{w.label}</span>
                </div>
              ))}
            </div>
          </Card>

          {sourceCounts.length > 0 && (
            <Card className="mt-3">
              <p className="microlabel mb-2">Por fuente</p>
              <div className="flex flex-wrap gap-3">
                {sourceCounts.map((s) => (
                  <p key={s.source} className="text-sm">
                    <span className="numeric font-semibold">{s.count}</span>{" "}
                    <span className="text-muted">{s.source}</span>
                  </p>
                ))}
              </div>
            </Card>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="microlabel mb-3 text-fg">Rendimiento por plantilla (90d)</h2>
          {templateStats.size === 0 ? (
            <Card>
              <p className="text-sm text-muted">Todavía no hay envíos registrados.</p>
            </Card>
          ) : (
            <Card className="divide-y divide-line p-0 sm:p-0">
              {[...templateStats.entries()]
                .sort((a, b) => b[1].sends - a[1].sends)
                .map(([tpl, s]) => {
                  const rate = s.sends > 0 ? Math.round((s.replies / s.sends) * 100) : 0;
                  return (
                    <div key={tpl} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <p className="min-w-0 flex-1 truncate">{tpl}</p>
                      <span className="numeric text-xs text-muted">{s.sends} envíos</span>
                      <span
                        className={cn(
                          "numeric w-12 text-right text-sm font-semibold",
                          rate >= 30 ? "text-success" : rate >= 15 ? "text-warn" : "text-muted"
                        )}
                      >
                        {rate}%
                      </span>
                    </div>
                  );
                })}
            </Card>
          )}
        </section>

        <section>
          <h2 className="microlabel mb-3 text-fg">Ventas por producto</h2>
          {byProduct.size === 0 ? (
            <Card>
              <p className="text-sm text-muted">
                Cuando cierres ventas (estado Cliente + registrar venta), aparecen acá.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-line p-0 sm:p-0">
              {[...byProduct.entries()]
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .map(([name, s]) => (
                  <div key={name} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <p className="min-w-0 flex-1 truncate">{name}</p>
                    <span className="numeric text-xs text-muted">{s.count} ventas</span>
                    <span className="numeric font-semibold text-success">{fmtARS(s.revenue)}/mes</span>
                  </div>
                ))}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}

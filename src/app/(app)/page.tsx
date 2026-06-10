import Link from "next/link";
import { Flame, Target, ArrowRight } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { StatCard, Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty";
import { timeAgo } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  whatsapp: "envió un WhatsApp a",
  respuesta: "registró respuesta de",
  nota: "dejó una nota en",
  cambio_estado: "cambió el estado de",
  asignacion: "asignó",
  descarte: "descartó",
};

export default async function HomePage() {
  const ctx = await getCtx();
  const { supabase } = ctx;
  const now = new Date().toISOString();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const count = (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const q = build(base());
    return q;
  };
  const base = () => supabase.from("leads").select("id", { count: "exact", head: true });

  const [activos, paraContactar, respondieron, vencidos, sinAsignar, contactadosHoy] =
    await Promise.all([
      count((q) => q.not("status", "in", "(cliente,descartado)")),
      count((q) => q.in("status", ["nuevo", "asignado"])),
      count((q) => q.eq("status", "respondio")),
      count((q) => q.lte("next_followup_at", now).not("status", "in", "(cliente,descartado)")),
      ctx.isAdmin ? count((q) => q.is("assigned_to", null).eq("status", "nuevo")) : Promise.resolve({ count: 0 }),
      supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("type", "whatsapp")
        .gte("created_at", startOfDay),
    ]);

  const [{ data: paraHoy }, { data: actividad }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, name, city, status, next_followup_at")
      .not("status", "in", "(cliente,descartado)")
      .or(`next_followup_at.lte.${now},status.eq.asignado`)
      .order("next_followup_at", { ascending: true, nullsFirst: false })
      .limit(7),
    supabase
      .from("activities")
      .select("id, type, result, created_at, leads(id, name), profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const firstName = (ctx.profile.full_name ?? "").split(" ")[0] || "equipo";

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Hola, {firstName} 👋</h1>
        <p className="text-sm text-muted">
          {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Leads activos" value={activos.count ?? 0} />
        <StatCard label="Para contactar" value={paraContactar.count ?? 0} accent />
        <StatCard label="Respondieron" value={respondieron.count ?? 0} />
        <StatCard
          label="WhatsApps hoy"
          value={contactadosHoy.count ?? 0}
          hint={ctx.isAdmin ? `${sinAsignar.count ?? 0} sin asignar` : undefined}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Flame className="size-4 text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Para hoy</h2>
            {(vencidos.count ?? 0) > 0 && (
              <span className="numeric rounded-full bg-danger/15 px-2 py-0.5 text-[11px] font-semibold text-danger">
                {vencidos.count} vencidos
              </span>
            )}
          </div>
          {paraHoy?.length ? (
            <div className="space-y-2">
              {(paraHoy as Pick<Lead, "id" | "name" | "city" | "status" | "next_followup_at">[]).map(
                (lead) => (
                  <Link key={lead.id} href={`/leads/${lead.id}`} className="block">
                    <Card className="flex items-center gap-3 py-3 transition-colors hover:border-accent/40">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{lead.name}</p>
                        <p className="text-xs text-muted">{lead.city ?? "—"}</p>
                      </div>
                      <StatusBadge status={lead.status as LeadStatus} />
                      <ArrowRight className="size-4 text-muted" />
                    </Card>
                  </Link>
                )
              )}
            </div>
          ) : (
            <EmptyState
              icon={Target}
              title="Nada pendiente por ahora"
              description="Cuando tengas leads asignados o seguimientos vencidos, aparecen acá."
            />
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">Actividad reciente</h2>
          {actividad?.length ? (
            <Card className="divide-y divide-line p-0 sm:p-0">
              {actividad.map((a) => {
                const lead = a.leads as unknown as { id: string; name: string } | null;
                const who = (a.profiles as unknown as { full_name: string | null } | null)?.full_name ?? "Alguien";
                return (
                  <div key={a.id} className="flex items-center gap-2 px-4 py-3 text-sm">
                    <p className="min-w-0 flex-1 truncate text-muted">
                      <span className="text-fg">{who.split(" ")[0]}</span>{" "}
                      {ACTIVITY_LABELS[a.type] ?? a.type}{" "}
                      {lead ? (
                        <Link href={`/leads/${lead.id}`} className="text-accent hover:underline">
                          {lead.name}
                        </Link>
                      ) : (
                        "un lead"
                      )}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted">{timeAgo(a.created_at)}</span>
                  </div>
                );
              })}
            </Card>
          ) : (
            <EmptyState icon={Flame} title="Todavía no hay actividad" />
          )}
        </div>
      </section>
    </div>
  );
}

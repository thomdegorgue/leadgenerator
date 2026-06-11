import Link from "next/link";
import { Flame, Target, ArrowRight } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { StatCard, StatStrip, Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty";
import { timeAgo, cn } from "@/lib/utils";
import type { Lead, LeadStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIVITY_LABELS: Record<string, string> = {
  whatsapp: "envió WhatsApp a",
  respuesta: "registró respuesta de",
  nota: "anotó en",
  cambio_estado: "movió",
  asignacion: "asignó",
  descarte: "descartó",
  cierre: "cerró venta con",
};

const ACTIVITY_DOTS: Record<string, string> = {
  whatsapp: "bg-accent",
  respuesta: "bg-success",
  cierre: "bg-success",
  descarte: "bg-danger",
  asignacion: "bg-warn",
};

export default async function HomePage() {
  const ctx = await getCtx();
  const { supabase } = ctx;
  const now = new Date().toISOString();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const count = (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => build(base());
  const base = () => supabase.from("leads").select("id", { count: "exact", head: true });

  const [activos, paraContactar, respondieron, vencidos, sinAsignar, contactadosHoy] =
    await Promise.all([
      count((q) => q.not("status", "in", "(cliente,descartado)")),
      count((q) => q.in("status", ["nuevo", "asignado"])),
      count((q) => q.eq("status", "respondio")),
      count((q) => q.lte("next_followup_at", now).not("status", "in", "(cliente,descartado)")),
      ctx.isAdmin
        ? count((q) => q.is("assigned_to", null).eq("status", "nuevo"))
        : Promise.resolve({ count: 0 }),
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
      .limit(9),
  ]);

  const firstName = (ctx.profile.full_name ?? "").split(" ")[0] || "equipo";
  const fecha = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <p className="microlabel text-accent">
            01 <span className="text-dim">/ Centro de comando</span>
          </p>
          <h1 className="mt-1 font-display text-xl font-semibold tracking-tight">
            Hola, {firstName}
          </h1>
        </div>
        <p className="microlabel">{fecha}</p>
      </header>

      <StatStrip cols={4}>
        <StatCard label="Leads activos" value={activos.count ?? 0} />
        <StatCard label="Para contactar" value={paraContactar.count ?? 0} accent />
        <StatCard label="Respondieron" value={respondieron.count ?? 0} />
        <StatCard
          label="WhatsApps hoy"
          value={contactadosHoy.count ?? 0}
          hint={ctx.isAdmin ? `${sinAsignar.count ?? 0} sin asignar` : undefined}
        />
      </StatStrip>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Flame className="size-3.5 text-accent" />
            <h2 className="microlabel text-fg">Para hoy</h2>
            {(vencidos.count ?? 0) > 0 && (
              <span className="numeric rounded-[3px] bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger">
                {vencidos.count} VENCIDOS
              </span>
            )}
          </div>
          {paraHoy?.length ? (
            <div className="border border-line bg-surface">
              {(paraHoy as Pick<Lead, "id" | "name" | "city" | "status" | "next_followup_at">[]).map(
                (lead, i) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface2",
                      i > 0 && "border-t border-line"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{lead.name}</p>
                      <p className="text-[11px] text-dim">{lead.city ?? "—"}</p>
                    </div>
                    <StatusBadge status={lead.status as LeadStatus} />
                    <ArrowRight className="size-3.5 text-dim" />
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
          <h2 className="microlabel mb-3 text-fg">Registro de actividad</h2>
          {actividad?.length ? (
            <Card className="space-y-0 p-0 sm:p-0">
              {actividad.map((a, i) => {
                const lead = a.leads as unknown as { id: string; name: string } | null;
                const who =
                  (a.profiles as unknown as { full_name: string | null } | null)?.full_name ??
                  "Sistema";
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-center gap-2.5 px-4 py-2.5 text-[12px]",
                      i > 0 && "border-t border-line"
                    )}
                  >
                    <span
                      className={cn("size-1.5 shrink-0", ACTIVITY_DOTS[a.type] ?? "bg-dim")}
                    />
                    <span className="numeric shrink-0 text-[10px] text-dim">
                      {timeAgo(a.created_at)}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-muted">
                      <span className="font-medium text-fg">{who.split(" ")[0]}</span>{" "}
                      {ACTIVITY_LABELS[a.type] ?? a.type}{" "}
                      {lead ? (
                        <Link href={`/leads/${lead.id}`} className="text-accent hover:underline">
                          {lead.name}
                        </Link>
                      ) : (
                        "un lead"
                      )}
                    </p>
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

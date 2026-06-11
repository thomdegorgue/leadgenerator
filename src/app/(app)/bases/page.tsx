import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar, FileSpreadsheet } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { aiEnabled, apifyEnabled } from "@/lib/flags";
import { syncRunningApifyRuns } from "@/lib/apify-import";
import { IntelPanel } from "./intel-panel";

// Lotes de enriquecimiento/IA pueden tardar (webs lentas, Apify sync)
export const maxDuration = 300;
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { timeAgo } from "@/lib/utils";
import type { RunStatus, Search, SearchRun } from "@/lib/types";
import { CsvImport } from "./csv-import";
import { GmapsForm } from "./gmaps-form";
import { AutoRefresh } from "./auto-refresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bases" };

const RUN_BADGES: Record<RunStatus, string> = {
  pendiente: "bg-slate-400/10 text-slate-300 border-slate-400/25",
  corriendo: "bg-cyan-400/10 text-cyan-300 border-cyan-400/25",
  completado: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
  fallido: "bg-red-400/10 text-red-300 border-red-400/25",
};

const RUN_LABELS: Record<RunStatus, string> = {
  pendiente: "Pendiente",
  corriendo: "Corriendo",
  completado: "Completado",
  fallido: "Fallido",
};

export default async function BasesPage() {
  const ctx = await getCtx();
  if (!ctx.isAdmin) redirect("/");

  // Levanta resultados de corridas Apify en progreso (camino principal en local,
  // red de seguridad del webhook en producción).
  if (apifyEnabled()) await syncRunningApifyRuns(ctx.org.id);

  const countLeads = (build: (q: ReturnType<typeof baseQuery>) => ReturnType<typeof baseQuery>) =>
    build(baseQuery());
  const baseQuery = () =>
    ctx.supabase.from("leads").select("id", { count: "exact", head: true });

  const [{ data }, webPending, igPending, aiPending, { data: products }] = await Promise.all([
    ctx.supabase
      .from("searches")
      .select("*, search_runs(*), products(name)")
      .eq("archived", false)
      .order("created_at", { ascending: false })
      .limit(20),
    countLeads((q) => q.is("enriched_at", null)),
    apifyEnabled()
      ? countLeads((q) => q.not("instagram", "is", null).is("ig_enriched_at", null))
      : Promise.resolve({ count: 0 }),
    aiEnabled()
      ? countLeads((q) => q.not("enriched_at", "is", null).is("ai_scored_at", null))
      : Promise.resolve({ count: 0 }),
    ctx.supabase.from("products").select("id, name").eq("active", true).order("name"),
  ]);

  const productOptions = (products ?? []) as { id: string; name: string }[];

  const searches = (data ?? []) as unknown as (Search & {
    search_runs: SearchRun[];
    products: { name: string } | null;
  })[];
  const hasRunning = searches.some((s) =>
    s.search_runs.some((r) => r.status === "corriendo" || r.status === "pendiente")
  );

  return (
    <div className="space-y-6">
      <AutoRefresh active={hasRunning} />
      <PageHeader
        index="05"
        title="Generador de bases"
        sub="Encontrá negocios y cargalos con anti-duplicados automático."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {apifyEnabled() ? (
          <GmapsForm products={productOptions} />
        ) : (
          <Card className="border-dashed">
            <div className="flex items-center gap-2">
              <Radar className="size-4 text-muted" />
              <h2 className="text-sm font-semibold">Google Maps</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              Configurá <code className="rounded bg-surface2 px-1.5 py-0.5 text-xs">APIFY_TOKEN</code>{" "}
              para buscar negocios directo en Google Maps. Mientras tanto, importá por CSV.
            </p>
          </Card>
        )}
        <CsvImport products={productOptions} />
      </section>

      <section>
        <h2 className="microlabel mb-3 text-fg">Inteligencia</h2>
        <IntelPanel
          webPending={webPending.count ?? 0}
          igPending={igPending.count ?? 0}
          aiPending={aiPending.count ?? 0}
          igAvailable={apifyEnabled()}
          aiAvailable={aiEnabled()}
        />
      </section>

      <section>
        <h2 className="microlabel mb-3 text-fg">Búsquedas</h2>
        {searches.length === 0 ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Todavía no generaste ninguna base"
            description="Tu primera base puede ser un CSV exportado de cualquier lado: ARGOS deduplica solo."
          />
        ) : (
          <div className="space-y-2">
            {searches.map((search) => {
              const run = search.search_runs.sort((a, b) =>
                b.created_at.localeCompare(a.created_at)
              )[0];
              return (
                <Card key={search.id} className="flex flex-wrap items-center gap-3 py-3 transition-colors hover:border-accent/40">
                  <Link href={`/bases/${search.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{search.name}</p>
                    <p className="text-xs text-muted">
                      {search.sources.join(", ")}
                      {search.products?.name && (
                        <span className="text-accent"> · {search.products.name}</span>
                      )}
                      {" · "}
                      {timeAgo(search.created_at)}
                    </p>
                  </Link>
                  {run && (
                    <>
                      {run.status === "completado" && (
                        <p className="numeric text-xs text-muted">
                          <span className="text-success">{run.stats.inserted ?? 0} nuevos</span>
                          {" · "}
                          {run.stats.duplicates ?? 0} duplicados
                        </p>
                      )}
                      {run.status === "fallido" && run.error && (
                        <p className="max-w-48 truncate text-xs text-danger" title={run.error}>
                          {run.error}
                        </p>
                      )}
                      <Badge className={RUN_BADGES[run.status]}>
                        {run.status === "corriendo" && (
                          <span className="pulse-dot size-1.5 rounded-full bg-cyan-400" />
                        )}
                        {RUN_LABELS[run.status]}
                      </Badge>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

import { redirect } from "next/navigation";
import { Radar, FileSpreadsheet } from "lucide-react";
import { getCtx } from "@/lib/auth";
import { apifyEnabled } from "@/lib/flags";
import { syncRunningApifyRuns } from "@/lib/apify-import";
import { Card } from "@/components/ui/card";
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

  const { data } = await ctx.supabase
    .from("searches")
    .select("*, search_runs(*)")
    .order("created_at", { ascending: false })
    .limit(20);

  const searches = (data ?? []) as (Search & { search_runs: SearchRun[] })[];
  const hasRunning = searches.some((s) =>
    s.search_runs.some((r) => r.status === "corriendo" || r.status === "pendiente")
  );

  return (
    <div className="space-y-6">
      <AutoRefresh active={hasRunning} />
      <header>
        <h1 className="text-xl font-semibold">Generador de bases</h1>
        <p className="text-sm text-muted">
          Encontrá negocios y cargalos con anti-duplicados automático.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {apifyEnabled() ? (
          <GmapsForm />
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
        <CsvImport />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">Búsquedas</h2>
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
                <Card key={search.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{search.name}</p>
                    <p className="text-xs text-muted">
                      {search.sources.join(", ")} · {timeAgo(search.created_at)}
                    </p>
                  </div>
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

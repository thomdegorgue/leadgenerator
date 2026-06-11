import { getCtx } from "@/lib/auth";
import { Board, type BoardLead } from "./board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const ctx = await getCtx();

  const { data } = await ctx.supabase
    .from("leads")
    .select("id, name, city, status, lead_scores(score), assignee:profiles!leads_assigned_to_fkey(full_name)")
    .order("updated_at", { ascending: false })
    .limit(500);

  const leads = (data ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    city: l.city as string | null,
    status: l.status as BoardLead["status"],
    score: Math.max(0, ...((l.lead_scores as { score: number }[] | null) ?? []).map((s) => s.score)) || null,
    assignee:
      (l.assignee as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }));

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="border-b border-line pb-3">
        <h1 className="font-display text-xl font-semibold tracking-tight">Pipeline</h1>
        <p className="mt-0.5 text-sm text-muted">
          <span className="numeric text-fg">{leads.length}</span> leads en juego — arrastrá para mover
        </p>
      </header>
      <Board initialLeads={leads} />
    </div>
  );
}

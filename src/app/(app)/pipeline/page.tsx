import { getCtx } from "@/lib/auth";
import { Board, type BoardLead } from "./board";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  const ctx = await getCtx();

  const { data } = await ctx.supabase
    .from("leads")
    .select("id, name, city, status, assignee:profiles!leads_assigned_to_fkey(full_name)")
    .order("updated_at", { ascending: false })
    .limit(500);

  const leads = (data ?? []).map((l) => ({
    id: l.id as string,
    name: l.name as string,
    city: l.city as string | null,
    status: l.status as BoardLead["status"],
    assignee:
      (l.assignee as unknown as { full_name: string | null } | null)?.full_name ?? null,
  }));

  return (
    <div className="flex h-full flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold">Pipeline</h1>
        <p className="text-sm text-muted">Arrastrá las tarjetas para mover de estado.</p>
      </header>
      <Board initialLeads={leads} />
    </div>
  );
}

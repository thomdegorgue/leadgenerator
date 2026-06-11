import { getCtx } from "@/lib/auth";
import type { LeadStatus, MessageTemplate } from "@/lib/types";
import type { AiAnalysis } from "@/lib/ai";
import { FocusDeck, type FocusLead } from "./focus-deck";

export const dynamic = "force-dynamic";
export const metadata = { title: "Focus" };

export default async function FocusPage() {
  const ctx = await getCtx();
  const now = new Date().toISOString();
  const startOfDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [{ data: leads }, { data: templates }, { count: todayCount }, { data: org }] =
    await Promise.all([
      ctx.supabase
        .from("leads")
        .select(
          "id, name, category, city, phone, phone_e164, status, next_followup_at, lead_scores(score, products(name)), ai_outputs(kind, content, created_at)"
        )
        .eq("assigned_to", ctx.userId)
        .in("status", ["asignado", "contactado", "respondio"])
        .limit(120),
      ctx.supabase.from("message_templates").select("*").eq("active", true).order("stage"),
      ctx.supabase
        .from("activities")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ctx.userId)
        .eq("type", "whatsapp")
        .gte("created_at", startOfDay),
      ctx.supabase.from("organizations").select("settings").eq("id", ctx.org.id).single(),
    ]);

  type Raw = {
    id: string;
    name: string;
    category: string | null;
    city: string | null;
    phone: string | null;
    phone_e164: string | null;
    status: LeadStatus;
    next_followup_at: string | null;
    lead_scores: { score: number; products: { name: string } | null }[] | null;
    ai_outputs: { kind: string; content: string; created_at: string }[] | null;
  };

  // Prioridad: respondió sin contestar → seguimiento vencido → asignado nuevo → resto
  const priority = (l: Raw) => {
    if (l.status === "respondio") return 0;
    if (l.next_followup_at && l.next_followup_at <= now) return 1;
    if (l.status === "asignado") return 2;
    return 3;
  };

  const queue: FocusLead[] = ((leads ?? []) as unknown as Raw[])
    .map((l) => {
      const top = (l.lead_scores ?? []).reduce<{ score: number; product: string } | null>(
        (best, s) =>
          !best || s.score > best.score
            ? { score: s.score, product: s.products?.name ?? "Producto" }
            : best,
        null
      );
      const latestAnalysis = (l.ai_outputs ?? [])
        .filter((o) => o.kind === "analisis")
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      let speech: string | null = null;
      let argumento: string | null = null;
      if (latestAnalysis) {
        try {
          const parsed = JSON.parse(latestAnalysis.content) as AiAnalysis;
          speech = parsed.speech ?? null;
          argumento = parsed.argumento ?? null;
        } catch {
          /* contenido viejo no parseable */
        }
      }
      return {
        id: l.id,
        name: l.name,
        category: l.category,
        city: l.city,
        phone: l.phone,
        phoneE164: l.phone_e164,
        status: l.status,
        overdue: Boolean(l.next_followup_at && l.next_followup_at <= now),
        priority: priority(l),
        topScore: top,
        speech,
        argumento,
      };
    })
    .filter((l) => l.priority < 3)
    .sort((a, b) => a.priority - b.priority || (b.topScore?.score ?? 0) - (a.topScore?.score ?? 0))
    .slice(0, 40);

  const dailyGoal =
    Number((org?.settings as Record<string, unknown> | null)?.daily_goal) || 30;

  return (
    <FocusDeck
      initialQueue={queue}
      templates={(templates ?? []) as MessageTemplate[]}
      vendedorName={ctx.profile.full_name?.split(" ")[0] ?? ""}
      todayCount={todayCount ?? 0}
      dailyGoal={dailyGoal}
    />
  );
}

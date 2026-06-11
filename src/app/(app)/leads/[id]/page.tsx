import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Globe,
  AtSign,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  StickyNote,
  UserRound,
  ArrowLeftRight,
  Trash2,
  Send,
} from "lucide-react";
import { getCtx } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ScoreRing } from "@/components/score-ring";
import { REASON_LABELS } from "@/lib/status";
import { timeAgo } from "@/lib/utils";
import type { Activity, Lead, LeadScore, MessageTemplate } from "@/lib/types";
import { aiEnabled } from "@/lib/flags";
import type { AiAnalysis } from "@/lib/ai";
import { WhatsAppPanel } from "./whatsapp-panel";
import { LeadControls } from "./lead-controls";
import { NoteForm } from "./note-form";
import { AiPanel } from "./ai-panel";

// El análisis IA (Sonnet) puede tardar más que el default
export const maxDuration = 120;

export const dynamic = "force-dynamic";

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <Send className="size-3.5" />,
  respuesta: <MessageCircle className="size-3.5" />,
  nota: <StickyNote className="size-3.5" />,
  cambio_estado: <ArrowLeftRight className="size-3.5" />,
  asignacion: <UserRound className="size-3.5" />,
  descarte: <Trash2 className="size-3.5" />,
};

const RESULT_LABELS: Record<string, string> = {
  respondio: "Respondió",
  sin_respuesta: "Sin respuesta",
  numero_invalido: "Número inválido",
};

function activityText(a: Activity & { profiles?: { full_name: string | null } | null }) {
  const who = a.profiles?.full_name?.split(" ")[0] ?? "Sistema";
  switch (a.type) {
    case "whatsapp":
      return `${who} envió WhatsApp${a.note ? ` (${a.note.replace("Plantilla: ", "")})` : ""}`;
    case "respuesta":
      return `${who}: ${RESULT_LABELS[a.result ?? ""] ?? a.result}`;
    case "nota":
      return `${who}: "${a.note}"`;
    case "cambio_estado":
      return `${who} movió a ${a.result}`;
    case "asignacion":
      return `${who} asignó el lead`;
    case "descarte":
      return `${who} descartó${a.note ? `: ${a.note}` : ""}`;
    default:
      return `${who} · ${a.type}`;
  }
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();

  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("*, assignee:profiles!leads_assigned_to_fkey(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!lead) notFound();

  const [{ data: scores }, { data: activities }, { data: templates }, members, { data: aiOutput }, { data: products }] = await Promise.all([
    ctx.supabase
      .from("lead_scores")
      .select("*, products(name)")
      .eq("lead_id", id)
      .order("score", { ascending: false }),
    ctx.supabase
      .from("activities")
      .select("*, profiles(full_name)")
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    ctx.supabase
      .from("message_templates")
      .select("*")
      .eq("active", true)
      .order("stage"),
    ctx.isAdmin
      ? ctx.supabase
          .from("memberships")
          .select("user_id, role, profiles(full_name)")
          .eq("org_id", ctx.org.id)
          .then(({ data }) =>
            (data ?? []).map((m) => ({
              userId: m.user_id as string,
              name:
                ((m.profiles as unknown as { full_name: string | null } | null)?.full_name ??
                  "Sin nombre") + (m.role === "vendedor" ? "" : ` (${m.role})`),
            }))
          )
      : Promise.resolve([]),
    aiEnabled()
      ? ctx.supabase
          .from("ai_outputs")
          .select("content")
          .eq("lead_id", id)
          .eq("kind", "analisis")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    ctx.supabase.from("products").select("id, name").eq("active", true).order("name"),
  ]);

  const productOptions = (products ?? []) as { id: string; name: string }[];
  const typedLead = lead as Lead & { assignee: { full_name: string | null } | null };

  let analysis: AiAnalysis | null = null;
  if (aiOutput?.content) {
    try {
      analysis = JSON.parse(aiOutput.content) as AiAnalysis;
    } catch {
      analysis = null;
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="truncate font-display text-xl font-semibold tracking-tight">
              {typedLead.name}
            </h1>
            <StatusBadge status={typedLead.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {[typedLead.category, typedLead.city, typedLead.province].filter(Boolean).join(" · ") || "Sin datos de ubicación"}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            {typedLead.website && (
              <a
                href={/^https?:/.test(typedLead.website) ? typedLead.website : `https://${typedLead.website}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-accent hover:underline"
              >
                <Globe className="size-3.5" /> Web
              </a>
            )}
            {typedLead.instagram && (
              <a
                href={`https://instagram.com/${typedLead.instagram}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-accent hover:underline"
              >
                <AtSign className="size-3.5" /> {typedLead.instagram}
              </a>
            )}
            {typedLead.google_place_id && (
              <a
                href={`https://www.google.com/maps/place/?q=place_id:${typedLead.google_place_id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-accent hover:underline"
              >
                <MapPin className="size-3.5" /> Maps
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {aiEnabled() && (
            <AiPanel
              leadId={typedLead.id}
              phoneE164={typedLead.phone_e164}
              initialAnalysis={analysis}
            />
          )}
          <WhatsAppPanel
            lead={{
              id: typedLead.id,
              name: typedLead.name,
              city: typedLead.city,
              category: typedLead.category,
              phone: typedLead.phone,
              phone_e164: typedLead.phone_e164,
            }}
            templates={(templates ?? []) as MessageTemplate[]}
            vendedorName={ctx.profile.full_name?.split(" ")[0] ?? ""}
          />

          <section>
            <h2 className="microlabel mb-3 text-fg">Historial</h2>
            <NoteForm leadId={typedLead.id} />
            {activities?.length ? (
              <Card className="mt-3 divide-y divide-line p-0 sm:p-0">
                {(activities as (Activity & { profiles: { full_name: string | null } | null })[]).map(
                  (a) => (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 rounded-md bg-surface2 p-1.5 text-muted">
                        {ACTIVITY_ICONS[a.type] ?? <StickyNote className="size-3.5" />}
                      </span>
                      <p className="min-w-0 flex-1 text-sm text-fg/90">{activityText(a)}</p>
                      <span className="shrink-0 text-[11px] text-muted">{timeAgo(a.created_at)}</span>
                    </div>
                  )
                )}
              </Card>
            ) : (
              <p className="mt-3 text-sm text-muted">
                Todavía no hay contactos registrados con este lead.
              </p>
            )}
          </section>
        </div>

        <div className="space-y-5">
          {(scores?.length ?? 0) > 0 && (
            <section>
              <h2 className="microlabel mb-3 text-fg">Oportunidad por producto</h2>
              <div className="space-y-2">
                {(scores as (LeadScore & { products: { name: string } | null })[]).map((s) => (
                  <Card key={s.id} className="flex items-center gap-4 py-3">
                    <ScoreRing score={s.score} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{s.products?.name ?? "Producto"}</p>
                      <p className="truncate text-xs text-muted">
                        {s.reasons.map((r) => REASON_LABELS[r] ?? r).join(" · ") || "Sin señales aún"}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="microlabel mb-3 text-fg">Datos</h2>
            <Card className="space-y-2.5 text-sm">
              <p className="flex items-center gap-2 text-muted">
                <Phone className="size-4 shrink-0" />
                <span className="numeric text-fg">{typedLead.phone_e164 ?? typedLead.phone ?? "—"}</span>
              </p>
              <p className="flex items-center gap-2 text-muted">
                <Mail className="size-4 shrink-0" />
                <span className="truncate text-fg">{typedLead.email ?? "—"}</span>
              </p>
              <p className="flex items-center gap-2 text-muted">
                <MapPin className="size-4 shrink-0" />
                <span className="truncate text-fg">{typedLead.address ?? "—"}</span>
              </p>
              {typedLead.rating != null && (
                <p className="flex items-center gap-2 text-muted">
                  <Star className="size-4 shrink-0 text-warn" />
                  <span className="numeric text-fg">
                    {typedLead.rating} ({typedLead.reviews_count ?? 0} reseñas)
                  </span>
                </p>
              )}
              <p className="border-t border-line pt-2.5 text-xs text-muted">
                Fuente: {typedLead.source} · cargado {timeAgo(typedLead.created_at)}
                {typedLead.assignee?.full_name && (
                  <>
                    {" · "}asignado a <span className="text-fg">{typedLead.assignee.full_name}</span>
                  </>
                )}
              </p>
            </Card>
          </section>

          <LeadControls
            leadId={typedLead.id}
            status={typedLead.status}
            assignedTo={typedLead.assigned_to}
            isAdmin={ctx.isAdmin}
            members={members}
            products={productOptions}
            hasDeal={typedLead.deal_value != null || typedLead.deal_product_id != null}
          />

          <Link href="/leads" className="block text-center text-sm text-muted hover:text-accent">
            ← Volver a leads
          </Link>
        </div>
      </div>
    </div>
  );
}

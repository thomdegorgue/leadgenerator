import { redirect } from "next/navigation";
import { getCtx } from "@/lib/auth";
import { Megaphone } from "lucide-react";
import { EmptyState } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/card";
import type { LeadStatus, Team } from "@/lib/types";
import { CampaignsClient, type CampaignCard } from "./campaigns-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Campañas" };

export default async function CampanasPage() {
  const ctx = await getCtx();
  if (!ctx.isAdmin) redirect("/");

  const [{ data: campaigns }, { data: teams }, { data: products }] = await Promise.all([
    ctx.supabase
      .from("campaigns")
      .select("*, products(name), teams(name)")
      .eq("org_id", ctx.org.id)
      .order("created_at", { ascending: false }),
    ctx.supabase.from("teams").select("*").eq("org_id", ctx.org.id),
    ctx.supabase.from("products").select("id, name").eq("active", true),
  ]);

  // Stats por campaña a partir de los estados de sus leads
  const cards: CampaignCard[] = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { data: links } = await ctx.supabase
        .from("campaign_leads")
        .select("leads(status)")
        .eq("campaign_id", c.id)
        .limit(5000);
      const statuses = (links ?? [])
        .map((l) => (l.leads as unknown as { status: LeadStatus } | null)?.status)
        .filter(Boolean) as LeadStatus[];
      const count = (...sts: LeadStatus[]) => statuses.filter((s) => sts.includes(s)).length;
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        productName: (c.products as unknown as { name: string } | null)?.name ?? null,
        teamName: (c.teams as unknown as { name: string } | null)?.name ?? null,
        teamId: c.team_id,
        total: statuses.length,
        sinAsignar: count("nuevo"),
        contactados: count("contactado", "respondio", "reunion", "propuesta", "cliente"),
        respondieron: count("respondio", "reunion", "propuesta", "cliente"),
        clientes: count("cliente"),
      };
    })
  );

  return (
    <div className="space-y-4">
      <PageHeader
        index="07"
        title="Campañas"
        sub="Producto + filtro + equipo: un frente de ataque medible."
      />

      <CampaignsClient
        campaigns={cards}
        teams={(teams ?? []) as Team[]}
        products={(products ?? []) as { id: string; name: string }[]}
      />

      {cards.length === 0 && (
        <EmptyState
          icon={Megaphone}
          title="Sin campañas todavía"
          description='Creá una: "Catálogos para distribuidoras de Rosario" y se llena sola con los leads que matchean.'
        />
      )}
    </div>
  );
}

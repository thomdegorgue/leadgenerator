import { getCtx } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import type { MessageTemplate, Product } from "@/lib/types";
import { TemplatesClient } from "./templates-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plantillas" };

export default async function PlantillasPage() {
  const ctx = await getCtx();

  const [{ data: templates }, { data: products }] = await Promise.all([
    ctx.supabase.from("message_templates").select("*").order("stage").order("name"),
    ctx.supabase.from("products").select("*").eq("active", true).order("name"),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        index="06"
        title="Plantillas de WhatsApp"
        sub={`Variables: {{nombre}}, {{ciudad}}, {{categoria}}, {{vendedor}}`}
      />
      <TemplatesClient
        templates={(templates ?? []) as MessageTemplate[]}
        products={(products ?? []) as Product[]}
        canEdit={ctx.isAdmin}
      />
    </div>
  );
}

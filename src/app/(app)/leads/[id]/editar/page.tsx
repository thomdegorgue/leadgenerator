import { notFound } from "next/navigation";
import { getCtx } from "@/lib/auth";
import type { Lead } from "@/lib/types";
import { EditLeadForm } from "./edit-lead-form";

export const metadata = { title: "Editar lead" };

export default async function EditarLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();

  const { data: lead } = await ctx.supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <header>
        <h1 className="text-xl font-semibold">Editar lead</h1>
        <p className="text-sm text-muted">
          Al guardar se re-normalizan teléfono y dominio, y se recalculan los scores.
        </p>
      </header>
      <EditLeadForm lead={lead as Lead} />
    </div>
  );
}

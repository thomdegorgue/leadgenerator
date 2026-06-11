"use server";

import { getCtx } from "@/lib/auth";
import { applyLeadFilters, needsScoreJoin, resolveFilterIds, type LeadFilterParams } from "@/lib/lead-filters";
import { STATUS } from "@/lib/status";
import type { Lead, LeadStatus } from "@/lib/types";

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Exporta los leads del filtro actual a CSV (máx 5000 filas). */
export async function exportLeadsCsv(
  filters: LeadFilterParams
): Promise<{ ok: true; csv: string; rows: number } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Solo managers y owners exportan." };

  const ids = await resolveFilterIds(ctx.supabase, filters);
  let query = ctx.supabase
    .from("leads")
    .select(
      `*, assignee:profiles!leads_assigned_to_fkey(full_name)${needsScoreJoin(filters) ? ", lead_scores!inner(score, product_id)" : ""}`
    )
    .order("created_at", { ascending: false })
    .limit(5000);
  query = applyLeadFilters(query, filters, ids);

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  const header = [
    "nombre", "rubro", "telefono", "email", "web", "instagram",
    "direccion", "ciudad", "provincia", "estado", "asignado", "fuente", "creado",
  ];
  const lines = (data ?? []).map((l) => {
    const lead = l as unknown as Lead & { assignee: { full_name: string | null } | null };
    return [
      lead.name, lead.category, lead.phone_e164 ?? lead.phone, lead.email, lead.website,
      lead.instagram, lead.address, lead.city, lead.province,
      STATUS[lead.status as LeadStatus]?.label ?? lead.status,
      lead.assignee?.full_name ?? "", lead.source,
      new Date(lead.created_at).toLocaleDateString("es-AR"),
    ].map(csvCell).join(",");
  });

  return { ok: true, csv: [header.join(","), ...lines].join("\n"), rows: lines.length };
}

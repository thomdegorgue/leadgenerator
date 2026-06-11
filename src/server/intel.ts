"use server";

import { revalidatePath } from "next/cache";
import { getCtx } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { aiEnabled, apifyEnabled } from "@/lib/flags";
import { analyzeWebsite, digitalizationLevel } from "@/lib/enrich-web";
import { fetchInstagramProfiles } from "@/lib/apify";
import { aiScoreLead, aiAnalyzeLead, type LeadFacts, type ProductInfo, type AiAnalysis } from "@/lib/ai";
import { rootDomain } from "@/lib/domain";
import type { Lead } from "@/lib/types";

type BatchResult = { ok: true; processed: number; remaining: number } | { ok: false; error: string };

const WEB_BATCH = 12;
const IG_BATCH = 8;
const AI_BATCH = 8;

function leadFacts(lead: Lead, enrichment?: Record<string, unknown> | null): LeadFacts {
  return {
    name: lead.name,
    category: lead.category,
    city: lead.city,
    province: lead.province,
    website: lead.website,
    instagram: lead.instagram,
    rating: lead.rating,
    reviews_count: lead.reviews_count,
    signals: {
      tiene_web: Boolean(lead.website),
      tiene_whatsapp: Boolean(lead.phone_e164),
      ...(enrichment ?? {}),
    },
  };
}

/** Enriquecimiento web heurístico (sin IA, sin costo). Lotes de 12. */
export async function enrichWebBatch(): Promise<BatchResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };

  const admin = createAdminClient();
  const { data: leads } = await admin
    .from("leads")
    .select("*")
    .eq("org_id", ctx.org.id)
    .is("enriched_at", null)
    .order("created_at", { ascending: true })
    .limit(WEB_BATCH);

  if (!leads?.length) return { ok: true, processed: 0, remaining: 0 };

  await Promise.allSettled(
    (leads as Lead[]).map(async (lead) => {
      const web = lead.website ? await analyzeWebsite(lead.website) : null;
      const igFromWeb = web?.instagram ?? null;
      const hasInstagram = Boolean(lead.instagram || igFromWeb);

      await admin.from("lead_enrichments").upsert(
        {
          lead_id: lead.id,
          has_ecommerce: web ? web.has_ecommerce : null,
          has_catalog: web ? web.has_catalog : null,
          uses_whatsapp: Boolean(web?.uses_whatsapp || lead.phone_e164),
          has_instagram: hasInstagram,
          sells_products: web?.has_ecommerce || web?.has_catalog || null,
          digitalization_level: digitalizationLevel({
            hasWebsite: Boolean(lead.website && web?.reachable),
            hasEcommerce: Boolean(web?.has_ecommerce),
            usesWhatsapp: Boolean(web?.uses_whatsapp || lead.phone_e164),
            hasInstagram,
            hasCatalog: Boolean(web?.has_catalog),
          }),
          signals: {
            platform: web?.platform ?? null,
            web_reachable: web?.reachable ?? null,
          },
          enriched_by: "rules",
          enriched_at: new Date().toISOString(),
        },
        { onConflict: "lead_id" }
      );

      if (igFromWeb && !lead.instagram) {
        await admin.from("leads").update({ instagram: igFromWeb }).eq("id", lead.id);
      }
      await admin
        .from("leads")
        .update({ enriched_at: new Date().toISOString() })
        .eq("id", lead.id);
      await admin.rpc("compute_rule_scores", { p_lead: lead.id });
    })
  );

  const { count } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.org.id)
    .is("enriched_at", null);

  revalidatePath("/bases");
  return { ok: true, processed: leads.length, remaining: count ?? 0 };
}

/** Enriquecimiento de perfiles de Instagram vía Apify. Lotes de 8 (consume crédito). */
export async function enrichInstagramBatch(): Promise<BatchResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  if (!apifyEnabled()) return { ok: false, error: "Apify no está configurado." };

  const admin = createAdminClient();
  const { data: leads } = await admin
    .from("leads")
    .select("id, instagram, website")
    .eq("org_id", ctx.org.id)
    .not("instagram", "is", null)
    .is("ig_enriched_at", null)
    .order("created_at", { ascending: true })
    .limit(IG_BATCH);

  if (!leads?.length) return { ok: true, processed: 0, remaining: 0 };

  let profiles: Awaited<ReturnType<typeof fetchInstagramProfiles>> = [];
  try {
    profiles = await fetchInstagramProfiles(leads.map((l) => (l.instagram as string).toLowerCase()));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error en Apify" };
  }

  const byUser = new Map(profiles.map((p) => [p.username, p]));
  const now = new Date().toISOString();

  for (const lead of leads) {
    const profile = byUser.get((lead.instagram as string).toLowerCase());
    if (profile) {
      const { data: existing } = await admin
        .from("lead_enrichments")
        .select("signals")
        .eq("lead_id", lead.id)
        .maybeSingle();

      await admin.from("lead_enrichments").upsert(
        {
          lead_id: lead.id,
          has_instagram: true,
          ig_followers: profile.followers,
          ig_posts: profile.posts,
          signals: {
            ...((existing?.signals as Record<string, unknown>) ?? {}),
            ig_bio: profile.biography,
            ig_category: profile.category,
          },
          enriched_at: now,
        },
        { onConflict: "lead_id" }
      );

      // Si el perfil tiene web y el lead no, la sumamos (con su clave de dedup)
      if (profile.externalUrl && !lead.website) {
        const domain = rootDomain(profile.externalUrl);
        await admin
          .from("leads")
          .update({ website: profile.externalUrl, ...(domain ? { domain } : {}) })
          .eq("id", lead.id);
      }
    }
    // Marcar siempre (aunque no exista el perfil) para no reintentarlo en loop
    await admin.from("leads").update({ ig_enriched_at: now }).eq("id", lead.id);
    await admin.rpc("compute_rule_scores", { p_lead: lead.id });
  }

  const { count } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.org.id)
    .not("instagram", "is", null)
    .is("ig_enriched_at", null);

  revalidatePath("/bases");
  return { ok: true, processed: leads.length, remaining: count ?? 0 };
}

/** Score multi-producto con IA (Haiku). Pisa los scores por reglas. Lotes de 8. */
export async function aiScoreBatch(): Promise<BatchResult> {
  const ctx = await getCtx();
  if (!ctx.isAdmin) return { ok: false, error: "Sin permisos." };
  if (!aiEnabled()) return { ok: false, error: "IA no configurada (ANTHROPIC_API_KEY)." };

  const admin = createAdminClient();

  const [{ data: leads }, { data: products }] = await Promise.all([
    admin
      .from("leads")
      .select("*, lead_enrichments(*)")
      .eq("org_id", ctx.org.id)
      .not("enriched_at", "is", null)
      .is("ai_scored_at", null)
      .order("created_at", { ascending: true })
      .limit(AI_BATCH),
    admin
      .from("products")
      .select("id, slug, name, description, pitch, price_from")
      .eq("org_id", ctx.org.id)
      .eq("active", true),
  ]);

  if (!leads?.length) return { ok: true, processed: 0, remaining: 0 };
  if (!products?.length) return { ok: false, error: "No hay productos activos para puntuar." };

  const productInfo: ProductInfo[] = products.map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    pitch: p.pitch,
    price_from: p.price_from,
  }));
  const bySlug = new Map(products.map((p) => [p.slug, p.id]));

  await Promise.allSettled(
    leads.map(async (lead) => {
      const enrichment = Array.isArray(lead.lead_enrichments)
        ? lead.lead_enrichments[0]
        : lead.lead_enrichments;
      const scores = await aiScoreLead(leadFacts(lead as Lead, enrichment ?? null), productInfo);
      if (!scores) return;

      for (const s of scores) {
        const productId = bySlug.get(s.product_slug);
        if (!productId) continue;
        await admin.from("lead_scores").upsert(
          {
            lead_id: lead.id,
            product_id: productId,
            score: s.score,
            reasons: s.reasons,
            generated_by: "ai",
            created_at: new Date().toISOString(),
          },
          { onConflict: "lead_id,product_id" }
        );
      }
      await admin.from("leads").update({ ai_scored_at: new Date().toISOString() }).eq("id", lead.id);
    })
  );

  const { count } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("org_id", ctx.org.id)
    .not("enriched_at", "is", null)
    .is("ai_scored_at", null);

  revalidatePath("/bases");
  revalidatePath("/leads");
  return { ok: true, processed: leads.length, remaining: count ?? 0 };
}

/** Análisis comercial + speech con Sonnet. Se cachea en ai_outputs. */
export async function generateAnalysis(
  leadId: string
): Promise<{ ok: true; analysis: AiAnalysis } | { ok: false; error: string }> {
  const ctx = await getCtx();
  if (!aiEnabled()) return { ok: false, error: "IA no configurada." };

  // Verificar acceso con el cliente del usuario (RLS) antes de usar admin
  const { data: lead } = await ctx.supabase
    .from("leads")
    .select("*, lead_enrichments(*)")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return { ok: false, error: "Lead no encontrado." };

  const admin = createAdminClient();
  const [{ data: products }, { data: topScore }] = await Promise.all([
    admin
      .from("products")
      .select("slug, name, description, pitch, price_from")
      .eq("org_id", ctx.org.id)
      .eq("active", true),
    admin
      .from("lead_scores")
      .select("score, products(name)")
      .eq("lead_id", leadId)
      .order("score", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const enrichment = Array.isArray(lead.lead_enrichments)
    ? lead.lead_enrichments[0]
    : lead.lead_enrichments;

  let analysis: AiAnalysis | null;
  try {
    analysis = await aiAnalyzeLead(
      leadFacts(lead as Lead, enrichment ?? null),
      (products ?? []) as ProductInfo[],
      (topScore?.products as unknown as { name: string } | null)?.name ?? null,
      ctx.profile.full_name?.split(" ")[0] ?? "el equipo"
    );
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error llamando a la IA." };
  }
  if (!analysis) return { ok: false, error: "La IA devolvió una respuesta inválida. Probá de nuevo." };

  await admin.from("ai_outputs").insert({
    lead_id: leadId,
    kind: "analisis",
    content: JSON.stringify(analysis),
    model: "claude-sonnet-4-6",
  });

  revalidatePath(`/leads/${leadId}`);
  return { ok: true, analysis };
}

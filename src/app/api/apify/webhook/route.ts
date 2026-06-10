import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchDatasetItems, mapGmapsItem } from "@/lib/apify";
import { normalizePhoneAR } from "@/lib/phone";
import { rootDomain } from "@/lib/domain";

export const maxDuration = 300;

const CHUNK = 1000;

export async function POST(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("run");
  const token = request.nextUrl.searchParams.get("token");
  if (!runId || !token) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const admin = createAdminClient();

  const { data: run } = await admin.from("search_runs").select("*").eq("id", runId).single();
  if (!run || run.stats?.webhook_token !== token)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    eventType?: string;
    resource?: { defaultDatasetId?: string; status?: string };
  };

  if (body.eventType !== "ACTOR.RUN.SUCCEEDED") {
    await admin
      .from("search_runs")
      .update({
        status: "fallido",
        finished_at: new Date().toISOString(),
        error: `Apify: ${body.resource?.status ?? body.eventType ?? "desconocido"}`,
      })
      .eq("id", runId);
    return NextResponse.json({ ok: true });
  }

  const datasetId = body.resource?.defaultDatasetId;
  if (!datasetId) return NextResponse.json({ error: "no dataset" }, { status: 400 });

  try {
    const items = await fetchDatasetItems(datasetId);
    const rows = items
      .map(mapGmapsItem)
      .filter((r) => r.name)
      .map((r) => ({
        ...r,
        phone_e164: normalizePhoneAR(r.phone),
        domain: rootDomain(r.website),
      }));

    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await admin.rpc("import_leads", {
        p_org: run.org_id,
        p_run: runId,
        p_source: "gmaps",
        p_rows: rows.slice(i, i + CHUNK),
      });
      if (error) throw new Error(error.message);
    }

    if (rows.length === 0) {
      await admin
        .from("search_runs")
        .update({ status: "completado", finished_at: new Date().toISOString() })
        .eq("id", runId);
    }

    return NextResponse.json({ ok: true, imported: rows.length });
  } catch (e) {
    await admin
      .from("search_runs")
      .update({
        status: "fallido",
        finished_at: new Date().toISOString(),
        error: e instanceof Error ? e.message : "Error importando resultados",
      })
      .eq("id", runId);
    return NextResponse.json({ error: "import failed" }, { status: 500 });
  }
}

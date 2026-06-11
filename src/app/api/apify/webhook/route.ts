import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { importApifyDataset } from "@/lib/apify-import";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get("run");
  const token = request.nextUrl.searchParams.get("token");
  if (!runId || !token) return NextResponse.json({ error: "missing params" }, { status: 400 });

  const admin = createAdminClient();

  const { data: run } = await admin.from("search_runs").select("*").eq("id", runId).single();
  if (!run || run.stats?.webhook_token !== token)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (run.status !== "corriendo") return NextResponse.json({ ok: true, skipped: true });

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
    const imported = await importApifyDataset(admin, runId, run.org_id, datasetId);
    return NextResponse.json({ ok: true, imported });
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

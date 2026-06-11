import type { CanonicalLeadRow } from "./types";

const GMAPS_ACTOR = "compass~crawler-google-places";

/**
 * Arranca una corrida del scraper de Google Maps.
 * El webhook es opcional: en local (sin URL pública) el avance se sigue por polling.
 */
export async function startGmapsRun(opts: {
  niche: string;
  location: string;
  count: number;
  webhookUrl?: string;
}): Promise<string> {
  let url = `https://api.apify.com/v2/acts/${GMAPS_ACTOR}/runs?token=${process.env.APIFY_TOKEN}`;

  if (opts.webhookUrl) {
    const webhooks = Buffer.from(
      JSON.stringify([
        {
          eventTypes: [
            "ACTOR.RUN.SUCCEEDED",
            "ACTOR.RUN.FAILED",
            "ACTOR.RUN.ABORTED",
            "ACTOR.RUN.TIMED_OUT",
          ],
          requestUrl: opts.webhookUrl,
        },
      ])
    ).toString("base64");
    url += `&webhooks=${webhooks}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      searchStringsArray: [opts.niche],
      locationQuery: opts.location,
      maxCrawledPlacesPerSearch: opts.count,
      language: "es",
      skipClosedPlaces: true,
    }),
  });

  if (!res.ok) throw new Error(`Apify respondió ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { id: string } };
  return json.data.id;
}

export interface ApifyRunInfo {
  status: string; // READY | RUNNING | SUCCEEDED | FAILED | ABORTED | TIMED-OUT
  datasetId: string | null;
}

export async function fetchRunStatus(apifyRunId: string): Promise<ApifyRunInfo> {
  const res = await fetch(
    `https://api.apify.com/v2/actor-runs/${apifyRunId}?token=${process.env.APIFY_TOKEN}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Apify run status ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { status: string; defaultDatasetId?: string } };
  return { status: json.data.status, datasetId: json.data.defaultDatasetId ?? null };
}

export async function fetchDatasetItems(datasetId: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${process.env.APIFY_TOKEN}&clean=true&format=json`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Apify dataset ${res.status}: ${await res.text()}`);
  return (await res.json()) as Record<string, unknown>[];
}

/** Mapea un item del actor de Google Maps al formato canónico de lead. */
export function mapGmapsItem(item: Record<string, unknown>): CanonicalLeadRow {
  const str = (k: string) => (typeof item[k] === "string" && (item[k] as string).trim()) || null;
  const num = (k: string) => (typeof item[k] === "number" ? (item[k] as number) : null);
  const location = item.location as { lat?: number; lng?: number } | undefined;

  return {
    name: (str("title") ?? "") as string,
    category: str("categoryName"),
    phone: str("phone") ?? str("phoneUnformatted"),
    website: str("website"),
    address: str("address"),
    city: str("city"),
    province: str("state"),
    country: str("countryCode") === "AR" ? "Argentina" : str("countryCode"),
    lat: location?.lat ?? null,
    lng: location?.lng ?? null,
    google_place_id: str("placeId"),
    rating: num("totalScore"),
    reviews_count: num("reviewsCount"),
    raw: { url: str("url") },
  };
}

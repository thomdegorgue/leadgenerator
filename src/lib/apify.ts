import type { CanonicalLeadRow } from "./types";

const GMAPS_ACTOR = "compass~crawler-google-places";

/** Arranca una corrida del scraper de Google Maps con webhook de finalización. */
export async function startGmapsRun(opts: {
  niche: string;
  location: string;
  count: number;
  webhookUrl: string;
}): Promise<string> {
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

  const res = await fetch(
    `https://api.apify.com/v2/acts/${GMAPS_ACTOR}/runs?token=${process.env.APIFY_TOKEN}&webhooks=${webhooks}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: [opts.niche],
        locationQuery: opts.location,
        maxCrawledPlacesPerSearch: opts.count,
        language: "es",
        skipClosedPlaces: true,
      }),
    }
  );

  if (!res.ok) throw new Error(`Apify respondió ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: { id: string } };
  return json.data.id;
}

export async function fetchDatasetItems(datasetId: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?token=${process.env.APIFY_TOKEN}&clean=true&format=json`
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

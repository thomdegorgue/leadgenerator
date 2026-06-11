/**
 * Cliente de IA (Claude). Solo se importa desde código de servidor y solo se
 * ejecuta si aiEnabled() — la app funciona 100% sin esto.
 */
import Anthropic from "@anthropic-ai/sdk";

const HAIKU = "claude-haiku-4-5-20251001"; // clasificación masiva, barato
const SONNET = "claude-sonnet-4-6"; // análisis comercial profundo

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function extractJson<T>(text: string): T | null {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

export interface LeadFacts {
  name: string;
  category: string | null;
  city: string | null;
  province: string | null;
  website: string | null;
  instagram: string | null;
  rating: number | null;
  reviews_count: number | null;
  signals: Record<string, unknown>;
}

export interface ProductInfo {
  slug: string;
  name: string;
  description: string | null;
  pitch?: string | null;
  price_from?: string | null;
}

export interface AiScore {
  product_slug: string;
  score: number;
  reasons: string[];
}

/** Score multi-producto con Haiku. Devuelve null si la respuesta no parsea. */
export async function aiScoreLead(
  lead: LeadFacts,
  products: ProductInfo[]
): Promise<AiScore[] | null> {
  const response = await client().messages.create({
    model: HAIKU,
    max_tokens: 700,
    system:
      "Sos un analista comercial de una software factory argentina que vende SaaS a PyMEs. " +
      "Calificás qué tan buena oportunidad es un negocio para CADA producto (0-100). " +
      "Criterio: score alto si el negocio NECESITA el producto y NO lo tiene resuelto. " +
      "Si ya tiene resuelto lo que el producto ofrece, score bajo. " +
      "Respondé SOLO JSON válido, sin texto extra.",
    messages: [
      {
        role: "user",
        content:
          `NEGOCIO:\n${JSON.stringify(lead, null, 1)}\n\n` +
          `PRODUCTOS QUE VENDEMOS:\n${JSON.stringify(products, null, 1)}\n\n` +
          `Devolvé exactamente este formato:\n` +
          `{"scores":[{"product_slug":"...","score":0-100,"reasons":["razón corta en español",...]}]}\n` +
          `Una entrada por producto. Máximo 3 razones por producto, cortas (3-6 palabras).`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = extractJson<{ scores: AiScore[] }>(text);
  if (!parsed?.scores?.length) return null;

  return parsed.scores
    .filter((s) => typeof s.score === "number" && s.product_slug)
    .map((s) => ({
      product_slug: s.product_slug,
      score: Math.min(Math.max(Math.round(s.score), 0), 100),
      reasons: (s.reasons ?? []).slice(0, 4).map(String),
    }));
}

export interface AiAnalysis {
  problema: string;
  oportunidad: string;
  argumento: string;
  speech: string;
}

/** Análisis comercial + speech de WhatsApp con Sonnet. */
export async function aiAnalyzeLead(
  lead: LeadFacts,
  products: ProductInfo[],
  topProduct: string | null,
  vendedor: string
): Promise<AiAnalysis | null> {
  const response = await client().messages.create({
    model: SONNET,
    max_tokens: 900,
    system:
      "Sos el mejor estratega comercial de una software factory de Buenos Aires que vende " +
      "SaaS a PyMEs (tiendas online, catálogos digitales, agendas de turnos). " +
      "Hablás español rioplatense (vos). Sos concreto, cero humo. " +
      "Respondé SOLO JSON válido, sin texto extra.",
    messages: [
      {
        role: "user",
        content:
          `NEGOCIO A ANALIZAR:\n${JSON.stringify(lead, null, 1)}\n\n` +
          `NUESTROS PRODUCTOS:\n${JSON.stringify(products, null, 1)}\n\n` +
          (topProduct ? `PRODUCTO CON MEJOR FIT SEGÚN SCORE: ${topProduct}\n\n` : "") +
          `Nombre del vendedor: ${vendedor}\n\n` +
          `Devolvé exactamente:\n` +
          `{"problema":"qué problema de digitalización tiene HOY este negocio (1-2 frases)",` +
          `"oportunidad":"qué producto nuestro le conviene y por qué (1-2 frases)",` +
          `"argumento":"el argumento de venta más fuerte para usar en la conversación (1-2 frases)",` +
          `"speech":"mensaje de WhatsApp de primer contacto, personalizado con datos reales del negocio, tono cercano rioplatense, máximo 400 caracteres, sin inventar datos, máximo 1 emoji"}`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const parsed = extractJson<AiAnalysis>(text);
  if (!parsed?.problema || !parsed?.speech) return null;
  return parsed;
}

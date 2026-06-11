/**
 * Enriquecimiento heurístico por web — SIN IA, costo cero.
 * Visita el sitio del lead y detecta señales comerciales, con foco en
 * plataformas usadas en Argentina (Tienda Nube, Mercado Shops...).
 */

export interface WebSignals {
  reachable: boolean;
  platform: string | null;
  has_ecommerce: boolean;
  has_catalog: boolean;
  uses_whatsapp: boolean;
  instagram: string | null;
}

const PLATFORMS: { name: string; needles: string[] }[] = [
  { name: "tiendanube", needles: ["tiendanube", "nuvemshop"] },
  { name: "mercadoshops", needles: ["mercadoshops"] },
  { name: "shopify", needles: ["cdn.shopify.com", "myshopify"] },
  { name: "woocommerce", needles: ["woocommerce"] },
  { name: "vtex", needles: ["vtex"] },
  { name: "wix-stores", needles: ["wixstores", "wix-ecommerce"] },
  { name: "empretienda", needles: ["empretienda"] },
];

const CART_NEEDLES = ["agregar al carrito", "añadir al carrito", "add to cart", "/cart", "carrito de compras", "comprar ahora"];
const CATALOG_NEEDLES = ["catálogo", "catalogo", "lista de precios", "nuestros productos"];
const WA_NEEDLES = ["wa.me/", "api.whatsapp.com", "whatsapp.com/send"];

export async function analyzeWebsite(url: string): Promise<WebSignals | null> {
  const target = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  let html: string;
  try {
    const res = await fetch(target, {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept-Language": "es-AR,es;q=0.9",
      },
    });
    if (!res.ok) return { reachable: false, platform: null, has_ecommerce: false, has_catalog: false, uses_whatsapp: false, instagram: null };
    html = (await res.text()).slice(0, 600_000).toLowerCase();
  } catch {
    return null; // no se pudo verificar (timeout/DNS): no afirmar nada
  }

  const platform = PLATFORMS.find((p) => p.needles.some((n) => html.includes(n)))?.name ?? null;
  const igMatch = html.match(/instagram\.com\/([a-z0-9._]{2,30})/);
  const igHandle = igMatch && !["p", "reel", "explore", "accounts", "stories"].includes(igMatch[1]) ? igMatch[1] : null;

  return {
    reachable: true,
    platform,
    has_ecommerce: platform !== null || CART_NEEDLES.some((n) => html.includes(n)),
    has_catalog: CATALOG_NEEDLES.some((n) => html.includes(n)),
    uses_whatsapp: WA_NEEDLES.some((n) => html.includes(n)),
    instagram: igHandle,
  };
}

/** Nivel de digitalización 0-100 a partir de las señales disponibles. */
export function digitalizationLevel(signals: {
  hasWebsite: boolean;
  hasEcommerce: boolean;
  usesWhatsapp: boolean;
  hasInstagram: boolean;
  hasCatalog: boolean;
}): number {
  let level = 0;
  if (signals.hasWebsite) level += 30;
  if (signals.hasEcommerce) level += 35;
  if (signals.usesWhatsapp) level += 15;
  if (signals.hasInstagram) level += 10;
  if (signals.hasCatalog) level += 10;
  return Math.min(level, 100);
}

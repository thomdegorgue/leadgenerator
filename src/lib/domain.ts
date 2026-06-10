/**
 * Extrae el dominio raíz de una URL para usar como clave de dedup.
 * Dominios de plataformas compartidas (IG, FB, linktree...) devuelven null:
 * no identifican unívocamente al negocio.
 */
const SHARED_PLATFORMS = [
  "instagram.com",
  "facebook.com",
  "fb.com",
  "wa.me",
  "whatsapp.com",
  "api.whatsapp.com",
  "linktr.ee",
  "bio.link",
  "taplink.cc",
  "google.com",
  "goo.gl",
  "maps.app.goo.gl",
  "mercadolibre.com.ar",
  "mercadoshops.com.ar",
];

export function rootDomain(url?: string | null): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url.trim()}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".")) return null;
    if (SHARED_PLATFORMS.some((p) => host === p || host.endsWith(`.${p}`))) return null;
    return host;
  } catch {
    return null;
  }
}

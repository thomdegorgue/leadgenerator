import type { LeadStatus } from "./types";

export const STATUS_ORDER: LeadStatus[] = [
  "nuevo",
  "asignado",
  "contactado",
  "respondio",
  "reunion",
  "propuesta",
  "cliente",
  "descartado",
];

export const STATUS: Record<
  LeadStatus,
  { label: string; badge: string; dot: string }
> = {
  nuevo: {
    label: "Nuevo",
    badge: "bg-slate-400/10 text-slate-300 border-slate-400/25",
    dot: "bg-slate-400",
  },
  asignado: {
    label: "Asignado",
    badge: "bg-cyan-400/10 text-cyan-300 border-cyan-400/25",
    dot: "bg-cyan-400",
  },
  contactado: {
    label: "Contactado",
    badge: "bg-blue-400/10 text-blue-300 border-blue-400/25",
    dot: "bg-blue-400",
  },
  respondio: {
    label: "Respondió",
    badge: "bg-violet-400/10 text-violet-300 border-violet-400/25",
    dot: "bg-violet-400",
  },
  reunion: {
    label: "Reunión",
    badge: "bg-amber-400/10 text-amber-300 border-amber-400/25",
    dot: "bg-amber-400",
  },
  propuesta: {
    label: "Propuesta",
    badge: "bg-orange-400/10 text-orange-300 border-orange-400/25",
    dot: "bg-orange-400",
  },
  cliente: {
    label: "Cliente",
    badge: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
    dot: "bg-emerald-400",
  },
  descartado: {
    label: "Descartado",
    badge: "bg-zinc-500/10 text-zinc-400 border-zinc-500/25",
    dot: "bg-zinc-500",
  },
};

/** Etiquetas en español para las razones del score por reglas. */
export const REASON_LABELS: Record<string, string> = {
  has_instagram: "Tiene Instagram",
  uses_whatsapp: "Usa WhatsApp",
  no_ecommerce: "No tiene ecommerce",
  no_catalog: "No tiene catálogo",
  no_online_booking: "No tiene reservas online",
  sells_products: "Vende productos",
  has_website: "Tiene web",
  no_website: "No tiene web",
  ig_5k_followers: "+5.000 seguidores en IG",
  good_rating: "Buen rating en Google",
  category_match: "Rubro ideal",
  uses_platform: "Usa plataforma de ecommerce",
};

/** Señales disponibles para el editor visual de reglas de score. */
export const SIGNAL_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: "category_match", label: "Rubro ideal", hint: "El rubro del negocio matchea las keywords del producto" },
  { key: "no_ecommerce", label: "No tiene ecommerce", hint: "No se detectó tienda online en su web" },
  { key: "no_catalog", label: "No tiene catálogo", hint: "No se detectó catálogo online" },
  { key: "no_online_booking", label: "No tiene reservas online", hint: "Sin sistema de turnos detectado" },
  { key: "no_website", label: "No tiene web", hint: "El negocio no tiene sitio propio" },
  { key: "has_website", label: "Tiene web", hint: "Tiene sitio propio" },
  { key: "uses_whatsapp", label: "Usa WhatsApp", hint: "Tiene teléfono móvil o botón de WhatsApp" },
  { key: "has_instagram", label: "Tiene Instagram", hint: "Tiene perfil de IG detectado" },
  { key: "ig_5k_followers", label: "+5.000 seguidores", hint: "Audiencia relevante en Instagram" },
  { key: "sells_products", label: "Vende productos", hint: "Publica o vende productos online" },
  { key: "good_rating", label: "Buen rating en Google", hint: "4.0 o más estrellas" },
  { key: "uses_platform", label: "Usa plataforma ecommerce", hint: "Tienda Nube, Shopify, Woo... (para venderle otro producto)" },
];

/** Motivos tipificados de descarte. */
export const DISCARD_REASONS: Record<string, string> = {
  no_contesta: "No contesta",
  no_interesa: "No le interesa",
  numero_invalido: "Número inválido",
  ya_resuelto: "Ya lo tiene resuelto",
  competencia: "Se fue con la competencia",
  otro: "Otro",
};

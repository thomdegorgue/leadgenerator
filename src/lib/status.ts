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
};

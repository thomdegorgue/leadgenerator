import type { Lead } from "./types";

export const TEMPLATE_STAGES: Record<string, string> = {
  primer_contacto: "Primer contacto",
  seguimiento: "Seguimiento",
  recontacto: "Recontacto",
  oferta: "Oferta",
  recuperacion: "Recuperar conversación",
};

export const TEMPLATE_VARIABLES = ["nombre", "ciudad", "categoria", "vendedor"] as const;

/** Reemplaza variables {{nombre}}, {{ciudad}}, {{categoria}}, {{vendedor}}. */
export function renderTemplate(body: string, vars: Record<string, string | null | undefined>) {
  return body
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key]?.trim() ?? "")
    .replace(/ {2,}/g, " ")
    .trim();
}

export function templateVars(lead: Pick<Lead, "name" | "city" | "category">, vendedor?: string | null) {
  return {
    nombre: lead.name,
    ciudad: lead.city,
    categoria: lead.category,
    vendedor: vendedor ?? "",
  };
}

export function waLink(phoneE164: string, text: string) {
  return `https://wa.me/${phoneE164.replace("+", "")}?text=${encodeURIComponent(text)}`;
}

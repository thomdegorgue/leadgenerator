export type LeadStatus =
  | "nuevo"
  | "asignado"
  | "contactado"
  | "respondio"
  | "reunion"
  | "propuesta"
  | "cliente"
  | "descartado";

export type Role = "owner" | "manager" | "vendedor";
export type LeadSource = "gmaps" | "instagram" | "facebook" | "website" | "csv" | "manual";
export type RunStatus = "pendiente" | "corriendo" | "completado" | "fallido";

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_super_admin: boolean;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

export interface Membership {
  id: string;
  org_id: string;
  user_id: string;
  team_id: string | null;
  role: Role;
}

export interface Team {
  id: string;
  org_id: string;
  name: string;
}

export interface Product {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  description: string | null;
  pitch: string | null;
  price_from: string | null;
  category_keywords: string[];
  score_rules: Record<string, number>;
  active: boolean;
}

export interface Lead {
  id: string;
  org_id: string;
  search_run_id: string | null;
  source: LeadSource;
  name: string;
  category: string | null;
  phone: string | null;
  phone_e164: string | null;
  email: string | null;
  website: string | null;
  domain: string | null;
  instagram: string | null;
  facebook: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  google_place_id: string | null;
  rating: number | null;
  reviews_count: number | null;
  status: LeadStatus;
  assigned_to: string | null;
  assigned_at: string | null;
  next_followup_at: string | null;
  discard_reason: string | null;
  deal_value: number | null;
  deal_product_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadScore {
  id: string;
  lead_id: string;
  product_id: string;
  score: number;
  reasons: string[];
  generated_by: "rules" | "ai";
}

export interface Activity {
  id: string;
  org_id: string;
  lead_id: string;
  user_id: string | null;
  type: string;
  result: string | null;
  note: string | null;
  created_at: string;
}

export interface MessageTemplate {
  id: string;
  org_id: string;
  product_id: string | null;
  stage: string;
  name: string;
  body: string;
  active: boolean;
}

export interface Search {
  id: string;
  org_id: string;
  name: string;
  sources: string[];
  niche: string | null;
  location: string | null;
  target_count: number;
  product_id: string | null;
  notes: string | null;
  archived: boolean;
  auto_rerun: boolean;
  created_at: string;
}

export interface SearchRun {
  id: string;
  search_id: string;
  org_id: string;
  status: RunStatus;
  stats: { found?: number; inserted?: number; duplicates?: number; webhook_token?: string };
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

/** Fila canónica que aceptan los importadores (CSV / Apify / manual). */
export interface CanonicalLeadRow {
  name: string;
  category?: string | null;
  phone?: string | null;
  phone_e164?: string | null;
  email?: string | null;
  website?: string | null;
  domain?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  google_place_id?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  raw?: Record<string, unknown>;
}

export interface ImportStats {
  found: number;
  inserted: number;
  duplicates: number;
}

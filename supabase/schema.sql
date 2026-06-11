-- ============================================================================
-- ARGOS — Sistema Operativo Comercial
-- schema.sql — ÚNICA FUENTE DE VERDAD de la base de datos.
--
-- 100% IDEMPOTENTE: se puede ejecutar completo, todas las veces que haga
-- falta, sobre una base vacía o sobre producción con datos. Nunca borra datos.
--
-- Uso: pegar el archivo ENTERO en el SQL Editor de Supabase y ejecutar.
--
-- Reglas para mantener la idempotencia al evolucionar el esquema:
--   * Tablas nuevas:      create table if not exists ...
--   * Columnas nuevas:    alter table ... add column if not exists ...
--                         (agregarla en la SECCIÓN 9 — EVOLUCIÓN, no en el
--                          create table original, que no se re-ejecuta)
--   * Valores de enum:    alter type ... add value if not exists '...';
--   * Funciones:          create or replace function ...
--   * Triggers/Policies:  drop ... if exists; + create ...
--   * Índices:            create index if not exists ...
-- ============================================================================


-- ============================================================
-- 1. EXTENSIONES
-- ============================================================
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;   -- fuzzy matching para anti-duplicados


-- ============================================================
-- 2. TIPOS (enums)
-- ============================================================
do $$ begin
  create type public.member_role as enum ('owner', 'manager', 'vendedor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum
    ('nuevo', 'asignado', 'contactado', 'respondio', 'reunion', 'propuesta', 'cliente', 'descartado');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.run_status as enum ('pendiente', 'corriendo', 'completado', 'fallido');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_source as enum ('gmaps', 'instagram', 'facebook', 'website', 'csv', 'manual');
exception when duplicate_object then null; end $$;


-- ============================================================
-- 3. TABLAS
-- ============================================================

-- --- Identidad -------------------------------------------------------------

create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  full_name       text,
  avatar_url      text,
  phone           text,
  is_super_admin  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  settings    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.memberships (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  team_id     uuid references public.teams(id) on delete set null,
  role        public.member_role not null default 'vendedor',
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

-- --- Catálogo propio (lo que vendemos) --------------------------------------

create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  slug        text not null,
  name        text not null,
  description text,
  -- reglas declarativas para el score sin IA (señal -> puntos),
  -- ej: {"no_ecommerce": 30, "has_instagram": 20, "uses_whatsapp": 20}
  score_rules jsonb not null default '{}'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (org_id, slug)
);

-- --- Generación de bases -----------------------------------------------------

create table if not exists public.searches (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations(id) on delete cascade,
  created_by    uuid references public.profiles(id) on delete set null,
  name          text not null,
  sources       text[] not null default '{gmaps}',
  niche         text,                 -- "distribuidoras", "peluquerías"...
  location      text,                 -- "CABA, Argentina"
  target_count  integer not null default 1000,
  filters       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.search_runs (
  id            uuid primary key default gen_random_uuid(),
  search_id     uuid not null references public.searches(id) on delete cascade,
  org_id        uuid not null references public.organizations(id) on delete cascade,
  status        public.run_status not null default 'pendiente',
  apify_run_id  text,
  stats         jsonb not null default '{}'::jsonb,  -- {found, inserted, duplicates}
  error         text,
  started_at    timestamptz,
  finished_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- --- Leads -------------------------------------------------------------------

create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizations(id) on delete cascade,
  search_run_id    uuid references public.search_runs(id) on delete set null,
  source           public.lead_source not null default 'manual',

  name             text not null,
  category         text,
  phone            text,              -- crudo, como vino
  phone_e164       text,              -- normalizado +549..., clave de dedup
  email            text,
  website          text,
  domain           text,              -- dominio raíz normalizado, clave de dedup
  instagram        text,              -- handle sin @
  facebook         text,
  address          text,
  city             text,
  province         text,
  country          text default 'Argentina',
  lat              double precision,
  lng              double precision,
  google_place_id  text,              -- clave de dedup principal
  rating           numeric(3,2),
  reviews_count    integer,

  status           public.lead_status not null default 'nuevo',
  assigned_to      uuid references public.profiles(id) on delete set null,
  assigned_at      timestamptz,
  next_followup_at timestamptz,       -- para reciclaje / siguiente mejor acción
  raw              jsonb not null default '{}'::jsonb,  -- payload original del scraper

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Anti-duplicados: unicidad por organización en cada clave fuerte
create unique index if not exists leads_org_place_uq
  on public.leads (org_id, google_place_id) where google_place_id is not null;
create unique index if not exists leads_org_phone_uq
  on public.leads (org_id, phone_e164) where phone_e164 is not null;
create unique index if not exists leads_org_domain_uq
  on public.leads (org_id, domain) where domain is not null;
-- Fuzzy (nombre + ciudad) para detección blanda en la app
create index if not exists leads_name_trgm_idx on public.leads using gin (name gin_trgm_ops);
create index if not exists leads_org_status_idx on public.leads (org_id, status);
create index if not exists leads_assigned_idx on public.leads (assigned_to, status);
create index if not exists leads_followup_idx on public.leads (org_id, next_followup_at)
  where next_followup_at is not null;

-- --- Enriquecimiento y score ---------------------------------------------------

create table if not exists public.lead_enrichments (
  lead_id              uuid primary key references public.leads(id) on delete cascade,
  sells_products       boolean,
  has_ecommerce        boolean,
  has_catalog          boolean,
  uses_whatsapp        boolean,
  has_instagram        boolean,
  ig_followers         integer,
  ig_posts             integer,
  has_online_booking   boolean,      -- relevante para vender agendas
  digitalization_level integer check (digitalization_level between 0 and 100),
  signals              jsonb not null default '{}'::jsonb,
  enriched_by          text,          -- 'rules' | 'ai' | 'manual'
  enriched_at          timestamptz not null default now()
);

create table if not exists public.lead_scores (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.leads(id) on delete cascade,
  product_id   uuid not null references public.products(id) on delete cascade,
  score        integer not null check (score between 0 and 100),
  reasons      text[] not null default '{}',
  generated_by text not null default 'rules',  -- 'rules' | 'ai'
  created_at   timestamptz not null default now(),
  unique (lead_id, product_id)
);

create index if not exists lead_scores_product_idx on public.lead_scores (product_id, score desc);

-- --- Campañas ------------------------------------------------------------------

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  name        text not null,
  status      text not null default 'activa',  -- activa | pausada | archivada
  created_at  timestamptz not null default now()
);

create table if not exists public.campaign_leads (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (campaign_id, lead_id)
);

-- --- Actividad (historial global, inmutable) -------------------------------------

create table if not exists public.activities (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  lead_id     uuid not null references public.leads(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete set null,
  type        text not null,  -- whatsapp | llamada | email | nota | cambio_estado | asignacion | respuesta | reunion | descarte
  result      text,           -- ej: 'sin_respuesta' | 'respondio' | 'interesado' | 'no_interesado'
  note        text,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activities_lead_idx on public.activities (lead_id, created_at desc);
create index if not exists activities_user_idx on public.activities (user_id, created_at desc);

-- --- Plantillas de mensajes -------------------------------------------------------

create table if not exists public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  stage       text not null,  -- primer_contacto | seguimiento | recontacto | oferta | recuperacion
  name        text not null,
  body        text not null,  -- variables: {{nombre}}, {{ciudad}}, {{categoria}}, {{vendedor}}
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- --- Salidas de IA (cacheadas, opcionales) -----------------------------------------

create table if not exists public.ai_outputs (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  kind        text not null,  -- 'speech' | 'analisis' | 'mensaje'
  content     text not null,
  model       text,
  created_at  timestamptz not null default now()
);

create index if not exists ai_outputs_lead_idx on public.ai_outputs (lead_id, kind);


-- ============================================================
-- 4. FUNCIONES AUXILIARES (security definer: usadas por las policies)
-- ============================================================

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = auth.uid()), false)
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m where m.org_id = p_org and m.user_id = auth.uid())
$$;

create or replace function public.org_role(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role::text from public.memberships m where m.org_id = p_org and m.user_id = auth.uid()
$$;

-- ¿El usuario actual comparte equipo con p_user dentro de p_org?
create or replace function public.shares_team_with(p_org uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on b.org_id = a.org_id and b.team_id = a.team_id
    where a.org_id = p_org and a.user_id = auth.uid()
      and b.user_id = p_user and a.team_id is not null
  )
$$;

-- Regla central de visibilidad de un lead:
--   super admin -> todo | owner -> su org | manager -> su equipo + sin asignar | vendedor -> solo los suyos
create or replace function public.can_view_lead(p_lead uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.leads l
    where l.id = p_lead
      and (
        public.is_super_admin()
        or (
          public.is_org_member(l.org_id)
          and (
            public.org_role(l.org_id) = 'owner'
            or (public.org_role(l.org_id) = 'manager'
                and (l.assigned_to is null or public.shares_team_with(l.org_id, l.assigned_to)))
            or (public.org_role(l.org_id) = 'vendedor' and l.assigned_to = auth.uid())
          )
        )
      )
  )
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or public.org_role(p_org) in ('owner', 'manager')
$$;


-- ============================================================
-- 5. TRIGGERS
-- ============================================================

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_organizations_updated on public.organizations;
create trigger trg_organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();

drop trigger if exists trg_leads_updated on public.leads;
create trigger trg_leads_updated before update on public.leads
  for each row execute function public.set_updated_at();

-- Perfil automático al registrarse un usuario en Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Nadie puede auto-promoverse a super admin.
-- Solo aplica a sesiones de usuario (con JWT): el SQL Editor y el service role
-- (auth.uid() null) pasan — por ahí corre superadmin.sql.
create or replace function public.guard_super_admin_flag()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_super_admin is distinct from old.is_super_admin
     and auth.uid() is not null
     and not public.is_super_admin() then
    raise exception 'Solo un super admin puede modificar is_super_admin';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_super_admin on public.profiles;
create trigger trg_guard_super_admin before update on public.profiles
  for each row execute function public.guard_super_admin_flag();


-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles          enable row level security;
alter table public.organizations     enable row level security;
alter table public.teams             enable row level security;
alter table public.memberships       enable row level security;
alter table public.products          enable row level security;
alter table public.searches          enable row level security;
alter table public.search_runs       enable row level security;
alter table public.leads             enable row level security;
alter table public.lead_enrichments  enable row level security;
alter table public.lead_scores       enable row level security;
alter table public.campaigns         enable row level security;
alter table public.campaign_leads    enable row level security;
alter table public.activities        enable row level security;
alter table public.message_templates enable row level security;
alter table public.ai_outputs        enable row level security;

-- profiles: cualquier usuario autenticado ve nombres/avatares (herramienta interna);
-- cada uno edita solo su perfil (el flag super admin lo protege el trigger)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() is not null);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_super_admin());

-- organizations
drop policy if exists orgs_select on public.organizations;
create policy orgs_select on public.organizations
  for select using (public.is_super_admin() or public.is_org_member(id));
drop policy if exists orgs_update on public.organizations;
create policy orgs_update on public.organizations
  for update using (public.is_super_admin() or public.org_role(id) = 'owner');
drop policy if exists orgs_insert on public.organizations;
create policy orgs_insert on public.organizations
  for insert with check (public.is_super_admin());

-- teams
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select using (public.is_super_admin() or public.is_org_member(org_id));
drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- memberships
drop policy if exists memberships_select on public.memberships;
create policy memberships_select on public.memberships
  for select using (public.is_super_admin() or public.is_org_member(org_id));
drop policy if exists memberships_write on public.memberships;
create policy memberships_write on public.memberships
  for all using (public.is_super_admin() or public.org_role(org_id) = 'owner')
  with check (public.is_super_admin() or public.org_role(org_id) = 'owner');

-- products
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select using (public.is_super_admin() or public.is_org_member(org_id));
drop policy if exists products_write on public.products;
create policy products_write on public.products
  for all using (public.is_super_admin() or public.org_role(org_id) = 'owner')
  with check (public.is_super_admin() or public.org_role(org_id) = 'owner');

-- searches / search_runs (solo owner/manager las operan)
drop policy if exists searches_all on public.searches;
create policy searches_all on public.searches
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));
drop policy if exists search_runs_all on public.search_runs;
create policy search_runs_all on public.search_runs
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

-- leads: la regla central vive en can_view_lead()
drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select using (public.can_view_lead(id));
drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert with check (public.is_org_admin(org_id));
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads
  for update using (public.can_view_lead(id)) with check (public.can_view_lead(id));
drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads
  for delete using (public.is_super_admin() or public.org_role(org_id) = 'owner');

-- enriquecimiento / scores / IA: visibles si ves el lead; escribe el servidor o un admin
drop policy if exists enrichments_select on public.lead_enrichments;
create policy enrichments_select on public.lead_enrichments
  for select using (public.can_view_lead(lead_id));
drop policy if exists enrichments_write on public.lead_enrichments;
create policy enrichments_write on public.lead_enrichments
  for all using (public.can_view_lead(lead_id)) with check (public.can_view_lead(lead_id));

drop policy if exists scores_select on public.lead_scores;
create policy scores_select on public.lead_scores
  for select using (public.can_view_lead(lead_id));

drop policy if exists ai_outputs_select on public.ai_outputs;
create policy ai_outputs_select on public.ai_outputs
  for select using (public.can_view_lead(lead_id));

-- campaigns
drop policy if exists campaigns_select on public.campaigns;
create policy campaigns_select on public.campaigns
  for select using (public.is_super_admin() or public.is_org_member(org_id));
drop policy if exists campaigns_write on public.campaigns;
create policy campaigns_write on public.campaigns
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

drop policy if exists campaign_leads_select on public.campaign_leads;
create policy campaign_leads_select on public.campaign_leads
  for select using (public.can_view_lead(lead_id));
drop policy if exists campaign_leads_write on public.campaign_leads;
create policy campaign_leads_write on public.campaign_leads
  for all using (
    exists (select 1 from public.campaigns c where c.id = campaign_id and public.is_org_admin(c.org_id))
  );

-- activities: log inmutable; inserta cualquiera que vea el lead, a su propio nombre
drop policy if exists activities_select on public.activities;
create policy activities_select on public.activities
  for select using (public.can_view_lead(lead_id));
drop policy if exists activities_insert on public.activities;
create policy activities_insert on public.activities
  for insert with check (public.can_view_lead(lead_id) and user_id = auth.uid());

-- message_templates
drop policy if exists templates_select on public.message_templates;
create policy templates_select on public.message_templates
  for select using (public.is_super_admin() or public.is_org_member(org_id));
drop policy if exists templates_write on public.message_templates;
create policy templates_write on public.message_templates
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));


-- ============================================================
-- 7. REALTIME (pipeline y actividad en vivo)
-- ============================================================
do $$ begin
  alter publication supabase_realtime add table public.leads;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.activities;
exception when duplicate_object then null; end $$;


-- ============================================================
-- 8. SCORE SIN IA (fallback por reglas declarativas)
-- ============================================================
-- Calcula el score de un lead para cada producto activo de la org usando
-- products.score_rules (señal -> puntos). Funciona sin ninguna API externa.
create or replace function public.compute_rule_scores(p_lead uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_lead public.leads%rowtype;
  v_enr  public.lead_enrichments%rowtype;
  v_prod record;
  v_rule record;
  v_score integer;
  v_reasons text[];
  v_signal boolean;
begin
  select * into v_lead from public.leads where id = p_lead;
  if not found then return; end if;
  select * into v_enr from public.lead_enrichments where lead_id = p_lead;

  for v_prod in
    select id, score_rules from public.products
    where org_id = v_lead.org_id and active
  loop
    v_score := 0;
    v_reasons := '{}';
    for v_rule in select key, value::int as pts from jsonb_each_text(v_prod.score_rules)
    loop
      v_signal := case v_rule.key
        when 'has_instagram'      then coalesce(v_enr.has_instagram, v_lead.instagram is not null)
        when 'uses_whatsapp'      then coalesce(v_enr.uses_whatsapp, v_lead.phone_e164 is not null)
        when 'no_ecommerce'       then coalesce(not v_enr.has_ecommerce, false)
        when 'no_catalog'         then coalesce(not v_enr.has_catalog, false)
        when 'no_online_booking'  then coalesce(not v_enr.has_online_booking, false)
        when 'sells_products'     then coalesce(v_enr.sells_products, false)
        when 'has_website'        then v_lead.website is not null
        when 'no_website'         then v_lead.website is null
        when 'ig_5k_followers'    then coalesce(v_enr.ig_followers, 0) >= 5000
        when 'good_rating'        then coalesce(v_lead.rating, 0) >= 4.0
        else false
      end;
      if v_signal then
        v_score := v_score + v_rule.pts;
        v_reasons := array_append(v_reasons, v_rule.key);
      end if;
    end loop;
    v_score := least(greatest(v_score, 0), 100);

    insert into public.lead_scores (lead_id, product_id, score, reasons, generated_by)
    values (p_lead, v_prod.id, v_score, v_reasons, 'rules')
    on conflict (lead_id, product_id)
    do update set score = excluded.score, reasons = excluded.reasons,
                  generated_by = 'rules', created_at = now()
    where public.lead_scores.generated_by = 'rules';  -- no pisa scores de IA
  end loop;
end $$;


-- ============================================================
-- 8b. IMPORTACIÓN MASIVA CON ANTI-DUPLICADOS
-- ============================================================
-- Inserta un lote de leads (jsonb array) ignorando duplicados (cualquier
-- conflicto con los índices únicos parciales), calcula el score por reglas
-- de los insertados y actualiza las stats del search_run.
-- Autorización: org admin (jwt de usuario) o service role (servidor).
create or replace function public.import_leads(
  p_org uuid, p_run uuid, p_source public.lead_source, p_rows jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_found    int := coalesce(jsonb_array_length(p_rows), 0);
  v_inserted int := 0;
  v_ids      uuid[];
begin
  if not (public.is_org_admin(p_org) or coalesce(auth.jwt()->>'role', '') = 'service_role') then
    raise exception 'No autorizado para importar leads en esta organización';
  end if;

  with src as (
    select * from jsonb_to_recordset(p_rows) as r(
      name text, category text, phone text, phone_e164 text, email text,
      website text, domain text, instagram text, facebook text,
      address text, city text, province text, country text,
      lat double precision, lng double precision,
      google_place_id text, rating numeric, reviews_count int, raw jsonb
    )
  ), ins as (
    insert into public.leads (
      org_id, search_run_id, source, name, category, phone, phone_e164, email,
      website, domain, instagram, facebook, address, city, province, country,
      lat, lng, google_place_id, rating, reviews_count, raw
    )
    select p_org, p_run, p_source, trim(name), category, phone, phone_e164, email,
      website, domain, instagram, facebook, address, city, province,
      coalesce(country, 'Argentina'), lat, lng, google_place_id,
      least(rating, 9.99), reviews_count, coalesce(raw, '{}'::jsonb)
    from src
    where name is not null and length(trim(name)) > 0
    on conflict do nothing
    returning id
  )
  select array_agg(id), count(*)::int into v_ids, v_inserted from ins;

  if v_ids is not null then
    perform public.compute_rule_scores(t.id) from unnest(v_ids) as t(id);
  end if;

  if p_run is not null then
    update public.search_runs set
      status = 'completado',
      finished_at = now(),
      stats = stats || jsonb_build_object(
        'found',      coalesce((stats->>'found')::int, 0) + v_found,
        'inserted',   coalesce((stats->>'inserted')::int, 0) + coalesce(v_inserted, 0),
        'duplicates', coalesce((stats->>'duplicates')::int, 0) + (v_found - coalesce(v_inserted, 0))
      )
    where id = p_run;
  end if;

  return jsonb_build_object(
    'found', v_found,
    'inserted', coalesce(v_inserted, 0),
    'duplicates', v_found - coalesce(v_inserted, 0)
  );
end $$;


-- ============================================================
-- 9. EVOLUCIÓN (migraciones acumulativas)
-- ============================================================
-- Las columnas/cambios posteriores al create table original van acá, en orden,
-- siempre con "if not exists" / patrón idempotente. Ejemplo:
--   alter table public.leads add column if not exists tags text[] not null default '{}';

-- [2026-06] Fase 2: tracking de enriquecimiento e IA por lead
alter table public.leads add column if not exists enriched_at timestamptz;
alter table public.leads add column if not exists ig_enriched_at timestamptz;
alter table public.leads add column if not exists ai_scored_at timestamptz;

create index if not exists leads_pending_enrich_idx
  on public.leads (org_id, created_at) where enriched_at is null;

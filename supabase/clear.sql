-- ============================================================================
-- ARGOS — clear.sql
-- Limpia TODOS los datos de negocio. No toca el esquema, ni auth.users,
-- ni profiles, ni la estructura de organizaciones/equipos/productos.
--
-- Uso: pegar entero en el SQL Editor de Supabase y ejecutar.
-- ============================================================================

truncate table
  public.activities,
  public.ai_outputs,
  public.lead_scores,
  public.lead_enrichments,
  public.campaign_leads,
  public.campaigns,
  public.leads,
  public.search_runs,
  public.searches,
  public.message_templates
restart identity cascade;

-- ----------------------------------------------------------------------------
-- RESET TOTAL (opcional): descomentar para borrar también la estructura
-- organizacional. Después hay que volver a correr superadmin.sql.
-- Los usuarios de Auth se borran desde el panel (Authentication > Users).
-- ----------------------------------------------------------------------------
-- truncate table
--   public.memberships,
--   public.teams,
--   public.products,
--   public.organizations
-- restart identity cascade;
--
-- update public.profiles set is_super_admin = false;

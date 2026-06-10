-- ============================================================================
-- ARGOS — superadmin.sql
-- Convierte en SUPER ADMIN a un usuario YA CREADO en Supabase Auth
-- (Authentication > Users > Add user), crea la organización por defecto si no
-- existe, lo agrega como owner, y siembra productos y plantillas iniciales.
--
-- IDEMPOTENTE: se puede correr varias veces y con distintos emails.
--
-- Uso:
--   1. Crear el usuario en el panel de Auth de Supabase (email + password).
--   2. Editar v_email acá abajo.
--   3. Pegar entero en el SQL Editor y ejecutar.
-- ============================================================================

do $$
declare
  v_email text := 'thomdegorgue@gmail.com';  -- ← EDITAR: email del super admin
  v_org_name text := 'HQ';
  v_org_slug text := 'hq';

  v_user uuid;
  v_org  uuid;
begin
  -- 1. Usuario debe existir en Auth
  select id into v_user from auth.users where email = v_email;
  if v_user is null then
    raise exception 'No existe ningún usuario en Auth con email %. Crealo primero en Authentication > Users.', v_email;
  end if;

  -- 2. Perfil + flag super admin
  insert into public.profiles (id, full_name, is_super_admin)
  values (v_user, initcap(split_part(v_email, '@', 1)), true)
  on conflict (id) do update set is_super_admin = true;

  -- 3. Organización por defecto
  select id into v_org from public.organizations where slug = v_org_slug;
  if v_org is null then
    insert into public.organizations (name, slug)
    values (v_org_name, v_org_slug)
    returning id into v_org;
  end if;

  -- 4. Membresía como owner
  insert into public.memberships (org_id, user_id, role)
  values (v_org, v_user, 'owner')
  on conflict (org_id, user_id) do update set role = 'owner';

  -- 5. Productos iniciales (lo que vendemos) con reglas de score sin IA
  insert into public.products (org_id, slug, name, description, score_rules) values
    (v_org, 'tienda-online', 'Tienda Online', 'Ecommerce completo con carrito y pagos',
     '{"sells_products": 25, "no_ecommerce": 30, "has_instagram": 15, "uses_whatsapp": 15, "ig_5k_followers": 15}'::jsonb),
    (v_org, 'catalogo', 'Catálogo Online', 'Catálogo digital con pedidos por WhatsApp',
     '{"sells_products": 25, "no_catalog": 30, "uses_whatsapp": 25, "has_instagram": 20}'::jsonb),
    (v_org, 'agenda-turnos', 'Agenda de Turnos', 'Reservas y turnos automáticos online',
     '{"no_online_booking": 40, "uses_whatsapp": 25, "has_instagram": 15, "good_rating": 20}'::jsonb)
  on conflict (org_id, slug) do nothing;

  -- 6. Plantillas de WhatsApp iniciales
  if not exists (select 1 from public.message_templates where org_id = v_org) then
    insert into public.message_templates (org_id, stage, name, body) values
      (v_org, 'primer_contacto', 'Primer contacto',
       'Hola {{nombre}} 👋 Vi que están en {{ciudad}} y me gustó mucho lo que hacen. Trabajo ayudando a negocios como el de ustedes a vender más online. ¿Tienen un minuto para que les cuente?'),
      (v_org, 'seguimiento', 'Seguimiento',
       'Hola {{nombre}}, ¿cómo están? Les escribí hace unos días por el tema de digitalizar el negocio. ¿Pudieron verlo? Cualquier duda estoy a disposición 🙌'),
      (v_org, 'recontacto', 'Recontacto',
       'Hola {{nombre}}! Hace un tiempo hablamos sobre mejorar la presencia online del negocio. Tenemos novedades que les pueden interesar, ¿les parece si retomamos?'),
      (v_org, 'oferta', 'Oferta',
       'Hola {{nombre}}! Este mes tenemos una promo especial para negocios de {{ciudad}}: bonificamos la puesta en marcha. ¿Querés que te pase el detalle?'),
      (v_org, 'recuperacion', 'Recuperar conversación',
       'Hola {{nombre}}, quedó pendiente nuestra charla 😊 ¿Seguís interesado en lo que habíamos hablado? Si preferís lo vemos en una llamada corta cuando puedas.');
  end if;

  raise notice 'OK: % es super admin y owner de la org "%" (%).', v_email, v_org_name, v_org;
end $$;

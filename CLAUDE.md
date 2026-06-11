# ARGOS — Sistema Operativo Comercial

> **ARGOS** — el gigante de los cien ojos: el que todo lo ve. Nombre confirmado.
> Documento de producto completo: `PROPUESTA.md`.

Plataforma interna de una software factory (Buenos Aires) para: generar bases de leads (Google Maps / CSV), deduplicar, enriquecer, calificar con **score multi-producto** (un score por cada SaaS que vendemos: tienda online, catálogo, agenda de turnos), distribuir al equipo de ventas y contactar por WhatsApp con plantillas. UI en **español rioplatense**.

## Stack

- **Next.js 15 (App Router) + TypeScript** — deploy en **Vercel Pro** (ya contratado)
- **Supabase** — Postgres + Auth + RLS + Realtime. **Plan FREE al inicio**; el diseño debe respetar sus límites (500MB DB, sin pg_cron confiable en free → cron via Vercel Cron o Inngest)
- **Inngest** (free tier) — jobs largos: generación de bases, enriquecimiento, distribución, reciclaje
- **Apify** (free tier USD 5/mes al inicio) — scraper de Google Maps como fuente primaria. IG/FB solo como enriquecimiento futuro
- **Claude API** — OPCIONAL (ver abajo)
- **UI**: Tailwind 4 + shadcn/ui con theme custom, Framer Motion, dnd-kit. Dark-first "Mission Control", mobile-first, PWA

## Regla de oro: la IA es ADITIVA, nunca requerida

Todo funciona sin `ANTHROPIC_API_KEY`:
- **Score**: fallback por reglas declarativas (`products.score_rules` + función SQL `compute_rule_scores`). Con IA, se mejora (`generated_by = 'ai'` pisa a `'rules'`, nunca al revés).
- **Mensajes**: plantillas con variables (`{{nombre}}`, `{{ciudad}}`...) siempre disponibles; la personalización IA es un botón extra.
- **Enriquecimiento**: señales por heurística (tiene web, tiene IG, teléfono móvil) sin IA; clasificación profunda con Haiku Batch cuando haya key.
- Gate central: helper `aiEnabled()` que chequea la env var. Sin key, los botones de IA no se renderizan (no se muestran deshabilitados: directamente no existen).
- Lo mismo con Apify: sin `APIFY_TOKEN`, las fuentes disponibles son CSV import + carga manual.

## WhatsApp

Solo links `wa.me/<phone_e164>?text=<plantilla>` — el humano envía desde su teléfono. **NUNCA implementar envío automatizado** desde números personales (riesgo de ban). Al volver del link, la app pide registrar el resultado en 1 tap (crea `activities`).

## Base de datos — flujo de trabajo

**`supabase/schema.sql` es la ÚNICA fuente de verdad.** No usamos migraciones de Supabase CLI ni drafts: el archivo es **100% idempotente** y se corre entero en el SQL Editor de Supabase cada vez que cambia algo (sobre base vacía o producción con datos, nunca borra nada).

Reglas para mantener la idempotencia al editar `schema.sql`:
- Tabla nueva → `create table if not exists`
- **Columna nueva en tabla existente → `alter table ... add column if not exists` en la SECCIÓN 9 (EVOLUCIÓN)** del archivo, NO en el `create table` original (que no se re-ejecuta)
- Enum nuevo valor → `alter type ... add value if not exists`
- Funciones → `create or replace`; triggers y policies → `drop ... if exists` + `create`
- Índices → `create index if not exists`

Otros archivos:
- `supabase/clear.sql` — borra todos los datos de negocio (leads, actividad, campañas...). Sección comentada para reset total de la estructura organizacional.
- `supabase/superadmin.sql` — editar `v_email` y correr: marca super admin a un usuario ya creado en Auth, crea la org `hq`, lo hace owner y siembra productos + plantillas. Idempotente.

## Roles y visibilidad (RLS, enforced en DB)

- **super_admin** (flag en `profiles`): ve todo, cross-org
- **owner**: ve toda su org
- **manager**: ve leads de su(s) equipo(s) + leads sin asignar
- **vendedor**: ve SOLO sus leads asignados

La regla central es la función SQL `can_view_lead(uuid)` — cualquier tabla satélite (activities, scores, ai_outputs) delega en ella. Las mutaciones del servidor usan service role (bypassa RLS); RLS es la red de seguridad del cliente.

Pipeline: `lead_status` = nuevo → asignado → contactado → respondio → reunion → propuesta → cliente (+ descartado). El estado vive en `leads.status` (global por lead); las campañas son agrupadores, no duplican estado.

Anti-duplicados: índices únicos parciales por org en `google_place_id`, `phone_e164` (normalizado +549...) y `domain` (raíz). Inserciones masivas con `on conflict do nothing` + conteo de duplicados en `search_runs.stats`.

## Convenciones

- UI y textos en español rioplatense (vos/ustedes). Código, tablas y columnas en inglés.
- Mobile-first: el vendedor vive en el celular (Modo Focus); manager/owner en desktop.
- Diseño: dark-first, un acento eléctrico, tipografía mono para números, Framer Motion. Sin 3D pesado.
- Server Actions para mutaciones; supabase-js en cliente solo para lecturas + Realtime.

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # solo servidor
ANTHROPIC_API_KEY=                # OPCIONAL — habilita features de IA
APIFY_TOKEN=                      # OPCIONAL — habilita fuente Google Maps
INNGEST_EVENT_KEY=                # jobs
INNGEST_SIGNING_KEY=
```

## Roadmap (resumen — detalle en PROPUESTA.md)

1. ✅ **Fase 1**: auth+roles+RLS, generador de bases (GMaps/CSV), dedup, pipeline, WhatsApp con plantillas, historial, asignación, design system. *Funciona 100% sin IA.*
2. ✅ **Fase 2**: enriquecimiento web (heurístico, `lib/enrich-web.ts`) + Instagram (Apify sync), score multi-producto IA (Haiku, `aiScoreBatch`), análisis comercial + speech (Sonnet, cacheado en `ai_outputs`), distribución configurable (round-robin / por carga / por score). Panel "Inteligencia" en /bases con runners por lotes; tracking por columnas `leads.enriched_at` / `ig_enriched_at` / `ai_scored_at`.
3. ✅ **Fase 3** (ampliada): operación masiva (selección múltiple + bulk actions + filtros avanzados + export CSV + edición de leads + motivos de descarte), bases gestionables (/bases/[id]: stats, editar, archivar, borrar, re-ejecutar, distribución dirigida, **producto objetivo**, auto_rerun semanal), productos autoservicio (/productos con editor visual de reglas + keywords de rubro + recalcular base), equipos pro (rendimiento por vendedor, leads estancados, sacar miembros), campañas (/campanas: filtro + equipo + métricas), dashboard ejecutivo (/dashboard: funnel, facturación por producto, métricas por plantilla), cierre con datos (deal_value/deal_product_id), reciclaje + auto-rerun vía cron (/api/cron/daily, protegido por CRON_SECRET, vercel.json), **Modo Focus** (/focus: cola priorizada respondió→vencidos→nuevos por score, meta diaria de settings), ⌘K command palette, PWA (manifest + íconos), Realtime en pipeline, /ajustes (recycle_days, daily_goal en organizations.settings).
   Postergado a pedido: notificaciones in-app y SLA de primer contacto. Pendiente: merge de duplicados blandos.
4. **Fase 4** (opcional): WhatsApp Business API, multi-tenant comercial.

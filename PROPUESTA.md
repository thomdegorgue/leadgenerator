# ARGOS — Sistema Operativo Comercial

> Documento fundacional. Versión 1.0 — Junio 2026.
> Propuesta de producto + arquitectura. Pendiente de confirmación para ejecución.

---

## 1. Qué es

Una plataforma interna (y futuro SaaS) para la software factory: encuentra negocios con problemas de digitalización en Argentina/LATAM, los enriquece con IA, los califica **según cuál de nuestros productos les calza** (tienda online, catálogo, agenda de turnos, etc.), los distribuye al equipo de ventas y acelera el cierre por WhatsApp.

No es "un scraper con CRM". Es una **máquina de oportunidades**: el vendedor abre la app en el celular y la app le dice a quién contactar, por qué, con qué producto y con qué mensaje.

---

## 2. Evaluación de la idea original

### Lo que está muy bien
- El foco en el **post-lead** (calificar → distribuir → contactar → medir) es el diferencial real. Generar 10.000 filas lo hace cualquiera.
- El nicho (negocios que venden por Instagram/WhatsApp en LATAM) está desatendido por Apollo/Clay/Pipedrive, que son USA-first, email-first y caros en USD.
- Dogfooding: lo usamos nosotros primero → feedback loop inmediato.

### Riesgos reales que hay que diseñar desde el día 1
1. **Scraping de Instagram/Facebook es frágil e infringe ToS.** Apify lo resuelve operativamente (proxies, actores mantenidos), pero los actores de IG se rompen seguido y Meta banea. → Google Maps como fuente primaria (estable, riquísima en PyMEs argentinas), IG/FB como **enriquecimiento secundario** del lead ya encontrado, no como fuente masiva.
2. **WhatsApp:** los links `wa.me` con mensaje prearmado son 100% seguros (es el vendedor el que envía desde su número). El envío **automatizado** masivo desde números personales = ban casi garantizado. La WhatsApp Business API (Meta/Twilio) es la vía legal pero cuesta por conversación y requiere plantillas aprobadas. → Fase 1-3: semi-automático (un tap, mensaje listo, envía el humano). Fase 4: Business API opcional.
3. **Costo de IA a escala:** enriquecer 10.000 leads con un modelo grande es caro. → Enriquecimiento en dos niveles: scoring/clasificación masiva con Haiku vía Batch API (50% descuento), speech personalizado con Sonnet **solo on-demand** cuando el vendedor abre el lead.
4. **Timeouts de Vercel:** generar una base de 10.000 leads tarda minutos/horas. No puede vivir en una serverless function. → Cola de jobs (Inngest) + webhooks de Apify.
5. **Tracking de respuestas:** con `wa.me` no sabemos automáticamente si el lead respondió. → UX de registro en 1 tap al volver a la app ("¿Respondió? Sí/No/Después") + en Fase 4 la Business API lo automatiza.

---

## 3. Mejoras clave sobre la idea original

### 3.1 Score multi-producto (fit por solución) — el diferencial más grande
Vendemos varias cosas. Un solo score de 0-100 no alcanza. Cada lead recibe **un score por producto nuestro**:

| Lead | Tienda online | Catálogo | Agenda turnos |
|---|---|---|---|
| Distribuidora ABC | 94 | 88 | 12 |
| Peluquería Luna | 20 | 35 | 96 |

Reglas: distribuidora que publica productos en IG y no tiene ecommerce → score alto en Tienda. Peluquería que coordina turnos por DM → score alto en Agenda. **Las campañas filtran por este fit.** Esto es lo que ningún CRM genérico puede copiar.

### 3.2 Modo Focus (mobile-first, el "wow" de productividad)
En vez de una tabla con 10.000 filas, el vendedor entra a una **cola tipo card-stack**: un lead por pantalla, con el resumen IA, el score, los botones de plantilla de WhatsApp y acciones por swipe/tap (Contactado / Sin respuesta / Agendar seguimiento / Descartar). Procesás 50 leads en 20 minutos desde el celular. Esto es lo que hace que el equipo diga "wow", no el 3D.

### 3.3 Reciclaje de leads
Lead contactado sin respuesta → vuelve automáticamente a la cola a los X días con plantilla de "recontacto". Lead descartado por un vendedor → puede reingresar a otra campaña a los N meses. Nada muere en una planilla.

### 3.4 Siguiente Mejor Acción
El home del vendedor no es un dashboard pasivo: es una lista priorizada generada por el sistema — "estos 5 tienen seguimiento vencido, estos 10 son nuevos con score >85, este respondió ayer y no le contestaste".

### 3.5 Búsquedas como recetas reutilizables
Una búsqueda guardada ("Distribuidoras, AMBA, GMaps") se puede re-ejecutar periódicamente; el anti-duplicados garantiza que solo entren negocios nuevos. La base crece sola.

---

## 4. Identidad y UI/UX

**Nombre:** ARGOS — el gigante de los cien ojos que todo lo ve (confirmado).

**Concepto visual: "Mission Control", no "Trello".**
- **Dark-first**: fondo grafito/azul profundo casi negro, tarjetas con glassmorphism sutil, un solo acento eléctrico (cian o lima) para acciones y datos vivos. Verde/ámbar/rojo solo para semántica de score y estados.
- **Tipografía**: Geist o Inter para UI + una mono (Geist Mono) para números/datos → estética de instrumento, no de oficina.
- **Movimiento**: Framer Motion en todo — transiciones de página, score rings que se animan al cargar, números que cuentan, streaming del texto IA. Micro-interacciones con feedback háptico en mobile.
- **3D**: descartado como elemento estructural (mata performance mobile y envejece mal). En su lugar: un fondo shader/gradient animado sutil (login y header del dashboard) que da el toque futurista sin costo.
- **Command palette (⌘K)** en desktop: buscar leads, saltar a módulos, ejecutar acciones.
- **Mobile-first real**: PWA instalable con push notifications, bottom navigation, gestos de swipe, Modo Focus como pantalla principal del vendedor. Desktop es el entorno del manager/owner (tablas, dashboards, configuración).

**Roles → experiencias distintas:**
- **Vendedor** (90% mobile): Modo Focus + Mis Leads + actividad personal.
- **Manager**: pipeline del equipo, redistribución, métricas comparativas.
- **Owner**: dashboard ejecutivo, generador de bases, campañas, facturación.

---

## 5. Arquitectura técnica

```
┌─ Next.js 15 (App Router, TS) ── Vercel Pro ─┐
│  PWA mobile-first · Tailwind 4 + shadcn/ui  │
│  custom theme · Framer Motion · dnd-kit      │
└──────────────┬───────────────────────────────┘
               │
   ┌───────────┼────────────────┬───────────────┐
   ▼           ▼                ▼               ▼
Supabase    Inngest          Apify          Claude API
Postgres    (jobs/colas)     (scraping)     (IA)
Auth+RLS    - generar base   - GMaps        - Haiku: enriquecer
Realtime    - enriquecer     - IG/FB          + score (Batch API)
Storage     - distribuir     - websites     - Sonnet: speech
pg_cron     - reciclar         (webhooks)     on-demand
```

- **Next.js 15 + TypeScript** en Vercel Pro. Server Components + Server Actions.
- **Supabase**: Postgres con **RLS multi-tenant** (organización → equipos → usuarios; el vendedor literalmente no puede leer leads ajenos a nivel base de datos), Auth, Realtime (pipeline y actividad en vivo), Storage.
- **Inngest** para trabajos largos y colas (generación de base, enriquecimiento batch, distribución, reciclaje). Vercel-native, generoso free tier, evita el límite de timeout de las functions.
- **Apify** para scraping: actor de Google Maps como fuente primaria; actores de IG/website como enriquecedores. Webhooks de Apify → Inngest → normalización → upsert con dedup.
- **Claude API**: `claude-haiku-4-5` vía **Batch API** para clasificación/score masivo (centavos por mil leads); `claude-sonnet-4-6` para análisis comercial y speech personalizado, generado on-demand y cacheado en el lead.
- **Dedup**: teléfono normalizado E.164 + `google_place_id` + dominio raíz + fuzzy de nombre+ciudad (pg_trgm). Constraint a nivel DB, no solo aplicación.

## 6. Modelo de datos (núcleo)

```
organizations ─ teams ─ memberships (rol: owner|manager|vendedor)
searches (receta: fuentes, nicho, zona, cantidad) ─ search_runs (job)
leads (datos base + place_id/phone/domain únicos por org)
lead_enrichments (señales: ecommerce, IG, seguidores, digitalización…)
lead_scores (lead × producto → score + razones[])
products (lo que vendemos: tienda, catálogo, agenda…)
campaigns ─ campaign_leads (estado de pipeline vive acá)
assignments (lead → vendedor, con historial)
activities (timeline global: quién, cuándo, qué, resultado)
message_templates (por producto y etapa, con variables)
ai_outputs (speech, análisis comercial — cacheados por lead)
```

## 7. Mapeo de los 14 módulos → cómo se resuelven

| Módulo | Resolución | Fase |
|---|---|---|
| 1 Constructor de bases | UI de receta → Inngest → Apify GMaps → upsert dedup | 1 |
| 2 Enriquecimiento IA | Apify (web/IG) + Haiku Batch clasifica señales | 2 |
| 3 Score | Score multi-producto con razones explicables | 2 |
| 4 Pipeline | Estados en `campaign_leads`, kanban + lista, Realtime | 1 |
| 5 WhatsApp | `wa.me` + plantillas con variables + registro 1-tap | 1 |
| 6 IA personaliza mensajes | Sonnet on-demand, editable antes de enviar | 2 |
| 7 Centro de actividad | Home del vendedor + Siguiente Mejor Acción | 1→3 |
| 8 Equipos/roles | Supabase Auth + RLS | 1 |
| 9 Distribución automática | Round-robin / por carga / por score, vía Inngest | 2 |
| 10 Anti-duplicados | Constraints DB + normalización + fuzzy | 1 |
| 11 Historial global | `activities` visible en cada lead | 1 |
| 12 IA comercial | Problema/oportunidad/argumento con Sonnet, cacheado | 2 |
| 13 Campañas | Campañas por producto, filtran por fit score | 3 |
| 14 Dashboard ejecutivo | Funnel, tasas, comparativas, facturación | 3 |
| + Modo Focus | Card-stack mobile con swipe | 3 |
| + Reciclaje | pg_cron + Inngest re-encolan sin respuesta | 3 |

## 8. Roadmap

- **Fase 1 — Núcleo operativo (~2-3 semanas):** auth + org + roles + RLS, generador de bases (GMaps vía Apify), dedup, leads + pipeline, plantillas WhatsApp + registro de actividad, asignación manual y round-robin básico, design system completo. *Sale a producción y el equipo ya vende con esto.*
- **Fase 2 — Inteligencia (~2 semanas):** enriquecimiento (web/IG), score multi-producto, IA comercial + speech personalizado, distribución automática configurable.
- **Fase 3 — Escala y experiencia (~2 semanas):** campañas, Modo Focus, Siguiente Mejor Acción, reciclaje, dashboard ejecutivo, PWA + push.
- **Fase 4 — Opcional:** WhatsApp Business API (tracking real de respuestas, secuencias), multi-tenant comercial para venderlo como SaaS, integraciones.

## 9. Costos — plan base (escalable)

Principio: **todo funciona sin IA y sin servicios pagos extra**; cada servicio se enchufa cuando hace falta (la app detecta la env var y habilita las features).

| Servicio | Arranque | Al escalar |
|---|---|---|
| Vercel Pro | Ya contratado | — |
| Supabase | **Free** (500MB DB ≈ 200-400k leads) | Pro USD 25 |
| Apify | **Free** (USD 5 crédito/mes ≈ 5k lugares GMaps) | Starter USD 49 |
| Inngest | **Free** (sobra) | — |
| Claude API | **Opcional** — sin key, score por reglas + plantillas | ~USD 10-30 por 10k leads (Haiku Batch) |
| **Total arranque** | **USD 0 extra** | |

Fuentes sin costo alguno: **importación CSV** y carga manual (funcionan sin Apify).

## 10. Decisiones tomadas

1. Nombre: **ARGOS** (confirmado).
2. Fase 1 con Google Maps + CSV; actores de IG recién en Fase 2+.
3. IA aditiva, nunca requerida: la app es 100% funcional sin `ANTHROPIC_API_KEY`.
4. Idioma de la UI: español rioplatense.
5. Esquema de DB centralizado en `supabase/schema.sql` idempotente (sin migraciones); `clear.sql` y `superadmin.sql` como utilidades.

Pendiente: acento de color (cian eléctrico vs lima).

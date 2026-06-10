# 👁️ ARGOS — Sistema Operativo Comercial

> El que todo lo ve. Encuentra negocios con problemas de digitalización, los califica
> por producto, los distribuye al equipo y acelera el cierre por WhatsApp.

Documentación: [PROPUESTA.md](PROPUESTA.md) (producto) · [CLAUDE.md](CLAUDE.md) (convenciones técnicas).

## Puesta en marcha

1. **Supabase**: creá un proyecto (free tier alcanza). En el **SQL Editor** pegá y ejecutá
   entero [`supabase/schema.sql`](supabase/schema.sql). Es idempotente: corrélo de nuevo
   cada vez que cambie.
2. **Usuario admin**: en *Authentication → Users → Add user* creá tu usuario (email +
   contraseña). Después editá el email en [`supabase/superadmin.sql`](supabase/superadmin.sql)
   y ejecutalo: te hace super admin, crea la org y siembra productos + plantillas.
3. **Env vars**: copiá `.env.example` a `.env.local` y completá las 3 claves de Supabase
   (*Project Settings → API*). `APIFY_TOKEN` y `ANTHROPIC_API_KEY` son opcionales:
   sin ellas la app funciona igual (CSV + reglas).
4. **Local**: `npm install && npm run dev` → http://localhost:3000
5. **Deploy**: importá el repo en Vercel y cargá las mismas env vars. Para que la fuente
   Google Maps funcione, `APP_URL` debe ser la URL pública (el webhook de Apify la necesita).

## Scripts SQL

| Archivo | Qué hace |
|---|---|
| `supabase/schema.sql` | **Única fuente de verdad.** Tablas, RLS, funciones. 100% idempotente. |
| `supabase/clear.sql` | Borra los datos de negocio (no toca usuarios ni estructura). |
| `supabase/superadmin.sql` | Promueve un usuario a super admin + siembra org/productos/plantillas. |

## Stack

Next.js 15 · TypeScript · Tailwind 4 · Supabase (Postgres + Auth + RLS) · Vercel ·
Apify (opcional) · Claude API (opcional) · Framer Motion · dnd-kit

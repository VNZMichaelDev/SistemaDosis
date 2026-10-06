# Sistema Dosis Web (DePOS Dosis)

Port web del POS de escritorio **DePOS Dosis**: Next.js 16 (App Router) + Supabase (PostgreSQL) + Vercel.

## Stack

- **Frontend/Admin/POS/Cocina**: Next.js 16 + React + Tailwind CSS v4 (`src/app/`)
- **API**: route catch-all `/api/[...slug]` con Express-style router (`src/server/`)
- **BD**: Supabase PostgreSQL — RLS deny-all (service role solo servidor), RPC transaccionales
- **Auth**: JWT (jose) en cookie httpOnly `depos_token`, roles `admin/encargado/empleado/mesero/cocina`
- **Realtime**: broadcast Supabase en canal `pedidos-events`

## Correr en local

```bash
npm install
npm run seed     # BD vacía: admin/admin123, tasa 36.5,12 mesas, productos de ejemplo
npm run dev      # http://localhost:3111
```

Migraciones SQL: pegar `supabase/apply_all.sql` en el SQL Editor de Supabase (idempotente).

## Variables de entorno (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
JWT_SECRET=< secreto aleatorio largo >
```

## Scripts

- `npm run dev` / `npm run build` / `npm run start` — Next.js
- `npm run seed` — seed idempotente (`scripts/seed.ts`)
- `npx tsx scripts/e2e.ts` — E2E de API (99 checks, requiere server corriendo)
- `npx tsx scripts/e2e-realtime.ts` — verifica broadcast realtime

## Estructura

```
src/
  app/                  # páginas (login, pos, cocina, admin/*)
  server/               # router + handlers (74 endpoints)
  lib/                  # supabase, auth, api-client, realtime hook
  proxy.ts              # guards de rol por ruta (Next middleware)
supabase/
  migrations/           # 6 migraciones
  apply_all.sql         # todo concatenado para el SQL Editor
```

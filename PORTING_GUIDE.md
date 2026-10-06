# Guía de porting DePOS Dosis → Next.js + Supabase

Referencia de código original: `C:\Users\Michael Escobar\Documents\proyectos\DePOS\DePOS Dosis\carloss version actual\backend\src\server.js` (Express + better-sqlite3 + zod).

## Convenciones del proyecto nuevo

### Router (reemplaza a Express)
Archivo: `src/server/router.ts`. Registro de rutas:

```ts
import { get, post, put, del, pub, json, apiError, conflict, notFound, VALIDATION, VALIDATION as V, type Ctx } from '../router'

// get/post/put/del YA incluyen auth obligatorio (como authRequired). pub = público sin auth.
get('/productos', async ({ query, session }) => { ... json({ productos }) }, { roles: ['admin', 'encargado'] })
post('/productos', async ({ body, params, session }) => { ... }, { roles: ['admin'] })
pub.get('/health', () => json({ ok: true }))
```

- `handler(ctx)` donde `ctx = { req, params, query, session, body }`.
- `params: Record<string,string>` (strings — convierte con `Number(params.id)`).
- `query: URLSearchParams` → `query.get('q')`.
- `session: { userId, usuario, rol }` (garantizado si la ruta tiene auth).
- Respuestas: `json(datos)` (200 por defecto). Errores: `apiError(status, 'CODIGO')`, `conflict('CODIGO')` (409), `notFound()` (404), `VALIDATION()` (400).
- **Los códigos de error DEBEN ser idénticos** a los del original (`USER_EXISTS`, `PEDIDO_FACTURADO`, `OVERPAY`, etc.) porque el frontend los compara.
- Al final: **NO toques `src/server/routes.ts`** (lo cablea el coordinador) y NO modifiques archivos fuera de tu asignación.

### BD (Supabase)
```ts
import { supabaseAdmin } from '@/lib/supabase'
const db = supabaseAdmin()
const { data, error } = await db.from('productos').select('*').eq('id', id).maybeSingle()
if (error) throw new Error(error.message)
```
- `SELECT ... WHERE a=? AND b=?` → `.select().eq('a', v).eq('b', v)`
- `INSERT ... RETURNING id` → `.insert(obj).select('id').single()`
- `UPDATE ... WHERE` → `.update(obj).eq(...)`
- `DELETE ... WHERE` → `.delete().eq(...)`
- `COUNT(*)` → `.select('*', { count: 'exact', head: true })`
- `LIKE '%q%'` (case-insensitive) → `.ilike('column', `%${q}%`)` — para OR entre columnas usa `.or('nombre.ilike.%q%,codigo.ilike.%q%')`
- `OR` complejo / `ORDER BY` / `LIMIT` → `.or(...)`, `.order(...)`, `.limit(n)`
- JOINs (embebidos): `.select('*, mesas(nombre), usuarios(usuario)')` devuelve objetos anidados. **Aplana** para conservar la forma original:
  `{ ...rest, mesa_nombre: p.menas?.nombre }` (ver helper `flatten` si existe en tu archivo).
- Unicidad violada → `error.code === '23505'` → `conflict('CODIGO')`. FK violada → `error.code === '23503'`.
- Multi-statement transaccional → usar RPC `.rpc('nombre_fn', {...})` (ver abajo).

### Diferencias de esquema (SQLite → Postgres)
| Original (SQLite) | Nuevo (Postgres) |
|---|---|
| `activo/es_receta/cancelado/pagado/pagada` INTEGER 0/1 | `boolean` true/false (filtra con `.eq('activo', true)`, `p.cancelado === false`) |
| `usuarios.departamentos_precios` TEXT JSON string | `jsonb` → **ya es array**, NO hagas `JSON.parse` |
| `fecha`/`created_at` TEXT `'YYYY-MM-DD HH:mm:ss'` | `timestamptz` → string ISO (`2026-10-04T12:00:00-04:00`). Para rangos de fecha `from`/`to` (`YYYY-MM-DD`): usa `${from}T00:00:00-04:00` y `${to}T23:59:59-04:00` con `.gte('fecha', ...)` / `.lte('fecha', ...)` |
| `db.transaction(...)` | RPC en Postgres (migración propia) o llamadas secuenciales si el original era secuencial |
| `wssSend(tipo, payload)` | `import { broadcast } from '../realtime'` → `await broadcast('nuevo_pedido', {...})` (mismos tipos de evento) |

### Tiempo real
```ts
import { broadcast } from '../realtime'
await broadcast('pedido_actualizado', { pedido_id, estado, mesa_nombre, cliente })
```

### Validación
`zod` v4 instalado. `z.object({...}).safeParse(body)` → si falla `return VALIDATION()`.

### Verificación obligatoria
- `npx tsc --noEmit` debe quedar **sin errores** al terminar (desde la raíz del proyecto).
- No ejecutes `next dev` ni `next build` (los hace el coordinador).
- Ports fiel: misma ruta, mismo método, mismos roles, misma forma de respuesta, mismos códigos de error, misma lógica de negocio.

### Roles
`admin`, `encargado`, `empleado`, `mesero`, `cocina`. En el original: `requireRole('a','b')` → `{ roles: ['a','b'] }`.

---

# Guía de porting de PÁGINAS (frontend React → Next.js App Router)

Referencia: `C:\Users\Michael Escobar\Documents\proyectos\DePOS\DePOS Dosis\carloss version actual\frontend\src\pages\*.jsx` (React + Vite + react-router + Tailwind v3).

## Destino de cada página (App Router)

| Original | Destino (reemplaza el placeholder si existe) |
|---|---|
| `pages/TomarPedido.jsx` | `src/app/(empleado)/pos/page.tsx` |
| `pages/Facturar.jsx` | `src/app/(empleado)/pos/facturar/page.tsx` |
| `pages/Cocina.jsx` | `src/app/(empleado)/cocina/page.tsx` |
| `pages/admin/<X>.jsx` | `src/app/admin/<x-minusculas>/page.tsx` (crear carpeta) |

- Los modales/companion components van en la MISMA carpeta de la ruta (ej. `src/app/admin/inventario/ProductoFormModal.tsx`) - nunca se llaman `page.tsx`.
- Cada page.tsx empieza con `'use client'` y `export default function ...`.

## Reglas de conversión

1. **react-router → next/navigation**:
   - `useNavigate()` → `import { useRouter } from 'next/navigation'`; `nav('/x')` → `router.push('/x')`; `nav(-1)` → `router.back()`.
   - `useParams()` → `import { useParams } from 'next/navigation'` (mismo uso; valores `string`).
2. **Imports de libs**:
   - `../lib/api.js` o `../../lib/api.js` → `'@/lib/api-client'` (función `apiFetch` idéntica).
   - `../lib/notify.js` → `'@/lib/notify'` (`sendNotification`).
3. **WebSocket → hook realtime** (TomarPedido, Facturar, Cocina). Elimina TODO el bloque `connectWs`/`wsRef`/`reconnectTimer` y sustituye:
   ```tsx
   import { usePedidosRealtime } from '@/lib/use-pedidos-realtime'
   // ...
   usePedidosRealtime(
     (data) => {
       // era ws.onmessage: `data` ya es el objeto parseado con data.type
     },
     () => {
       // era ws.onopen: refrescar datos (loadPedidos() etc.)
     },
   )
   ```
   El hook llama `onConnected` al suscribirse y en cada reconexión (equivale a `onopen` tras `onclose`).
4. **Tipos**: usa `any` con liberalidad para datos de API (`useState<any>([])`, `(e: any)`) para que el port sea línea por línea. `npx tsc --noEmit` debe pasar.
5. **Tailwind**: conserva las clases EXACTAS. Ojo con v4: `flex-shrink-0` → `shrink-0` (única clase renombrada presente). No uses versiones antiguas de utilidades eliminadas (`bg-opacity-*`).
6. **Imágenes**: usa `<img>` normal con `alt` (no `next/image`). Si ESLint se queja añade `/* eslint-disable-next-line @next/next/no-img-element */`.
7. **NO** uses `printReceipt` (no existe; no hay impresión).
8. **UI idéntica**: mismo JSX, mismos textos, mismas clases Tailwind, misma lógica de negocio y mismos códigos de error (`err.status`, `err.data.error`).
9. El layout (admin o empleado) ya maneja auth/roles/guard; la página solo renderiza.
10. **NO** toques: `src/server/**`, `src/proxy.ts`, layouts (`src/app/**/layout.tsx`), `src/lib/**`, ni páginas de otros agentes.

## Verificación obligatoria
- `npx tsc --noEmit` sin errores (desde la raíz del proyecto).
- No ejecutes `next dev` ni `next build` (los hace el coordinador).

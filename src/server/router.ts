import type { NextRequest } from 'next/server'
import { getSession, type Rol, type Session } from '@/lib/auth'

export interface Ctx {
  req: NextRequest
  params: Record<string, string>
  query: URLSearchParams
  session: Session
  body: any
}

export type Handler = (ctx: Ctx) => Promise<Response> | Response

export interface RouteDef {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  pattern: string
  handler: Handler
  /** true = requiere sesión; roles = además requiere uno de esos roles */
  auth?: boolean
  roles?: Rol[]
}

const routes: RouteDef[] = []

export function route(method: RouteDef['method'], pattern: string, handler: Handler, opts?: { auth?: boolean; roles?: Rol[] }) {
  routes.push({ method, pattern, handler, auth: opts?.auth ?? false, roles: opts?.roles })
}

/** Alias cómodos con auth obligatorio (como authRequired de Express). */
export const get = (pattern: string, handler: Handler, opts?: { auth?: boolean; roles?: Rol[] }) =>
  route('GET', pattern, handler, { auth: true, ...opts })
export const post = (pattern: string, handler: Handler, opts?: { auth?: boolean; roles?: Rol[] }) =>
  route('POST', pattern, handler, { auth: true, ...opts })
export const put = (pattern: string, handler: Handler, opts?: { auth?: boolean; roles?: Rol[] }) =>
  route('PUT', pattern, handler, { auth: true, ...opts })
export const del = (pattern: string, handler: Handler, opts?: { auth?: boolean; roles?: Rol[] }) =>
  route('DELETE', pattern, handler, { auth: true, ...opts })
/** Rutas públicas (sin auth). */
export const pub = {
  get: (pattern: string, handler: Handler) => route('GET', pattern, handler),
  post: (pattern: string, handler: Handler) => route('POST', pattern, handler),
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

export function apiError(status: number, error: string, extra?: Record<string, unknown>): Response {
  return Response.json({ error, ...extra }, { status })
}

export const VALIDATION = () => apiError(400, 'VALIDATION')
export const UNAUTHORIZED = () => apiError(401, 'UNAUTHORIZED')
export const FORBIDDEN = () => apiError(403, 'FORBIDDEN')
export const notFound = (code = 'NOT_FOUND') => apiError(404, code)
export const conflict = (code: string) => apiError(409, code)

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean)
  const s = path.split('/').filter(Boolean)
  if (p.length !== s.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i])
    else if (p[i] !== s[i]) return null
  }
  return params
}

async function parseBody(req: NextRequest): Promise<any> {
  if (req.method === 'GET' || req.method === 'DELETE') return undefined
  try {
    const text = await req.text()
    if (!text) return undefined
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Despacha una petición /api/* a la ruta registrada correspondiente. */
export async function handleApi(req: NextRequest, pathname: string): Promise<Response> {
  const path = pathname.replace(/^\/api/, '').replace(/\/$/, '') || '/'
  const method = req.method as RouteDef['method']

  let matched: RouteDef | null = null
  let params: Record<string, string> | null = null
  for (const r of routes) {
    if (r.method !== method) continue
    const m = matchPattern(r.pattern, path)
    if (m) {
      matched = r
      params = m
      break
    }
  }

  if (!matched || !params) return apiError(404, 'NOT_FOUND')

  let session: Session | null = null
  if (matched.auth || matched.roles) {
    session = await getSession()
    if (!session) return UNAUTHORIZED()
    if (matched.roles && matched.roles.length > 0 && !matched.roles.includes(session.rol)) return FORBIDDEN()
  }

  try {
    const body = await parseBody(req)
    return await matched.handler({
      req,
      params,
      query: req.nextUrl.searchParams,
      session: session as Session,
      body,
    })
  } catch (e: any) {
    console.error(`⚠️ Error API ${method} ${pathname}:`, e?.message, e?.stack)
    return apiError(500, 'INTERNAL_SERVER_ERROR', { detail: e?.message })
  }
}

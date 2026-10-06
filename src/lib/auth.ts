import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'depos_token'
export const SESSION_HOURS = 12

export type Rol = 'admin' | 'empleado' | 'encargado' | 'mesero' | 'cocina'

export interface Session {
  userId: number
  usuario: string
  rol: Rol
}

function secretKey() {
  return new TextEncoder().encode(process.env.JWT_SECRET || 'dev_secret_change_me')
}

export async function signToken(session: Session): Promise<string> {
  return new SignJWT({ usuario: session.usuario, rol: session.rol })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(session.userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey())
}

export async function verifyToken(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (!payload.sub || typeof payload.rol !== 'string') return null
    return {
      userId: Number(payload.sub),
      usuario: String(payload.usuario ?? ''),
      rol: payload.rol as Rol,
    }
  } catch {
    return null
  }
}

/** Lee la sesión desde la cookie httpOnly (Route Handlers / Server Components). */
export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

/** Establece la cookie httpOnly (solo en Route Handlers). */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
}

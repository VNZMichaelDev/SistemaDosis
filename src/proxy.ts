import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const ADMIN_ROLES = ['admin', 'encargado']
const POS_ROLES = ['empleado', 'encargado', 'admin', 'mesero', 'cocina']
const COCINA_ROLES = ['empleado', 'encargado', 'admin', 'cocina']

function homeFor(rol: string): string {
  if (rol === 'admin' || rol === 'encargado') return '/admin/inventario'
  if (rol === 'cocina') return '/cocina'
  return '/pos'
}

async function readRol(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('depos_token')?.value
  if (!token) return null
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev_secret_change_me')
    const { payload } = await jwtVerify(token, secret)
    return typeof payload.rol === 'string' ? payload.rol : null
  } catch {
    return null
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const rol = await readRol(request)

  if (pathname.startsWith('/login')) {
    // Sesión válida → saltar el login
    if (rol) return NextResponse.redirect(new URL(homeFor(rol), request.url))
    return NextResponse.next()
  }

  const allowed =
    pathname.startsWith('/admin')
      ? ADMIN_ROLES
      : pathname.startsWith('/pos')
        ? POS_ROLES
        : pathname.startsWith('/cocina')
          ? COCINA_ROLES
          : null

  if (allowed) {
    if (!rol) return NextResponse.redirect(new URL('/login', request.url))
    if (!allowed.includes(rol)) return NextResponse.redirect(new URL(homeFor(rol), request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/pos/:path*', '/cocina/:path*', '/login'],
}

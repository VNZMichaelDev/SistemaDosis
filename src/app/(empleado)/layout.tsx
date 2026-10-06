'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getStoredUser, logout, type StoredUser } from '@/lib/auth-client'

const POS_ROLES = ['empleado', 'encargado', 'admin', 'mesero', 'cocina']
const COCINA_ROLES = ['empleado', 'encargado', 'admin', 'cocina']

function homeFor(rol: string): string {
  if (rol === 'admin' || rol === 'encargado') return '/admin/inventario'
  if (rol === 'cocina') return '/cocina'
  return '/pos'
}

function navLinkClass(active: boolean): string {
  return `text-[10px] md:text-[11px] px-2 md:px-3 py-1.5 rounded-lg font-semibold tracking-wide whitespace-nowrap transition-all shrink-0 ${
    active ? 'bg-dosis-yellow text-dosis-green-dark shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
  }`
}

function isActiveLink(pathname: string, to: string, end: boolean): boolean {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(to + '/')
}

export default function EmpleadoLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<StoredUser | null>(null)

  useEffect(() => {
    const stored = getStoredUser()
    const allowed = pathname.startsWith('/cocina') ? COCINA_ROLES : POS_ROLES
    if (!stored || !allowed.includes(stored.rol)) {
      router.replace(stored ? homeFor(stored.rol) : '/login')
      return
    }
    setUser(stored)
    setReady(true)
  }, [pathname, router])

  if (!ready || !user) return null

  const isAdmin = user.rol === 'admin' || user.rol === 'encargado'

  async function handleSalir() {
    await logout()
    router.push('/login')
  }

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      style={{ fontFamily: 'DM Sans, system-ui, sans-serif' }}
    >
      <header
        style={{
          flexShrink: 0,
          backgroundColor: '#1E3A2F',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          gap: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="DEPos" style={{ height: '24px' }} />
          <nav style={{ display: 'flex', alignItems: 'center', gap: '4px', overflowX: 'auto' }}>
            <Link href="/pos" className={navLinkClass(isActiveLink(pathname, '/pos', true))}>
              Tomar Pedido
            </Link>
            <Link
              href="/pos/facturar"
              className={navLinkClass(isActiveLink(pathname, '/pos/facturar', false))}
            >
              Facturar
            </Link>
            <Link href="/cocina" className={navLinkClass(isActiveLink(pathname, '/cocina', false))}>
              Cocina
            </Link>
            {isAdmin && (
              <Link
                href="/admin/config"
                className={navLinkClass(isActiveLink(pathname, '/admin/config', false))}
              >
                Tasa $
              </Link>
            )}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              fontWeight: 'bold',
              color: 'rgba(255,255,255,0.8)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '9999px',
              padding: '4px 8px',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#7FD87F',
                animation: 'pulse 2s infinite',
              }}
            />
            EN VIVO
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
            {user?.usuario}
          </span>
          <button
            onClick={() => {
              if (isAdmin) {
                router.push('/admin/inventario')
              } else {
                handleSalir()
              }
            }}
            style={{
              fontSize: '9px',
              color: 'rgba(255,255,255,0.7)',
              padding: '4px 8px',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: 'transparent',
            }}
          >
            {isAdmin ? 'Volver' : 'Salir'}
          </button>
        </div>
      </header>
      <main style={{ flex: 1, overflow: 'hidden' }}>{children}</main>
    </div>
  )
}

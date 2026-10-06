'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getStoredUser, logout, type StoredUser } from '@/lib/auth-client'

const ADMIN_ROLES = ['admin', 'encargado']

function homeFor(rol: string): string {
  if (rol === 'admin' || rol === 'encargado') return '/admin/inventario'
  if (rol === 'cocina') return '/cocina'
  return '/pos'
}

const navItems = [
  { to: '/admin/inventario', label: 'Menú', icon: InventoryIcon },
  { to: '/admin/departamentos', label: 'Categorías', icon: FolderIcon },
  { to: '/admin/proveedores', label: 'Proveedores', icon: TruckIcon },
  { to: '/admin/ingredientes', label: 'Ingredientes', icon: LeafIcon },
  { to: '/admin/recetas', label: 'Recetas', icon: RecipeIcon },
  { to: '/admin/vendedores', label: 'Vendedores', icon: SellerIcon },
  { to: '/admin/creditos', label: 'Créditos', icon: CreditIcon },
  { to: '/admin/usuarios', label: 'Usuarios', icon: UsersIcon },
  { to: '/admin/config', label: 'Tasa $', icon: SettingsIcon },
  { to: '/admin/reportes', label: 'Reportes', icon: ReportsIcon },
  { to: '/pos', label: 'Tomar Pedido', icon: PosIcon },
  { to: '/pos/facturar', label: 'Facturar', icon: CashIcon },
  { to: '/admin/facturas', label: 'Facturas', icon: InvoiceIcon },
  { to: '/cocina', label: 'Cocina', icon: KitchenIcon },
]

function InventoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" />
      <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity="0.4" />
      <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" fill="currentColor" opacity="0.4" />
    </svg>
  )
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="5" r="3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 13c0-2.5 2.5-4.5 5.5-4.5S13 10.5 13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 15 15" fill="none">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2M3.1 3.1l1.4 1.4M10.5 10.5l1.4 1.4M10.5 3.1l-1.4 1.4M4.5 10.5l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ReportsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="2" y="2" width="4" height="11" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="7" y="5" width="4" height="8" rx="1" fill="currentColor" opacity="0.65" />
      <rect x="10.5" y="3.5" width="2.5" height="9.5" rx="1" fill="currentColor" />
    </svg>
  )
}

function CreditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 15 15" fill="none">
      <rect x="1.5" y="2" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 5.5h12" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 8.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1.5 3.5v8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.5 3h-4a1 1 0 0 0-1 .5z" />
    </svg>
  )
}

function PosIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1.5" y="2.5" width="12" height="10" rx="1.5" />
      <path d="M1.5 5.5h12" />
      <path d="M4 8.5h1M7 8.5h1" />
      <circle cx="11" cy="9" r="1.5" />
    </svg>
  )
}

function CashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="3.5" width="13" height="9" rx="1.5" />
      <circle cx="7.5" cy="8" r="2" />
      <path d="M11 8h1M3 8h1" />
    </svg>
  )
}

function InvoiceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 1.5h7l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z" />
      <path d="M11 1.5v3h3" />
      <path d="M5.5 7.5h4M5.5 10h2.5" />
    </svg>
  )
}

function KitchenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 1v4M10.5 1v4" />
      <path d="M2 5.5h11v1.5a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V5.5z" />
      <path d="M5.5 10v3.5h4V10" />
    </svg>
  )
}

function TruckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 3.5h9v7H1z" />
      <path d="M10 6h2.5l1.5 2.5v2h-4" />
      <circle cx="4" cy="11" r="1" />
      <circle cx="12" cy="11" r="1" />
    </svg>
  )
}

function LeafIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 13c3-6 9-10 12-11-1 3-5 9-12 11z" />
      <path d="M2 13c2-3 5-6 10-10" />
    </svg>
  )
}

function RecipeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="1.5" width="11" height="12" rx="1" />
      <path d="M5 5h5M5 8h5M5 11h3" />
    </svg>
  )
}

function SellerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="7.5" cy="5" r="3" />
      <path d="M2.5 13.5c0-2.5 2.2-4.5 5-4.5s5 2 5 4.5" />
      <path d="M10 3l2 2M13 3l-2 2" strokeWidth="1.5" />
    </svg>
  )
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<StoredUser | null>(null)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    const stored = getStoredUser()
    if (!stored || !ADMIN_ROLES.includes(stored.rol)) {
      router.replace(stored ? homeFor(stored.rol) : '/login')
      return
    }
    setUser(stored)
    setReady(true)
  }, [router])

  if (!ready || !user) return null

  const userInitial = user?.usuario?.charAt(0).toUpperCase() || 'A'

  const filteredNavItems =
    user?.rol === 'encargado'
      ? navItems.filter((item) => item.to !== '/admin/usuarios' && item.to !== '/admin/config')
      : navItems

  async function handleSalir() {
    await logout()
    router.push('/login')
  }

  return (
    <div className="flex h-screen min-h-[600px] font-sans">
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={
          'fixed md:static top-0 left-0 h-full z-50 bg-depo-yellow flex flex-col transition-transform duration-200 ' +
          (mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0') +
          ' w-[170px] min-w-[170px]'
        }
      >
        <div className="border-b border-black/10 px-3 py-3 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="DEPos" className="w-full max-w-[90px] h-auto" />
          <div className="text-[10px] text-black/50 mt-1 font-medium">Restaurante</div>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.to || pathname.startsWith(item.to + '/')
            const Icon = item.icon
            return (
              <Link
                key={item.to}
                href={item.to}
                onClick={() => setMobileSidebarOpen(false)}
                className={
                  'flex items-center gap-[6px] px-3 py-[7px] text-[11px] font-medium tracking-wide transition-all duration-150 ' +
                  (isActive
                    ? 'text-depo-yellow bg-depo-dark border-l-2 border-depo-yellow'
                    : 'text-yellow-900/70 hover:text-depo-dark hover:bg-black/10')
                }
              >
                <span className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-black/10 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-[8px]">
            <div className="w-[26px] h-[26px] bg-depo-dark rounded-full flex items-center justify-center text-[10px] font-semibold text-depo-yellow">
              {userInitial}
            </div>
            <span className="text-[11px] font-semibold text-depo-dark">{user?.usuario}</span>
          </div>
          <button
            onClick={handleSalir}
            className="text-[11px] text-depo-yellow px-3 py-1.5 border border-depo-dark/30 rounded-lg bg-depo-dark font-semibold tracking-wider uppercase transition-all duration-150 hover:bg-depo-dark-2 active:scale-[0.95] cursor-pointer"
          >
            Salir
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-depo-bg">
        <div className="md:hidden flex items-center justify-between px-3 py-2 bg-white border-b border-depo-border-2 shrink-0">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 -ml-2 rounded-md text-depo-dark hover:bg-[#F5F4F0] transition-colors"
            aria-label="Abrir menú"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <path d="M4 5h12M4 10h12M4 15h12" />
            </svg>
          </button>
          <div className="w-8 h-8 bg-depo-yellow rounded-full flex items-center justify-center text-[11px] font-semibold text-depo-dark">
            {userInitial}
          </div>
        </div>
        <div className="flex-1 overflow-auto px-3 md:px-4">{children}</div>
      </main>
    </div>
  )
}

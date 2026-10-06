'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiFetch } from '@/lib/api-client'
import { getStoredUser } from '@/lib/auth-client'

function homeFor(rol: string): string {
  if (rol === 'admin' || rol === 'encargado') return '/admin/inventario'
  if (rol === 'cocina') return '/cocina'
  return '/pos'
}

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const user = getStoredUser()
    if (!user) {
      // Limpia cualquier cookie huérfana y entra a login
      apiFetch('/api/auth/logout', { method: 'POST', redirectOnAuth: false })
        .catch(() => {})
        .finally(() => {
          window.location.href = '/login'
        })
      return
    }
    router.replace(homeFor(user.rol))
  }, [router])

  return null
}

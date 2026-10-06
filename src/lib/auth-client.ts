import { apiFetch } from './api-client'

export type Rol = 'admin' | 'empleado' | 'encargado' | 'mesero' | 'cocina'

export interface StoredUser {
  id: number
  usuario: string
  rol: Rol
  departamentos_precios?: unknown[]
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem('depos_user')
  return raw ? JSON.parse(raw) : null
}

export function setStoredUser(user: StoredUser): void {
  localStorage.setItem('depos_user', JSON.stringify(user))
}

export function clearStoredUser(): void {
  localStorage.removeItem('depos_user')
}

export async function login(usuario: string, password: string): Promise<StoredUser> {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { usuario, password },
    redirectOnAuth: false,
  })
  setStoredUser(data.user)
  return data.user
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST', redirectOnAuth: false })
  } catch {
    /* ignorar */
  }
  clearStoredUser()
}

export async function fetchMe(): Promise<StoredUser | null> {
  await apiFetch('/api/auth/me')
  return getStoredUser()
}

export function forceLogout(): void {
  clearStoredUser()
  window.location.href = '/login'
}

export function isAdmin(user: StoredUser | null): boolean {
  return user?.rol === 'admin'
}

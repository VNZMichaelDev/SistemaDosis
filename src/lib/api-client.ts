export interface ApiFetchOptions {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  /** false = no redirige a /login en 401/403 (útil para el login mismo) */
  redirectOnAuth?: boolean
}

export interface ApiError extends Error {
  status?: number
  data?: unknown
  rawText?: string
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<any> {
  const { method = 'GET', body, headers, redirectOnAuth = true } = options
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })

  const text = await res.text()
  let data: any = null
  let parseFailed = false
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
    parseFailed = true
  }

  if (!res.ok || parseFailed) {
    if (redirectOnAuth && (res.status === 401 || res.status === 403)) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('depos_user')
        window.location.href = '/login'
      }
    }
    const err: ApiError = new Error(parseFailed ? 'Respuesta inválida del servidor' : 'API_ERROR')
    err.status = res.status
    err.data = data
    err.rawText = text
    throw err
  }

  if (data === null) return {}
  return data
}

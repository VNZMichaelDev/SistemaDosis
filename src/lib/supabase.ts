import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let instance: SupabaseClient | null = null

/** Cliente Supabase con service_role (solo usar en el servidor). */
export function supabaseAdmin(): SupabaseClient {
  if (!instance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY')
    }
    instance = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return instance
}

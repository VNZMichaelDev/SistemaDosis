import { createClient, type RealtimeChannel } from '@supabase/supabase-js'

const CHANNEL_NAME = 'pedidos-events'

let channel: RealtimeChannel | null = null
let subscribed: Promise<void> | null = null

function ensureChannel(): RealtimeChannel {
  if (!channel) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Faltan variables de Supabase para Realtime')
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    channel = client.channel(CHANNEL_NAME)
    subscribed = new Promise<void>((resolve) => {
      channel!.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
      })
    })
  }
  return channel
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Emite un evento broadcast a todos los clientes suscrito a `pedidos-events`.
 * Mismos tipos de evento que el WebSocket original del sistema.
 */
export async function broadcast(type: string, payload: Record<string, unknown>): Promise<void> {
  try {
    const ch = ensureChannel()
    // espera máxima 3s a que el canal esté listo (la primera vez)
    await Promise.race([subscribed, sleep(3000)])
    await ch.send({ type: 'broadcast', event: type, payload })
  } catch (e: any) {
    console.error(`⚠️ broadcast(${type}) falló:`, e?.message)
  }
}

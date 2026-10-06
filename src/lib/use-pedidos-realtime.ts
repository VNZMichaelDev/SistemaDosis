'use client'

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabaseBrowser } from './supabase-browser'

const CHANNEL = 'pedidos-events'
const EVENTS = ['nuevo_pedido', 'pedido_actualizado', 'pedido_cancelado', 'pedido_pagado', 'item_agregado'] as const

interface Listener {
  onEvent: (data: any) => void
  onConnected?: () => void
}

let channel: RealtimeChannel | null = null
const listeners = new Set<Listener>()

function ensureChannel(): RealtimeChannel {
  if (!channel) {
    const sb = supabaseBrowser()
    channel = sb.channel(CHANNEL)
    for (const ev of EVENTS) {
      channel.on('broadcast', { event: ev }, ({ payload }) => {
        const data = { type: ev, ...(payload || {}) }
        listeners.forEach((l) => l.onEvent(data))
      })
    }
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        listeners.forEach((l) => l.onConnected?.())
      }
    })
  }
  return channel
}

/**
 * Suscripción a los eventos en vivo de pedidos (mismos tipos que el
 * WebSocket original: nuevo_pedido, pedido_actualizado, ...).
 *
 * - `onEvent({ type, ...payload })` → equivalente a `ws.onmessage` (objeto ya parseado).
 * - `onConnected()` → equivalente a `ws.onopen` (se llama al suscribir y en reconexiones).
 */
export function usePedidosRealtime(
  onEvent: (data: any) => void,
  onConnected?: () => void,
): void {
  const eventRef = useRef(onEvent)
  const connectedRef = useRef(onConnected)

  useEffect(() => {
    eventRef.current = onEvent
    connectedRef.current = onConnected
  })

  useEffect(() => {
    const listener: Listener = {
      onEvent: (data) => eventRef.current(data),
      onConnected: () => connectedRef.current?.(),
    }
    listeners.add(listener)
    ensureChannel()
    return () => {
      listeners.delete(listener)
    }
  }, [])
}

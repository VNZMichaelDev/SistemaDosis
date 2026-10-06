'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { apiFetch } from '@/lib/api-client'
import { sendNotification } from '@/lib/notify'
import { usePedidosRealtime } from '@/lib/use-pedidos-realtime'

function timeAgo(dateStr: any) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return '< 1m'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h}h ${m}m`
}

function formatFecha(s: any) {
  const d = new Date(s)
  return d.toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }) + ', ' + d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
}

function mergeItems(pedido: any) {
  return { ...pedido, items: pedido.items || [] }
}

export default function CocinaPage() {
  const [pedidos, setPedidos] = useState<any[]>([])
  const [notification, setNotification] = useState<string | null>(null)
  const [filter, setFilter] = useState('todos')
  const audioCtxRef = useRef<any>(null)
  const lastSoundTime = useRef(0)

  const playBell = useCallback(() => {
    const ts = Date.now()
    if (ts - lastSoundTime.current < 1500) return
    lastSoundTime.current = ts
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
      const ctx = audioCtxRef.current
      const now = ctx.currentTime
      ;[800, 1000, 1200].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = freq
        osc.type = 'sine'
        gain.gain.setValueAtTime(0.6, now + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.6)
        osc.start(now + i * 0.12)
        osc.stop(now + i * 0.12 + 0.6)
      })
    } catch { /* audio not available */ }
  }, [])

  // Reemplazar o agregar pedido en el estado sin borrar todo
  const upsertPedido = useCallback((nuevo: any) => {
    setPedidos((prev) => {
      const idx = prev.findIndex((p) => p.id === nuevo.id)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = mergeItems(nuevo)
        return copy
      }
      return [mergeItems(nuevo), ...prev]
    })
  }, [])

  const updatePedidoEstado = useCallback((id: any, estado: any) => {
    setPedidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, estado } : p))
    )
  }, [])

  async function loadPedidos() {
    try {
      const data = await apiFetch('/api/pedidos/activos')
      if (data.pedidos) setPedidos(data.pedidos.map(mergeItems))
    } catch { /* silent */ }
  }

  usePedidosRealtime(
    (data) => {
      if (data.type === 'connected') return

      if (data.type === 'nuevo_pedido' && data.pedido) {
        upsertPedido({ ...data.pedido, items: data.items || [] })
        playBell()
        const mesa = data.pedido?.mesa_nombre || ''
        setNotification(`🔔 Nuevo: ${mesa}`)
        setTimeout(() => setNotification(null), 6000)
        if (navigator.vibrate) navigator.vibrate([200, 100, 200])
        sendNotification('Nuevo pedido', `Mesa ${mesa}`, `nuevo-${data.pedido.id}`)
      }

      if (data.type === 'pedido_actualizado') {
        if (data.estado === 'facturado') {
          setPedidos((prev) => prev.filter((p) => p.id !== data.pedido_id))
        } else {
          updatePedidoEstado(data.pedido_id, data.estado)
        }
      }
      if (data.type === 'pedido_pagado') {
        setPedidos((prev) =>
          prev.map((p) => (p.id === data.pedido_id ? { ...p, pagado: 1 } : p))
        )
      }
      if (data.type === 'pedido_cancelado') {
        setPedidos((prev) => prev.filter((p) => p.id !== data.pedido_id))
      }
      if (data.type === 'item_agregado' && data.pedido) {
        upsertPedido({ ...data.pedido, items: data.items || [] })
        playBell()
        setNotification(`🔔 Item agregado: ${data.pedido?.mesa_nombre || ''}`)
        setTimeout(() => setNotification(null), 5000)
      }
    },
    () => {
      loadPedidos()
    },
  )

  useEffect(() => {
    loadPedidos()

    const interval = setInterval(loadPedidos, 5000)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadPedidos()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function updateEstado(id: any, estado: any) {
    try {
      await apiFetch(`/api/pedidos/${id}/estado`, { method: 'PUT', body: { estado } })
      updatePedidoEstado(id, estado)
    } catch { /* silent */ }
  }

  const pendientes = pedidos.filter((p) => p.estado === 'pendiente')
  const preparando = pedidos.filter((p) => p.estado === 'preparando')
  const listos = pedidos.filter((p) => p.estado === 'listo')

  const displayed = filter === 'todos' ? pedidos :
    filter === 'pendiente' ? pendientes :
    filter === 'preparando' ? preparando : listos

  const tabs: any[] = [
    { k: 'todos', l: 'Todos', count: pedidos.length },
    { k: 'pendiente', l: 'Pendientes', count: pendientes.length, color: 'text-red-600' },
    { k: 'preparando', l: 'Preparando', count: preparando.length, color: 'text-amber-600' },
    { k: 'listo', l: 'Listos', count: listos.length, color: 'text-green-600' },
  ]

  return (
    <div className="h-full flex flex-col bg-[#FDFBE0]">
      {notification && (
        <div style={{ position: 'fixed', top: '12px', left: '12px', right: '12px', zIndex: 200, backgroundColor: '#D97706', color: 'white', padding: '14px 20px', borderRadius: '16px', fontSize: '16px', fontWeight: 'bold', textAlign: 'center', border: '1px solid #B45309' }}>
          {notification}
        </div>
      )}

      <div style={{ flexShrink: 0, padding: '12px', backgroundColor: '#1E3A2F', borderBottom: '1px solid #153D2B', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>Cocina</h1>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)' }}>{pedidos.length} activos</span>
        </div>
        <button onClick={loadPedidos} style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', padding: '8px 16px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
          ↻ Recargar
        </button>
      </div>

      <div style={{ flexShrink: 0, display: 'flex', gap: '4px', padding: '8px', backgroundColor: 'white', borderBottom: '1px solid #E5E7EB', overflowX: 'auto' }}>
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setFilter(t.k)}
            style={{
              flexShrink: 0,
              padding: '8px 16px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 'bold',
              backgroundColor: filter === t.k ? '#1E3A2F' : '#F3F4F6',
              color: filter === t.k ? 'white' : '#6B7280',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            {t.l}
            {t.count > 0 && <span style={{ marginLeft: '6px', color: filter === t.k ? 'white' : (t.color || '#9CA3AF') }}>({t.count})</span>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 content-start">
        {displayed.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6B7280', fontSize: '13px', marginTop: '48px' }}>Sin pedidos</div>
        )}
        {displayed.map((p) => (
          <OrderCard key={p.id} pedido={p} onEstado={updateEstado} />
        ))}
      </div>
    </div>
  )
}

function OrderCard({ pedido, onEstado }: { pedido: any; onEstado: (id: any, estado: any) => void }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    if (pedido.estado === 'listo') return
    const update = () => setElapsed(timeAgo(pedido.created_at))
    update()
    const interval = setInterval(update, 30000)
    return () => clearInterval(interval)
  }, [pedido.created_at, pedido.estado])

  const badgeColor =
    pedido.estado === 'pendiente' ? { backgroundColor: '#FEE2E2', color: '#DC2626' } :
    pedido.estado === 'preparando' ? { backgroundColor: '#FEF3C7', color: '#D97706' } :
    { backgroundColor: '#D1FAE5', color: '#059669' }

  const badgeLabel =
    pedido.estado === 'pendiente' ? '⏳ PENDIENTE' :
    pedido.estado === 'preparando' ? '👨‍🍳 PREPARANDO' :
    '✅ LISTO'

  return (
    <div style={{
      backgroundColor: pedido.estado === 'pendiente' ? '#FEF2F2' : 'white',
      borderRadius: '12px',
      padding: '16px 20px',
      boxShadow: pedido.estado === 'pendiente' ? '0 2px 10px rgba(220,38,38,0.12)' : '0 2px 10px rgba(0,0,0,0.07)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      border: pedido.estado === 'pendiente' ? '2px solid #FCA5A5' : '1px solid #E5E7EB'
    }}>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#1E3A2F' }}>#{pedido.id}</span>
            <span style={{ fontSize: '11px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px' }}>🏪 {pedido.mesa_nombre}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <p style={{ fontSize: '11px', color: '#6B7280' }}>{formatFecha(pedido.created_at)}</p>
            <span style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>· {elapsed}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
          <span style={{ padding: '4px 10px', fontSize: '10px', fontWeight: 'bold', borderRadius: '9999px', textTransform: 'uppercase', whiteSpace: 'nowrap', ...badgeColor }}>{badgeLabel}</span>
          {pedido.pagado ? <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '9999px', fontWeight: '600', backgroundColor: '#D1FAE5', color: '#059669', border: '1px solid rgba(5,150,105,0.2)', whiteSpace: 'nowrap' }}>✅ Pagado</span> : null}
        </div>
      </div>

      {/* Cliente */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#1E3A2F' }}>
        <span>👤</span>
        <strong style={{ fontWeight: '600' }}>{pedido.cliente || 'Sin cliente'}</strong>
      </div>

      {/* Productos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: '#1E3A2F' }}>
        {pedido.items?.map((item: any) => {
          const esNuevo = item.created_at && pedido.created_at && item.created_at > pedido.created_at
          return (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <span style={{ fontWeight: 'medium' }}>
                <span style={{ fontWeight: 'bold', fontFamily: 'monospace', color: '#059669', marginRight: '6px' }}>{item.cantidad}×</span>
                {item.producto_nombre}
                {esNuevo && <span style={{ marginLeft: '8px', fontSize: '9px', padding: '2px 6px', borderRadius: '9999px', backgroundColor: '#F59E0B', color: 'white', fontWeight: 'bold' }}>NUEVO</span>}
              </span>
            </div>
          )
        })}
      </div>

      {/* Caja gris: detalles de la orden */}
      <div style={{ backgroundColor: '#F5F3EF', padding: '12px', borderRadius: '8px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {pedido.usuario_nombre && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#1E3A2F', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>🧑‍🍳 Mesero</span>
            <span style={{ fontWeight: '600', color: '#1E3A2F', textAlign: 'right' }}>{pedido.usuario_nombre}</span>
          </div>
        )}
        {pedido.notas && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#1E3A2F', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>📝 Notas</span>
            <span style={{ color: '#B45309', textAlign: 'right' }}>{pedido.notas}</span>
          </div>
        )}
        {!pedido.vendedor_nombre && !pedido.usuario_nombre && !pedido.notas && (
          <span style={{ color: '#9CA3AF' }}>Sin detalles adicionales</span>
        )}
      </div>

      {/* Selector de estado */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #E5E7EB', paddingTop: '12px', fontSize: '13px' }}>
        <label style={{ color: '#9CA3AF', fontWeight: '500', whiteSpace: 'nowrap' }}>Estado:</label>
        <select
          value={pedido.estado}
          onChange={(e) => onEstado(pedido.id, e.target.value)}
          style={{ width: '100%', backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '8px 10px', color: '#1E3A2F', fontWeight: '600', outline: 'none', cursor: 'pointer' }}
        >
          <option value="pendiente">⏳ Pendiente</option>
          <option value="preparando">👨‍🍳 Preparando</option>
          <option value="listo">✅ Listo</option>
        </select>
      </div>
    </div>
  )
}

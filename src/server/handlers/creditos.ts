import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, del, get, json, notFound, post, VALIDATION } from '../router'

const round2 = (n: number) => Number(n.toFixed(2))

/** params.id → número válido o null (el original devolvía 404 con NaN). */
function idOf(raw: string): number | null {
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

// ============ CRÉDITOS (FIADO) ============

get('/creditos', async () => {
  const { data, error } = await supabaseAdmin()
    .from('clientes_credito')
    .select('id, nombre, cedula, deuda_total')
    .order('nombre', { ascending: true })
  if (error) throw new Error(error.message)
  return json({ clientes: data ?? [] })
})

// OJO: debe registrarse ANTES de '/creditos/:id' (el router toma la primera coincidencia)
get('/creditos/buscar', async ({ query }) => {
  const cedula = (query.get('cedula') || '').trim()
  if (!cedula) return VALIDATION()

  const { data, error } = await supabaseAdmin()
    .from('clientes_credito')
    .select('id, nombre, cedula, deuda_total')
    .eq('cedula', cedula)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return notFound()
  return json({ cliente: data })
})

get('/creditos/:id', async ({ params }) => {
  const id = idOf(params.id)
  if (id === null) return notFound()

  const db = supabaseAdmin()
  const { data: cliente, error } = await db
    .from('clientes_credito')
    .select('id, nombre, cedula, deuda_total')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!cliente) return notFound()

  const { data: cvRows, error: cvErr } = await db
    .from('credito_ventas')
    .select(
      'ventas(id, fecha, total_usd, total_bs, metodo_pago, detalle_venta(id, producto_id, cantidad, precio_usd, subtotal, productos(nombre, codigo, tipo)))',
    )
    .eq('cliente_id', id)
  if (cvErr) throw new Error(cvErr.message)

  const ventasConDetalle = (cvRows ?? [])
    .map((r: any) => r.ventas)
    .filter(Boolean)
    .map((v: any) => ({
      id: v.id,
      fecha: v.fecha,
      total_usd: v.total_usd,
      total_bs: v.total_bs,
      metodo_pago: v.metodo_pago,
      detalle: [...((v.detalle_venta ?? []) as any[])]
        .sort((a: any, b: any) => Number(a.id) - Number(b.id))
        .map((d: any) => ({
          producto_id: d.producto_id,
          cantidad: d.cantidad,
          precio_usd: d.precio_usd,
          subtotal: d.subtotal,
          nombre: d.productos?.nombre ?? null,
          codigo: d.productos?.codigo ?? null,
          tipo: d.productos?.tipo ?? null,
        })),
    }))
    .sort((a: any, b: any) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0))

  const { data: pagos, error: pagosErr } = await db
    .from('credito_pagos')
    .select('id, monto_usd, fecha')
    .eq('cliente_id', id)
    .order('fecha', { ascending: false })
  if (pagosErr) throw new Error(pagosErr.message)

  return json({ cliente, ventas: ventasConDetalle, pagos: pagos ?? [] })
})

post('/creditos/:id/pagar', async ({ params, body, session }) => {
  const id = idOf(params.id)
  if (id === null) return notFound()

  const schema = z.object({
    monto_usd: z.number().positive(),
    metodo_pago: z.string().default('Pago de Crédito'),
    referencia: z.string().optional(),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return VALIDATION()

  const db = supabaseAdmin()
  const { data: cliente, error: cliErr } = await db
    .from('clientes_credito')
    .select('id, deuda_total')
    .eq('id', id)
    .maybeSingle()
  if (cliErr) throw new Error(cliErr.message)
  if (!cliente) return notFound()

  const monto = round2(parsed.data.monto_usd)
  if (monto > cliente.deuda_total + 0.001) {
    return apiError(409, 'OVERPAY', { message: 'El monto excede la deuda actual' })
  }

  const { data: config } = await db.from('configuracion').select('tasa_cambio').eq('id', 1).maybeSingle()
  const tasa = config ? Number(config.tasa_cambio) : 1
  const totalBs = round2(monto * tasa)
  const referencia = parsed.data.referencia || ''
  const ventaRef = parsed.data.metodo_pago === 'Pago Móvil' ? referencia : ''

  // Transacción original (db.transaction en better-sqlite3) → RPC atómica
  const { error: rpcErr } = await db.rpc('pagar_credito', {
    p_cliente_id: id,
    p_monto: monto,
    p_metodo_pago: parsed.data.metodo_pago,
    p_venta_referencia: ventaRef,
    p_pago_referencia: referencia,
    p_total_bs: totalBs,
    p_usuario_id: session.userId,
  })
  if (rpcErr) {
    if (rpcErr.message.includes('OVERPAY')) {
      return apiError(409, 'OVERPAY', { message: 'El monto excede la deuda actual' })
    }
    if (rpcErr.message.includes('NOT_FOUND')) return notFound()
    throw new Error(rpcErr.message)
  }

  const { data: updated, error: updErr } = await db
    .from('clientes_credito')
    .select('id, nombre, cedula, deuda_total')
    .eq('id', id)
    .maybeSingle()
  if (updErr) throw new Error(updErr.message)

  return json({ ok: true, cliente: updated })
})

// Eliminar cliente de crédito
del(
  '/creditos/:id',
  async ({ params }) => {
    const id = idOf(params.id)
    if (id === null) return notFound()

    const db = supabaseAdmin()
    const { data: cliente, error } = await db.from('clientes_credito').select('id').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!cliente) return notFound()

    // Transacción original (borrar pagos → ventas → cliente) → RPC atómica
    const { error: rpcErr } = await db.rpc('eliminar_cliente_credito', { p_cliente_id: id })
    if (rpcErr) {
      if (rpcErr.message.includes('NOT_FOUND')) return notFound()
      throw new Error(rpcErr.message)
    }

    return json({ ok: true })
  },
  { roles: ['admin'] },
)

import { supabaseAdmin } from '@/lib/supabase'
import { get, json, notFound, VALIDATION } from '../router'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

const dayStart = (ymd: string) => `${ymd}T00:00:00-04:00`
const dayEnd = (ymd: string) => `${ymd}T23:59:59-04:00`

function readRange(query: URLSearchParams): { hasRange: boolean; from: string; to: string } | null {
  const from = (query.get('from') || '').trim()
  const to = (query.get('to') || '').trim()
  const hasRange = Boolean(from && to)
  if (hasRange && (!DAY_RE.test(from) || !DAY_RE.test(to))) return null
  return { hasRange, from, to }
}

function flattenVenta(v: any) {
  const { pedidos, ...rest } = v
  return { ...rest, mesa_nombre: pedidos?.mesas?.nombre ?? null }
}

function flattenDetalle(d: any) {
  const { productos, ...rest } = d
  return { ...rest, codigo: productos?.codigo ?? null, nombre: productos?.nombre ?? null, tipo: productos?.tipo ?? null }
}

// ============ REPORTES ============

get(
  '/reportes/ventas',
  async ({ query }) => {
    const range = readRange(query)
    if (!range) return VALIDATION()

    const page = Math.max(1, Number(query.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 10))
    const offset = (page - 1) * limit
    const db = supabaseAdmin()

    let rowsQuery = db
      .from('ventas')
      .select('*, pedidos(mesa_id, mesas(nombre))')
      .or('metodo_pago.neq.Credito,pagada.eq.true')
    if (range.hasRange) rowsQuery = rowsQuery.gte('fecha', dayStart(range.from)).lte('fecha', dayEnd(range.to))

    const { data: rowsRaw, error } = await rowsQuery.order('fecha', { ascending: false }).range(offset, offset + limit - 1)
    if (error) throw new Error(error.message)

    const { data: totals, error: totalsError } = await db.rpc('reporte_ventas_totales', {
      p_from: range.hasRange ? dayStart(range.from) : null,
      p_to: range.hasRange ? dayEnd(range.to) : null,
    })
    if (totalsError) throw new Error(totalsError.message)

    const rows = (rowsRaw ?? []).map(flattenVenta)
    const totalCount = Number((totals as any)?.count)
    const totalPages = Math.max(1, Math.ceil(totalCount / limit))

    return json({ rows, totals, page, limit, totalPages, totalCount })
  },
  { roles: ['admin', 'encargado'] },
)

get(
  '/reportes/ventas/:id',
  async ({ params }) => {
    const id = Number(params.id)
    const db = supabaseAdmin()

    const { data: ventaRaw, error } = await db.from('ventas').select('*, pedidos(mesa_id, mesas(nombre))').eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!ventaRaw) return notFound()

    const { data: detalleRaw, error: detalleError } = await db
      .from('detalle_venta')
      .select('*, productos(codigo, nombre, tipo)')
      .eq('venta_id', id)
      .order('id', { ascending: true })
    if (detalleError) throw new Error(detalleError.message)

    const { data: pagos, error: pagosError } = await db
      .from('venta_pagos')
      .select('metodo_pago, monto_usd, monto_bs, referencia')
      .eq('venta_id', id)
      .order('id', { ascending: true })
    if (pagosError) throw new Error(pagosError.message)

    return json({
      venta: flattenVenta(ventaRaw),
      detalle: (detalleRaw ?? []).map(flattenDetalle),
      pagos: pagos ?? [],
    })
  },
  { roles: ['admin', 'encargado'] },
)

get(
  '/reportes/pagos',
  async ({ query }) => {
    const range = readRange(query)
    if (!range) return VALIDATION()

    const { data, error } = await supabaseAdmin().rpc('reporte_pagos', {
      p_from: range.hasRange ? dayStart(range.from) : null,
      p_to: range.hasRange ? dayEnd(range.to) : null,
    })
    if (error) throw new Error(error.message)
    return json({ pagos: (data as any) ?? [] })
  },
  { roles: ['admin', 'encargado'] },
)

get(
  '/reportes/ventas-por-departamento',
  async ({ query }) => {
    const range = readRange(query)
    if (!range) return VALIDATION()

    const { data, error } = await supabaseAdmin().rpc('reporte_ventas_por_departamento', {
      p_from: range.hasRange ? dayStart(range.from) : null,
      p_to: range.hasRange ? dayEnd(range.to) : null,
    })
    if (error) throw new Error(error.message)
    return json({ departamentos: (data as any) ?? [] })
  },
  { roles: ['admin', 'encargado'] },
)

get(
  '/reportes/pagos-movil',
  async ({ query }) => {
    const range = readRange(query)
    if (!range) return VALIDATION()

    const { data, error } = await supabaseAdmin().rpc('reporte_pagos_movil', {
      p_from: range.hasRange ? dayStart(range.from) : null,
      p_to: range.hasRange ? dayEnd(range.to) : null,
    })
    if (error) throw new Error(error.message)
    return json({ pagos: (data as any)?.pagos ?? [], multipago: (data as any)?.multipago ?? [] })
  },
  { roles: ['admin', 'encargado'] },
)

get(
  '/reportes/cobertura',
  async ({ query }) => {
    const from = (query.get('from') || '').trim()
    const to = (query.get('to') || '').trim()
    if (!from || !to || !DAY_RE.test(from) || !DAY_RE.test(to)) return VALIDATION()

    const { data, error } = await supabaseAdmin().rpc('reporte_cobertura', {
      p_from: dayStart(from),
      p_to: dayEnd(to),
    })
    if (error) throw new Error(error.message)

    const proveedores = (data as any)?.proveedores ?? []
    const gananciaTotal = Number((data as any)?.total_ganancia || 0)
    const totalDeudas = proveedores.reduce((sum: number, d: any) => sum + d.saldo_pendiente, 0)

    return json({
      ganancia_semanal: gananciaTotal,
      total_deudas: totalDeudas,
      saldo_disponible: gananciaTotal - totalDeudas,
      proveedores,
    })
  },
  { roles: ['admin', 'encargado'] },
)

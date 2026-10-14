import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, del, get, json, post, put, VALIDATION } from '../router'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const dayStart = (ymd: string) => `${ymd}T00:00:00-04:00`
const dayEnd = (ymd: string) => `${ymd}T23:59:59-04:00`

export const GASTO_CATEGORIAS = ['alquiler', 'sueldos', 'intereses', 'prestaciones', 'servicios', 'impuestos', 'transporte', 'marketing', 'otro'] as const

const schemaGasto = z.object({
  fecha: z.string().regex(DAY_RE).optional(),
  categoria: z.enum(GASTO_CATEGORIAS),
  descripcion: z.string().optional().default(''),
  monto_usd: z.number().nonnegative(),
})

const schemaCierre = z.object({
  fecha: z.string().regex(DAY_RE).optional(),
  tipo: z.enum(['inicial', 'final']),
  valor_usd: z.number().nonnegative(),
  notas: z.string().optional().default(''),
})

// ==================== GASTOS ====================

get(
  '/gastos',
  async ({ query }) => {
    const from = (query.get('from') || '').trim()
    const to = (query.get('to') || '').trim()
    let q = supabaseAdmin().from('gastos').select('*').order('fecha', { ascending: false }).order('id', { ascending: false })
    if (from && to && DAY_RE.test(from) && DAY_RE.test(to)) {
      q = q.gte('fecha', from).lte('fecha', to)
    }
    const { data, error } = await q
    if (error) throw new Error(error.message)
    return json({ gastos: data ?? [] })
  },
  { roles: ['admin', 'encargado'] },
)

post(
  '/gastos',
  async ({ body }) => {
    const parsed = schemaGasto.safeParse(body)
    if (!parsed.success) return VALIDATION()
    const { data, error } = await supabaseAdmin()
      .from('gastos')
      .insert({
        fecha: parsed.data.fecha,
        categoria: parsed.data.categoria,
        descripcion: parsed.data.descripcion,
        monto_usd: parsed.data.monto_usd,
      })
      .select('id')
      .single()
    if (error) return apiError(500, 'DB_ERROR', { detail: error.message })
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

put(
  '/gastos/:id',
  async ({ params, body }) => {
    const parsed = schemaGasto.safeParse(body)
    if (!parsed.success) return VALIDATION()
    const { data, error } = await supabaseAdmin()
      .from('gastos')
      .update({
        fecha: parsed.data.fecha,
        categoria: parsed.data.categoria,
        descripcion: parsed.data.descripcion,
        monto_usd: parsed.data.monto_usd,
      })
      .eq('id', Number(params.id))
      .select('id')
    if (error) throw new Error(error.message)
    return json({ updated: (data ?? []).length })
  },
  { roles: ['admin', 'encargado'] },
)

del(
  '/gastos/:id',
  async ({ params }) => {
    const { data, error } = await supabaseAdmin().from('gastos').delete().eq('id', Number(params.id)).select('id')
    if (error) throw new Error(error.message)
    return json({ deleted: (data ?? []).length })
  },
  { roles: ['admin', 'encargado'] },
)

// ==================== CIERRES DE INVENTARIO ====================

get(
  '/inventario-cierres',
  async () => {
    const { data, error } = await supabaseAdmin()
      .from('inventario_cierres')
      .select('*')
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
    if (error) throw new Error(error.message)
    return json({ cierres: data ?? [] })
  },
  { roles: ['admin', 'encargado'] },
)

post(
  '/inventario-cierres',
  async ({ body }) => {
    const parsed = schemaCierre.safeParse(body)
    if (!parsed.success) return VALIDATION()
    const { data, error } = await supabaseAdmin()
      .from('inventario_cierres')
      .insert({
        fecha: parsed.data.fecha,
        tipo: parsed.data.tipo,
        valor_usd: parsed.data.valor_usd,
        notas: parsed.data.notas,
      })
      .select('id')
      .single()
    if (error) return apiError(500, 'DB_ERROR', { detail: error.message })
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

del(
  '/inventario-cierres/:id',
  async ({ params }) => {
    const { data, error } = await supabaseAdmin().from('inventario_cierres').delete().eq('id', Number(params.id)).select('id')
    if (error) throw new Error(error.message)
    return json({ deleted: (data ?? []).length })
  },
  { roles: ['admin', 'encargado'] },
)

// ==================== ESTADO DE RESULTADOS ====================
// Estructura exacta de la hoja de la contadora:
//   Ventas | Inventario Inicial | Compras | Mercancía Disponible |
//   (−) Inventario Final | Utilidad Bruta | Gastos | Utilidad | Utilidad/Ventas %

get(
  '/reportes/estado-resultados',
  async ({ query }) => {
    const from = (query.get('from') || '').trim()
    const to = (query.get('to') || '').trim()
    if (!from || !to || !DAY_RE.test(from) || !DAY_RE.test(to)) return VALIDATION()

    const db = supabaseAdmin()

    const [totRes, comprasRes, gastosRes, facturasGastoRes, invIniRes, invFinRes] = await Promise.all([
      db.rpc('reporte_ventas_totales', { p_from: dayStart(from), p_to: dayEnd(to) }),
      db
        .from('facturas_proveedor')
        .select('monto_total')
        .eq('categoria', 'compra')
        .gte('fecha_documento', from)
        .lte('fecha_documento', to),
      db
        .from('gastos')
        .select('*')
        .gte('fecha', from)
        .lte('fecha', to)
        .order('fecha', { ascending: false })
        .order('id', { ascending: false }),
      db
        .from('facturas_proveedor')
        .select('id, numero_factura, descripcion, monto_total, fecha_documento')
        .eq('categoria', 'gasto')
        .gte('fecha_documento', from)
        .lte('fecha_documento', to)
        .order('fecha_documento', { ascending: false }),
      db
        .from('inventario_cierres')
        .select('*')
        .eq('tipo', 'inicial')
        .lte('fecha', from)
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from('inventario_cierres')
        .select('*')
        .eq('tipo', 'final')
        .lte('fecha', to)
        .order('fecha', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    if (totRes.error) throw new Error(totRes.error.message)
    if (comprasRes.error) throw new Error(comprasRes.error.message)
    if (gastosRes.error) throw new Error(gastosRes.error.message)
    if (facturasGastoRes.error) throw new Error(facturasGastoRes.error.message)
    if (invIniRes.error) throw new Error(invIniRes.error.message)
    if (invFinRes.error) throw new Error(invFinRes.error.message)

    const tot = (totRes.data ?? {}) as any
    const ventas = Number(tot.total_usd || 0)

    const comprasTotal = (comprasRes.data ?? []).reduce((s: number, r: any) => s + Number(r.monto_total || 0), 0)

    const invIni = invIniRes.data as any
    const invFin = invFinRes.data as any
    const invIniVal = invIni ? Number(invIni.valor_usd) : null
    const invFinVal = invFin ? Number(invFin.valor_usd) : null

    const disponible = (invIniVal ?? 0) + comprasTotal
    const costoVenta = disponible - (invFinVal ?? 0)
    const utilidadBruta = ventas - costoVenta

    // Gastos internos agrupados por categoría + facturas de proveedor marcadas como gasto
    const gastosInt = (gastosRes.data ?? []) as any[]
    const facturasGasto = (facturasGastoRes.data ?? []) as any[]

    const porCategoria = new Map<string, number>()
    for (const g of gastosInt) {
      porCategoria.set(g.categoria, (porCategoria.get(g.categoria) || 0) + Number(g.monto_usd || 0))
    }
    const detalleGastos: { categoria: string; total_usd: number }[] = GASTO_CATEGORIAS.map((c) => ({
      categoria: c,
      total_usd: porCategoria.get(c) || 0,
    })).filter((d) => d.total_usd > 0)
    const facturasGastoTotal = facturasGasto.reduce((s, f) => s + Number(f.monto_total || 0), 0)
    if (facturasGastoTotal > 0) {
      detalleGastos.push({ categoria: 'proveedores', total_usd: facturasGastoTotal })
    }

    const gastosTotal = detalleGastos.reduce((s, d) => s + d.total_usd, 0)
    const utilidad = utilidadBruta - gastosTotal
    const margenPct = ventas > 0 ? (utilidad / ventas) * 100 : 0

    return json({
      from,
      to,
      ventas: {
        total_usd: ventas,
        count: Number(tot.count || 0),
        total_bs: Number(tot.total_bs || 0),
      },
      inventario_inicial: invIni ? { id: invIni.id, fecha: invIni.fecha, valor_usd: invIniVal } : null,
      inventario_final: invFin ? { id: invFin.id, fecha: invFin.fecha, valor_usd: invFinVal } : null,
      inventario_incompleto: invIniVal === null || invFinVal === null,
      compras_total: comprasTotal,
      disponible,
      costo_venta: costoVenta,
      utilidad_bruta: utilidadBruta,
      gastos: {
        detalle: detalleGastos,
        proveedores: facturasGasto.map((f) => ({
          id: f.id,
          numero_factura: f.numero_factura,
          descripcion: f.descripcion,
          fecha: f.fecha_documento,
          monto_usd: Number(f.monto_total || 0),
        })),
        total: gastosTotal,
      },
      utilidad,
      margen_pct: margenPct,
    })
  },
  { roles: ['admin', 'encargado'] },
)

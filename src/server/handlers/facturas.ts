import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { broadcast } from '../realtime'
import { apiError, del, get, json, post, VALIDATION } from '../router'

/** dv.*, p.codigo, p.nombre, p.tipo → aplana el embed de productos. */
function flattenDetalle(rows: any[]) {
  return rows.map((d) => {
    const { productos, ...rest } = d
    return { ...rest, codigo: productos?.codigo ?? null, nombre: productos?.nombre ?? null, tipo: productos?.tipo ?? null }
  })
}

// ─── Facturas: listar y modificar ────────────────────────────────────────────

get('/facturas', async ({ query }) => {
  const page = Math.max(1, parseInt(query.get('page') || '') || 1)
  const limit = Math.min(50, Math.max(1, parseInt(query.get('limit') || '') || 20))
  const offset = (page - 1) * limit
  const search = (query.get('search') || '').trim()
  const pagadaParam = query.get('pagada')
  const pagada = pagadaParam !== null ? Number(pagadaParam) : null

  // En SQLite `v.id = NULL/NaN` y `v.pagada` fuera de {0,1} no devuelven filas
  const searchInvalido = search !== '' && !Number.isInteger(Number(search))
  const pagadaInvalida = pagada !== null && pagada !== 0 && pagada !== 1
  if (searchInvalido || pagadaInvalida) {
    return json({ facturas: [], total: 0, page, pages: Math.ceil(0 / limit) })
  }

  const db = supabaseAdmin()
  let q = db.from('ventas').select('*, pedidos(mesas(nombre))', { count: 'exact' })
  if (search !== '') q = q.eq('id', Number(search))
  if (pagada !== null) q = q.eq('pagada', pagada === 1)

  const { data, count, error } = await q.order('fecha', { ascending: false }).range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)

  const facturas = (data ?? []).map((v: any) => {
    const { pedidos, ...rest } = v
    return { ...rest, mesa_nombre: pedidos?.mesas?.nombre ?? null }
  })

  const total = count ?? 0
  return json({ facturas, total, page, pages: Math.ceil(total / limit) })
})

del(
  '/facturas/:id/items/:itemId',
  async ({ params }) => {
    const ventaId = Number(params.id)
    const itemId = Number(params.itemId)

    const db = supabaseAdmin()
    const { data: venta, error: vErr } = await db.from('ventas').select('*').eq('id', ventaId).maybeSingle()
    if (vErr) throw new Error(vErr.message)
    if (!venta) return apiError(404, 'VENTA_NOT_FOUND')

    const { data: item, error: iErr } = await db
      .from('detalle_venta')
      .select('*')
      .eq('id', itemId)
      .eq('venta_id', ventaId)
      .maybeSingle()
    if (iErr) throw new Error(iErr.message)
    if (!item) return apiError(404, 'ITEM_NOT_FOUND')

    const { data: config } = await db.from('configuracion').select('tasa_cambio').eq('id', 1).maybeSingle()
    const tasa = config ? Number(config.tasa_cambio) : 1

    // Transacción original (db.transaction) → RPC atómica
    const { error: rpcErr } = await db.rpc('factura_quitar_item', {
      p_venta_id: ventaId,
      p_item_id: itemId,
      p_tasa: tasa,
    })
    if (rpcErr) {
      if (rpcErr.message.includes('VENTA_NOT_FOUND')) return apiError(404, 'VENTA_NOT_FOUND')
      if (rpcErr.message.includes('ITEM_NOT_FOUND')) return apiError(404, 'ITEM_NOT_FOUND')
      throw new Error(rpcErr.message)
    }

    const { data: updatedVenta, error: uErr } = await db.from('ventas').select('*').eq('id', ventaId).maybeSingle()
    if (uErr) throw new Error(uErr.message)

    let detalle: any[] = []
    if (updatedVenta) {
      const { data, error } = await db
        .from('detalle_venta')
        .select('*, productos(codigo, nombre, tipo)')
        .eq('venta_id', ventaId)
        .order('id', { ascending: true })
      if (error) throw new Error(error.message)
      detalle = flattenDetalle(data ?? [])
    }

    return json({ ok: true, venta: updatedVenta || null, detalle })
  },
  { roles: ['admin', 'encargado'] },
)

post(
  '/facturas/:id/items',
  async ({ params, body }) => {
    const ventaId = Number(params.id)
    const schema = z.object({
      producto_id: z.number().int().positive(),
      cantidad: z.number().positive(),
      precio_usd: z.number().nonnegative(),
      subtotal: z.number().nonnegative(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const db = supabaseAdmin()
    const { data: venta, error: vErr } = await db.from('ventas').select('*').eq('id', ventaId).maybeSingle()
    if (vErr) throw new Error(vErr.message)
    if (!venta) return apiError(404, 'VENTA_NOT_FOUND')

    const { data: producto, error: pErr } = await db
      .from('productos')
      .select('*')
      .eq('id', parsed.data.producto_id)
      .maybeSingle()
    if (pErr) throw new Error(pErr.message)
    if (!producto) return apiError(404, 'PRODUCT_NOT_FOUND')

    const { data: config } = await db.from('configuracion').select('tasa_cambio').eq('id', 1).maybeSingle()
    const tasa = config ? Number(config.tasa_cambio) : 1

    // Transacción original (db.transaction) → RPC atómica
    const { error: rpcErr } = await db.rpc('factura_agregar_item', {
      p_venta_id: ventaId,
      p_producto_id: parsed.data.producto_id,
      p_cantidad: parsed.data.cantidad,
      p_precio_usd: parsed.data.precio_usd,
      p_subtotal: parsed.data.subtotal,
      p_precio_costo: producto.precio_costo || 0,
      p_tasa: tasa,
    })
    if (rpcErr) {
      if (rpcErr.message.includes('VENTA_NOT_FOUND')) return apiError(404, 'VENTA_NOT_FOUND')
      if (rpcErr.message.includes('PRODUCT_NOT_FOUND')) return apiError(404, 'PRODUCT_NOT_FOUND')
      throw new Error(rpcErr.message)
    }

    if (venta.pedido_id) {
      const { data: pedidoRow, error: peErr } = await db
        .from('pedidos')
        .select('*, mesas(nombre), usuarios(usuario), vendedores(nombre)')
        .eq('id', venta.pedido_id)
        .maybeSingle()
      if (peErr) throw new Error(peErr.message)

      const { data: itemsRows, error: ieErr } = await db
        .from('pedido_items')
        .select('*, productos(nombre)')
        .eq('pedido_id', venta.pedido_id)
        .order('id', { ascending: true })
      if (ieErr) throw new Error(ieErr.message)

      const pedido = pedidoRow
        ? (() => {
            const { mesas, usuarios, vendedores, ...rest } = pedidoRow as any
            return {
              ...rest,
              mesa_nombre: mesas?.nombre ?? null,
              usuario_nombre: usuarios?.usuario ?? null,
              vendedor_nombre: vendedores?.nombre ?? null,
            }
          })()
        : null

      const items = (itemsRows ?? []).map((it: any) => {
        const { productos, ...rest } = it
        return { ...rest, producto_nombre: productos?.nombre ?? null }
      })

      await broadcast('item_agregado', { pedido_id: venta.pedido_id, pedido, items })
    }

    const { data: updatedVenta, error: uErr } = await db.from('ventas').select('*').eq('id', ventaId).maybeSingle()
    if (uErr) throw new Error(uErr.message)

    const { data: det, error: dErr } = await db
      .from('detalle_venta')
      .select('*, productos(codigo, nombre, tipo)')
      .eq('venta_id', ventaId)
      .order('id', { ascending: true })
    if (dErr) throw new Error(dErr.message)

    return json({ ok: true, venta: updatedVenta, detalle: flattenDetalle(det ?? []) })
  },
  { roles: ['admin', 'encargado'] },
)

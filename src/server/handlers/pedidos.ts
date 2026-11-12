import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { broadcast } from '../realtime'
import { conflict, del, get, json, notFound, post, put, VALIDATION, apiError } from '../router'

const itemSchema = z.object({
  producto_id: z.number().int().positive(),
  cantidad: z.number().positive(),
  precio_usd: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
  notas: z.string().optional().default(''),
})

const PEDIDO_FULL =
  '*, mesa:mesas(nombre), usuario:usuarios(usuario), vendedor:vendedores(nombre), pedido_items(*, producto:productos(nombre))'

/** Aplana el pedido con embeds a la forma exacta del original (p.* + *_nombre). */
function flatPedido(p: any) {
  const { mesa, usuario, vendedor, pedido_items: _pedido_items, ...rest } = p
  return {
    ...rest,
    mesa_nombre: mesa?.nombre ?? null,
    usuario_nombre: usuario?.usuario ?? null,
    vendedor_nombre: vendedor?.nombre ?? null,
  }
}

function flatItems(pedidoItems: any[] | null | undefined) {
  return (pedidoItems ?? []).map(({ producto, ...it }: any) => ({
    ...it,
    producto_nombre: producto?.nombre ?? null,
  }))
}

/** Pedido con su arreglo `items` (forma de los listados). */
function flatPedidoConItems(p: any) {
  return { ...flatPedido(p), items: flatItems(p.pedido_items) }
}

async function fetchPedido(id: number) {
  const { data, error } = await supabaseAdmin().from('pedidos').select(PEDIDO_FULL).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

// ============ CONSULTA DE STOCK AL TOMAR EL PEDIDO ============
// Compara lo que pide el carrito contra el stock de los ingredientes
// de las recetas, ANTES de mandar la orden a cocina (no se espera a facturar).

type ItemStock = { producto_id: number; cantidad: number }

/**
 * Detalle de lo que falta, agregando los ingredientes de las recetas de los
 * productos pedidos. `null` = hay stock suficiente.
 *   → "Carne de res: falta 1.5 kg; Aceite: falta 0.5 l"
 */
async function faltantesStock(items: ItemStock[]): Promise<string | null> {
  const mapa = await mapaFaltantes(items)
  const faltas = Object.values(mapa.productos).filter((d) => d)
  // También lo que falta sumando todos los productos entre sí
  const global = Object.entries(mapa.total)
    .filter(([, v]) => v.falta > 0.0005)
    .map(([, v]) => `${v.nombre}: falta ${Math.round(v.falta * 1000) / 1000} ${v.unidad}`)
  const unicos = [...new Set([...faltas, ...global])]
  return unicos.length ? unicos.join('; ') : null
}

/** Devuelve el detalle por producto (para marcar en el carrito) y el total. */
async function mapaFaltantes(items: ItemStock[]) {
  const db = supabaseAdmin()
  const porProducto: Record<number, string> = {}
  const total: Record<number, { nombre: string; unidad: string; falta: number }> = {}

  const ids = [...new Set(items.map((i) => i.producto_id))]
  if (ids.length === 0) return { productos: porProducto, total }

  const { data: prods } = await db.from('productos').select('id, es_receta').in('id', ids)
  const recetaIds = (prods ?? []).filter((p: any) => p.es_receta).map((p: any) => p.id)
  if (recetaIds.length === 0) return { productos: porProducto, total }

  const { data: ri } = await db
    .from('receta_ingredientes')
    .select('producto_id, ingrediente_id, cantidad, ingredientes(nombre, unidad, stock_actual)')
    .in('producto_id', recetaIds)

  for (const row of ri ?? []) {
    const ing = row.ingredientes as any
    if (!ing) continue
    const cantPedida = items
      .filter((i) => i.producto_id === row.producto_id)
      .reduce((s, i) => s + i.cantidad, 0)
    if (cantPedida <= 0) continue

    const requerido = row.cantidad * cantPedida
    const stock = Number(ing.stock_actual || 0)
    const falta = Math.round((requerido - stock) * 1000) / 1000

    // Total agregado por ingrediente (varios productos pueden usar el mismo)
    const t = total[row.ingrediente_id]
    total[row.ingrediente_id] = {
      nombre: ing.nombre,
      unidad: ing.unidad,
      falta: (t?.falta ?? 0) + Math.max(0, falta),
    }

    // Detalle por producto individual
    if (falta > 0.0005 && !porProducto[row.producto_id]) {
      porProducto[row.producto_id] = `${ing.nombre}: falta ${falta} ${ing.unidad}`
    }
  }
  return { productos: porProducto, total }
}

// POST /stock/verificar  { items: [{producto_id, cantidad}] }
// → { ok, detalle, productos: { [producto_id]: "Ingrediente: falta X unidad" } }
post('/stock/verificar', async ({ body }) => {
  const schema = z.object({
    items: z
      .array(z.object({ producto_id: z.number().int().positive(), cantidad: z.number().positive() }))
      .min(1),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return VALIDATION()

  const mapa = await mapaFaltantes(parsed.data.items)
  const faltas = [
    ...Object.values(mapa.productos).filter(Boolean),
    ...Object.entries(mapa.total)
      .filter(([, v]) => v.falta > 0.0005)
      .map(([, v]) => `${v.nombre}: falta ${Math.round(v.falta * 1000) / 1000} ${v.unidad}`),
  ]
  const detalle = [...new Set(faltas)].join('; ')
  return json({ ok: !detalle, detalle, productos: mapa.productos })
})

// ============ CREAR PEDIDO ============

post('/pedidos', async ({ body, session }) => {
  const schema = z.object({
    mesa_id: z.number().int().positive(),
    notas: z.string().optional().default(''),
    cliente: z.string().optional().default(''),
    listo: z.boolean().optional().default(false),
    items: z.array(itemSchema).min(1),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return VALIDATION()

  // Sin stock no se toma el pedido: se avisa antes de mandar a cocina
  const faltan = await faltantesStock(parsed.data.items)
  if (faltan) return apiError(409, 'INSUFFICIENT_STOCK', { detail: faltan })

  const db = supabaseAdmin()

  // Vendedor asignado al usuario logueado
  const { data: vendedor } = await db
    .from('vendedores')
    .select('id')
    .eq('usuario_id', session.userId)
    .eq('activo', true)
    .maybeSingle()

  const estado = parsed.data.listo ? 'listo' : 'pendiente'

  const { data: pedidoId, error } = await db.rpc('crear_pedido', {
    p_mesa_id: parsed.data.mesa_id,
    p_notas: parsed.data.notas,
    p_cliente: parsed.data.cliente,
    p_usuario_id: session.userId,
    p_vendedor_id: vendedor?.id ?? null,
    p_estado: estado,
    p_items: parsed.data.items,
  })
  if (error) throw new Error(error.message)

  const row = await fetchPedido(Number(pedidoId))
  if (!row) return notFound()
  const pedido = flatPedido(row)
  const items = flatItems(row.pedido_items)

  if (parsed.data.listo) {
    await broadcast('pedido_actualizado', {
      pedido_id: pedidoId,
      estado: 'listo',
      mesa_nombre: pedido.mesa_nombre,
      cliente: pedido.cliente,
    })
  } else {
    await broadcast('nuevo_pedido', { pedido, items })
  }

  return json({ id: pedidoId, pedido, items })
})

// ============ AGREGAR ITEMS A UN PEDIDO ============

post('/pedidos/:id/items', async ({ params, body }) => {
  const id = Number(params.id)
  const schema = z.object({ items: z.array(itemSchema).min(1) })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return VALIDATION()

  // Mismo control de stock al agregar productos a un pedido abierto
  const faltanItems = await faltantesStock(parsed.data.items)
  if (faltanItems) return apiError(409, 'INSUFFICIENT_STOCK', { detail: faltanItems })

  const db = supabaseAdmin()
  const { data: pedido } = await db.from('pedidos').select('id, estado, cancelado').eq('id', id).maybeSingle()
  if (!pedido) return notFound()
  if (pedido.estado === 'facturado' || pedido.cancelado) return conflict('PEDIDO_FACTURADO')

  const { error } = await db.rpc('agregar_items_pedido', { p_pedido_id: id, p_items: parsed.data.items })
  if (error) throw new Error(error.message)

  const row = await fetchPedido(id)
  if (!row) return notFound()
  const updated = flatPedido(row)
  const items = flatItems(row.pedido_items)

  await broadcast('pedido_actualizado', {
    pedido_id: id,
    estado: updated.estado,
    mesa_nombre: updated.mesa_nombre,
    cliente: updated.cliente,
  })

  return json({ pedido: updated, items })
})

// ============ QUITAR ITEM DE UN PEDIDO ============

del('/pedidos/:id/items/:itemId', async ({ params }) => {
  const id = Number(params.id)
  const itemId = Number(params.itemId)

  const db = supabaseAdmin()
  const { data: pedido } = await db.from('pedidos').select('id, estado, cancelado').eq('id', id).maybeSingle()
  if (!pedido) return notFound()
  if (pedido.estado === 'facturado' || pedido.cancelado) return conflict('PEDIDO_FACTURADO')

  const { data: removed, error } = await db.rpc('pedido_quitar_item', { p_pedido_id: id, p_item_id: itemId })
  if (error) throw new Error(error.message)
  if (!removed) return notFound('ITEM_NOT_FOUND')

  const row = await fetchPedido(id)
  if (!row) return notFound()
  const updated = flatPedido(row)
  const items = flatItems(row.pedido_items)

  await broadcast('pedido_actualizado', {
    pedido_id: id,
    estado: updated.estado,
    mesa_nombre: updated.mesa_nombre,
    cliente: updated.cliente,
  })

  return json({ ok: true, pedido: updated, items })
})

// ============ CANCELAR PEDIDO ============

post('/pedidos/:id/cancelar', async ({ params }) => {
  const id = Number(params.id)
  const db = supabaseAdmin()

  const { data: pedido } = await db.from('pedidos').select('id, estado, cancelado').eq('id', id).maybeSingle()
  if (!pedido) return notFound()
  if (pedido.estado === 'facturado' || pedido.cancelado) return conflict('PEDIDO_FACTURADO')

  const { error } = await db.from('pedidos').update({ cancelado: true }).eq('id', id)
  if (error) throw new Error(error.message)

  const { data: rawData } = await db
    .from('pedidos')
    .select('id, estado, cancelado, cliente, mesa:mesas(nombre)')
    .eq('id', id)
    .maybeSingle()
  const info = rawData as any

  await broadcast('pedido_cancelado', {
    pedido_id: id,
    mesa_nombre: info?.mesa?.nombre ?? null,
    cliente: info?.cliente ?? '',
  })

  return json({ ok: true })
})

// ============ LISTADOS ============

async function listarPedidos(where: (q: any) => any, limit: number) {
  const base = supabaseAdmin().from('pedidos').select(PEDIDO_FULL)
  const { data, error } = await where(base).order('updated_at', { ascending: false }).limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map(flatPedidoConItems)
}

get('/pedidos/activos', async () => {
  const pedidos = await listarPedidos(
    (q) => q.in('estado', ['pendiente', 'preparando', 'listo']).eq('cancelado', false),
    200,
  )
  // el original ordena por created_at DESC
  pedidos.sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
  return json({ pedidos })
})

put(
  '/pedidos/:id/estado',
  async ({ params, body }) => {
    const id = Number(params.id)
    const db = supabaseAdmin()
    const { data: pedido } = await db
      .from('pedidos')
      .select('id, estado, cancelado, pagado')
      .eq('id', id)
      .maybeSingle()
    if (!pedido) return notFound()
    if (pedido.cancelado) return conflict('PEDIDO_CANCELADO')

    const schema = z.object({ estado: z.enum(['pendiente', 'preparando', 'listo', 'facturado']) })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    let newEstado = parsed.data.estado
    if (newEstado === 'listo' && pedido.pagado) newEstado = 'facturado'

    const { error } = await db.from('pedidos').update({ estado: newEstado }).eq('id', id)
    if (error) throw new Error(error.message)

    const { data: rawData } = await db
      .from('pedidos')
      .select('id, estado, cliente, mesa:mesas(nombre)')
      .eq('id', id)
      .maybeSingle()
    const info = rawData as any

    await broadcast('pedido_actualizado', {
      pedido_id: id,
      estado: newEstado,
      mesa_nombre: info?.mesa?.nombre ?? null,
      cliente: info?.cliente ?? '',
    })

    return json({ ok: true })
  },
  { roles: ['empleado', 'encargado', 'admin', 'cocina'] },
)

get('/pedidos/buscar', async ({ query }) => {
  const q = (query.get('q') || '').trim()

  if (q) {
    const { data, error } = await supabaseAdmin().rpc('pedidos_buscar_json', { p_q: q })
    if (error) throw new Error(error.message)
    return json({ pedidos: data ?? [] })
  }

  const pedidos = await listarPedidos((qb) => qb.eq('cancelado', false), 30)
  return json({ pedidos })
})

get('/pedidos/pendientes', async () => {
  const pedidos = await listarPedidos(
    (q) => q.in('estado', ['listo', 'pendiente', 'preparando']).eq('pagado', false).eq('cancelado', false),
    50,
  )
  return json({ pedidos })
})

get('/pedidos/facturados', async () => {
  const pedidos = await listarPedidos((q) => q.eq('estado', 'facturado').eq('cancelado', false), 50)
  return json({ pedidos })
})

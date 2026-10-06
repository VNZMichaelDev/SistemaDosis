import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { broadcast } from '../realtime'
import { conflict, del, get, json, notFound, post, put, VALIDATION } from '../router'

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

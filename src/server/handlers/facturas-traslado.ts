import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, del, get, json, post, VALIDATION } from '../router'

const schemaItem = z.object({
  descripcion: z.string().min(1),
  cantidad: z.number().positive(),
  precio_unitario: z.number().nonnegative(),
  producto_id: z.number().nullable().optional(),
})

const schemaFactura = z.object({
  destinatario: z.string().min(1),
  direccion: z.string().optional().default(''),
  rif: z.string().optional().default(''),
  fecha: z.string().optional(),
  notas: z.string().optional().default(''),
  items: z.array(schemaItem).min(1),
})

get('/facturas-traslado', async () => {
  const { data, error } = await supabaseAdmin()
    .from('facturas_traslado')
    .select('id, numero, destinatario, direccion, rif, fecha, subtotal, total, notas, created_at')
    .order('id', { ascending: false })
  if (error) return apiError(500, 'DB_ERROR', { detail: error.message })
  return json({ facturas: data })
})

post('/facturas-traslado', async ({ body, session }) => {
  if (session.rol !== 'admin' && session.rol !== 'encargado') return apiError(403, 'FORBIDDEN')
  const parsed = schemaFactura.safeParse(body)
  if (!parsed.success) return VALIDATION()
  const { destinatario, direccion, rif, fecha, notas, items } = parsed.data

  const itemsLimpios = items.map((it) => ({
    descripcion: it.descripcion.trim(),
    cantidad: it.cantidad,
    precio_unitario: it.precio_unitario,
    importe: Math.round(it.cantidad * it.precio_unitario * 100) / 100,
    producto_id: it.producto_id ?? null,
  }))
  const subtotal = Math.round(itemsLimpios.reduce((s, i) => s + i.importe, 0) * 100) / 100

  // Número FT-XXX
  const { data: last } = await supabaseAdmin()
    .from('facturas_traslado')
    .select('numero')
    .order('id', { ascending: false })
    .limit(1)
  let seq = 1
  if (last && last.length > 0) {
    const m = last[0].numero.match(/(\d+)$/)
    if (m) seq = parseInt(m[1], 10) + 1
  }
  const numero = `FT-${String(seq).padStart(3, '0')}`

  const { data: factura, error: errFac } = await supabaseAdmin()
    .from('facturas_traslado')
    .insert({
      numero,
      destinatario: destinatario.trim(),
      direccion: direccion.trim(),
      rif: rif.trim(),
      fecha: fecha || new Date().toISOString().slice(0, 10),
      subtotal,
      total: subtotal,
      notas: notas.trim(),
      usuario_id: session.userId,
    })
    .select('id, numero')
    .single()
  if (errFac) return apiError(500, 'DB_ERROR', { detail: errFac.message })

  const { error: errItems } = await supabaseAdmin()
    .from('facturas_traslado_items')
    .insert(itemsLimpios.map((i) => ({ ...i, factura_id: factura.id })))
  if (errItems) return apiError(500, 'DB_ERROR', { detail: errItems.message })

  return json({ id: factura.id, numero: factura.numero, subtotal, total: subtotal }, 201)
})

get('/facturas-traslado/:id', async ({ params }) => {
  const id = Number(params.id)
  if (!Number.isFinite(id)) return apiError(400, 'BAD_REQUEST')
  const { data: factura, error } = await supabaseAdmin()
    .from('facturas_traslado')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !factura) return apiError(404, 'NOT_FOUND')
  const { data: items } = await supabaseAdmin()
    .from('facturas_traslado_items')
    .select('id, producto_id, descripcion, cantidad, precio_unitario, importe')
    .eq('factura_id', id)
    .order('id')
  return json({ factura, items: items || [] })
})

del('/facturas-traslado/:id', async ({ params, session }) => {
  if (session.rol !== 'admin') return apiError(403, 'FORBIDDEN')
  const id = Number(params.id)
  if (!Number.isFinite(id)) return apiError(400, 'BAD_REQUEST')
  const { error } = await supabaseAdmin().from('facturas_traslado').delete().eq('id', id)
  if (error) return apiError(500, 'DB_ERROR', { detail: error.message })
  return json({ ok: true })
})

import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, del, get, json, notFound, post, put, VALIDATION } from '../router'

const schemaIngrediente = z.object({
  nombre: z.string().min(1),
  unidad: z.string().optional().default('kg'),
  stock_actual: z.number().nonnegative().optional().default(0),
  stock_minimo: z.number().nonnegative().optional().default(0),
  precio_unitario: z.number().nonnegative().optional().default(0),
})

get(
  '/ingredientes',
  async () => {
    const { data, error } = await supabaseAdmin()
      .from('ingredientes')
      .select('*')
      .eq('activo', true)
      .order('nombre', { ascending: true })
    if (error) throw new Error(error.message)
    return json({ ingredientes: data ?? [] })
  },
  { roles: ['admin', 'encargado'] },
)

post(
  '/ingredientes',
  async ({ body }) => {
    const parsed = schemaIngrediente.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('ingredientes')
      .insert({
        nombre: parsed.data.nombre,
        unidad: parsed.data.unidad,
        stock_actual: parsed.data.stock_actual,
        stock_minimo: parsed.data.stock_minimo,
        precio_unitario: parsed.data.precio_unitario,
      })
      .select('id')
      .single()

    if (error) return apiError(500, 'DB_ERROR')
    return json({ id: data.id })
  },
  { roles: ['admin'] },
)

put(
  '/ingredientes/:id',
  async ({ params, body }) => {
    const id = Number(params.id)
    const parsed = schemaIngrediente.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('ingredientes')
      .update({
        nombre: parsed.data.nombre,
        unidad: parsed.data.unidad,
        stock_actual: parsed.data.stock_actual,
        stock_minimo: parsed.data.stock_minimo,
        precio_unitario: parsed.data.precio_unitario,
      })
      .eq('id', id)
      .select('id')

    if (error) return apiError(500, 'DB_ERROR')
    return json({ updated: data?.length ?? 0 })
  },
  { roles: ['admin'] },
)

del(
  '/ingredientes/:id',
  async ({ params }) => {
    const { data, error } = await supabaseAdmin()
      .from('ingredientes')
      .update({ activo: false })
      .eq('id', Number(params.id))
      .select('id')
    if (error) throw new Error(error.message)
    return json({ deleted: data?.length ?? 0 })
  },
  { roles: ['admin'] },
)

put(
  '/ingredientes/:id/stock',
  async ({ params, body }) => {
    const id = Number(params.id)
    const schema = z.object({
      cantidad: z.number(),
      notas: z.string().optional().default(''),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const db = supabaseAdmin()
    const { data: ing, error: ingError } = await db.from('ingredientes').select('*').eq('id', id).maybeSingle()
    if (ingError) throw new Error(ingError.message)
    if (!ing) return notFound()

    const nuevoStock = Number((ing.stock_actual + parsed.data.cantidad).toFixed(3))
    if (nuevoStock < 0) return apiError(400, 'INSUFFICIENT_STOCK')

    const { error } = await db.from('ingredientes').update({ stock_actual: nuevoStock }).eq('id', id)
    if (error) throw new Error(error.message)
    return json({ stock_actual: nuevoStock })
  },
  { roles: ['admin', 'encargado'] },
)

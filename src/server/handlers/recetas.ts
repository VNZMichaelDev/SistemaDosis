import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { get, json, put, VALIDATION } from '../router'

get(
  '/recetas/:productoId',
  async ({ params }) => {
    const productoId = Number(params.productoId)
    const { data, error } = await supabaseAdmin()
      .from('receta_ingredientes')
      .select('*, ingredientes(nombre, unidad, stock_actual)')
      .eq('producto_id', productoId)
    if (error) throw new Error(error.message)

    const receta = (data ?? [])
      .map((r: any) => {
        const { ingredientes, ...rest } = r
        return {
          ...rest,
          ingrediente_nombre: ingredientes?.nombre ?? null,
          ingrediente_unidad: ingredientes?.unidad ?? null,
          stock_actual: ingredientes?.stock_actual ?? 0,
        }
      })
      .sort((a, b) => (a.ingrediente_nombre < b.ingrediente_nombre ? -1 : a.ingrediente_nombre > b.ingrediente_nombre ? 1 : 0))

    return json({ receta })
  },
  { roles: ['admin', 'encargado'] },
)

put(
  '/recetas/:productoId',
  async ({ params, body }) => {
    const productoId = Number(params.productoId)
    const schema = z.object({
      ingredientes: z.array(
        z.object({
          ingrediente_id: z.number().int().positive(),
          cantidad: z.number().nonnegative(),
        }),
      ),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { error } = await supabaseAdmin().rpc('replace_receta', {
      p_producto_id: productoId,
      p_items: parsed.data.ingredientes,
    })
    if (error) throw new Error(error.message)

    return json({ ok: true })
  },
  { roles: ['admin'] },
)

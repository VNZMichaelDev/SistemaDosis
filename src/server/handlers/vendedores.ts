import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, conflict, del, get, json, post, put, VALIDATION } from '../router'

const schemaVendedor = z.object({
  nombre: z.string().min(1),
  cedula: z.string().min(1),
  comision_porcentaje: z.number().nonnegative().optional().default(0),
  usuario_id: z.number().int().positive().nullable().optional(),
})

const MSG_ASIGNADO = 'Este usuario ya está asignado a otro vendedor'

get(
  '/vendedores',
  async () => {
    const { data, error } = await supabaseAdmin()
      .from('vendedores')
      .select('*, usuarios(usuario)')
      .eq('activo', true)
      .order('nombre', { ascending: true })
    if (error) throw new Error(error.message)

    const vendedores = (data ?? []).map((v: any) => {
      const { usuarios, ...rest } = v
      return { ...rest, usuario_nombre: usuarios?.usuario ?? null }
    })
    return json({ vendedores })
  },
  { roles: ['admin', 'encargado'] },
)

// Cualquier rol autenticado puede consultar su propio vendedor
get('/vendedores/lookup', async ({ session }) => {
  const { data, error } = await supabaseAdmin()
    .from('vendedores')
    .select('id, nombre, cedula')
    .eq('usuario_id', session.userId)
    .eq('activo', true)
    .limit(1)
  if (error) throw new Error(error.message)
  return json({ vendedor: data?.[0] ?? null })
})

post(
  '/vendedores',
  async ({ body }) => {
    const parsed = schemaVendedor.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const db = supabaseAdmin()

    if (parsed.data.usuario_id) {
      const { data: existing } = await db
        .from('vendedores')
        .select('id')
        .eq('usuario_id', parsed.data.usuario_id)
        .eq('activo', true)
        .limit(1)
      if (existing && existing.length > 0) return apiError(409, 'USUARIO_YA_ASIGNADO', { message: MSG_ASIGNADO })
    }

    const { data, error } = await db
      .from('vendedores')
      .insert({
        nombre: parsed.data.nombre,
        cedula: parsed.data.cedula,
        comision_porcentaje: parsed.data.comision_porcentaje,
        usuario_id: parsed.data.usuario_id ?? null,
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') return conflict('VENDEDOR_EXISTS')
      return apiError(500, 'DB_ERROR')
    }
    return json({ id: data.id })
  },
  { roles: ['admin'] },
)

put(
  '/vendedores/:id',
  async ({ params, body }) => {
    const id = Number(params.id)
    const parsed = schemaVendedor.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const db = supabaseAdmin()

    if (parsed.data.usuario_id) {
      const { data: existing } = await db
        .from('vendedores')
        .select('id')
        .eq('usuario_id', parsed.data.usuario_id)
        .eq('activo', true)
        .neq('id', id)
        .limit(1)
      if (existing && existing.length > 0) return apiError(409, 'USUARIO_YA_ASIGNADO', { message: MSG_ASIGNADO })
    }

    const { data, error } = await db
      .from('vendedores')
      .update({
        nombre: parsed.data.nombre,
        cedula: parsed.data.cedula,
        comision_porcentaje: parsed.data.comision_porcentaje,
        usuario_id: parsed.data.usuario_id ?? null,
      })
      .eq('id', id)
      .select('id')

    if (error) {
      if (error.code === '23505') return conflict('VENDEDOR_EXISTS')
      return apiError(500, 'DB_ERROR')
    }
    return json({ updated: data?.length ?? 0 })
  },
  { roles: ['admin'] },
)

del(
  '/vendedores/:id',
  async ({ params }) => {
    const { data, error } = await supabaseAdmin()
      .from('vendedores')
      .update({ activo: false })
      .eq('id', Number(params.id))
      .select('id')
    if (error) throw new Error(error.message)
    return json({ deleted: data?.length ?? 0 })
  },
  { roles: ['admin'] },
)

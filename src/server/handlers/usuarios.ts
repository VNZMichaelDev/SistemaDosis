import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { conflict, del, get, json, notFound, put, VALIDATION, post } from '../router'

const ROLES = z.enum(['admin', 'empleado', 'encargado', 'mesero', 'cocina'])

function cleanUser(u: any) {
  return {
    id: u.id,
    usuario: u.usuario,
    rol: u.rol,
    departamentos_precios: u.departamentos_precios || [],
  }
}

get(
  '/usuarios',
  async () => {
    const { data } = await supabaseAdmin().from('usuarios').select('id, usuario, rol, departamentos_precios').order('id', { ascending: false })
    return json({ users: (data ?? []).map(cleanUser) })
  },
  { roles: ['admin'] },
)

post(
  '/usuarios',
  async ({ body }) => {
    const schema = z.object({
      usuario: z.string().min(3),
      password: z.string().min(4),
      rol: ROLES,
      departamentos_precios: z.array(z.number()).optional(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const hash = await bcrypt.hash(parsed.data.password, 10)
    const { data, error } = await supabaseAdmin()
      .from('usuarios')
      .insert({
        usuario: parsed.data.usuario,
        password: hash,
        rol: parsed.data.rol,
        departamentos_precios: parsed.data.departamentos_precios ?? [],
      })
      .select('id')
      .single()

    if (error) {
      if (error.code === '23505') return conflict('USER_EXISTS')
      throw new Error(error.message)
    }
    return json({ id: data.id })
  },
  { roles: ['admin'] },
)

put(
  '/usuarios/:id',
  async ({ params, body }) => {
    const id = Number(params.id)
    const schema = z.object({
      rol: ROLES.optional(),
      password: z.string().min(4).optional(),
      departamentos_precios: z.array(z.number()).optional(),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const db = supabaseAdmin()
    const { data: user } = await db.from('usuarios').select('id, rol').eq('id', id).maybeSingle()
    if (!user) return notFound()

    if (parsed.data.rol && user.rol === 'admin' && parsed.data.rol !== 'admin') {
      const { count } = await db.from('usuarios').select('*', { count: 'exact', head: true }).eq('rol', 'admin')
      if ((count ?? 0) <= 1) return conflict('LAST_ADMIN')
    }

    const update: Record<string, unknown> = { rol: parsed.data.rol ?? user.rol }
    if (parsed.data.departamentos_precios !== undefined) update.departamentos_precios = parsed.data.departamentos_precios
    if (parsed.data.password) update.password = await bcrypt.hash(parsed.data.password, 10)

    const { error } = await db.from('usuarios').update(update).eq('id', id)
    if (error) throw new Error(error.message)
    return json({ ok: true })
  },
  { roles: ['admin'] },
)

del(
  '/usuarios/:id',
  async ({ params, session }) => {
    const id = Number(params.id)
    if (id === session.userId) return conflict('CANNOT_DELETE_SELF')

    const db = supabaseAdmin()
    const { data: user } = await db.from('usuarios').select('id, rol').eq('id', id).maybeSingle()
    if (!user) return notFound()

    if (user.rol === 'admin') {
      const { count } = await db.from('usuarios').select('*', { count: 'exact', head: true }).eq('rol', 'admin')
      if ((count ?? 0) <= 1) return conflict('LAST_ADMIN')
    }

    const { error } = await db.from('usuarios').delete().eq('id', id)
    if (error) {
      // Tiene ventas/pedidos/vendedores asociados: no se puede borrar (antes rompía las FK)
      if (error.code === '23503') return conflict('USER_HAS_DATA')
      throw new Error(error.message)
    }
    return json({ deleted: 1 })
  },
  { roles: ['admin'] },
)

// ============ CONFIG ============

get('/config', async () => {
  const { data } = await supabaseAdmin().from('configuracion').select('id, tasa_cambio').eq('id', 1).maybeSingle()
  return json({ config: data })
})

put(
  '/config',
  async ({ body }) => {
    const schema = z.object({ tasa_cambio: z.number().positive() })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()
    const { error } = await supabaseAdmin().from('configuracion').update({ tasa_cambio: parsed.data.tasa_cambio }).eq('id', 1)
    if (error) throw new Error(error.message)
    return json({ ok: true })
  },
  // endurecido: en el sistema original cualquier rol autenticado podía cambiar la tasa
  { roles: ['admin', 'encargado'] },
)

// ============ MESAS ============

get('/mesas', async () => {
  const { data } = await supabaseAdmin().from('mesas').select('*').eq('activo', true).order('nombre', { ascending: true })
  return json({ mesas: data ?? [] })
})

post(
  '/mesas',
  async ({ body }) => {
    const schema = z.object({ nombre: z.string().min(1) })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()
    const { data, error } = await supabaseAdmin().from('mesas').insert({ nombre: parsed.data.nombre.trim() }).select('id').single()
    if (error) {
      if (error.code === '23505') return conflict('MESA_EXISTS')
      throw new Error(error.message)
    }
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

del(
  '/mesas/:id',
  async ({ params }) => {
    const { error } = await supabaseAdmin().from('mesas').update({ activo: false }).eq('id', Number(params.id))
    if (error) throw new Error(error.message)
    return json({ ok: true })
  },
  { roles: ['admin', 'encargado'] },
)

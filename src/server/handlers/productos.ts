import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, conflict, del, get, json, notFound, post, put, VALIDATION } from '../router'

const PRODUCT_SELECT = '*, departamentos(nombre), productos_codigos(count)'

/** Envuelve un valor entre comillas para el árbol lógico de PostgREST (caract. reservados: , . : ()). */
function lit(value: string): string {
  return `"${value.replace(/"/g, '')}"`
}

/** Escapa comodines de LIKE para igualdad exacta case-insensitive (equivale a LOWER(x) = ?). */
function exact(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** departamentos_precios es jsonb: ya viene como array. */
function deptosDe(user: any): number[] {
  const arr = user?.departamentos_precios
  if (!Array.isArray(arr)) return []
  return arr.map((n: unknown) => Number(n)).filter((n: number) => Number.isFinite(n))
}

function withDepartamento(row: any) {
  const { departamentos, ...rest } = row ?? {}
  return { ...rest, departamento_nombre: departamentos?.nombre ?? null }
}

function mapProducto(row: any) {
  const { departamentos, productos_codigos, ...rest } = row ?? {}
  return {
    ...rest,
    departamento_nombre: departamentos?.nombre ?? null,
    codigos_alternos: Number(productos_codigos?.[0]?.count ?? 0),
  }
}

// ============ DEPARTAMENTOS ============

get('/departamentos', async () => {
  const { data, error } = await supabaseAdmin()
    .from('departamentos')
    .select('*, productos(id)')
    .order('nombre', { ascending: true })
  if (error) throw new Error(error.message)

  const departamentos = (data ?? []).map((d: any) => {
    const { productos, ...rest } = d
    return { ...rest, total_productos: (productos ?? []).length }
  })
  return json({ departamentos })
})

post(
  '/departamentos',
  async ({ body }) => {
    const schema = z.object({ nombre: z.string().min(1), descripcion: z.string().optional().default('') })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('departamentos')
      .insert({ nombre: parsed.data.nombre.trim(), descripcion: parsed.data.descripcion.trim() })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') return conflict('DEPARTAMENTO_EXISTS')
      throw new Error(error.message)
    }
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

put(
  '/departamentos/:id',
  async ({ params, body }) => {
    const id = Number(params.id)
    const schema = z.object({ nombre: z.string().min(1), descripcion: z.string().optional().default('') })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { error } = await supabaseAdmin()
      .from('departamentos')
      .update({ nombre: parsed.data.nombre.trim(), descripcion: parsed.data.descripcion.trim() })
      .eq('id', id)
    if (error) {
      if (error.code === '23505') return conflict('DEPARTAMENTO_EXISTS')
      throw new Error(error.message)
    }
    return json({ ok: true })
  },
  { roles: ['admin', 'encargado'] },
)

del(
  '/departamentos/:id',
  async ({ params }) => {
    const id = Number(params.id)
    const db = supabaseAdmin()

    const { error: e1 } = await db.from('productos').update({ departamento_id: null }).eq('departamento_id', id)
    if (e1) return apiError(400, 'CANNOT_DELETE')

    const { data, error } = await db.from('departamentos').delete().eq('id', id).select('id')
    if (error) return apiError(400, 'CANNOT_DELETE')

    return json({ deleted: (data ?? []).length })
  },
  { roles: ['admin', 'encargado'] },
)

// ============ PRODUCTOS: PERMISO DE PRECIO ============

get('/productos/permiso', async ({ query, session }) => {
  const search = (query.get('search') || '').trim()
  const db = supabaseAdmin()

  const { data: user, error } = await db.from('usuarios').select('departamentos_precios').eq('id', session.userId).maybeSingle()
  if (error) throw new Error(error.message)

  const deptos = deptosDe(user)
  if (deptos.length === 0) return json({ productos: [] })

  let q = db.from('productos').select('id, codigo, nombre, precio_usd, tipo, departamento_id').in('departamento_id', deptos)
  if (search) {
    const term = lit(`%${search}%`)
    q = q.or(`nombre.ilike.${term},codigo.ilike.${term}`)
  }

  const { data, error: e2 } = await q.order('nombre', { ascending: true })
  if (e2) throw new Error(e2.message)
  return json({ productos: data ?? [] })
})

put('/productos/:id/precio', async ({ params, body, session }) => {
  const id = Number(params.id)
  const schema = z.object({ precio_usd: z.number().positive() })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return VALIDATION()

  const db = supabaseAdmin()

  const { data: user, error: e1 } = await db.from('usuarios').select('departamentos_precios').eq('id', session.userId).maybeSingle()
  if (e1) throw new Error(e1.message)
  const deptos = deptosDe(user)
  if (deptos.length === 0) return apiError(403, 'FORBIDDEN')

  const { data: prod, error: e2 } = await db.from('productos').select('id, departamento_id').eq('id', id).maybeSingle()
  if (e2) throw new Error(e2.message)
  if (!prod) return notFound()
  if (!prod.departamento_id || !deptos.includes(Number(prod.departamento_id))) return apiError(403, 'FORBIDDEN')

  const { error } = await db.from('productos').update({ precio_usd: parsed.data.precio_usd }).eq('id', id)
  if (error) throw new Error(error.message)
  return json({ ok: true })
})

// ============ PRODUCTOS: IMPORTACIÓN ============

post(
  '/productos/import',
  async ({ body }) => {
    const schema = z.object({
      products: z
        .array(
          z.object({
            codigo: z.string().min(1),
            nombre: z.string().min(1),
            precio_usd: z.number().nonnegative(),
            tipo: z.enum(['unidad', 'peso', 'variable']),
          }),
        )
        .min(1),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const rows = parsed.data.products.map((p) => ({
      codigo: p.codigo,
      nombre: p.nombre,
      precio_usd: p.precio_usd,
      tipo: p.tipo,
    }))

    // INSERT OR IGNORE → upsert ignoreDuplicates sobre el unique de codigo (una sola sentencia, atómica)
    const { data, error } = await supabaseAdmin()
      .from('productos')
      .upsert(rows, { onConflict: 'codigo', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(error.message)

    const inserted = (data ?? []).length
    return json({ ok: true, inserted, skipped: rows.length - inserted })
  },
  { roles: ['admin', 'encargado'] },
)

// ============ PRODUCTOS ============

get('/productos/lookup', async ({ query }) => {
  const codigo = (query.get('codigo') || '').trim().toLowerCase()
  if (!codigo) return json({ product: null })

  const db = supabaseAdmin()
  const pat = exact(codigo)

  const { data: direct, error: e1 } = await db.from('productos').select('*, departamentos(nombre)').ilike('codigo', pat).limit(1)
  if (e1) throw new Error(e1.message)
  if (direct && direct.length > 0) return json({ product: withDepartamento(direct[0]) })

  const { data: alt, error: e2 } = await db
    .from('productos_codigos')
    .select('producto_id, productos(*, departamentos(nombre))')
    .ilike('codigo', pat)
    .limit(1)
  if (e2) throw new Error(e2.message)
  if (alt && alt.length > 0 && alt[0].productos) return json({ product: withDepartamento(alt[0].productos) })

  const { data: byName, error: e3 } = await db.from('productos').select('*, departamentos(nombre)').ilike('nombre', pat).limit(1)
  if (e3) throw new Error(e3.message)
  return json({ product: byName && byName.length > 0 ? withDepartamento(byName[0]) : null })
})

get('/productos', async ({ query }) => {
  const db = supabaseAdmin()
  const q = (query.get('q') || '').trim()
  const departamentoId = (query.get('departamento_id') || '').trim()
  const hasPage = query.get('page') !== null
  const page = Math.max(1, Number(query.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.get('limit')) || 20))
  const offset = (page - 1) * limit

  let rows: any[] = []
  let totalCount = 0

  if (q) {
    // codigo LIKE / nombre LIKE / EXISTS en productos_codigos (dos ramas unidas por id)
    const term = lit(`%${q}%`)
    let a = db.from('productos').select(PRODUCT_SELECT).or(`codigo.ilike.${term},nombre.ilike.${term}`)
    if (departamentoId) a = a.eq('departamento_id', Number(departamentoId))
    const { data: rowsA, error: e1 } = await a
    if (e1) throw new Error(e1.message)

    const { data: alt, error: e2 } = await db.from('productos_codigos').select('producto_id').ilike('codigo', `%${q}%`)
    if (e2) throw new Error(e2.message)
    const altIds = [...new Set((alt ?? []).map((r: any) => Number(r.producto_id)))]

    const merged = new Map<number, any>()
    for (const r of rowsA ?? []) merged.set(Number(r.id), r)
    if (altIds.length > 0) {
      let b = db.from('productos').select(PRODUCT_SELECT).in('id', altIds)
      if (departamentoId) b = b.eq('departamento_id', Number(departamentoId))
      const { data: rowsB, error: e3 } = await b
      if (e3) throw new Error(e3.message)
      for (const r of rowsB ?? []) merged.set(Number(r.id), r)
    }

    rows = [...merged.values()].sort((x, y) => String(x.nombre).localeCompare(String(y.nombre)))
    totalCount = rows.length
  } else {
    let countQ = db.from('productos').select('id', { count: 'exact', head: true })
    if (departamentoId) countQ = countQ.eq('departamento_id', Number(departamentoId))

    let dataQ = db.from('productos').select(PRODUCT_SELECT)
    if (departamentoId) dataQ = dataQ.eq('departamento_id', Number(departamentoId))
    let listQ = dataQ.order('nombre', { ascending: true })

    if (hasPage) {
      const { count, error: e1 } = await countQ
      if (e1) throw new Error(e1.message)
      totalCount = count ?? 0
      listQ = listQ.range(offset, offset + limit - 1)
    }

    const { data, error } = await listQ
    if (error) throw new Error(error.message)
    rows = data ?? []
  }

  if (hasPage) {
    if (q) rows = rows.slice(offset, offset + limit)
    const totalPages = Math.ceil(totalCount / limit) || 1
    return json({ products: rows.map(mapProducto), totalCount, totalPages, page })
  }

  return json({ products: rows.map(mapProducto) })
})

post(
  '/productos',
  async ({ body }) => {
    const schema = z.object({
      codigo: z.string().min(1),
      nombre: z.string().min(1),
      precio_usd: z.number().nonnegative(),
      precio_costo: z.number().nonnegative().optional().default(0),
      margen_ganancia: z.number().nonnegative().optional().default(0),
      tipo: z.enum(['peso', 'unidad', 'variable']),
      departamento_id: z.number().int().positive().nullable().optional(),
      es_receta: z.boolean().optional().default(false),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('productos')
      .insert({
        codigo: parsed.data.codigo,
        nombre: parsed.data.nombre,
        precio_usd: parsed.data.precio_usd,
        precio_costo: parsed.data.precio_costo ?? 0,
        margen_ganancia: parsed.data.margen_ganancia ?? 0,
        tipo: parsed.data.tipo,
        departamento_id: parsed.data.departamento_id ?? null,
        es_receta: parsed.data.es_receta ?? false,
      })
      .select('id')
      .single()
    if (error) {
      if (error.code === '23505') return conflict('PRODUCT_EXISTS')
      throw new Error(error.message)
    }
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

put(
  '/productos/:id',
  async ({ params, body }) => {
    const id = Number(params.id)
    const schema = z.object({
      codigo: z.string().min(1),
      nombre: z.string().min(1),
      precio_usd: z.number().nonnegative(),
      precio_costo: z.number().nonnegative().optional().default(0),
      margen_ganancia: z.number().nonnegative().optional().default(0),
      tipo: z.enum(['peso', 'unidad', 'variable']),
      departamento_id: z.number().int().positive().nullable().optional(),
      es_receta: z.boolean().optional().default(false),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('productos')
      .update({
        codigo: parsed.data.codigo,
        nombre: parsed.data.nombre,
        precio_usd: parsed.data.precio_usd,
        precio_costo: parsed.data.precio_costo ?? 0,
        margen_ganancia: parsed.data.margen_ganancia ?? 0,
        tipo: parsed.data.tipo,
        departamento_id: parsed.data.departamento_id ?? null,
        es_receta: parsed.data.es_receta ?? false,
      })
      .eq('id', id)
      .select('id')
    if (error) throw new Error(error.message)
    return json({ updated: (data ?? []).length })
  },
  { roles: ['admin', 'encargado'] },
)

del(
  '/productos/:id',
  async ({ params }) => {
    const id = Number(params.id)
    const { data, error } = await supabaseAdmin().from('productos').delete().eq('id', id).select('id')
    if (error) {
      if (error.code === '23503') {
        return apiError(400, 'PRODUCT_HAS_SALES', {
          message: 'No se puede eliminar el producto porque tiene ventas registradas',
        })
      }
      throw new Error(error.message)
    }
    return json({ deleted: (data ?? []).length })
  },
  { roles: ['admin'] },
)

// ============ CÓDIGOS ALTERNOS ============

get('/productos/:id/codigos', async ({ params }) => {
  const id = Number(params.id)
  const { data, error } = await supabaseAdmin()
    .from('productos_codigos')
    .select('id, codigo')
    .eq('producto_id', id)
    .order('codigo', { ascending: true })
  if (error) throw new Error(error.message)
  return json({ codigos: data ?? [] })
})

post(
  '/productos/:id/codigos',
  async ({ params, body }) => {
    const id = Number(params.id)
    const schema = z.object({ codigo: z.string().min(1) })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const db = supabaseAdmin()
    const { data: prod, error: e1 } = await db.from('productos').select('id').eq('id', id).maybeSingle()
    if (e1) throw new Error(e1.message)
    if (!prod) return notFound()

    const code = parsed.data.codigo.trim()

    const { data: existingMain, error: e2 } = await db.from('productos').select('id').eq('codigo', code).neq('id', id).maybeSingle()
    if (e2) throw new Error(e2.message)
    if (existingMain) return conflict('CODIGO_EXISTS')

    const { data, error } = await db.from('productos_codigos').insert({ producto_id: id, codigo: code }).select('id').single()
    if (error) {
      if (error.code === '23505') return conflict('CODIGO_EXISTS')
      throw new Error(error.message)
    }
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

del(
  '/productos/:id/codigos/:codigoId',
  async ({ params }) => {
    const codigoId = Number(params.codigoId)
    const { data, error } = await supabaseAdmin()
      .from('productos_codigos')
      .delete()
      .eq('id', codigoId)
      .eq('producto_id', Number(params.id))
      .select('id')
    if (error) throw new Error(error.message)
    return json({ deleted: (data ?? []).length })
  },
  { roles: ['admin', 'encargado'] },
)

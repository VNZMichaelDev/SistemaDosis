import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, del, get, json, notFound, post, put, VALIDATION } from '../router'

const schemaProveedor = z.object({
  nombre: z.string().min(1),
  contacto: z.string().optional().default(''),
  telefono: z.string().optional().default(''),
  direccion: z.string().optional().default(''),
  notas: z.string().optional().default(''),
})

const schemaFactura = z.object({
  numero_factura: z.string().optional().default(''),
  monto_total: z.number().nonnegative(),
  descripcion: z.string().optional().default(''),
})

// ==================== PROVEEDORES ====================

get(
  '/proveedores',
  async () => {
    const { data, error } = await supabaseAdmin().from('proveedores').select('*').eq('activo', true).order('nombre')
    if (error) throw new Error(error.message)
    return json({ proveedores: data ?? [] })
  },
  { roles: ['admin', 'encargado'] },
)

post(
  '/proveedores',
  async ({ body }) => {
    const parsed = schemaProveedor.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('proveedores')
      .insert({
        nombre: parsed.data.nombre,
        contacto: parsed.data.contacto,
        telefono: parsed.data.telefono,
        direccion: parsed.data.direccion,
        notas: parsed.data.notas,
      })
      .select('id')
      .single()
    if (error) return apiError(500, 'DB_ERROR')
    return json({ id: data.id })
  },
  { roles: ['admin'] },
)

put(
  '/proveedores/:id',
  async ({ params, body }) => {
    const id = Number(params.id)
    const parsed = schemaProveedor.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('proveedores')
      .update({
        nombre: parsed.data.nombre,
        contacto: parsed.data.contacto,
        telefono: parsed.data.telefono,
        direccion: parsed.data.direccion,
        notas: parsed.data.notas,
      })
      .eq('id', id)
      .select('id')
    if (error) throw new Error(error.message)
    return json({ updated: (data ?? []).length })
  },
  { roles: ['admin'] },
)

del(
  '/proveedores/:id',
  async ({ params }) => {
    const id = Number(params.id)
    const { data, error } = await supabaseAdmin().from('proveedores').update({ activo: false }).eq('id', id).select('id')
    if (error) throw new Error(error.message)
    return json({ deleted: (data ?? []).length })
  },
  { roles: ['admin'] },
)

// ==================== FACTURAS PROVEEDOR ====================

get(
  '/proveedores/:id/facturas',
  async ({ params }) => {
    const proveedorId = Number(params.id)
    const { data, error } = await supabaseAdmin()
      .from('facturas_proveedor')
      .select('*, pagos_proveedor(monto)')
      .eq('proveedor_id', proveedorId)
      .order('fecha_registro', { ascending: false })
    if (error) throw new Error(error.message)

    const facturas = (data ?? []).map((fp: any) => {
      const montoPagado = (fp.pagos_proveedor ?? []).reduce((s: number, pg: any) => s + (Number(pg.monto) || 0), 0)
      const rest = { ...fp }
      delete rest.pagos_proveedor
      return { ...rest, monto_pagado: montoPagado, saldo_pendiente: (Number(fp.monto_total) || 0) - montoPagado }
    })
    return json({ facturas })
  },
  { roles: ['admin', 'encargado'] },
)

post(
  '/proveedores/:id/facturas',
  async ({ params, body }) => {
    const proveedorId = Number(params.id)
    const parsed = schemaFactura.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('facturas_proveedor')
      .insert({
        proveedor_id: proveedorId,
        numero_factura: parsed.data.numero_factura,
        monto_total: parsed.data.monto_total,
        descripcion: parsed.data.descripcion,
      })
      .select('id')
      .single()
    if (error) return apiError(500, 'DB_ERROR')
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

put(
  '/proveedores/facturas/:id',
  async ({ params, body }) => {
    const id = Number(params.id)
    const parsed = schemaFactura.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('facturas_proveedor')
      .update({
        numero_factura: parsed.data.numero_factura,
        monto_total: parsed.data.monto_total,
        descripcion: parsed.data.descripcion,
      })
      .eq('id', id)
      .select('id')
    if (error) throw new Error(error.message)
    return json({ updated: (data ?? []).length })
  },
  { roles: ['admin'] },
)

del(
  '/proveedores/facturas/:id',
  async ({ params }) => {
    const id = Number(params.id)
    const { data, error } = await supabaseAdmin().from('facturas_proveedor').delete().eq('id', id).select('id')
    if (error) throw new Error(error.message)
    return json({ deleted: (data ?? []).length })
  },
  { roles: ['admin'] },
)

// ==================== PAGOS A PROVEEDOR ====================

post(
  '/proveedores/facturas/:id/pagos',
  async ({ params, body }) => {
    const facturaId = Number(params.id)
    const schema = z.object({
      monto: z.number().positive(),
      notas: z.string().optional().default(''),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const db = supabaseAdmin()
    const { data: factura, error: errFactura } = await db.from('facturas_proveedor').select('*').eq('id', facturaId).maybeSingle()
    if (errFactura) throw new Error(errFactura.message)
    if (!factura) return notFound()

    const { data: pagos, error: errPagos } = await db.from('pagos_proveedor').select('monto').eq('factura_proveedor_id', facturaId)
    if (errPagos) throw new Error(errPagos.message)
    const totalPagado = (pagos ?? []).reduce((s, pg) => s + (Number(pg.monto) || 0), 0)

    if (totalPagado + parsed.data.monto > factura.monto_total + 0.01) {
      return apiError(400, 'EXCEEDS_BALANCE')
    }

    const { data, error } = await db
      .from('pagos_proveedor')
      .insert({ factura_proveedor_id: facturaId, monto: parsed.data.monto, notas: parsed.data.notas })
      .select('id')
      .single()
    if (error) return apiError(500, 'DB_ERROR')
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

get(
  '/proveedores/facturas/:id/pagos',
  async ({ params }) => {
    const facturaId = Number(params.id)
    const { data, error } = await supabaseAdmin().from('pagos_proveedor').select('*').eq('factura_proveedor_id', facturaId).order('fecha_pago', { ascending: false })
    if (error) throw new Error(error.message)
    return json({ pagos: data ?? [] })
  },
  { roles: ['admin', 'encargado'] },
)

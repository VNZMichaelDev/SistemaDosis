import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { broadcast } from '../realtime'
import { apiError, json, post, VALIDATION } from '../router'

const creditoSchema = z.object({
  tipo: z.enum(['nuevo', 'existente']),
  nombre: z.string().optional(),
  cedula: z.string().min(1),
})

const pagoParcialSchema = z.object({
  metodo_pago: z.string().min(1),
  monto_usd: z.number().nonnegative(),
  referencia: z.string().optional().default(''),
})

const schema = z.object({
  pedido_id: z.number().int().positive().nullable().optional(),
  total_usd: z.number().nonnegative(),
  total_bs: z.number().nonnegative(),
  metodo_pago: z.string().min(1).default('Efectivo USD'),
  referencia: z.string().optional().default(''),
  credito: creditoSchema.optional(),
  pagos: z.array(pagoParcialSchema).optional(),
  items: z
    .array(
      z.object({
        producto_id: z.number().int().positive(),
        cantidad: z.number().positive(),
        precio_usd: z.number().nonnegative(),
        subtotal: z.number().nonnegative(),
      }),
    )
    .min(1),
})

post('/ventas', async ({ body, session }) => {
  const parsed = schema.safeParse(body)
  if (!parsed.success) return VALIDATION()

  const isCredito = parsed.data.metodo_pago === 'Credito'
  const isMultipago = parsed.data.metodo_pago === 'Multipago'
  const creditoData = parsed.data.credito
  if (isCredito && !creditoData) return apiError(400, 'CREDITO_REQUIRED')

  if (isMultipago) {
    const pagos = parsed.data.pagos
    if (!pagos || pagos.length === 0) return apiError(400, 'MULTIPAGO_REQUIRED')
    const sumaPagos = pagos.reduce((acc, p) => acc + p.monto_usd, 0)
    if (Math.abs(sumaPagos - parsed.data.total_usd) > 0.01) {
      return apiError(400, 'MULTIPAGO_MISMATCH', {
        message: `La suma de los pagos (${sumaPagos.toFixed(2)}) no coincide con el total (${parsed.data.total_usd.toFixed(2)})`,
      })
    }
  }

  const db = supabaseAdmin()

  // ---- Resolver cliente de crédito ----
  let clienteId: number | null = null
  if (isCredito && creditoData) {
    const cedula = creditoData.cedula.trim()
    if (creditoData.tipo === 'nuevo') {
      if (!creditoData.nombre || creditoData.nombre.trim().length === 0) {
        return apiError(400, 'CREDITO_NOMBRE_REQUIRED')
      }
      const { data: nuevo, error } = await db
        .from('clientes_credito')
        .insert({ nombre: creditoData.nombre.trim(), cedula, deuda_total: 0 })
        .select('id')
        .single()
      if (error) {
        if (error.code !== '23505') throw new Error(error.message)
        const { data: existing } = await db.from('clientes_credito').select('id').eq('cedula', cedula).maybeSingle()
        if (!existing) return apiError(409, 'CREDITO_CLIENTE_ERROR')
        clienteId = Number(existing.id)
      } else {
        clienteId = Number(nuevo.id)
      }
    } else {
      const { data: existing } = await db.from('clientes_credito').select('id').eq('cedula', cedula).maybeSingle()
      if (!existing) return apiError(404, 'CREDITO_CLIENTE_NOT_FOUND')
      clienteId = Number(existing.id)
    }
  }

  // ---- Verificar que el pedido no esté cancelado ----
  if (parsed.data.pedido_id) {
    const { data: pedidoParaPago } = await db
      .from('pedidos')
      .select('id, estado, cancelado')
      .eq('id', parsed.data.pedido_id)
      .maybeSingle()
    if (pedidoParaPago?.cancelado) return apiError(409, 'PEDIDO_CANCELADO')
  }

  // ---- Crear venta (transacción RPC) ----
  const ventaRef = parsed.data.metodo_pago === 'Pago Móvil' ? parsed.data.referencia || '' : ''
  const pagada = !isCredito

  const { data: ventaId, error } = await db.rpc('crear_venta', {
    p_total_usd: parsed.data.total_usd,
    p_total_bs: parsed.data.total_bs,
    p_metodo_pago: parsed.data.metodo_pago,
    p_referencia: ventaRef,
    p_pagada: pagada,
    p_usuario_id: session.userId,
    p_pedido_id: parsed.data.pedido_id ?? null,
    p_cliente_id: clienteId,
    p_items: parsed.data.items,
    p_pagos: parsed.data.pagos ?? [],
  })
  if (error) throw new Error(error.message)

  // ---- Notificar tiempo real ----
  if (parsed.data.pedido_id) {
    const { data: rawData } = await db
      .from('pedidos')
      .select('id, estado, cliente, pagado, mesa:mesas(nombre)')
      .eq('id', parsed.data.pedido_id)
      .maybeSingle()
    const info = rawData as any

    if (info?.estado === 'facturado') {
      await broadcast('pedido_actualizado', {
        pedido_id: parsed.data.pedido_id,
        estado: 'facturado',
        mesa_nombre: info.mesa?.nombre ?? null,
        cliente: info.cliente,
      })
    } else {
      await broadcast('pedido_pagado', {
        pedido_id: parsed.data.pedido_id,
        mesa_nombre: info?.mesa?.nombre ?? null,
        cliente: info?.cliente ?? '',
      })
    }
  }

  return json({ id: ventaId })
})

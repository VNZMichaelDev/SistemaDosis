import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, del, get, json, post, VALIDATION } from '../router'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

// ==================== FASE B + C: TEÓRICO VS. REAL E INDICADORES ====================
// GET /consumo?from=&to=
//   - Teórico:  recetas × ventas del período (lo que debió gastarse).
//   - Mermas:   pérdidas anotadas en la bitácora (fase A).
//   - Conteo:   último inventario físico hasta el cierre del período.
//   - Diferencia = stock del sistema − conteo (falta material no registrada).
//   - Real = teórico + mermas + diferencia.
//   - Indicadores: food cost % (meta 28%–35%), compras y ranking de pérdidas.
get(
  '/consumo',
  async ({ query }) => {
    const from = (query.get('from') || '').trim()
    const to = (query.get('to') || '').trim()
    if (!DAY_RE.test(from) || !DAY_RE.test(to) || from > to) return VALIDATION()

    const { data, error } = await supabaseAdmin().rpc('reporte_consumo', { p_from: from, p_to: to })
    if (error) return apiError(500, 'DB_ERROR', { detail: error.message })

    const rows: any[] = data?.ingredientes ?? []

    const ingredientes = rows.map((r) => {
      const precio = Number(r.precio_unitario || 0)
      const teoricoCant = Number(r.teorico_cant || 0)
      const mermasCant = Number(r.mermas_cant || 0)
      const mermasCosto = Number(r.mermas_costo || 0)
      const tieneConteo = r.conteo_cant !== null && r.conteo_cant !== undefined
      // Faltante positivo = material que el sistema dice tener pero no está contado.
      const dif = tieneConteo ? Number(r.stock_actual) - Number(r.conteo_cant) : null
      const difCosto = dif !== null ? dif * precio : null
      return {
        ingrediente_id: r.ingrediente_id,
        nombre: r.nombre,
        unidad: r.unidad,
        precio_unitario: precio,
        stock_actual: Number(r.stock_actual || 0),
        teorico_cant: teoricoCant,
        teorico_costo: teoricoCant * precio,
        mermas_cant: mermasCant,
        mermas_costo: mermasCosto,
        conteo_cant: tieneConteo ? Number(r.conteo_cant) : null,
        conteo_fecha: r.conteo_fecha ?? null,
        diferencia_cant: dif,
        diferencia_costo: difCosto,
        real_cant: teoricoCant + mermasCant + (dif ?? 0),
      }
    })

    const ventasTotal = Number(data?.ventas_total || 0)
    const comprasTotal = Number(data?.compras_total || 0)
    const costoTeorico = ingredientes.reduce((s, r) => s + r.teorico_costo, 0)
    const mermasCosto = ingredientes.reduce((s, r) => s + r.mermas_costo, 0)
    // Solo se contabiliza como pérdida lo que falta (diferencia positiva).
    const perdidaCosto = ingredientes.reduce(
      (s, r) => s + (r.diferencia_cant !== null && r.diferencia_cant > 0 ? r.diferencia_cant * r.precio_unitario : 0),
      0,
    )
    const sobranteCosto = ingredientes.reduce(
      (s, r) => s + (r.diferencia_cant !== null && r.diferencia_cant < 0 ? -r.diferencia_cant * r.precio_unitario : 0),
      0,
    )
    const costoReal = costoTeorico + mermasCosto + perdidaCosto
    const foodCostPct = ventasTotal > 0 ? (costoReal / ventasTotal) * 100 : null
    const foodCostTeoricoPct = ventasTotal > 0 ? (costoTeorico / ventasTotal) * 100 : null

    const ranking = ingredientes
      .map((r) => ({
        ingrediente_id: r.ingrediente_id,
        nombre: r.nombre,
        unidad: r.unidad,
        perdida_costo: r.mermas_costo + (r.diferencia_cant !== null && r.diferencia_cant > 0 ? r.diferencia_cant * r.precio_unitario : 0),
        mermas_costo: r.mermas_costo,
        no_registrado_costo: r.diferencia_cant !== null && r.diferencia_cant > 0 ? r.diferencia_cant * r.precio_unitario : 0,
      }))
      .filter((r) => r.perdida_costo > 0)
      .sort((a, b) => b.perdida_costo - a.perdida_costo)
      .slice(0, 5)

    return json({
      from,
      to,
      ventas_total: ventasTotal,
      compras_total: comprasTotal,
      costo_teorico: costoTeorico,
      mermas_costo: mermasCosto,
      perdida_costo: perdidaCosto,
      sobrante_costo: sobranteCosto,
      costo_real: costoReal,
      food_cost_pct: foodCostPct,
      food_cost_teorico_pct: foodCostTeoricoPct,
      ingredientes,
      ranking,
    })
  },
  { roles: ['admin', 'encargado'] },
)

// ==================== CONTEO DE INVENTARIO ====================

const schemaConteo = z.object({
  fecha: z.string().regex(DAY_RE),
  notas: z.string().optional().default(''),
  items: z
    .array(
      z.object({
        ingrediente_id: z.number().int().positive(),
        cantidad: z.number().nonnegative(),
      }),
    )
    .min(1),
})

// Guarda el conteo físico (upsert: volver a contar el mismo día reemplaza).
post(
  '/conteos',
  async ({ body, session }) => {
    const parsed = schemaConteo.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const rows = parsed.data.items.map((it) => ({
      fecha: parsed.data.fecha,
      ingrediente_id: it.ingrediente_id,
      cantidad: it.cantidad,
      usuario_id: session.userId,
      notas: parsed.data.notas,
    }))

    const { error } = await supabaseAdmin()
      .from('conteos_inventario')
      .upsert(rows, { onConflict: 'fecha,ingrediente_id' })
    if (error) return apiError(500, 'DB_ERROR', { detail: error.message })

    return json({ guardados: rows.length })
  },
  { roles: ['admin', 'encargado'] },
)

// Conteos de una fecha (para revisar/reeditar).
get(
  '/conteos',
  async ({ query }) => {
    const fecha = (query.get('fecha') || '').trim()
    if (!DAY_RE.test(fecha)) return VALIDATION()

    const { data, error } = await supabaseAdmin()
      .from('conteos_inventario')
      .select('*, ingredientes(nombre, unidad)')
      .eq('fecha', fecha)
      .order('ingrediente_id')
    if (error) return apiError(500, 'DB_ERROR', { detail: error.message })

    const conteos = (data ?? []).map((c: any) => {
      const { ingredientes, ...rest } = c
      return {
        ...rest,
        ingrediente_nombre: ingredientes?.nombre ?? null,
        ingrediente_unidad: ingredientes?.unidad ?? null,
      }
    })
    return json({ conteos })
  },
  { roles: ['admin', 'encargado'] },
)

// Borrar el conteo de una fecha (corrige conteos erróneos).
del(
  '/conteos/:fecha',
  async ({ params }) => {
    if (!DAY_RE.test(params.fecha)) return VALIDATION()
    const { error } = await supabaseAdmin().from('conteos_inventario').delete().eq('fecha', params.fecha)
    if (error) return apiError(500, 'DB_ERROR', { detail: error.message })
    return json({ borrados: true })
  },
  { roles: ['admin'] },
)

import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, del, get, json, post, VALIDATION } from '../router'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export const MERMA_TIPOS = ['operativa', 'financiera'] as const
export const MERMA_MOTIVOS = [
  'merma_natural',
  'error_cocina',
  'vencimiento',
  'cadena_frio',
  'consumo_personal',
  'cortesia',
  'robo',
  'otro',
] as const

/** Tipo fijo de cada motivo; 'otro' puede ser de cualquiera de los dos grupos. */
const MOTIVO_TIPO: Record<string, (typeof MERMA_TIPOS)[number] | null> = {
  merma_natural: 'operativa',
  error_cocina: 'operativa',
  vencimiento: 'operativa',
  cadena_frio: 'operativa',
  consumo_personal: 'financiera',
  cortesia: 'financiera',
  robo: 'financiera',
  otro: null,
}

const schemaMerma = z.object({
  ingrediente_id: z.number().int().positive(),
  cantidad: z.number().positive(),
  tipo: z.enum(MERMA_TIPOS),
  motivo: z.enum(MERMA_MOTIVOS),
  notas: z.string().optional().default(''),
  fecha: z.string().regex(DAY_RE).optional(),
})

// ==================== BITÁCORA ====================

get(
  '/mermas',
  async ({ query }) => {
    const from = (query.get('from') || '').trim()
    const to = (query.get('to') || '').trim()
    const tipo = (query.get('tipo') || '').trim()
    const motivo = (query.get('motivo') || '').trim()
    const ingredienteId = Number(query.get('ingrediente_id') || 0)

    let q = supabaseAdmin()
      .from('mermas')
      .select('*, ingredientes(nombre, unidad), usuarios(usuario)')
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })

    if (from && to && DAY_RE.test(from) && DAY_RE.test(to)) q = q.gte('fecha', from).lte('fecha', to)
    else if (from && DAY_RE.test(from)) q = q.gte('fecha', from)
    else if (to && DAY_RE.test(to)) q = q.lte('fecha', to)
    if (tipo && (MERMA_TIPOS as readonly string[]).includes(tipo)) q = q.eq('tipo', tipo)
    if (motivo && (MERMA_MOTIVOS as readonly string[]).includes(motivo)) q = q.eq('motivo', motivo)
    if (ingredienteId) q = q.eq('ingrediente_id', ingredienteId)

    const { data, error } = await q
    if (error) throw new Error(error.message)

    const mermas = (data ?? []).map((m: any) => {
      const { ingredientes, usuarios, ...rest } = m
      return {
        ...rest,
        ingrediente_nombre: ingredientes?.nombre ?? null,
        ingrediente_unidad: ingredientes?.unidad ?? null,
        usuario_nombre: usuarios?.usuario ?? null,
      }
    })

    return json({ mermas })
  },
  { roles: ['admin', 'encargado'] },
)

post(
  '/mermas',
  async ({ body, session }) => {
    const parsed = schemaMerma.safeParse(body)
    if (!parsed.success) return VALIDATION()

    // El motivo define el tipo (excepto 'otro'): evita registrar un robo
    // como merma operativa y distorsionar los reportes.
    const tipoEsperado = MOTIVO_TIPO[parsed.data.motivo]
    if (tipoEsperado && tipoEsperado !== parsed.data.tipo) return VALIDATION()

    const { data, error } = await supabaseAdmin().rpc('registrar_merma', {
      p_ingrediente_id: parsed.data.ingrediente_id,
      p_cantidad: parsed.data.cantidad,
      p_tipo: parsed.data.tipo,
      p_motivo: parsed.data.motivo,
      p_notas: parsed.data.notas,
      p_usuario_id: session.userId,
      p_fecha: parsed.data.fecha ?? null,
    })

    if (error) {
      const msg = error.message || ''
      if (msg.includes('INSUFFICIENT_STOCK')) return apiError(400, 'INSUFFICIENT_STOCK')
      if (msg.includes('INGREDIENT_NOT_FOUND')) return apiError(404, 'INGREDIENT_NOT_FOUND')
      if (msg.includes('INVALID_')) return VALIDATION()
      return apiError(500, 'DB_ERROR', { detail: msg })
    }

    return json({ id: data })
  },
  { roles: ['admin', 'encargado'] },
)

// Anular una entrada: borra el registro y devuelve la cantidad al stock.
del(
  '/mermas/:id',
  async ({ params }) => {
    const { error } = await supabaseAdmin().rpc('anular_merma', { p_id: Number(params.id) })
    if (error) {
      const msg = error.message || ''
      if (msg.includes('MERMA_NOT_FOUND')) return apiError(404, 'MERMA_NOT_FOUND')
      return apiError(500, 'DB_ERROR', { detail: msg })
    }
    return json({ anulada: true })
  },
  { roles: ['admin'] },
)

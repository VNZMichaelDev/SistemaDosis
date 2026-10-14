import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, del, get, json, notFound, post, put, VALIDATION } from '../router'

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Tasas anuales en días según la contadora:
 *  prestaciones 60/año, vacaciones 30/año (15 disfrute + 15 bono vacacional), utilidades 30/año. */
export const TASAS_DIAS = {
  prestaciones: 60,
  disfrute: 15,
  bono_vacacional: 15,
  utilidades: 30,
} as const

export type TipoDia = keyof typeof TASAS_DIAS
export const TIPOS_DIAS: TipoDia[] = ['disfrute', 'bono_vacacional', 'utilidades', 'prestaciones']

const MS_DIA = 86_400_000

/** Días transcurridos entre una fecha YYYY-MM-DD y hoy (zona -04), a nivel de día calendario. */
function diasDesde(fechaYmd: string): number {
  const hoyYmd = new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10)
  const a = Date.parse(`${fechaYmd}T00:00:00Z`)
  const b = Date.parse(`${hoyYmd}T00:00:00Z`)
  if (Number.isNaN(a)) return 0
  return Math.max(0, Math.floor((b - a) / MS_DIA))
}

function proximoAniversario(fechaYmd: string): string | null {
  const hoyYmd = new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10)
  const [, m, d] = fechaYmd.split('-')
  const anio = Number(hoyYmd.slice(0, 4))
  for (let y = anio; y <= anio + 1; y++) {
    const cand = `${y}-${m}-${d}`
    if (cand >= hoyYmd) return cand
  }
  return null
}

function calcularDias(empleado: any, registros: any[]) {
  const diasVividos = diasDesde(empleado.fecha_ingreso)
  const porTipo: Record<string, any[]> = {}
  for (const r of registros) {
    ;(porTipo[r.tipo] ||= []).push(r)
  }
  const saldos: Record<string, any> = {}
  for (const tipo of TIPOS_DIAS) {
    const acumulado = Math.floor((diasVividos / 365.25) * TASAS_DIAS[tipo])
    const regs = porTipo[tipo] || []
    const registrado = regs.reduce((s, r) => s + Number(r.dias || 0), 0)
    saldos[tipo] = {
      tasa_anual: TASAS_DIAS[tipo],
      acumulado,
      registrado,
      saldo: acumulado - registrado,
      valor_saldo: ((acumulado - registrado) * (Number(empleado.salario_usd) || 0)) / 30,
    }
  }
  return {
    dias_vividos: diasVividos,
    anios: diasVividos / 365.25,
    proximo_aniversario: proximoAniversario(empleado.fecha_ingreso),
    valor_dia: (Number(empleado.salario_usd) || 0) / 30,
    saldos,
  }
}

const schemaEmpleado = z.object({
  nombre: z.string().min(1),
  cedula: z.string().optional().default(''),
  cargo: z.string().optional().default(''),
  fecha_ingreso: z.string().regex(DAY_RE),
  salario_usd: z.number().nonnegative().optional().default(0),
})

// ==================== EMPLEADOS ====================

get(
  '/empleados',
  async ({ query }) => {
    const todos = query.get('todos') === '1'
    const db = supabaseAdmin()
    let q = db.from('empleados').select('*').order('nombre')
    if (!todos) q = q.eq('activo', true)
    const { data: empleados, error } = await q
    if (error) throw new Error(error.message)

    const ids = (empleados ?? []).map((e) => e.id)
    const { data: diasRows, error: diasError } = ids.length
      ? await db.from('empleado_dias').select('*').in('empleado_id', ids)
      : { data: [], error: null }
    if (diasError) throw new Error(diasError.message)

    const result = (empleados ?? []).map((e) => ({
      ...e,
      ...calcularDias(e, (diasRows ?? []).filter((r) => r.empleado_id === e.id)),
    }))
    return json({ empleados: result, tasas: TASAS_DIAS })
  },
  { roles: ['admin', 'encargado'] },
)

post(
  '/empleados',
  async ({ body }) => {
    const parsed = schemaEmpleado.safeParse(body)
    if (!parsed.success) return VALIDATION()
    const { data, error } = await supabaseAdmin()
      .from('empleados')
      .insert({
        nombre: parsed.data.nombre,
        cedula: parsed.data.cedula,
        cargo: parsed.data.cargo,
        fecha_ingreso: parsed.data.fecha_ingreso,
        salario_usd: parsed.data.salario_usd,
      })
      .select('id')
      .single()
    if (error) return apiError(500, 'DB_ERROR', { detail: error.message })
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

put(
  '/empleados/:id',
  async ({ params, body }) => {
    const parsed = schemaEmpleado.safeParse(body)
    if (!parsed.success) return VALIDATION()
    const { data, error } = await supabaseAdmin()
      .from('empleados')
      .update({
        nombre: parsed.data.nombre,
        cedula: parsed.data.cedula,
        cargo: parsed.data.cargo,
        fecha_ingreso: parsed.data.fecha_ingreso,
        salario_usd: parsed.data.salario_usd,
      })
      .eq('id', Number(params.id))
      .select('id')
    if (error) throw new Error(error.message)
    return json({ updated: (data ?? []).length })
  },
  { roles: ['admin', 'encargado'] },
)

del(
  '/empleados/:id',
  async ({ params }) => {
    const { data, error } = await supabaseAdmin().from('empleados').delete().eq('id', Number(params.id)).select('id')
    if (error) throw new Error(error.message)
    return json({ deleted: (data ?? []).length })
  },
  { roles: ['admin', 'encargado'] },
)

// ==================== CONTROL DE DÍAS ====================

get(
  '/empleados/:id/dias',
  async ({ params }) => {
    const { data, error } = await supabaseAdmin()
      .from('empleado_dias')
      .select('*')
      .eq('empleado_id', Number(params.id))
      .order('fecha', { ascending: false })
      .order('id', { ascending: false })
    if (error) throw new Error(error.message)
    return json({ dias: data ?? [], tasas: TASAS_DIAS })
  },
  { roles: ['admin', 'encargado'] },
)

post(
  '/empleados/:id/dias',
  async ({ params, body }) => {
    const schema = z.object({
      tipo: z.enum(['disfrute', 'bono_vacacional', 'utilidades', 'prestaciones']),
      fecha: z.string().regex(DAY_RE).optional(),
      dias: z.number().positive(),
      notas: z.string().optional().default(''),
    })
    const parsed = schema.safeParse(body)
    if (!parsed.success) return VALIDATION()

    const empleadoId = Number(params.id)
    const db = supabaseAdmin()
    const { data: empleado } = await db.from('empleados').select('id').eq('id', empleadoId).maybeSingle()
    if (!empleado) return notFound()

    const { data, error } = await db
      .from('empleado_dias')
      .insert({
        empleado_id: empleadoId,
        tipo: parsed.data.tipo,
        fecha: parsed.data.fecha,
        dias: parsed.data.dias,
        notas: parsed.data.notas,
      })
      .select('id')
      .single()
    if (error) return apiError(500, 'DB_ERROR', { detail: error.message })
    return json({ id: data.id })
  },
  { roles: ['admin', 'encargado'] },
)

del(
  '/empleados/dias/:id',
  async ({ params }) => {
    const { data, error } = await supabaseAdmin().from('empleado_dias').delete().eq('id', Number(params.id)).select('id')
    if (error) throw new Error(error.message)
    return json({ deleted: (data ?? []).length })
  },
  { roles: ['admin', 'encargado'] },
)

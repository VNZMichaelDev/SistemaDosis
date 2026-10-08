/**
 * Seed inicial de DePOS Dosis (Supabase).
 * Uso: npm run seed
 * Lee .env.local (o variables de entorno) con SUPABASE_URL/SERVICE_ROLE_KEY.
 * Idempotente: solo inserta si la tabla está vacía.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

function loadEnv() {
  const envFile = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

loadEnv()

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const db = createClient(url, key, { auth: { persistSession: false } })

async function count(table: string): Promise<number> {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function main() {
  // 1) Configuración (tasa de cambio)
  if ((await count('configuracion')) === 0) {
    const { error } = await db.from('configuracion').insert({ id: 1, tasa_cambio: 36.5 })
    if (error) throw new Error(`configuracion: ${error.message}`)
    console.log('OK configuracion (tasa 36.5)')
  }

  // 2) Usuario admin
  if ((await count('usuarios')) === 0) {
    const hash = await bcrypt.hash('admin123', 10)
    const { error } = await db.from('usuarios').insert({
      usuario: 'admin',
      password: hash,
      rol: 'admin',
      departamentos_precios: [],
    })
    if (error) throw new Error(`usuarios: ${error.message}`)
    console.log('OK usuario admin / admin123')
  }

  // 3) Mesas
  if ((await count('mesas')) === 0) {
    const nombres = Array.from({ length: 10 }, (_, i) => `Mesa ${i + 1}`).concat(['Para Llevar', 'Delivery'])
    const { error } = await db.from('mesas').insert(nombres.map((nombre) => ({ nombre })))
    if (error) throw new Error(`mesas: ${error.message}`)
    console.log(`OK mesas (${nombres.length})`)
  }

  // 4) Departamentos y productos reales (data/productos.json)
  const dataFile = path.join(process.cwd(), 'data', 'productos.json')
  const grupos = JSON.parse(fs.readFileSync(dataFile, 'utf-8')) as {
    departamento: string
    productos: { codigo: string; nombre: string; precio: number }[]
  }[]

  const { data: depsExistentes, error: eDeps } = await db.from('departamentos').select('id, nombre')
  if (eDeps) throw new Error(`departamentos: ${eDeps.message}`)

  const faltantes = grupos.map((g) => g.departamento).filter((n) => !depsExistentes?.some((d) => d.nombre === n))
  if (faltantes.length > 0) {
    const { error } = await db.from('departamentos').insert(faltantes.map((nombre) => ({ nombre, descripcion: '' })))
    if (error) throw new Error(`departamentos: ${error.message}`)
    console.log(`OK departamentos nuevos (${faltantes.length})`)
  } else {
    console.log('OK departamentos (ya presentes)')
  }

  const { data: deps, error: eDeps2 } = await db.from('departamentos').select('id, nombre')
  if (eDeps2) throw new Error(`departamentos: ${eDeps2.message}`)

  const { data: prodsExistentes, error: eProds } = await db.from('productos').select('codigo')
  if (eProds) throw new Error(`productos: ${eProds.message}`)
  const existentes = new Set(prodsExistentes?.map((p) => p.codigo))

  const nuevos: any[] = []
  for (const g of grupos) {
    const departamento_id = deps?.find((d) => d.nombre === g.departamento)?.id ?? null
    for (const p of g.productos) {
      if (existentes.has(p.codigo)) continue
      nuevos.push({
        codigo: p.codigo,
        nombre: p.nombre,
        precio_usd: p.precio,
        tipo: 'unidad',
        departamento_id,
      })
    }
  }

  if (nuevos.length > 0) {
    const { error } = await db.from('productos').insert(nuevos)
    if (error) throw new Error(`productos: ${error.message}`)
    console.log(`OK productos (${nuevos.length} insertados)`)
  } else {
    console.log('OK productos (ya presentes)')
  }

  console.log('\nSeed completado.')
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})

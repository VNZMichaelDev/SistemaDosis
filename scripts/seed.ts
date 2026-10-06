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

  // 4) Departamentos de ejemplo
  if ((await count('departamentos')) === 0) {
    const { data, error } = await db
      .from('departamentos')
      .insert([
        { nombre: 'Platos Fuertes', descripcion: '' },
        { nombre: 'Bebidas', descripcion: '' },
        { nombre: 'Postres', descripcion: '' },
      ])
      .select('id, nombre')
    if (error) throw new Error(`departamentos: ${error.message}`)
    console.log(`OK departamentos (${data?.length ?? 0})`)
  }

  // 5) Productos de ejemplo
  if ((await count('productos')) === 0) {
    const { data: deps } = await db.from('departamentos').select('id, nombre')
    const depId = (nombre: string) => deps?.find((d) => d.nombre === nombre)?.id ?? null
    const { error } = await db.from('productos').insert([
      { codigo: '001', nombre: 'Pepito', precio_usd: 4.5, precio_costo: 2.5, tipo: 'unidad', stock: 100, departamento_id: depId('Platos Fuertes'), margen_ganancia: 80 },
      { codigo: '002', nombre: 'Hamburguesa', precio_usd: 5.0, precio_costo: 2.8, tipo: 'unidad', stock: 100, departamento_id: depId('Platos Fuertes'), margen_ganancia: 78 },
      { codigo: '003', nombre: 'Refresco 500ml', precio_usd: 1.0, precio_costo: 0.5, tipo: 'unidad', stock: 200, departamento_id: depId('Bebidas'), margen_ganancia: 100 },
      { codigo: '004', nombre: 'Agua Mineral', precio_usd: 0.75, precio_costo: 0.3, tipo: 'unidad', stock: 200, departamento_id: depId('Bebidas'), margen_ganancia: 150 },
      { codigo: '005', nombre: 'Tres Leches', precio_usd: 2.5, precio_costo: 1.0, tipo: 'unidad', stock: 20, departamento_id: depId('Postres'), margen_ganancia: 150 },
      { codigo: '006', nombre: 'Tequeños (unidad)', precio_usd: 0.5, precio_costo: 0.2, tipo: 'unidad', stock: 300, departamento_id: depId('Platos Fuertes'), margen_ganancia: 150 },
      { codigo: '007', nombre: 'Café', precio_usd: 1.2, precio_costo: 0.4, tipo: 'unidad', stock: 100, departamento_id: depId('Bebidas'), margen_ganancia: 200 },
      { codigo: '008', nombre: 'Papas Fritas', precio_usd: 1.5, precio_costo: 0.6, tipo: 'peso', stock: 50, departamento_id: depId('Platos Fuertes'), margen_ganancia: 150 },
    ])
    if (error) throw new Error(`productos: ${error.message}`)
    console.log('OK productos de ejemplo (8)')
  }

  console.log('\nSeed completado.')
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})

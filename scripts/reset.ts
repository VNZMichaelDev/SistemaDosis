/**
 * Limpia los datos de prueba (E2E + seed de ejemplo), conservando admin y configuración.
 * Uso: npx tsx scripts/reset.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

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
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

async function wipe(table: string): Promise<void> {
  const { error } = await db.from(table).delete().gt('id', 0)
  if (error) throw new Error(`${table}: ${error.message}`)
  console.log(`  borrado ${table}`)
}

async function main() {
  console.log('Limpiando datos de prueba (se conservan admin y configuración)...\n')

  await wipe('credito_pagos')
  await wipe('credito_ventas')
  await wipe('clientes_credito')
  await wipe('venta_pagos')
  await wipe('detalle_venta')
  await wipe('ventas')
  await wipe('pedido_items')
  await wipe('pedidos')
  await wipe('productos_codigos')
  await wipe('receta_ingredientes')
  await wipe('ingredientes')
  await wipe('pagos_proveedor')
  await wipe('facturas_proveedor')
  await wipe('proveedores')
  await wipe('productos')
  await wipe('departamentos')
  await wipe('vendedores')

  const { error: eUsers } = await db.from('usuarios').delete().neq('usuario', 'admin')
  if (eUsers) throw new Error(`usuarios: ${eUsers.message}`)
  console.log('  borrado usuarios (≠ admin)')

  await wipe('mesas')

  console.log('\nReset completado.')
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})

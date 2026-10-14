import fs from 'node:fs'
import path from 'node:path'

function loadEnv() {
  const envFile = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv()

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function rest(method: string, query: string, body?: unknown): Promise<any> {
  const res = await fetch(`${URL_SB}/rest/v1/${query}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${query} → ${res.status} ${text}`)
  return text ? JSON.parse(text) : null
}

async function main() {
  console.log('== Importando créditos del SQLite ==\n')

  // Limpiar créditos previos (por si acaso)
  await rest('DELETE', 'credito_pagos?id=gte.1')
  await rest('DELETE', 'credito_ventas?id=gte.1')
  await rest('DELETE', 'clientes_credito?id=gte.1')
  console.log('  créditos previos limpiados')

  // Clientes con deuda (IDs originales preservados)
  const clientes = [
    { id: 23, nombre: 'Oskal Gil', cedula: '8716196', deuda_total: 196.02 },
    { id: 25, nombre: 'Nazaret matos', cedula: '999', deuda_total: 14 },
    { id: 67, nombre: 'Geovani Franco', cedula: '3567', deuda_total: 14.9 },
    { id: 84, nombre: 'Pedro primo postizo', cedula: 'Pedro', deuda_total: 6.68 },
    { id: 89, nombre: 'Jose luis', cedula: 'Jose', deuda_total: 4.45 },
    { id: 92, nombre: 'Douglas primo', cedula: 'primo', deuda_total: 16.95 },
    { id: 96, nombre: 'Victor preveefo', cedula: 'Victor', deuda_total: 9 },
    { id: 98, nombre: 'Dubreily', cedula: 'Dubreily', deuda_total: 2.3 },
    { id: 102, nombre: 'Yulbri carro negro', cedula: 'Yul', deuda_total: 5.25 },
    { id: 110, nombre: 'David Matos', cedula: 'David', deuda_total: 15.26 },
    { id: 116, nombre: 'Roki', cedula: 'Roki', deuda_total: 18.66 },
    { id: 120, nombre: 'Jeferson', cedula: 'Jeferson', deuda_total: 15.02 },
    { id: 121, nombre: 'Aracelis', cedula: 'Aracelis', deuda_total: 6.58 },
    { id: 128, nombre: 'Cecilia Matos', cedula: 'Ceci', deuda_total: 6.8 },
    { id: 130, nombre: 'Jesus niño', cedula: 'Jesús', deuda_total: 8.47 },
    { id: 134, nombre: 'Carlos olivares', cedula: 'Carlos', deuda_total: 14.64 },
    { id: 135, nombre: 'raa casitas', cedula: 'raa', deuda_total: 8.32 },
    { id: 136, nombre: 'Marvin', cedula: 'Marvin', deuda_total: 3.66 },
    { id: 137, nombre: 'Angel Malta', cedula: 'Angel', deuda_total: 13.68 },
    { id: 138, nombre: 'Eddyson', cedula: 'Eddyson', deuda_total: 103.75 },
    { id: 139, nombre: 'david matos', cedula: 'david', deuda_total: 20.03 },
    { id: 140, nombre: 'mariela', cedula: 'mariela', deuda_total: 54.9 },
    { id: 141, nombre: 'Jesús Niño', cedula: '8724876', deuda_total: 13.92 },
  ]
  const creados = await rest('POST', 'clientes_credito', clientes)
  console.log(`  clientes_credito: ${creados.length}`)

  // Pago registrado (cliente 98 = Dubreily, $2.30)
  const pagos = [{ id: 22, cliente_id: 98, monto_usd: 2.3, fecha: '2026-09-14T13:35:37-04:00' }]
  const pagosCreados = await rest('POST', 'credito_pagos', pagos)
  console.log(`  credito_pagos: ${pagosCreados.length}`)

  // Verificación
  console.log('\n== Verificación ==')
  const cc = await rest('GET', 'clientes_credito?select=id,nombre,deuda_total&order=id')
  const deudaTotal = cc.reduce((s: number, c: any) => s + c.deuda_total, 0)
  console.log(`  clientes: ${cc.length}, deuda total: $${deudaTotal.toFixed(2)}`)
  for (const c of cc) console.log(`    ${c.id}. ${c.nombre}: $${c.deuda_total}`)
  console.log('\nImportación de créditos completada.')
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})

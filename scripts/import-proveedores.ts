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
  console.log('== Importando proveedores del SQLite ==\n')

  // Limpiar previos
  await rest('DELETE', 'pagos_proveedor?id=gte.1')
  await rest('DELETE', 'facturas_proveedor?id=gte.1')
  await rest('DELETE', 'proveedores?id=gte.1')
  console.log('  previos limpiados')

  // Proveedores (IDs originales)
  const proveedores = [
    { id: 1, nombre: 'Alimento Santopi', contacto: '', telefono: '04121982997', direccion: '', notas: '', activo: true },
    { id: 2, nombre: 'Nominas', contacto: '', telefono: '', direccion: '', notas: '', activo: true },
    { id: 3, nombre: 'JJVA', contacto: 'Jomaluli', telefono: '02722689596', direccion: 'Calle 1', notas: '', activo: true },
    { id: 4, nombre: 'Nohel queso de mano', contacto: '', telefono: '', direccion: 'La gran parada', notas: '', activo: true },
    { id: 5, nombre: 'Inversiones Segotovar', contacto: 'Franklin', telefono: '04126888517', direccion: '', notas: '', activo: true },
    { id: 6, nombre: 'Codizulca pollo', contacto: 'Jose Gregorio', telefono: '', direccion: '', notas: '', activo: true },
  ]
  const provsCreados = await rest('POST', 'proveedores', proveedores)
  console.log(`  proveedores: ${provsCreados.length}`)

  // Facturas (IDs originales; sin categoria/fecha_documento en el SQLite viejo)
  const facturas = [
    { id: 1, proveedor_id: 1, numero_factura: '0003-3968', monto_total: 97.17, descripcion: '', fecha_registro: '2026-07-17T00:28:46-04:00' },
    { id: 2, proveedor_id: 2, numero_factura: '', monto_total: 288, descripcion: '', fecha_registro: '2026-07-17T13:11:25-04:00' },
    { id: 5, proveedor_id: 4, numero_factura: '#001', monto_total: 100, descripcion: '', fecha_registro: '2026-07-17T13:19:33-04:00' },
    { id: 6, proveedor_id: 5, numero_factura: '#7520', monto_total: 38.37, descripcion: '', fecha_registro: '2026-07-17T13:21:54-04:00' },
    { id: 7, proveedor_id: 5, numero_factura: '#7613', monto_total: 38.28, descripcion: '', fecha_registro: '2026-07-17T13:22:32-04:00' },
    { id: 9, proveedor_id: 4, numero_factura: '00001', monto_total: 75, descripcion: '', fecha_registro: '2026-07-17T22:14:51-04:00' },
    { id: 10, proveedor_id: 3, numero_factura: '93262', monto_total: 39.23, descripcion: '', fecha_registro: '2026-07-29T12:48:10-04:00' },
  ]
  const factsCreadas = await rest('POST', 'facturas_proveedor', facturas)
  console.log(`  facturas_proveedor: ${factsCreadas.length}`)

  // Pagos (IDs originales)
  const pagos = [
    { id: 1, factura_proveedor_id: 5, monto: 78, fecha_pago: '2026-07-17T22:14:35-04:00', notas: '' },
    { id: 2, factura_proveedor_id: 7, monto: 38.28, fecha_pago: '2026-07-24T01:52:40-04:00', notas: '' },
    { id: 6, factura_proveedor_id: 1, monto: 97.17, fecha_pago: '2026-08-01T11:09:42-04:00', notas: '' },
    { id: 7, factura_proveedor_id: 6, monto: 38.37, fecha_pago: '2026-08-13T03:26:32-04:00', notas: '' },
    { id: 8, factura_proveedor_id: 5, monto: 22, fecha_pago: '2026-08-13T03:27:02-04:00', notas: '' },
    { id: 9, factura_proveedor_id: 9, monto: 75, fecha_pago: '2026-08-13T03:27:05-04:00', notas: '' },
    { id: 10, factura_proveedor_id: 10, monto: 39.23, fecha_pago: '2026-08-13T03:28:38-04:00', notas: '' },
  ]
  const pagosCreados = await rest('POST', 'pagos_proveedor', pagos)
  console.log(`  pagos_proveedor: ${pagosCreados.length}`)

  // Verificación
  console.log('\n== Verificación ==')
  const provs = await rest('GET', 'proveedores?select=id,nombre&order=id')
  console.log(`  proveedores: ${provs.length}`)
  for (const p of provs) console.log(`    ${p.id}. ${p.nombre}`)
  const facts = await rest('GET', 'facturas_proveedor?select=id,proveedor_id,monto_total&order=id')
  const totalFacturas = facts.reduce((s: number, f: any) => s + f.monto_total, 0)
  console.log(`  facturas: ${facts.length}, monto total: $${totalFacturas.toFixed(2)}`)
  const pagosV = await rest('GET', 'pagos_proveedor?select=id,monto&order=id')
  const totalPagos = pagosV.reduce((s: number, p: any) => s + p.monto, 0)
  console.log(`  pagos: ${pagosV.length}, monto total: $${totalPagos.toFixed(2)}`)
  console.log('\nImportación de proveedores completada.')
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})

/**
 * E2E del módulo de Contabilidad + Empleados.
 * Uso: npx tsx scripts/e2e-contabilidad.ts (con el server corriendo en localhost:3111)
 */
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

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3111'
const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const run = Date.now().toString(36)

let cookie = ''
let pass = 0
let fail = 0

function check(cond: boolean, label: string) {
  if (cond) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.error(`  ✗ ${label}`)
  }
}

async function api(method: string, url: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  return { status: res.status, data, headers: res.headers }
}

async function sb(method: string, table: string, body?: unknown): Promise<void> {
  const res = await fetch(`${URL_SB}/rest/v1/${table}`, {
    method,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`SB ${method} ${table}: ${res.status} ${await res.text()}`)
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

async function main() {
  const hoy = ymd(new Date())
  const ayer = ymd(new Date(Date.now() - 86400000))
  const hace400 = ymd(new Date(Date.now() - 400 * 86400000))

  console.log('== Login ==')
  const login = await api('POST', '/api/auth/login', { usuario: 'admin', password: 'admin123' })
  check(login.status === 200 && login.data?.token, 'login admin')
  cookie = `depos_token=${login.data.token}`

  console.log('\n== Estado de Resultados (matemática de la contadora) ==')

  // Proveedor + facturas (compra y gasto)
  const prov = await api('POST', '/api/proveedores', { nombre: `Cont E2E ${run}` })
  const provId = prov.data.id
  check(Boolean(provId), 'crear proveedor')

  const facCompra = await api('POST', `/api/proveedores/${provId}/facturas`, {
    numero_factura: `FC-${run}`,
    monto_total: 600,
    descripcion: 'Compra mercancía E2E',
    categoria: 'compra',
    fecha_documento: hoy,
  })
  check(facCompra.status === 200 && facCompra.data.id, 'factura compra 600')

  const facGasto = await api('POST', `/api/proveedores/${provId}/facturas`, {
    numero_factura: `FG-${run}`,
    monto_total: 50,
    descripcion: 'Gasto proveedor E2E',
    categoria: 'gasto',
    fecha_documento: hoy,
  })
  check(facGasto.status === 200 && facGasto.data.id, 'factura gasto 50')

  // Gastos internos
  const gAlq = await api('POST', '/api/gastos', { fecha: hoy, categoria: 'alquiler', descripcion: 'Alquiler E2E', monto_usd: 150 })
  const gSue = await api('POST', '/api/gastos', { fecha: hoy, categoria: 'sueldos', descripcion: 'Sueldos E2E', monto_usd: 100 })
  check(gAlq.status === 200 && gSue.status === 200, 'gastos alquiler 150 + sueldos 100')

  // Cierres de inventario
  const cIni = await api('POST', '/api/inventario-cierres', { fecha: ayer, tipo: 'inicial', valor_usd: 100, notas: 'E2E inicial' })
  const cFin = await api('POST', '/api/inventario-cierres', { fecha: hoy, tipo: 'final', valor_usd: 150, notas: 'E2E final' })
  check(cIni.status === 200 && cFin.status === 200, 'cierres inventario 100 inicial / 150 final')

  // Venta directa vía Supabase REST: total 1000, costo congelado 450
  const prods = await api('GET', '/api/productos')
  const productoId = prods.data.products[0].id
  const ventaIns = await fetch(`${URL_SB}/rest/v1/ventas?select=id`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify([
      {
        total_usd: 1000,
        total_bs: 0,
        metodo_pago: 'Efectivo',
        pagada: true,
        fecha: new Date().toISOString(),
        usuario_id: login.data.user.id,
      },
    ]),
  })
  const ventaId = (await ventaIns.json())[0].id
  await sb('POST', 'detalle_venta', [{ venta_id: ventaId, producto_id: productoId, cantidad: 1, precio_usd: 1000, precio_costo: 450, subtotal: 1000 }])
  check(Boolean(ventaId), 'venta 1000 (costo 450)')

  const er = await api('GET', `/api/reportes/estado-resultados?from=${hoy}&to=${hoy}`)
  check(er.status === 200, 'endpoint estado-resultados')
  const erd = er.data
  check(Number(erd.ventas.total_usd) === 1000, `ventas = 1000 (obtuve ${erd.ventas.total_usd})`)
  check(erd.inventario_inicial?.valor_usd === 100, `inventario inicial = 100 (obtuve ${erd.inventario_inicial?.valor_usd})`)
  check(erd.inventario_final?.valor_usd === 150, `inventario final = 150 (obtuve ${erd.inventario_final?.valor_usd})`)
  check(Number(erd.compras_total) === 600, `compras = 600 (obtuve ${erd.compras_total})`)
  check(Number(erd.disponible) === 700, `mercancía disponible = 700 (obtuve ${erd.disponible})`)
  check(Number(erd.costo_venta) === 550, `costo venta = 550 (obtuve ${erd.costo_venta})`)
  check(Number(erd.utilidad_bruta) === 450, `utilidad bruta = 450 (obtuve ${erd.utilidad_bruta})`)
  check(Number(erd.gastos.total) === 300, `gastos = 300 (150+100+50 factura proveedor) (obtuve ${erd.gastos.total})`)
  check(Number(erd.utilidad) === 150, `utilidad = 150 (obtuve ${erd.utilidad})`)
  check(Math.abs(Number(erd.margen_pct) - 15) < 0.001, `margen = 15% (obtuve ${erd.margen_pct})`)
  check(erd.inventario_incompleto === false, 'inventario completo')

  console.log('\n== Empleados (días) ==')
  const emp = await api('POST', '/api/empleados', {
    nombre: `Emp Cont E2E ${run}`,
    cedula: `V-${run}`,
    cargo: 'Cocinero',
    fecha_ingreso: hace400,
    salario_usd: 300,
  })
  check(emp.status === 200 && emp.data.id, 'crear empleado (ingreso hace 400 días)')

  const emps = await api('GET', '/api/empleados')
  const e = (emps.data.empleados || []).find((x: any) => x.id === emp.data.id)
  check(Boolean(e), 'listar empleados')
  const esperadoPrest = Math.floor((400 / 365.25) * 60)
  const esperadoDisp = Math.floor((400 / 365.25) * 15)
  check(e?.saldos?.prestaciones?.acumulado === esperadoPrest, `prestaciones acum. = ${esperadoPrest} (obtuve ${e?.saldos?.prestaciones?.acumulado})`)
  check(e?.saldos?.disfrute?.acumulado === esperadoDisp, `disfrute acum. = ${esperadoDisp} (obtuve ${e?.saldos?.disfrute?.acumulado})`)
  check(e?.valor_dia === 10, `valor día = 10 (salario 300/30) (obtuve ${e?.valor_dia})`)

  const dia = await api('POST', `/api/empleados/${emp.data.id}/dias`, { tipo: 'disfrute', fecha: hoy, dias: 10, notas: 'E2E disfrute' })
  check(dia.status === 200 && dia.data.id, 'registrar 10 días disfrute')

  const emps2 = await api('GET', '/api/empleados')
  const e2 = (emps2.data.empleados || []).find((x: any) => x.id === emp.data.id)
  check(e2?.saldos?.disfrute?.registrado === 10, `disfrute usado = 10 (obtuve ${e2?.saldos?.disfrute?.registrado})`)
  check(e2?.saldos?.disfrute?.saldo === esperadoDisp - 10, `disfrute saldo = ${esperadoDisp - 10} (obtuve ${e2?.saldos?.disfrute?.saldo})`)

  const empDel = await api('DELETE', `/api/empleados/${emp.data.id}`)
  check(empDel.status === 200, 'eliminar empleado (cleanup)')

  console.log('\n== Cleanup ==')
  await api('DELETE', `/api/gastos/${gAlq.data.id}`)
  await api('DELETE', `/api/gastos/${gSue.data.id}`)
  await api('DELETE', `/api/inventario-cierres/${cIni.data.id}`)
  await api('DELETE', `/api/inventario-cierres/${cFin.data.id}`)
  await api('DELETE', `/api/proveedores/facturas/${facCompra.data.id}`)
  await api('DELETE', `/api/proveedores/facturas/${facGasto.data.id}`)
  await api('DELETE', `/api/proveedores/${provId}`)
  await sb('DELETE', 'detalle_venta?venta_id=eq.' + ventaId)
  await sb('DELETE', 'ventas?id=eq.' + ventaId)
  console.log('  limpieza OK')

  console.log(`\n${pass} pass / ${fail} fail`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})

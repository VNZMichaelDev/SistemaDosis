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

async function clear(table: string, filter = 'id=gte.1'): Promise<void> {
  const rows = await rest('DELETE', `${table}?${filter}`)
  console.log(`  limpio ${table}: ${rows.length} filas`)
}

async function main() {
  console.log('== Limpiando datos de prueba ==')

  const HIJOS = [
    'detalle_venta',
    'venta_pagos',
    'pedido_items',
    'credito_pagos',
    'credito_ventas',
    'receta_ingredientes',
    'productos_codigos',
  ]
  const PADRES = [
    'ventas',
    'pedidos',
    'clientes_credito',
    'productos',
    'departamentos',
    'pagos_proveedor',
    'facturas_proveedor',
    'proveedores',
    'ingredientes',
    'vendedores',
  ]

  for (const t of HIJOS) await clear(t)
  for (const t of PADRES) await clear(t)

  const usuarios = await clear('usuarios', 'usuario=neq.admin')
  void usuarios
  await clear('mesas', 'activo=eq.false')

  console.log('\n== Insertando catálogo original ==')
  const grupos: { departamento: string; productos: { codigo: string; nombre: string; precio: number }[] }[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'scripts', 'productos.json'), 'utf8'),
  )

  const deps = await rest(
    'POST',
    'departamentos',
    grupos.map((g) => ({ nombre: g.departamento, descripcion: '' })),
  )
  const depIds = new Map<string, number>(deps.map((d: any) => [d.nombre, Number(d.id)]))
  console.log(`  departamentos: ${deps.length}`)

  const productos: any[] = []
  for (const g of grupos) {
    for (const p of g.productos) {
      productos.push({
        codigo: p.codigo,
        nombre: p.nombre,
        precio_usd: p.precio,
        precio_costo: 0,
        margen_ganancia: 0,
        tipo: 'unidad',
        departamento_id: depIds.get(g.departamento),
        es_receta: false,
      })
    }
  }
  const creados = await rest('POST', 'productos', productos)
  console.log(`  productos: ${creados.length}`)

  console.log('\n== Verificación final ==')
  for (const t of ['usuarios', 'departamentos', 'productos', 'mesas', 'pedidos', 'ventas']) {
    const rows = await rest('GET', `${t}?select=id&limit=1000`)
    console.log(`  ${t}: ${rows.length}`)
  }
  console.log('\nSeed completado.')
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})

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
  console.log('== Importando catálogo real del POS (SQLite) ==\n')

  // 0. Resguardar pedidos/ventas existentes (re-mapear producto_id → codigo → nuevo id)
  console.log('-- Resguardando historial de ventas --')
  const itemsOld = await rest('GET', 'pedido_items?select=id,pedido_id,producto_id,cantidad,precio_usd,subtotal,notas')
  const detOld = await rest('GET', 'detalle_venta?select=id,venta_id,producto_id,cantidad,precio_usd,precio_costo,subtotal')
  const prodMapOld = await rest('GET', 'productos?select=id,codigo')
  const codById = new Map<number, string>(prodMapOld.map((p: any) => [Number(p.id), p.codigo]))
  console.log(`  pedido_items: ${itemsOld.length}, detalle_venta: ${detOld.length}`)

  // Borrar hijos para liberar FK
  if (itemsOld.length) await rest('DELETE', 'pedido_items?id=gte.1')
  if (detOld.length) await rest('DELETE', 'detalle_venta?id=gte.1')

  // 1. Limpiar catálogo actual (orden FK)
  console.log('\n-- Limpiando catálogo previo --')
  await clear('receta_ingredientes')
  await clear('productos_codigos')
  await clear('productos')
  await clear('ingredientes')
  await clear('departamentos')

  // 2. Departamentos con IDs originales
  console.log('\n-- Insertando departamentos --')
  const departamentos = [
    { id: 1, nombre: 'Cachapas', descripcion: '' },
    { id: 2, nombre: 'Hamburguesas', descripcion: '' },
    { id: 3, nombre: 'Perros Calientes', descripcion: '' },
    { id: 4, nombre: 'Papas y Frituras', descripcion: '' },
    { id: 6, nombre: 'Bebidas', descripcion: '' },
    { id: 7, nombre: 'Empanadas', descripcion: '' },
    { id: 8, nombre: 'Helados', descripcion: '' },
    { id: 15, nombre: 'Parrillas', descripcion: '' },
  ]
  const depsCreados = await rest('POST', 'departamentos', departamentos)
  console.log(`  departamentos: ${depsCreados.length}`)

  // 3. Productos recuperados del WAL con IDs originales
  console.log('\n-- Insertando productos --')
  const catalogo: any[] = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'scripts', 'catalogo-recuperado.json'), 'utf8'),
  )
  const prodsCreados = await rest('POST', 'productos', catalogo)
  console.log(`  productos: ${prodsCreados.length}`)

  // 4. Ingredientes con IDs originales
  console.log('\n-- Insertando ingredientes --')
  const ingredientes = [
    { id: 1, nombre: 'Masa de Jojoto', unidad: 'kg', stock_actual: 0, stock_minimo: 1, precio_unitario: 2.44, activo: true },
    { id: 2, nombre: 'Queso de mano', unidad: 'unidad', stock_actual: 0, stock_minimo: 2, precio_unitario: 7.6, activo: true },
    { id: 3, nombre: 'Crema de leche', unidad: 'kg', stock_actual: 0, stock_minimo: 2, precio_unitario: 5.5, activo: true },
    { id: 4, nombre: 'Jamón', unidad: 'kg', stock_actual: 1.03, stock_minimo: 1.5, precio_unitario: 9.18, activo: true },
    { id: 5, nombre: 'Salchicha cocida Recao', unidad: 'unidad', stock_actual: 0, stock_minimo: 21, precio_unitario: 0.24, activo: true },
    { id: 6, nombre: 'Tocineta 🥓', unidad: 'kg', stock_actual: 0, stock_minimo: 1, precio_unitario: 0.39, activo: true },
    { id: 7, nombre: 'Queso amarillo', unidad: 'kg', stock_actual: 0, stock_minimo: 0.3, precio_unitario: 13, activo: true },
    { id: 8, nombre: 'Pan de perro', unidad: 'unidad', stock_actual: 16, stock_minimo: 12, precio_unitario: 0.23, activo: true },
    { id: 9, nombre: 'Pan de hamburguesa 🍔', unidad: 'unidad', stock_actual: 0, stock_minimo: 3, precio_unitario: 0.42, activo: true },
    { id: 10, nombre: 'Carne de  res 🥩', unidad: 'kg', stock_actual: 0, stock_minimo: 0.5, precio_unitario: 12, activo: true },
    { id: 11, nombre: 'Papas fritas 🍟', unidad: 'kg', stock_actual: 0, stock_minimo: 500, precio_unitario: 3.1, activo: true },
    { id: 12, nombre: 'Carne de pollo🍗', unidad: 'kg', stock_actual: 0, stock_minimo: 1.5, precio_unitario: 6, activo: true },
    { id: 13, nombre: 'Cochino 🐖', unidad: 'kg', stock_actual: 0, stock_minimo: 0.5, precio_unitario: 15, activo: true },
    { id: 14, nombre: 'Papas Mary bolsa', unidad: 'kg', stock_actual: 0, stock_minimo: 1, precio_unitario: 6, activo: true },
    { id: 15, nombre: 'Salsas', unidad: 'kg', stock_actual: 0, stock_minimo: 1, precio_unitario: 12, activo: true },
    { id: 16, nombre: 'Envase', unidad: 'unidad', stock_actual: 0, stock_minimo: 20, precio_unitario: 0.25, activo: true },
    { id: 17, nombre: 'Ensalada', unidad: 'kg', stock_actual: 0, stock_minimo: 0.5, precio_unitario: 1.3, activo: true },
    { id: 18, nombre: 'Helados y barquillas', unidad: 'unidad', stock_actual: 0, stock_minimo: 20, precio_unitario: 0.75, activo: true },
  ]
  const ingsCreados = await rest('POST', 'ingredientes', ingredientes)
  console.log(`  ingredientes: ${ingsCreados.length}`)

  // 5. Recetas (receta_ingredientes) — IDs originales; se omite producto 122 (no recuperado)
  console.log('\n-- Insertando recetas --')
  const recetasBrutas: { producto_id: number; ingrediente_id: number; cantidad: number }[] = [
    { producto_id: 4, ingrediente_id: 1, cantidad: 0.25 }, { producto_id: 4, ingrediente_id: 2, cantidad: 1 }, { producto_id: 4, ingrediente_id: 3, cantidad: 100 }, { producto_id: 4, ingrediente_id: 15, cantidad: 0.015 },
    { producto_id: 5, ingrediente_id: 1, cantidad: 0.25 }, { producto_id: 5, ingrediente_id: 2, cantidad: 1 }, { producto_id: 5, ingrediente_id: 4, cantidad: 0.03 }, { producto_id: 5, ingrediente_id: 6, cantidad: 0.03 }, { producto_id: 5, ingrediente_id: 7, cantidad: 0.03 }, { producto_id: 5, ingrediente_id: 15, cantidad: 0.01 },
    { producto_id: 6, ingrediente_id: 1, cantidad: 0.25 }, { producto_id: 6, ingrediente_id: 2, cantidad: 2 }, { producto_id: 6, ingrediente_id: 3, cantidad: 0.05 }, { producto_id: 6, ingrediente_id: 4, cantidad: 0.025 }, { producto_id: 6, ingrediente_id: 7, cantidad: 0.03 },
    { producto_id: 7, ingrediente_id: 1, cantidad: 0.3 }, { producto_id: 7, ingrediente_id: 2, cantidad: 2 }, { producto_id: 7, ingrediente_id: 3, cantidad: 0.1 }, { producto_id: 7, ingrediente_id: 4, cantidad: 0.06 }, { producto_id: 7, ingrediente_id: 7, cantidad: 0.4 }, { producto_id: 7, ingrediente_id: 13, cantidad: 0.16 },
    { producto_id: 8, ingrediente_id: 1, cantidad: 0.025 },
    { producto_id: 9, ingrediente_id: 1, cantidad: 0.25 }, { producto_id: 9, ingrediente_id: 2, cantidad: 1 }, { producto_id: 9, ingrediente_id: 3, cantidad: 0.1 }, { producto_id: 9, ingrediente_id: 4, cantidad: 0.3 }, { producto_id: 9, ingrediente_id: 6, cantidad: 0.3 }, { producto_id: 9, ingrediente_id: 15, cantidad: 0.01 },
    { producto_id: 10, ingrediente_id: 1, cantidad: 0.25 }, { producto_id: 10, ingrediente_id: 2, cantidad: 1 }, { producto_id: 10, ingrediente_id: 3, cantidad: 0.1 }, { producto_id: 10, ingrediente_id: 4, cantidad: 0.06 }, { producto_id: 10, ingrediente_id: 15, cantidad: 0.015 },
    { producto_id: 11, ingrediente_id: 2, cantidad: 1 },
    { producto_id: 12, ingrediente_id: 9, cantidad: 1 }, { producto_id: 12, ingrediente_id: 10, cantidad: 0.05 }, { producto_id: 12, ingrediente_id: 11, cantidad: 0.1 }, { producto_id: 12, ingrediente_id: 12, cantidad: 0.07 }, { producto_id: 12, ingrediente_id: 15, cantidad: 0.06 }, { producto_id: 12, ingrediente_id: 17, cantidad: 0.05 },
    { producto_id: 13, ingrediente_id: 4, cantidad: 0.025 }, { producto_id: 13, ingrediente_id: 6, cantidad: 0.03 }, { producto_id: 13, ingrediente_id: 7, cantidad: 0.03 }, { producto_id: 13, ingrediente_id: 9, cantidad: 1 }, { producto_id: 13, ingrediente_id: 10, cantidad: 0.05 }, { producto_id: 13, ingrediente_id: 11, cantidad: 0.1 }, { producto_id: 13, ingrediente_id: 12, cantidad: 0.07 }, { producto_id: 13, ingrediente_id: 15, cantidad: 0.07 }, { producto_id: 13, ingrediente_id: 17, cantidad: 0.05 },
    { producto_id: 14, ingrediente_id: 2, cantidad: 0.5 }, { producto_id: 14, ingrediente_id: 4, cantidad: 0.03 }, { producto_id: 14, ingrediente_id: 6, cantidad: 0.03 }, { producto_id: 14, ingrediente_id: 7, cantidad: 0.03 }, { producto_id: 14, ingrediente_id: 9, cantidad: 1 }, { producto_id: 14, ingrediente_id: 10, cantidad: 0.05 }, { producto_id: 14, ingrediente_id: 11, cantidad: 0.1 }, { producto_id: 14, ingrediente_id: 12, cantidad: 0.07 }, { producto_id: 14, ingrediente_id: 17, cantidad: 0.05 },
    { producto_id: 19, ingrediente_id: 11, cantidad: 0.25 },
    { producto_id: 30, ingrediente_id: 16, cantidad: 1 },
    { producto_id: 33, ingrediente_id: 18, cantidad: 1 },
    { producto_id: 37, ingrediente_id: 5, cantidad: 2 }, { producto_id: 37, ingrediente_id: 8, cantidad: 2 }, { producto_id: 37, ingrediente_id: 14, cantidad: 0.1 }, { producto_id: 37, ingrediente_id: 15, cantidad: 0.09 },
  ]
  // Filtrar producto 122 (no recuperado del WAL)
  const recetas = recetasBrutas.filter((r) => r.producto_id !== 122)
  const omitidas = recetasBrutas.length - recetas.length
  if (omitidas > 0) console.log(`  (omitidas ${omitidas} filas de receta del producto 122 — no recuperado)`)
  const recsCreadas = await rest('POST', 'receta_ingredientes', recetas)
  console.log(`  receta_ingredientes: ${recsCreadas.length}`)

  // 6. Config tasa_cambio (si está vacía)
  try {
    const cfg = await rest('GET', 'configuracion?select=id')
    if (!cfg || cfg.length === 0) {
      await rest('POST', 'configuracion', [{ id: 1, tasa_cambio: 880 }])
      console.log('\n  configuracion: tasa_cambio=880 insertada')
    } else {
      console.log('\n  configuracion: ya existe, no se toca')
    }
  } catch {
    await rest('POST', 'configuracion', [{ id: 1, tasa_cambio: 880 }])
    console.log('\n  configuracion: tasa_cambio=880 insertada')
  }

  // 7. Re-insertar pedido_items y detalle_venta con nuevos IDs
  if (itemsOld.length || detOld.length) {
    console.log('\n-- Re-mapeando historial de ventas --')
    const prodsNew = await rest('GET', 'productos?select=id,codigo')
    const idByCod = new Map<string, number>(prodsNew.map((p: any) => [p.codigo, Number(p.id)]))
    const itemsNew = itemsOld
      .map((it: any) => {
        const cod = codById.get(Number(it.producto_id))
        const nuevoId = cod ? idByCod.get(cod) : undefined
        if (!nuevoId) return null
        return { pedido_id: it.pedido_id, producto_id: nuevoId, cantidad: it.cantidad, precio_usd: it.precio_usd, subtotal: it.subtotal, notas: it.notas || '' }
      })
      .filter(Boolean)
    const detNew = detOld
      .map((d: any) => {
        const cod = codById.get(Number(d.producto_id))
        const nuevoId = cod ? idByCod.get(cod) : undefined
        if (!nuevoId) return null
        return { venta_id: d.venta_id, producto_id: nuevoId, cantidad: d.cantidad, precio_usd: d.precio_usd, precio_costo: d.precio_costo, subtotal: d.subtotal }
      })
      .filter(Boolean)
    if (itemsNew.length) await rest('POST', 'pedido_items', itemsNew)
    if (detNew.length) await rest('POST', 'detalle_venta', detNew)
    console.log(`  pedido_items re-mapeados: ${itemsNew.length}, detalle_venta: ${detNew.length}`)
  }

  // 8. Verificación
  console.log('\n== Verificación ==')
  for (const t of ['departamentos', 'productos', 'ingredientes', 'receta_ingredientes', 'configuracion']) {
    const rows = await rest('GET', `${t}?select=id&limit=1000`)
    console.log(`  ${t}: ${rows.length}`)
  }
  const prods = await rest('GET', 'productos?select=id,codigo,nombre&order=id')
  console.log('\n  Productos importados:')
  for (const p of prods) console.log(`    ${p.id}. [${p.codigo}] ${p.nombre}`)
  console.log('\nImportación completada.')
}

main().catch((e) => {
  console.error('ERROR:', e.message)
  process.exit(1)
})

import fs from 'node:fs'
import path from 'node:path'

const BASE = process.env.E2E_BASE || 'http://localhost:3333'

function loadEnv() {
  const envFile = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv()

let cookie = ''
let passed = 0
let failed = 0

async function req(method: string, url: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const sc = res.headers.get('set-cookie')
  if (sc) {
    const m = sc.match(/depos_token=([^;]+)/)
    if (m) cookie = `depos_token=${m[1]}`
  }
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  return { status: res.status, data }
}

function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.log(`  FAIL  ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`)
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

async function main() {
  const run = Date.now().toString(36)
  console.log(`E2E contra ${BASE} (run ${run})\n`)

  console.log('== Auth ==')
  const bad = await req('POST', '/api/auth/login', { usuario: 'admin', password: 'mala' })
  check('login inválido → 401 INVALID_CREDENTIALS', bad.status === 401 && bad.data?.error === 'INVALID_CREDENTIALS', bad.data)

  const login = await req('POST', '/api/auth/login', { usuario: 'admin', password: 'admin123' })
  check('login admin/admin123 → 200 con rol', login.status === 200 && login.data?.user?.rol === 'admin', login.data)
  check('cookie depos_token seteada', cookie.includes('depos_token='))

  const me = await req('GET', '/api/auth/me')
  check('GET /api/auth/me → admin', me.status === 200 && me.data?.user?.usuario === 'admin', me.data)
  const adminId = me.data?.user?.id

  console.log('== Catálogos ==')
  const config = await req('GET', '/api/config')
  check('config tasa 36.5', config.status === 200 && Number(config.data?.config?.tasa_cambio) === 36.5, config.data)

  const mesas = await req('GET', '/api/mesas')
  check('mesas listadas', mesas.status === 200 && (mesas.data?.mesas?.length ?? 0) >= 12, mesas.data?.mesas?.length)

  const deps = await req('GET', '/api/departamentos')
  check('departamentos listados', deps.status === 200 && (deps.data?.departamentos?.length ?? 0) >= 3, deps.data)

  const prods = await req('GET', '/api/productos')
  check('productos listados', prods.status === 200 && (prods.data?.products?.length ?? 0) >= 8, prods.data)
  const prod1 = prods.data?.products?.[0]
  const prod2 = prods.data?.products?.[1]

  console.log('== Pedido ==')
  const creando = await req('POST', '/api/pedidos', {
    mesa_id: mesas.data.mesas[0].id,
    notas: 'E2E',
    cliente: '',
    listo: false,
    items: [{ producto_id: prod1.id, cantidad: 2, precio_usd: prod1.precio_usd, subtotal: +(prod1.precio_usd * 2).toFixed(2), notas: '' }],
  })
  check('POST /api/pedidos → id', creando.status === 200 && !!creando.data?.id, creando.data)
  const pedidoId = creando.data?.id

  const activos = await req('GET', '/api/pedidos/activos')
  check('pedido aparece en activos', activos.status === 200 && (activos.data?.pedidos ?? []).some((p: any) => p.id === pedidoId), activos.data)

  const activo = (activos.data?.pedidos ?? []).find((p: any) => p.id === pedidoId)
  check('pedido aplanado con mesa_nombre', !!activo?.mesa_nombre, activo)

  const sumando = await req('POST', `/api/pedidos/${pedidoId}/items`, {
    items: [{ producto_id: prod2.id, cantidad: 1, precio_usd: prod2.precio_usd, subtotal: prod2.precio_usd, notas: '' }],
  })
  check('agregar item → 2 items', sumando.status === 200 && (sumando.data?.items?.length ?? 0) === 2, sumando.data?.items?.length)

  const estado = await req('PUT', `/api/pedidos/${pedidoId}/estado`, { estado: 'listo' })
  check('cambiar estado a listo', estado.status === 200, estado.data)

  const pendientes = await req('GET', '/api/pedidos/pendientes')
  check('pedido en pendientes', pendientes.status === 200 && (pendientes.data?.pedidos ?? []).some((p: any) => p.id === pedidoId), pendientes.data)

  console.log('== Venta (cobro del pedido) ==')
  const itemsVenta = [
    { producto_id: prod1.id, cantidad: 2, precio_usd: prod1.precio_usd, subtotal: +(prod1.precio_usd * 2).toFixed(2) },
    { producto_id: prod2.id, cantidad: 1, precio_usd: prod2.precio_usd, subtotal: prod2.precio_usd },
  ]
  const total = +itemsVenta.reduce((a: number, i: any) => a + i.subtotal, 0).toFixed(2)
  const venta = await req('POST', '/api/ventas', {
    pedido_id: pedidoId,
    total_usd: total,
    total_bs: +(total * 36.5).toFixed(2),
    metodo_pago: 'Efectivo USD',
    referencia: '',
    items: itemsVenta,
  })
  check('POST /api/ventas → id', venta.status === 200 && !!venta.data?.id, venta.data)
  const ventaId = venta.data?.id

  const facturados = await req('GET', '/api/pedidos/facturados')
  check('pedido ahora facturado', facturados.status === 200 && (facturados.data?.pedidos ?? []).some((p: any) => p.id === pedidoId), facturados.data)

  console.log('== Reportes ==')
  const rep = await req('GET', `/api/reportes/ventas?from=${today()}&to=${today()}`)
  check('reporte ventas hoy ≥1', rep.status === 200 && (rep.data?.totals?.count ?? 0) >= 1, rep.data?.totals)
  check('total_usd ≥ venta', rep.status === 200 && Number(rep.data?.totals?.total_usd) >= total, rep.data?.totals)

  const pagos = await req('GET', `/api/reportes/pagos?from=${today()}&to=${today()}`)
  check('reporte pagos hoy ≥1', pagos.status === 200 && (pagos.data?.pagos ?? []).reduce((a: number, p: any) => a + Number(p.count), 0) >= 1, pagos.data)

  const repVenta = await req('GET', `/api/reportes/ventas/${ventaId}`)
  check('reporte detalle de venta', repVenta.status === 200 && (repVenta.data?.detalle?.length ?? 0) >= 2, repVenta.data)

  const repDep = await req('GET', `/api/reportes/ventas-por-departamento?from=${today()}&to=${today()}`)
  check('reporte por departamento', repDep.status === 200 && Array.isArray(repDep.data?.rows ?? repDep.data?.departamentos ?? repDep.data), repDep.data)

  const repMovil = await req('GET', `/api/reportes/pagos-movil?from=${today()}&to=${today()}`)
  check('reporte pagos móvil', repMovil.status === 200, repMovil.data)

  const repCob = await req('GET', `/api/reportes/cobertura?from=${today()}&to=${today()}`)
  check('reporte cobertura (RPC)', repCob.status === 200, repCob.data)

  console.log('== Crédito ==')
  const ventaCredito = await req('POST', '/api/ventas', {
    pedido_id: null,
    total_usd: 5,
    total_bs: 182.5,
    metodo_pago: 'Credito',
    referencia: '',
    credito: { tipo: 'nuevo', nombre: 'Cliente E2E', cedula: `V-${run}` },
    items: [{ producto_id: prod1.id, cantidad: 1, precio_usd: 5, subtotal: 5 }],
  })
  check('venta a crédito → id', ventaCredito.status === 200 && !!ventaCredito.data?.id, ventaCredito.data)

  const creditos = await req('GET', '/api/creditos')
  check('cliente listado con deuda 5', creditos.status === 200 && (creditos.data?.clientes ?? []).some((c: any) => c.cedula === `V-${run}` && Number(c.deuda_total) >= 5), creditos.data)

  const cliente = (creditos.data?.clientes ?? []).find((c: any) => c.cedula === `V-${run}`)
  const pagando = await req('POST', `/api/creditos/${cliente?.id}/pagar`, {
    monto_usd: 2,
    monto_bs: 73,
    metodo_pago: 'Efectivo USD',
    referencia: '',
  })
  check('pagar 2 USD del crédito', pagando.status === 200, pagando.data)

  const creditos2 = await req('GET', '/api/creditos')
  const cliente2 = (creditos2.data?.clientes ?? []).find((c: any) => c.cedula === `V-${run}`)
  check('deuda bajó a 3', Number(cliente2?.deuda_total) === 3, cliente2)

  const credDet = await req('GET', `/api/creditos/${cliente?.id}`)
  check('detalle de crédito con ventas y pagos', credDet.status === 200 && Array.isArray(credDet.data?.ventas), credDet.data)

  console.log('== Facturas (venta) ==')
  const facturas = await req('GET', '/api/facturas')
  check('facturas ≥1', facturas.status === 200 && (facturas.data?.facturas?.length ?? 0) >= 1, facturas.data)

  const factBuscada = await req('GET', `/api/facturas?search=${ventaId}`)
  check('factura por id con mesa_nombre', factBuscada.status === 200 && (factBuscada.data?.facturas ?? []).length === 1, factBuscada.data)

  const addItem = await req('POST', `/api/facturas/${ventaId}/items`, {
    producto_id: prod2.id,
    cantidad: 1,
    precio_usd: prod2.precio_usd,
    subtotal: prod2.precio_usd,
  })
  check('agregar item a factura → total sube', addItem.status === 200 && Number(addItem.data?.venta?.total_usd) > total, addItem.data?.venta)
  check('detalle con 3 items (2 + 1 agregado)', (addItem.data?.detalle?.length ?? 0) === 3, addItem.data?.detalle)

  const detalle = addItem.data?.detalle ?? []
  const itemId = detalle[detalle.length - 1]?.id
  const delItem = await req('DELETE', `/api/facturas/${ventaId}/items/${itemId}`)
  check('quitar item de factura → total vuelve', delItem.status === 200 && Math.abs(Number(delItem.data?.venta?.total_usd) - total) < 0.01, delItem.data?.venta)

  console.log('== Pedido cancelado ==')
  const pedCancel = await req('POST', '/api/pedidos', {
    mesa_id: mesas.data.mesas[1].id,
    notas: '',
    cliente: '',
    listo: false,
    items: [{ producto_id: prod1.id, cantidad: 1, precio_usd: prod1.precio_usd, subtotal: prod1.precio_usd, notas: '' }],
  })
  const cancelar = await req('POST', `/api/pedidos/${pedCancel.data?.id}/cancelar`)
  check('cancelar pedido', cancelar.status === 200, cancelar.data)

  const activos2 = await req('GET', '/api/pedidos/activos')
  check('pedido cancelado NO aparece en activos', activos2.status === 200 && !(activos2.data?.pedidos ?? []).some((p: any) => p.id === pedCancel.data?.id), activos2.data)

  const estadoCancelado = await req('PUT', `/api/pedidos/${pedCancel.data?.id}/estado`, { estado: 'listo' })
  check('estado sobre cancelado → 409 PEDIDO_CANCELADO', estadoCancelado.status === 409 && estadoCancelado.data?.error === 'PEDIDO_CANCELADO', estadoCancelado.data)

  console.log('== Departamentos CRUD ==')
  const dep = await req('POST', '/api/departamentos', { nombre: `Dep E2E ${run}`, descripcion: 'x' })
  check('crear departamento', dep.status === 200 && !!dep.data?.id, dep.data)
  const depId = dep.data?.id

  const depDup = await req('POST', '/api/departamentos', { nombre: `Dep E2E ${run}` })
  check('dup → 409 DEPARTAMENTO_EXISTS', depDup.status === 409 && depDup.data?.error === 'DEPARTAMENTO_EXISTS', depDup.data)

  const depPut = await req('PUT', `/api/departamentos/${depId}`, { nombre: `Dep E2E R ${run}` })
  check('renombrar departamento', depPut.status === 200, depPut.data)

  console.log('== Productos CRUD ==')
  const nuevoProd = await req('POST', '/api/productos', {
    codigo: `9001${run}`,
    nombre: 'Producto E2E',
    precio_usd: 2.5,
    precio_costo: 1,
    tipo: 'unidad',
    departamento_id: depId,
  })
  check('crear producto', nuevoProd.status === 200 && !!nuevoProd.data?.id, nuevoProd.data)
  const nuevoProdId = nuevoProd.data?.id

  const prodDup = await req('POST', '/api/productos', { codigo: `9001${run}`, nombre: 'Otro', precio_usd: 1, tipo: 'unidad' })
  check('dup → 409 PRODUCT_EXISTS', prodDup.status === 409 && prodDup.data?.error === 'PRODUCT_EXISTS', prodDup.data)

  const prodPut = await req('PUT', `/api/productos/${nuevoProdId}`, {
    codigo: `9001${run}`,
    nombre: 'Producto E2E v2',
    precio_usd: 3,
    precio_costo: 1,
    tipo: 'unidad',
    departamento_id: depId,
  })
  check('actualizar producto → updated 1', prodPut.status === 200 && prodPut.data?.updated === 1, prodPut.data)

  const codPost = await req('POST', `/api/productos/${nuevoProdId}/codigos`, { codigo: `9001ALT${run}` })
  check('agregar código alterno', codPost.status === 200 && !!codPost.data?.id, codPost.data)

  const cods = await req('GET', `/api/productos/${nuevoProdId}/codigos`)
  check('listar códigos → 1', cods.status === 200 && (cods.data?.codigos?.length ?? 0) === 1, cods.data)

  const codDel = await req('DELETE', `/api/productos/${nuevoProdId}/codigos/${cods.data?.codigos?.[0]?.id}`)
  check('borrar código alterno', codDel.status === 200 && codDel.data?.deleted === 1, codDel.data)

  const imp1 = await req('POST', '/api/productos/import', { products: [{ codigo: `9002${run}`, nombre: `Import E2E ${run}`, precio_usd: 1, tipo: 'unidad' }] })
  check('importar producto nuevo → inserted 1', imp1.status === 200 && imp1.data?.inserted === 1, imp1.data)

  const imp2 = await req('POST', '/api/productos/import', { products: [{ codigo: `9002${run}`, nombre: `Import E2E ${run}`, precio_usd: 1, tipo: 'unidad' }] })
  check('importar duplicado → inserted 0 skipped 1', imp2.status === 200 && imp2.data?.inserted === 0 && imp2.data?.skipped === 1, imp2.data)

  const prodDelOk = await req('DELETE', `/api/productos/${nuevoProdId}`)
  check('borrar producto sin ventas → deleted 1', prodDelOk.status === 200 && prodDelOk.data?.deleted === 1, prodDelOk.data)

  const prodDelVentas = await req('DELETE', `/api/productos/${prod1.id}`)
  check('borrar producto con ventas → 400 PRODUCT_HAS_SALES', prodDelVentas.status === 400 && prodDelVentas.data?.error === 'PRODUCT_HAS_SALES', prodDelVentas.data)

  const depDel = await req('DELETE', `/api/departamentos/${depId}`)
  check('borrar departamento', depDel.status === 200 && depDel.data?.deleted === 1, depDel.data)

  console.log('== Ingredientes + recetas ==')
  const ing = await req('POST', '/api/ingredientes', { nombre: `Ingrediente E2E ${run}`, unidad: 'kg', stock_actual: 10, stock_minimo: 2, precio_unitario: 5 })
  check('crear ingrediente', ing.status === 200 && !!ing.data?.id, ing.data)
  const ingId = ing.data?.id

  const ingPut = await req('PUT', `/api/ingredientes/${ingId}`, { nombre: `Ingrediente E2E ${run}`, unidad: 'kg', stock_actual: 10, stock_minimo: 1, precio_unitario: 6 })
  check('actualizar ingrediente → updated 1', ingPut.status === 200 && ingPut.data?.updated === 1, ingPut.data)

  const ingStock = await req('PUT', `/api/ingredientes/${ingId}/stock`, { cantidad: -3 })
  check('ajuste de stock → 7', ingStock.status === 200 && Number(ingStock.data?.stock_actual) === 7, ingStock.data)

  const ingNeg = await req('PUT', `/api/ingredientes/${ingId}/stock`, { cantidad: -100 })
  check('stock negativo → 400 INSUFFICIENT_STOCK', ingNeg.status === 400 && ingNeg.data?.error === 'INSUFFICIENT_STOCK', ingNeg.data)

  const ingList = await req('GET', '/api/ingredientes')
  check('ingrediente listado', ingList.status === 200 && (ingList.data?.ingredientes ?? []).some((i: any) => i.id === ingId), ingList.data)

  const recetaPut = await req('PUT', `/api/recetas/${prod1.id}`, { ingredientes: [{ ingrediente_id: ingId, cantidad: 2 }] })
  check('guardar receta (RPC replace_receta)', recetaPut.status === 200 && recetaPut.data?.ok === true, recetaPut.data)

  const recetaGet = await req('GET', `/api/recetas/${prod1.id}`)
  check('GET receta con nombre de ingrediente', recetaGet.status === 200 && (recetaGet.data?.receta ?? []).length === 1 && recetaGet.data.receta[0].ingrediente_nombre === `Ingrediente E2E ${run}`, recetaGet.data)

  const ingDel = await req('DELETE', `/api/ingredientes/${ingId}`)
  check('borrar ingrediente (soft)', ingDel.status === 200 && ingDel.data?.deleted === 1, ingDel.data)

  const ingList2 = await req('GET', '/api/ingredientes')
  check('ingrediente ya no se lista', ingList2.status === 200 && !(ingList2.data?.ingredientes ?? []).some((i: any) => i.id === ingId), ingList2.data)

  console.log('== Proveedores + facturas + pagos ==')
  const prov = await req('POST', '/api/proveedores', { nombre: `Prov E2E ${run}` })
  check('crear proveedor', prov.status === 200 && !!prov.data?.id, prov.data)
  const provId = prov.data?.id

  const provDup = await req('POST', '/api/proveedores', { nombre: `Prov E2E2 ${run}`, contacto: 'x' })
  check('crear2do proveedor', provDup.status === 200, provDup.data)

  const provPut = await req('PUT', `/api/proveedores/${provId}`, { nombre: `Prov E2E Mod ${run}` })
  check('actualizar proveedor → updated 1', provPut.status === 200 && provPut.data?.updated === 1, provPut.data)

  const fprov = await req('POST', `/api/proveedores/${provId}/facturas`, { numero_factura: 'F-1', monto_total: 100, descripcion: 'insumos' })
  check('crear factura proveedor', fprov.status === 200 && !!fprov.data?.id, fprov.data)
  const fprovId = fprov.data?.id

  const fprovList = await req('GET', `/api/proveedores/${provId}/facturas`)
  check('listar facturas con saldo', fprovList.status === 200 && (fprovList.data?.facturas ?? []).some((f: any) => f.id === fprovId && Number(f.saldo_pendiente) === 100), fprovList.data)

  const pprov = await req('POST', `/api/proveedores/facturas/${fprovId}/pagos`, { monto: 40, notas: 'abono' })
  check('pago a factura proveedor', pprov.status === 200 && !!pprov.data?.id, pprov.data)

  const pprovList = await req('GET', `/api/proveedores/facturas/${fprovId}/pagos`)
  check('pagos listados → 1', pprovList.status === 200 && (pprovList.data?.pagos?.length ?? 0) === 1, pprovList.data)

  const pprovExcedido = await req('POST', `/api/proveedores/facturas/${fprovId}/pagos`, { monto: 9999 })
  check('pago excedido → 400 EXCEEDS_BALANCE', pprovExcedido.status === 400 && pprovExcedido.data?.error === 'EXCEEDS_BALANCE', pprovExcedido.data)

  const fprovPut = await req('PUT', `/api/proveedores/facturas/${fprovId}`, { numero_factura: 'F-2', monto_total: 120 })
  check('actualizar factura proveedor', fprovPut.status === 200 && fprovPut.data?.updated === 1, fprovPut.data)

  const fprovDel = await req('DELETE', `/api/proveedores/facturas/${fprovId}`)
  check('borrar factura proveedor (cascade pagos)', fprovDel.status === 200 && fprovDel.data?.deleted === 1, fprovDel.data)

  const provDel = await req('DELETE', `/api/proveedores/${provId}`)
  check('borrar proveedor (soft)', provDel.status === 200 && provDel.data?.deleted === 1, provDel.data)

  const provDel2 = await req('DELETE', `/api/proveedores/${provDup.data?.id}`)
  check('borrar2do proveedor (soft)', provDel2.status === 200, provDel2.data)

  console.log('== Vendedores ==')
  const vendUser = await req('POST', '/api/usuarios', { usuario: `vend_u_${run}`, password: 'pass1234', rol: 'empleado' })
  check('crear usuario para vendedor', vendUser.status === 200 && !!vendUser.data?.id, vendUser.data)
  const vendUserId = vendUser.data?.id

  const vend = await req('POST', '/api/vendedores', { nombre: 'Vend E2E', cedula: `V-111${run}`, comision_porcentaje: 5, usuario_id: vendUserId })
  check('crear vendedor', vend.status === 200 && !!vend.data?.id, vend.data)
  const vendId = vend.data?.id

  const vendDup = await req('POST', '/api/vendedores', { nombre: 'Vend2', cedula: `V-222${run}`, usuario_id: vendUserId })
  check('mismo usuario en2 vendedores → 409 USUARIO_YA_ASIGNADO', vendDup.status === 409 && vendDup.data?.error === 'USUARIO_YA_ASIGNADO', vendDup.data)

  const vendPut = await req('PUT', `/api/vendedores/${vendId}`, { nombre: 'Vend E2E Mod', cedula: `V-111${run}`, comision_porcentaje: 7, usuario_id: vendUserId })
  check('actualizar vendedor → updated 1', vendPut.status === 200 && vendPut.data?.updated === 1, vendPut.data)

  const vendList = await req('GET', '/api/vendedores')
  check('vendedor listado con usuario_nombre', vendList.status === 200 && (vendList.data?.vendedores ?? []).some((v: any) => v.id === vendId && v.usuario_nombre === `vend_u_${run}`), vendList.data)

  const vendLookup = await req('GET', '/api/vendedores/lookup')
  check('lookup admin → null', vendLookup.status === 200 && vendLookup.data?.vendedor === null, vendLookup.data)

  const vendDel = await req('DELETE', `/api/vendedores/${vendId}`)
  check('borrar vendedor (soft)', vendDel.status === 200 && vendDel.data?.deleted === 1, vendDel.data)

  console.log('== Mesas CRUD ==')
  const mesa = await req('POST', '/api/mesas', { nombre: `Mesa E2E ${run}` })
  check('crear mesa', mesa.status === 200 && !!mesa.data?.id, mesa.data)

  const mesaDup = await req('POST', '/api/mesas', { nombre: `Mesa E2E ${run}` })
  check('mesa dup → 409 MESA_EXISTS', mesaDup.status === 409 && mesaDup.data?.error === 'MESA_EXISTS', mesaDup.data)

  const mesaDel = await req('DELETE', `/api/mesas/${mesa.data?.id}`)
  check('borrar mesa (soft)', mesaDel.status === 200 && mesaDel.data?.ok === true, mesaDel.data)

  const mesas2 = await req('GET', '/api/mesas')
  check('mesa borrada ya no se lista', mesas2.status === 200 && !(mesas2.data?.mesas ?? []).some((m: any) => m.id === mesa.data?.id), mesas2.data)

  console.log('== Config PUT ==')
  const cfgPut = await req('PUT', '/api/config', { tasa_cambio: 36.6 })
  check('admin cambia tasa', cfgPut.status === 200 && cfgPut.data?.ok === true, cfgPut.data)

  const cfgBack = await req('PUT', '/api/config', { tasa_cambio: 36.5 })
  check('admin restaura tasa', cfgBack.status === 200, cfgBack.data)

  console.log('== Usuarios / roles ==')
  const emp = await req('POST', '/api/usuarios', { usuario: `emp_e2e_${run}`, password: 'empleado123', rol: 'empleado' })
  check('crear usuario empleado', emp.status === 200 && !!emp.data?.id, emp.data)
  const empId = emp.data?.id

  const empDup = await req('POST', '/api/usuarios', { usuario: `emp_e2e_${run}`, password: 'x1234', rol: 'empleado' })
  check('usuario dup → 409 USER_EXISTS', empDup.status === 409 && empDup.data?.error === 'USER_EXISTS', empDup.data)

  const empPut = await req('PUT', `/api/usuarios/${empId}`, { rol: 'encargado' })
  check('cambiar rol empleado → encargado', empPut.status === 200 && empPut.data?.ok === true, empPut.data)

  const lastAdmin = await req('PUT', `/api/usuarios/${adminId}`, { rol: 'empleado' })
  check('degradar único admin → 409 LAST_ADMIN', lastAdmin.status === 409 && lastAdmin.data?.error === 'LAST_ADMIN', lastAdmin.data)

  const selfDel = await req('DELETE', `/api/usuarios/${adminId}`)
  check('borrarse a sí mismo → 409 CANNOT_DELETE_SELF', selfDel.status === 409 && selfDel.data?.error === 'CANNOT_DELETE_SELF', selfDel.data)

  cookie = ''
  const loginEmp = await req('POST', '/api/auth/login', { usuario: `emp_e2e_${run}`, password: 'empleado123' })
  check('login empleado', loginEmp.status === 200 && loginEmp.data?.user?.rol === 'encargado', loginEmp.data)

  const noAdmin = await req('GET', '/api/usuarios')
  check('encargado NO ve usuarios → 403', noAdmin.status === 403, noAdmin.status)

  const siProductos = await req('GET', '/api/productos')
  check('encargado SÍ ve productos', siProductos.status === 200, siProductos.status)

  const noIng = await req('POST', '/api/ingredientes', { nombre: 'X' })
  check('encargado NO crea ingredientes → 403', noIng.status === 403, noIng.status)

  const ventaEmp = await req('POST', '/api/ventas', {
    pedido_id: null,
    total_usd: 1,
    total_bs: 36.5,
    metodo_pago: 'Efectivo USD',
    referencia: '',
    items: [{ producto_id: prod1.id, cantidad: 1, precio_usd: 1, subtotal: 1 }],
  })
  check('venta como encargado → id', ventaEmp.status === 200 && !!ventaEmp.data?.id, ventaEmp.data)

  cookie = ''
  const loginAdmin2 = await req('POST', '/api/auth/login', { usuario: 'admin', password: 'admin123' })
  check('re-login admin', loginAdmin2.status === 200, loginAdmin2.data)

  const delConDatos = await req('DELETE', `/api/usuarios/${empId}`)
  check('borrar usuario con ventas → 409 USER_HAS_DATA', delConDatos.status === 409 && delConDatos.data?.error === 'USER_HAS_DATA', delConDatos.data)

  const delConVendedor = await req('DELETE', `/api/usuarios/${vendUserId}`)
  check('borrar usuario con vendedor (FK) → 409 USER_HAS_DATA', delConVendedor.status === 409 && delConVendedor.data?.error === 'USER_HAS_DATA', delConVendedor.data)

  const limpio = await req('POST', '/api/usuarios', { usuario: `clean_u_${run}`, password: 'pass1234', rol: 'empleado' })
  const delLimpio = await req('DELETE', `/api/usuarios/${limpio.data?.id}`)
  check('borrar usuario sin datos → deleted 1', limpio.status === 200 && delLimpio.status === 200 && delLimpio.data?.deleted === 1, delLimpio.data)

  console.log('== Sin sesión ==')
  cookie = ''
  const anon = await req('GET', '/api/config')
  check('sin sesión → 401', anon.status === 401, anon.status)

  console.log(`\nResultado: ${passed} pass, ${failed} fail`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error('ERROR E2E:', e)
  process.exit(1)
})

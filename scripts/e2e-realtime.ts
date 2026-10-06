import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const BASE = process.env.E2E_BASE || 'http://localhost:3111'

function loadEnv() {
  const envFile = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envFile)) return
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let cookie = ''

async function req(method: string, apiUrl: string, body?: unknown): Promise<any> {
  const res = await fetch(`${BASE}${apiUrl}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const sc = res.headers.get('set-cookie')
  const m = sc?.match(/depos_token=([^;]+)/)
  if (m) cookie = `depos_token=${m[1]}`
  const text = await res.text()
  return { status: res.status, data: text ? JSON.parse(text) : null }
}

const received: { event: string; payload: any }[] = []

function waitFor(event: string, ms = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const iv = setInterval(() => {
      const hit = received.find((r) => r.event === event)
      if (hit) {
        clearInterval(iv)
        resolve(hit.payload)
      } else if (Date.now() - started > ms) {
        clearInterval(iv)
        reject(new Error(`timeout esperando broadcast '${event}'`))
      }
    }, 100)
  })
}

async function main() {
  console.log('== Realtime (Supabase broadcast) ==')

  const supabase = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
  const channel = supabase.channel('pedidos-events')
  for (const ev of ['nuevo_pedido', 'pedido_actualizado', 'pedido_cancelado', 'pedido_pagado', 'item_agregado']) {
    channel.on('broadcast', { event: ev }, ({ payload }) => received.push({ event: ev, payload }))
  }

  const status = await new Promise<string>((resolve) => {
    channel.subscribe((s) => resolve(s))
    setTimeout(() => resolve('TIMEOUT'), 10000)
  })
  console.log(`  canal cliente: ${status}`)
  if (status !== 'SUBSCRIBED') {
    console.log('  FAIL  suscripción al canal')
    process.exit(1)
  }

  await req('POST', '/api/auth/login', { usuario: 'admin', password: 'admin123' })
  const mesas = await req('GET', '/api/mesas')
  const prods = await req('GET', '/api/productos')
  const prod = prods.data.products[0]

  console.log('  → creando pedido (evento nuevo_pedido)...')
  const ped = await req('POST', '/api/pedidos', {
    mesa_id: mesas.data.mesas[0].id,
    notas: 'rt',
    cliente: '',
    listo: false,
    items: [{ producto_id: prod.id, cantidad: 1, precio_usd: prod.precio_usd, subtotal: prod.precio_usd, notas: '' }],
  })
  const p1 = await waitFor('nuevo_pedido')
  console.log(`  PASS  nuevo_pedido recibido (mesa=${p1.mesa_nombre})`)

  console.log('  → cambiando estado (evento pedido_actualizado)...')
  await req('PUT', `/api/pedidos/${ped.data.id}/estado`, { estado: 'preparando' })
  const p2 = await waitFor('pedido_actualizado')
  console.log(`  PASS  pedido_actualizado recibido (estado=${p2.estado})`)

  console.log('  → cobrando pedido (evento pedido_pagado)...')
  await req('POST', '/api/ventas', {
    pedido_id: ped.data.id,
    total_usd: prod.precio_usd,
    total_bs: +(prod.precio_usd * 36.5).toFixed(2),
    metodo_pago: 'Efectivo USD',
    referencia: '',
    items: [{ producto_id: prod.id, cantidad: 1, precio_usd: prod.precio_usd, subtotal: prod.precio_usd }],
  })
  const p3 = await waitFor('pedido_pagado')
  console.log(`  PASS  pedido_pagado recibido (venta_id=${p3.venta_id ?? p3.id ?? '?'})`)

  supabase.removeChannel(channel)
  console.log('\nRealtime: OK')
  process.exit(0)
}

main().catch((e) => {
  console.error('\nRealtime FALLÓ:', e.message)
  process.exit(1)
})

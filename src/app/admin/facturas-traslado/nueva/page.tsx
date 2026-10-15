'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'

interface Item {
  producto_id: number | null
  descripcion: string
  cantidad: string
  precio_unitario: string
}

function importeDe(it: Item): number {
  const c = parseFloat(it.cantidad) || 0
  const p = parseFloat(it.precio_unitario) || 0
  return Math.round(c * p * 100) / 100
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function NuevaFacturaTrasladoPage() {
  const router = useRouter()
  const [destinatario, setDestinatario] = useState('')
  const [direccion, setDireccion] = useState('')
  const [rif, setRif] = useState('')
  const [fecha, setFecha] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [notas, setNotas] = useState('')
  const [items, setItems] = useState<Item[]>([{ producto_id: null, descripcion: '', cantidad: '1', precio_unitario: '' }])
  const [productos, setProductos] = useState<any[]>([])
  const [ingredientes, setIngredientes] = useState<any[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    apiFetch('/api/productos')
      .then((d) => setProductos(d.products || []))
      .catch(() => {})
    apiFetch('/api/ingredientes')
      .then((d) => setIngredientes(d.ingredientes || []))
      .catch(() => {})
  }, [])

  // Combina ingredientes + productos en una sola lista para el selector
  const catalogo = [
    ...ingredientes.map((ing) => ({
      key: `ing-${ing.id}`,
      nombre: `${ing.nombre} (${ing.unidad})`,
      precio: ing.precio_unitario,
      tipo: 'ingrediente' as const,
    })),
    ...productos.map((p) => ({
      key: `prod-${p.id}`,
      nombre: p.nombre,
      precio: p.precio_costo > 0 ? p.precio_costo : p.precio_usd,
      tipo: 'producto' as const,
    })),
  ]

  const subtotal = items.reduce((s, it) => s + importeDe(it), 0)

  function addItem() {
    setItems([...items, { producto_id: null, descripcion: '', cantidad: '1', precio_unitario: '' }])
  }

  function removeItem(i: number) {
    if (items.length <= 1) return
    setItems(items.filter((_, idx) => idx !== i))
  }

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function pickProducto(i: number, key: string) {
    if (!key) {
      updateItem(i, { producto_id: null })
      return
    }
    if (key.startsWith('ing-')) {
      const ingId = Number(key.slice(4))
      const ing = ingredientes.find((x) => Number(x.id) === ingId)
      if (!ing) return
      updateItem(i, {
        producto_id: null,
        descripcion: `${ing.nombre} (${ing.unidad})`,
        precio_unitario: String(ing.precio_unitario || ''),
      })
      return
    }
    const prodId = Number(key.slice(5))
    const p = productos.find((x) => Number(x.id) === prodId)
    if (!p) return
    updateItem(i, {
      producto_id: Number(p.id),
      descripcion: p.nombre,
      precio_unitario: String(p.precio_costo > 0 ? p.precio_costo : p.precio_usd),
    })
  }

  async function guardar() {
    setError('')
    if (!destinatario.trim()) {
      setError('El destinatario es requerido')
      return
    }
    const itemsLimpios = items
      .filter((it) => it.descripcion.trim() && (parseFloat(it.cantidad) || 0) > 0)
      .map((it) => ({
        descripcion: it.descripcion.trim(),
        cantidad: parseFloat(it.cantidad) || 0,
        precio_unitario: parseFloat(it.precio_unitario) || 0,
        producto_id: it.producto_id,
      }))
    if (itemsLimpios.length === 0) {
      setError('Agrega al menos un item con descripción y cantidad')
      return
    }
    setSaving(true)
    try {
      const res = await apiFetch('/api/facturas-traslado', {
        method: 'POST',
        body: { destinatario, direccion, rif, fecha, notas, items: itemsLimpios },
      })
      router.push(`/admin/facturas-traslado/${res.id}`)
    } catch (e: any) {
      setError(e?.data?.message || e?.data?.error || 'Error al guardar')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="bg-depo-bg py-4 md:py-5 pr-4 md:pr-8 flex items-center justify-between border-b border-depo-border-2">
        <div>
          <div className="text-[22px] font-medium text-depo-dark tracking-tight">Nueva Factura de Traslado</div>
          <div className="text-xs text-depo-gray-3 tracking-widest uppercase mt-[1px]">Envío de mercancía a otra sucursal</div>
        </div>
        <Link
          href="/admin/facturas-traslado"
          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-4 py-2 rounded transition-all hover:bg-depo-input"
        >
          ← Volver
        </Link>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error ? (
          <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
        ) : null}

        <div className="bg-white border border-depo-border rounded-[10px] p-4 md:p-6 mb-4">
          <div className="text-[13px] font-medium text-depo-dark mb-4">Datos de la factura</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-1">Señor(es) *</label>
              <input
                value={destinatario}
                onChange={(e) => setDestinatario(e.target.value)}
                placeholder="Nombre del destinatario"
                className="w-full border border-depo-border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#E8E04A]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-1">Dirección</label>
              <input
                value={direccion}
                onChange={(e) => setDireccion(e.target.value)}
                placeholder="Dirección de la sucursal"
                className="w-full border border-depo-border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#E8E04A]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-1">RIF / Cédula</label>
              <input
                value={rif}
                onChange={(e) => setRif(e.target.value)}
                placeholder="J-00000000-0"
                className="w-full border border-depo-border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#E8E04A]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full border border-depo-border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#E8E04A]"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-1">Notas</label>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones (opcional)"
                className="w-full border border-depo-border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#E8E04A]"
              />
            </div>
          </div>
        </div>

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden mb-4">
          <div className="px-4 md:px-6 py-3 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Items</span>
            <button
              onClick={addItem}
              className="bg-[#E8E04A] border border-[#E8E04A] text-[#1A1A1A] text-xs font-semibold px-3 py-1.5 rounded transition-all hover:bg-[#F0E840]"
            >
              + Agregar item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6] w-[180px]">Producto</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Descripción</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6] w-[80px]">Cant.</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6] w-[100px]">P. Unit</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6] w-[100px]">Importe</th>
                  <th className="w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b border-[#F5F3EE]">
                    <td className="px-3 md:px-4 py-2">
                      <select
                        value={it.producto_id != null ? `prod-${it.producto_id}` : (it.descripcion ? catalogo.find((c) => c.nombre === it.descripcion)?.key || '' : '')}
                        onChange={(e) => pickProducto(i, e.target.value)}
                        className="w-full border border-depo-border-2 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#E8E04A]"
                      >
                        <option value="">— Manual —</option>
                        {ingredientes.length > 0 ? (
                          <optgroup label="Ingredientes">
                            {ingredientes.map((ing) => (
                              <option key={`ing-${ing.id}`} value={`ing-${ing.id}`}>
                                {ing.nombre} ({ing.unidad})
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                        {productos.length > 0 ? (
                          <optgroup label="Productos">
                            {productos.map((p) => (
                              <option key={`prod-${p.id}`} value={`prod-${p.id}`}>
                                {p.nombre}
                              </option>
                            ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </td>
                    <td className="px-3 md:px-4 py-2">
                      <input
                        value={it.descripcion}
                        onChange={(e) => updateItem(i, { descripcion: e.target.value })}
                        placeholder="Descripción del producto"
                        className="w-full border border-depo-border-2 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#E8E04A]"
                      />
                    </td>
                    <td className="px-3 md:px-4 py-2">
                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={it.cantidad}
                        onChange={(e) => updateItem(i, { cantidad: e.target.value })}
                        className="w-full border border-depo-border-2 rounded px-2 py-1.5 text-xs text-right font-mono focus:outline-none focus:border-[#E8E04A]"
                      />
                    </td>
                    <td className="px-3 md:px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={it.precio_unitario}
                        onChange={(e) => updateItem(i, { precio_unitario: e.target.value })}
                        className="w-full border border-depo-border-2 rounded px-2 py-1.5 text-xs text-right font-mono focus:outline-none focus:border-[#E8E04A]"
                      />
                    </td>
                    <td className="px-3 md:px-4 py-2 text-right text-xs font-semibold font-mono text-depo-dark">${fmt(importeDe(it))}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeItem(i)}
                        disabled={items.length <= 1}
                        className="text-[#DC2626] hover:bg-[#DC2626] hover:text-white rounded px-1.5 py-1 text-xs transition-all disabled:opacity-30"
                        title="Quitar item"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 md:px-6 py-3 flex justify-end items-center gap-6 border-t border-[#F0EDE6] bg-depo-table-header">
            <span className="text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase">Sub-Total</span>
            <span className="text-[16px] font-bold text-depo-dark font-mono">${fmt(subtotal)}</span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={guardar}
            disabled={saving}
            className="bg-[#E8E04A] border border-[#E8E04A] text-[#1A1A1A] text-sm font-semibold px-6 py-2.5 rounded transition-all hover:bg-[#F0E840] uppercase tracking-wider disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar Factura'}
          </button>
        </div>
      </div>
    </>
  )
}

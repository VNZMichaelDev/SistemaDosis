'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'

const CATEGORIAS: { v: string; l: string }[] = [
  { v: 'alquiler', l: 'Alquiler' },
  { v: 'sueldos', l: 'Sueldos' },
  { v: 'intereses', l: 'Intereses' },
  { v: 'prestaciones', l: 'Prestaciones' },
  { v: 'servicios', l: 'Servicios' },
  { v: 'impuestos', l: 'Impuestos' },
  { v: 'transporte', l: 'Transporte' },
  { v: 'marketing', l: 'Marketing' },
  { v: 'otro', l: 'Otro' },
]

const catLabel = (c: string) => CATEGORIAS.find((x) => x.v === c)?.l || (c === 'proveedores' ? 'Proveedores (gastos)' : c)

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function presetRango(kind: 'mes' | 'pasado' | 'anio'): { from: string; to: string } {
  const hoy = new Date()
  if (kind === 'mes') {
    return { from: ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), to: ymd(hoy) }
  }
  if (kind === 'pasado') {
    return {
      from: ymd(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
      to: ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
    }
  }
  return { from: ymd(new Date(hoy.getFullYear(), 0, 1)), to: ymd(hoy) }
}

export default function ContabilidadPage() {
  const [tab, setTab] = useState<'resultados' | 'gastos' | 'inventario'>('resultados')
  const [from, setFrom] = useState(() => presetRango('mes').from)
  const [to, setTo] = useState(() => presetRango('mes').to)
  const [er, setEr] = useState<any>(null)
  const [gastos, setGastos] = useState<any[]>([])
  const [cierres, setCierres] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Gasto form
  const [openGasto, setOpenGasto] = useState(false)
  const [editGasto, setEditGasto] = useState<any>(null)
  const [gFecha, setGFecha] = useState(ymd(new Date()))
  const [gCategoria, setGCategoria] = useState('alquiler')
  const [gMonto, setGMonto] = useState('')
  const [gDesc, setGDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Inventario form
  const [iFecha, setIFecha] = useState(ymd(new Date()))
  const [iTipo, setITipo] = useState<'inicial' | 'final'>('final')
  const [iValor, setIValor] = useState('')
  const [iNotas, setINotas] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [erData, gData, cData] = await Promise.all([
        apiFetch(`/api/reportes/estado-resultados?from=${from}&to=${to}`),
        apiFetch(`/api/gastos?from=${from}&to=${to}`),
        apiFetch('/api/inventario-cierres'),
      ])
      setEr(erData)
      setGastos(gData.gastos || [])
      setCierres(cData.cierres || [])
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to])

  function aplicarPreset(kind: 'mes' | 'pasado' | 'anio') {
    const r = presetRango(kind)
    setFrom(r.from)
    setTo(r.to)
  }

  function openNewGasto() {
    setEditGasto(null)
    setGFecha(ymd(new Date()))
    setGCategoria('alquiler')
    setGMonto('')
    setGDesc('')
    setOpenGasto(true)
  }

  function openEditGasto(g: any) {
    setEditGasto(g)
    setGFecha(g.fecha)
    setGCategoria(g.categoria)
    setGMonto(String(g.monto_usd))
    setGDesc(g.descripcion || '')
    setOpenGasto(true)
  }

  async function submitGasto(e: any) {
    e.preventDefault()
    const monto = Number(gMonto)
    if (!monto || monto <= 0) return
    setSaving(true)
    setError('')
    try {
      const body = { fecha: gFecha, categoria: gCategoria, descripcion: gDesc.trim(), monto_usd: monto }
      if (editGasto) await apiFetch(`/api/gastos/${editGasto.id}`, { method: 'PUT', body })
      else await apiFetch('/api/gastos', { method: 'POST', body })
      setOpenGasto(false)
      load()
    } catch (e: any) {
      setError(e?.data?.error || 'SAVE_FAILED')
    } finally {
      setSaving(false)
    }
  }

  async function deleteGasto(g: any) {
    if (!confirm(`¿Eliminar gasto "${catLabel(g.categoria)} - $${fmt(g.monto_usd)}"?`)) return
    try {
      await apiFetch(`/api/gastos/${g.id}`, { method: 'DELETE' })
      load()
    } catch (e: any) {
      setError(e?.data?.error || 'DELETE_FAILED')
    }
  }

  async function submitCierre(e: any) {
    e.preventDefault()
    const valor = Number(iValor)
    if (!valor || valor < 0) return
    setSaving(true)
    setError('')
    try {
      await apiFetch('/api/inventario-cierres', {
        method: 'POST',
        body: { fecha: iFecha, tipo: iTipo, valor_usd: valor, notas: iNotas.trim() },
      })
      setIValor('')
      setINotas('')
      load()
    } catch (e: any) {
      setError(e?.data?.error || 'SAVE_FAILED')
    } finally {
      setSaving(false)
    }
  }

  async function deleteCierre(c: any) {
    if (!confirm(`¿Eliminar cierre de inventario del ${c.fecha} ($${fmt(c.valor_usd)})?`)) return
    try {
      await apiFetch(`/api/inventario-cierres/${c.id}`, { method: 'DELETE' })
      load()
    } catch (e: any) {
      setError(e?.data?.error || 'DELETE_FAILED')
    }
  }

  const tabs = [
    { k: 'resultados', l: 'Estado de Resultados' },
    { k: 'gastos', l: 'Gastos' },
    { k: 'inventario', l: 'Inventario' },
  ]

  const totalGastosPeriodo = gastos.reduce((s, g) => s + Number(g.monto_usd || 0), 0)

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-2 border-b border-depo-border-2 md:bg-transparent">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-lg font-medium text-depo-dark tracking-tight">Contabilidad</div>
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Estado de resultados · gastos · inventario</div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => aplicarPreset('mes')} className="bg-white border border-depo-border-2 text-[#444] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-depo-bg">Este mes</button>
            <button onClick={() => aplicarPreset('pasado')} className="bg-white border border-depo-border-2 text-[#444] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-depo-bg">Mes pasado</button>
            <button onClick={() => aplicarPreset('anio')} className="bg-white border border-depo-border-2 text-[#444] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-depo-bg">Año</button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans" />
          </div>
          <div className="flex gap-1 pb-[1px]">
            {tabs.map((t) => (
              <button key={t.k} onClick={() => setTab(t.k as any)}
                className={`text-[12px] font-semibold px-3.5 py-[7px] rounded-lg transition-colors ${tab === t.k ? 'bg-depo-dark text-depo-yellow' : 'bg-white border border-depo-border-2 text-depo-gray-2 hover:bg-depo-bg'}`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}
        {loading && !er && <div className="text-sm text-depo-gray-3">Cargando...</div>}

        {/* ============ TAB: ESTADO DE RESULTADOS ============ */}
        {tab === 'resultados' && er && (
          <div className="max-w-[720px]">
            {er.inventario_incompleto && (
              <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-[13px] text-amber-800 border border-amber-200">
                ⚠ Falta registrar inventario {er.inventario_inicial ? '' : 'inicial'}{!er.inventario_inicial && !er.inventario_final ? ' y ' : ' '}{er.inventario_final ? '' : 'final'} de este período.
                Ve a la pestaña <strong>Inventario</strong> para completarlo (la contadora lo cuenta a mano).
              </div>
            )}

            <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
              <div className="px-5 md:px-7 py-4 border-b border-[#F0EDE6] flex items-center justify-between bg-depo-table-header">
                <span className="text-[15px] font-semibold text-depo-dark">Estado de Resultados</span>
                <span className="text-[12px] font-mono text-depo-gray-3">{er.from} — {er.to}</span>
              </div>

              <div className="px-5 md:px-7 py-5 font-mono text-[14px] space-y-[6px]">
                <Row label="Ventas" value={er.ventas.total_usd} sub={`${er.ventas.count} venta${er.ventas.count === 1 ? '' : 's'}`} />
                <Row
                  label="Inventario Inicial"
                  value={er.inventario_inicial?.valor_usd ?? null}
                  sub={er.inventario_inicial ? `corte ${er.inventario_inicial.fecha}` : 'sin registrar'}
                  warn={!er.inventario_inicial}
                />
                <Row label="Compras" value={er.compras_total} sub="facturas de proveedor del período" />
                <Row label="Mercancía Disponible para la Venta" value={er.disponible} strong />
                <Row
                  label="(−) Inventario Final"
                  value={er.inventario_final?.valor_usd ?? null}
                  sub={er.inventario_final ? `corte ${er.inventario_final.fecha}` : 'sin registrar'}
                  warn={!er.inventario_final}
                />
                <Row label="= Costo de la Mercancía Vendida" value={er.costo_venta} muted />
                <Row label="Utilidad Bruta" value={er.utilidad_bruta} strong accent />

                <div className="pt-3 pb-1 border-t border-dashed border-[#E5E7EB] mt-3">
                  <div className="text-[12px] font-sans font-semibold text-depo-dark tracking-wide uppercase mb-1.5">Gastos</div>
                  <div className="space-y-[5px] pl-2">
                    {er.gastos.detalle.length === 0 && (
                      <div className="text-[13px] text-[#BBB]">Sin gastos registrados en el período</div>
                    )}
                    {er.gastos.detalle.map((d: any) => (
                      <div key={d.categoria} className="flex justify-between text-[13.5px]">
                        <span className="text-depo-gray-2">{catLabel(d.categoria)}</span>
                        <span>${fmt(d.total_usd)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-[14px] font-semibold mt-2 pt-2 border-t border-[#F0EDE6]">
                    <span>Total Gastos</span>
                    <span>${fmt(er.gastos.total)}</span>
                  </div>
                </div>

                <div className="pt-3 mt-2 border-t-2 border-depo-dark flex justify-between text-[17px] font-bold">
                  <span>UTILIDAD</span>
                  <span className={er.utilidad >= 0 ? 'text-green-700' : 'text-rose-600'}>${fmt(er.utilidad)}</span>
                </div>

                <div className="pt-2 text-[13px] text-depo-gray-2 font-sans">
                  <span className="font-semibold text-depo-dark">NOTAS — Utilidad/Ventas:</span> ${fmt(er.utilidad)} / ${fmt(er.ventas.total_usd)} ={' '}
                  <span className="font-semibold">{fmt(er.margen_pct)}%</span>
                </div>
              </div>
            </div>

            {er.gastos.proveedores.length > 0 && (
              <div className="mt-4 bg-white border border-depo-border rounded-[10px] px-5 py-4">
                <div className="text-[13px] font-medium text-depo-dark mb-2">Gastos de proveedores en el período</div>
                <table className="w-full text-[12.5px] font-mono">
                  <tbody>
                    {er.gastos.proveedores.map((f: any) => (
                      <tr key={f.id} className="border-b border-[#F5F3EE] last:border-0">
                        <td className="py-1.5 text-depo-gray-3 font-sans">{f.fecha}</td>
                        <td className="py-1.5">{f.numero_factura || `#${f.id}`}</td>
                        <td className="py-1.5 text-depo-gray-2 font-sans">{f.descripcion || '—'}</td>
                        <td className="py-1.5 text-right">${fmt(f.monto_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ============ TAB: GASTOS ============ */}
        {tab === 'gastos' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] text-depo-gray-2">
                Gastos del período: <span className="font-mono font-semibold text-depo-dark">${fmt(totalGastosPeriodo)}</span>
                <span className="text-depo-gray-3 text-[11px]"> · {gastos.length} registro{gastos.length === 1 ? '' : 's'}</span>
              </div>
              <button onClick={openNewGasto}
                className="bg-depo-dark text-white border-none rounded-lg py-2 px-4 text-[12px] font-semibold cursor-pointer transition-colors hover:bg-[#333] tracking-wide active:scale-[0.97]">
                + Nuevo gasto
              </button>
            </div>

            <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Fecha</th>
                      <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Categoría</th>
                      <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Descripción</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Monto</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gastos.map((g) => (
                      <tr key={g.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                        <td className="px-4 md:px-6 py-[13px] text-[13px] font-mono text-depo-gray-2">{g.fecha}</td>
                        <td className="px-4 md:px-6 py-[13px] text-[13px]">
                          <span className="inline-block px-[10px] py-[3px] rounded text-[11px] font-medium tracking-wide bg-amber-50 text-amber-800">{catLabel(g.categoria)}</span>
                        </td>
                        <td className="px-4 md:px-6 py-[13px] text-[13px] text-depo-gray-2">{g.descripcion || <span className="text-[#CCC]">—</span>}</td>
                        <td className="px-4 md:px-6 py-[13px] text-[13px] font-mono text-right text-rose-600">${fmt(g.monto_usd)}</td>
                        <td className="px-4 md:px-6 py-[13px]">
                          <div className="flex gap-[6px] justify-end">
                            <button onClick={() => openEditGasto(g)}
                              className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans">
                              Editar
                            </button>
                            <button onClick={() => deleteGasto(g)}
                              className="bg-depo-bg border border-depo-border-2 text-[#DC2626] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-rose-50 hover:border-rose-300 font-sans">
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {gastos.length === 0 && (
                      <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={5}>Sin gastos en este período</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============ TAB: INVENTARIO ============ */}
        {tab === 'inventario' && (
          <div className="max-w-[720px]">
            <div className="bg-white border border-depo-border rounded-[10px] px-5 py-4 mb-4">
              <div className="text-[13px] font-medium text-depo-dark mb-1">Registrar inventario valorizado</div>
              <div className="text-[11.5px] text-depo-gray-3 mb-3">
                Como lo hace la contadora: cuenta el inventario al <strong>inicio</strong> del período (Inicial) y al <strong>cierre</strong> (Final), y el sistema hace la cuenta.
              </div>
              <form onSubmit={submitCierre} className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Fecha</label>
                  <input type="date" value={iFecha} onChange={(e) => setIFecha(e.target.value)}
                    className="bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Tipo</label>
                  <select value={iTipo} onChange={(e) => setITipo(e.target.value as any)}
                    className="bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans">
                    <option value="inicial">Inicial</option>
                    <option value="final">Final</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Valor (USD) *</label>
                  <input type="number" step="0.01" min="0" value={iValor} onChange={(e) => setIValor(e.target.value)} placeholder="0.00"
                    className="bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans w-[130px]" />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Notas</label>
                  <input value={iNotas} onChange={(e) => setINotas(e.target.value)} placeholder="Opcional..."
                    className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans" />
                </div>
                <button type="submit" disabled={saving || !Number(iValor)}
                  className="bg-depo-dark text-white border-none px-5 py-[8px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
              </form>
            </div>

            <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0EDE6] text-[13px] font-medium text-depo-dark">Capturas registradas</div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-5 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Fecha</th>
                    <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-5 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Tipo</th>
                    <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-5 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Valor</th>
                    <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-5 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Notas</th>
                    <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-5 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cierres.map((c) => (
                    <tr key={c.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                      <td className="px-5 py-[13px] text-[13px] font-mono text-depo-gray-2">{c.fecha}</td>
                      <td className="px-5 py-[13px] text-[13px]">
                        <span className={`inline-block px-[10px] py-[3px] rounded text-[11px] font-semibold ${c.tipo === 'inicial' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {c.tipo === 'inicial' ? 'Inicial' : 'Final'}
                        </span>
                      </td>
                      <td className="px-5 py-[13px] text-[13px] font-mono text-right text-depo-dark">${fmt(c.valor_usd)}</td>
                      <td className="px-5 py-[13px] text-[13px] text-depo-gray-2">{c.notas || <span className="text-[#CCC]">—</span>}</td>
                      <td className="px-5 py-[13px] text-right">
                        <button onClick={() => deleteCierre(c)}
                          className="bg-depo-bg border border-depo-border-2 text-[#DC2626] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-rose-50 hover:border-rose-300 font-sans">
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {cierres.length === 0 && (
                    <tr><td className="px-5 py-8 text-center text-sm text-depo-gray-3" colSpan={5}>Sin capturas de inventario</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal gasto */}
      {openGasto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenGasto(false)} />
          <div className="relative bg-white rounded-xl w-[420px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">{editGasto ? 'Editar gasto' : 'Nuevo gasto'}</div>
            <form onSubmit={submitGasto} className="space-y-[14px] overflow-y-auto px-7 py-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Fecha *</label>
                  <input type="date" value={gFecha} onChange={(e) => setGFecha(e.target.value)}
                    className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Categoría *</label>
                  <select value={gCategoria} onChange={(e) => setGCategoria(e.target.value)}
                    className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans">
                    {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Monto (USD) *</label>
                <input type="number" step="0.01" min="0" value={gMonto} onChange={(e) => setGMonto(e.target.value)} placeholder="0.00"
                  className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Descripción</label>
                <textarea rows={2} value={gDesc} onChange={(e) => setGDesc(e.target.value)} placeholder="Ej: Alquiler de local octubre..."
                  className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans resize-none" />
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button type="button" onClick={() => setOpenGasto(false)}
                  className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !Number(gMonto) || Number(gMonto) <= 0}
                  className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function Row({
  label,
  value,
  sub,
  strong,
  muted,
  accent,
  warn,
}: {
  label: string
  value: number | null
  sub?: string
  strong?: boolean
  muted?: boolean
  accent?: boolean
  warn?: boolean
}) {
  return (
    <div className={`flex justify-between items-baseline gap-3 ${strong ? 'font-semibold text-depo-dark' : muted ? 'text-depo-gray-2' : ''}`}>
      <span className="font-sans text-[13.5px] flex items-baseline gap-2">
        {label}
        {sub && <span className={`text-[11px] ${warn ? 'text-amber-600 font-semibold' : 'text-depo-gray-3'}`}>{warn ? `⚠ ${sub}` : `(${sub})`}</span>}
      </span>
      <span className={`font-mono tabular-nums ${accent ? (Number(value) >= 0 ? 'text-green-700' : 'text-rose-600') : 'text-depo-dark'}`}>
        {value === null ? '—' : `$${fmt(value)}`}
      </span>
    </div>
  )
}

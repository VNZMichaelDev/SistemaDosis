'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function FacturasTrasladoPage() {
  const [facturas, setFacturas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [openPago, setOpenPago] = useState(false)
  const [pagoFactura, setPagoFactura] = useState<any>(null)
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoNotas, setPagoNotas] = useState('')
  const [savingPago, setSavingPago] = useState(false)

  const [openHistorial, setOpenHistorial] = useState(false)
  const [historialFactura, setHistorialFactura] = useState<any>(null)
  const [historialPagos, setHistorialPagos] = useState<any[]>([])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/api/facturas-traslado')
      setFacturas(data.facturas || [])
    } catch (e: any) {
      setError(e?.data?.error || 'Error al cargar facturas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function eliminar(f: any) {
    if (!confirm(`¿Eliminar la factura ${f.numero}?`)) return
    setDeletingId(f.id)
    try {
      await apiFetch(`/api/facturas-traslado/${f.id}`, { method: 'DELETE' })
      await load()
    } catch (e: any) {
      setError(e?.data?.error || 'Error al eliminar')
    } finally {
      setDeletingId(null)
    }
  }

  function openPagoForm(f: any) {
    setPagoFactura(f)
    setPagoMonto('')
    setPagoNotas('')
    setOpenPago(true)
  }

  async function submitPago(e: any) {
    e.preventDefault()
    const monto = Number(pagoMonto)
    if (!monto || monto <= 0) return
    setSavingPago(true)
    setError('')
    try {
      await apiFetch(`/api/facturas-traslado/${pagoFactura.id}/pagos`, {
        method: 'POST',
        body: { monto, notas: pagoNotas.trim() },
      })
      setOpenPago(false)
      await load()
    } catch (e: any) {
      setError(e?.data?.error === 'EXCEEDS_BALANCE' ? 'El monto excede el saldo pendiente' : (e?.data?.error || 'Error al registrar el abono'))
    } finally {
      setSavingPago(false)
    }
  }

  async function openHistorialPagos(f: any) {
    setHistorialFactura(f)
    try {
      const data = await apiFetch(`/api/facturas-traslado/${f.id}/pagos`)
      setHistorialPagos(data.pagos || [])
    } catch {
      setHistorialPagos([])
    }
    setOpenHistorial(true)
  }

  const totalGeneral = facturas.reduce((s, f) => s + (f.total || 0), 0)
  const totalPagadoGeneral = facturas.reduce((s, f) => s + (f.monto_pagado || 0), 0)
  const totalSaldoGeneral = facturas.reduce((s, f) => s + (f.saldo_pendiente || 0), 0)

  return (
    <>
      <div className="bg-depo-bg py-4 md:py-5 pr-4 md:pr-8 flex items-center justify-between border-b border-depo-border-2">
        <div>
          <div className="text-[22px] font-medium text-depo-dark tracking-tight">Facturas de Traslado</div>
          <div className="text-xs text-depo-gray-3 tracking-widest uppercase mt-[1px]">Envíos de mercancía entre sucursales</div>
        </div>
        <Link
          href="/admin/facturas-traslado/nueva"
          className="bg-[#E8E04A] border border-[#E8E04A] text-[#1A1A1A] text-xs font-semibold px-4 py-2 rounded transition-all hover:bg-[#F0E840] uppercase tracking-wider"
        >
          + Nueva Factura
        </Link>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error ? (
          <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
        ) : null}

        {facturas.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-white border border-depo-border rounded-[10px] p-4 md:p-5">
              <div className="text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-1">Total facturado</div>
              <span className="text-[28px] font-bold text-depo-dark font-mono">${fmt(totalGeneral)}</span>
              <span className="text-[13px] text-depo-gray-3 ml-2">{facturas.length} factura{facturas.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="bg-white border border-depo-border rounded-[10px] p-4 md:p-5">
              <div className="text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-1">Total abonado</div>
              <span className="text-[28px] font-bold text-green-700 font-mono">${fmt(totalPagadoGeneral)}</span>
            </div>
            <div className="bg-white border border-depo-border rounded-[10px] p-4 md:p-5">
              <div className="text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-1">Saldo pendiente</div>
              <span className={`text-[28px] font-bold font-mono ${totalSaldoGeneral > 0 ? 'text-rose-600' : 'text-green-700'}`}>${fmt(totalSaldoGeneral)}</span>
            </div>
          </div>
        ) : null}

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Facturas emitidas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[820px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">N°</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Fecha</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Destinatario</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Total</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Abonado</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Saldo</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-semibold text-depo-dark font-mono">{f.numero}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2 font-mono">{f.fecha}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">{f.destinatario}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-semibold font-mono text-right">${fmt(f.total)}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-mono text-right text-green-700">${fmt(f.monto_pagado)}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-mono text-right">
                      <span className={f.saldo_pendiente > 0 ? 'text-rose-600 font-medium' : 'text-green-700'}>
                        ${fmt(f.saldo_pendiente)}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-[14px]">
                      <div className="flex gap-[6px] justify-end flex-wrap">
                        {f.saldo_pendiente > 0 ? (
                          <button
                            onClick={() => openPagoForm(f)}
                            className="bg-green-600 border-none text-white text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-green-700"
                          >
                            + Abono
                          </button>
                        ) : null}
                        <button
                          onClick={() => openHistorialPagos(f)}
                          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC]"
                        >
                          Pagos
                        </button>
                        <Link
                          href={`/admin/facturas-traslado/${f.id}`}
                          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC]"
                        >
                          Ver / PDF
                        </Link>
                        <button
                          disabled={deletingId === f.id}
                          onClick={() => eliminar(f)}
                          className="text-[#DC2626] hover:text-white hover:bg-[#DC2626] border border-[#DC2626] rounded px-[10px] py-[5px] text-xs font-medium transition-all disabled:opacity-40"
                        >
                          {deletingId === f.id ? '...' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && facturas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-depo-gray-3">
                      No hay facturas de traslado. Crea la primera con el botón &quot;+ Nueva Factura&quot;.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {openPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenPago(false)} />
          <div className="relative bg-white rounded-xl w-[380px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">Registrar abono</div>
            <div className="text-[11px] text-depo-gray-3 px-7 pt-1 shrink-0">
              {pagoFactura?.numero} · Saldo: <span className="text-rose-600 font-medium">${fmt(pagoFactura?.saldo_pendiente)}</span>
            </div>
            <form onSubmit={submitPago} className="space-y-[14px] overflow-y-auto px-7 py-5">
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Monto (USD) *</label>
                <input type="number" step="0.01" className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={pagoMonto} onChange={(e) => setPagoMonto(e.target.value)} placeholder="0.00" autoFocus />
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Notas</label>
                <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={pagoNotas} onChange={(e) => setPagoNotas(e.target.value)} placeholder="Referencia, método de pago..." />
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button type="button" onClick={() => setOpenPago(false)}
                  className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={savingPago || !Number(pagoMonto) || Number(pagoMonto) <= 0}
                  className="bg-green-600 text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-green-700 disabled:opacity-60">
                  {savingPago ? 'Registrando...' : 'Registrar abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {openHistorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenHistorial(false)} />
          <div className="relative bg-white rounded-xl w-[480px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-2 shrink-0">
              Abonos — {historialFactura?.numero}
            </div>
            <div className="flex-1 overflow-y-auto px-7 pb-5">
              {historialPagos.length === 0 ? (
                <div className="text-sm text-depo-gray-3 text-center py-6">Sin abonos registrados</div>
              ) : (
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 border-b border-[#F0EDE6]">Fecha</th>
                      <th className="text-right text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 border-b border-[#F0EDE6]">Monto</th>
                      <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 border-b border-[#F0EDE6]">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialPagos.map((pg) => (
                      <tr key={pg.id} className="border-b border-[#F5F3EE]">
                        <td className="px-3 py-2 text-[12px] text-depo-dark">{new Date(pg.fecha_pago).toLocaleString()}</td>
                        <td className="px-3 py-2 text-[12px] text-green-700 font-mono text-right">${Number(pg.monto).toFixed(2)}</td>
                        <td className="px-3 py-2 text-[12px] text-depo-gray-2">{pg.notas || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-7 pb-5">
              <button onClick={() => setOpenHistorial(false)}
                className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333]">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

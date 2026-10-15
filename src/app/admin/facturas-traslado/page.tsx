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

  const totalGeneral = facturas.reduce((s, f) => s + (f.total || 0), 0)

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
          <div className="bg-white border border-depo-border rounded-[10px] p-4 md:p-5 mb-4">
            <div className="text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-1">Total facturado</div>
            <span className="text-[28px] font-bold text-depo-dark font-mono">${fmt(totalGeneral)}</span>
            <span className="text-[13px] text-depo-gray-3 ml-2">{facturas.length} factura{facturas.length !== 1 ? 's' : ''}</span>
          </div>
        ) : null}

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Facturas emitidas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[560px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">N°</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Fecha</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Destinatario</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Total</th>
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
                    <td className="px-3 md:px-6 py-[14px]">
                      <div className="flex gap-[6px] justify-end">
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
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-depo-gray-3">
                      No hay facturas de traslado. Crea la primera con el botón &quot;+ Nueva Factura&quot;.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}

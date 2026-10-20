'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api-client'

const EMPRESA_NOMBRE = 'Comercializadora NICOBA, C.A'
const EMPRESA_RIF = 'J501089256'

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtFecha(fecha: string): string {
  if (!fecha) return '—'
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

export default function VerFacturaTrasladoPage() {
  const params = useParams()
  const id = params?.id
  const [factura, setFactura] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [pagos, setPagos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [generandoPdf, setGenerandoPdf] = useState(false)

  const [openPago, setOpenPago] = useState(false)
  const [pagoMonto, setPagoMonto] = useState('')
  const [pagoNotas, setPagoNotas] = useState('')
  const [savingPago, setSavingPago] = useState(false)

  async function cargarTodo() {
    try {
      const [d, pg] = await Promise.all([
        apiFetch(`/api/facturas-traslado/${id}`),
        apiFetch(`/api/facturas-traslado/${id}/pagos`).catch(() => ({ pagos: [] })),
      ])
      setFactura(d.factura)
      setItems(d.items || [])
      setPagos(pg.pagos || [])
    } catch (e: any) {
      setError(e?.data?.error || 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!id) return
    cargarTodo()
  }, [id])

  const montoPagado = pagos.reduce((s, pg) => s + (Number(pg.monto) || 0), 0)
  const saldoPendiente = (Number(factura?.total) || 0) - montoPagado

  function abrirPago() {
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
      await apiFetch(`/api/facturas-traslado/${id}/pagos`, {
        method: 'POST',
        body: { monto, notas: pagoNotas.trim() },
      })
      setOpenPago(false)
      await cargarTodo()
    } catch (e: any) {
      setError(e?.data?.error === 'EXCEEDS_BALANCE' ? 'El monto excede el saldo pendiente' : (e?.data?.error || 'Error al registrar el abono'))
    } finally {
      setSavingPago(false)
    }
  }

  async function descargarPdf() {
    if (!factura) return
    setGenerandoPdf(true)
    try {
      const [{ jsPDF }, autoTableMod] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      const autoTable = (autoTableMod as any).default || autoTableMod

      const doc = new jsPDF({ unit: 'mm', format: 'letter' })
      const pageW = doc.internal.pageSize.getWidth()

      // Logo
      let logoAltura = 0
      try {
        const logo = await cargarLogo()
        if (logo) {
          logoAltura = 36 * (logo.height / logo.width)
          doc.addImage(logo.data, 'PNG', pageW / 2 - 18, 10, 36, logoAltura, undefined, 'FAST')
        }
      } catch {
        // sin logo, continúa
      }

      let y = 10 + logoAltura + 6

      // Encabezado empresa
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.text(EMPRESA_NOMBRE, pageW / 2, y, { align: 'center' })
      y += 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`RIF: ${EMPRESA_RIF}`, pageW / 2, y, { align: 'center' })
      y += 8

      // Línea separadora
      doc.setDrawColor(0)
      doc.setLineWidth(0.4)
      doc.line(15, y, pageW - 15, y)
      y += 8

      // Datos factura
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text('FACTURA DE TRASLADO', 15, y)
      doc.setFont('helvetica', 'normal')
      doc.text(`N°: ${factura.numero}`, pageW - 15, y, { align: 'right' })
      y += 7

      doc.setFontSize(10)
      doc.text(`Señor(es): ${factura.destinatario || '—'}`, 15, y)
      doc.text(`Fecha: ${fmtFecha(factura.fecha)}`, pageW - 15, y, { align: 'right' })
      y += 6
      if (factura.direccion) {
        doc.text(`Dirección: ${factura.direccion}`, 15, y)
      }
      if (factura.rif) {
        doc.text(`RIF/Cédula: ${factura.rif}`, pageW - 15, y, { align: 'right' })
      }
      y += 8

      // Tabla de items
      autoTable(doc, {
        startY: y,
        margin: { left: 15, right: 15 },
        head: [['CANT.', 'DESCRIPCIÓN', 'P. Unit.', 'IMPORTE']],
        body: items.map((it) => [
          String(it.cantidad),
          it.descripcion,
          `$${fmt(it.precio_unitario)}`,
          `$${fmt(it.importe)}`,
        ]),
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 22, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 28, halign: 'right' },
          3: { cellWidth: 28, halign: 'right' },
        },
      })

      const finalY = (doc as any).lastAutoTable?.finalY || y + 40

      // Totales
      let ty = finalY + 10
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text('SUB-TOTAL:', pageW - 60, ty, { align: 'right' })
      doc.text(`$${fmt(factura.subtotal)}`, pageW - 15, ty, { align: 'right' })
      ty += 8
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text('TOTAL BS.:', pageW - 60, ty, { align: 'right' })
      doc.text(`$${fmt(factura.total)}`, pageW - 15, ty, { align: 'right' })

      // Notas
      if (factura.notas) {
        ty += 12
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(`Notas: ${factura.notas}`, 15, ty)
      }

      // Firma
      const pageH = doc.internal.pageSize.getHeight()
      const fy = pageH - 25
      doc.setLineWidth(0.3)
      doc.line(15, fy, 80, fy)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text('FIRMA DEL REMITENTE', 15, fy + 4)
      doc.line(pageW - 80, fy, pageW - 15, fy)
      doc.text('FIRMA DEL CLIENTE', pageW - 80, fy + 4)

      doc.save(`Factura_${factura.numero}.pdf`)
    } catch (e) {
      console.error(e)
      alert('Error al generar el PDF')
    } finally {
      setGenerandoPdf(false)
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <span className="text-sm text-depo-gray-3">Cargando factura…</span>
      </div>
    )
  }

  if (error || !factura) {
    return (
      <div className="flex-1 py-8 pr-4 md:pr-8">
        <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">
          {error || 'Factura no encontrada'}
        </div>
        <Link href="/admin/facturas-traslado" className="text-sm text-depo-dark underline">
          ← Volver a facturas
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="bg-depo-bg py-4 md:py-5 pr-4 md:pr-8 flex items-center justify-between border-b border-depo-border-2">
        <div>
          <div className="text-[22px] font-medium text-depo-dark tracking-tight">Factura {factura.numero}</div>
          <div className="text-xs text-depo-gray-3 tracking-widest uppercase mt-[1px]">{factura.destinatario}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={descargarPdf}
            disabled={generandoPdf}
            className="bg-[#E8E04A] border border-[#E8E04A] text-[#1A1A1A] text-xs font-semibold px-4 py-2 rounded transition-all hover:bg-[#F0E840] uppercase tracking-wider disabled:opacity-50"
          >
            {generandoPdf ? 'Generando…' : '⬇ Descargar PDF'}
          </button>
          <Link
            href="/admin/facturas-traslado"
            className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-4 py-2 rounded transition-all hover:bg-depo-input"
          >
            ← Volver
          </Link>
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {/* Vista previa estilo factura */}
        <div className="bg-white border border-depo-border rounded-[10px] p-6 md:p-10 max-w-[720px] mx-auto shadow-sm">
          <div className="text-center mb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Logo" className="mx-auto mb-3 max-h-[80px] w-auto" />
            <div className="text-lg font-bold text-depo-dark">{EMPRESA_NOMBRE}</div>
            <div className="text-sm text-depo-gray-2">RIF: {EMPRESA_RIF}</div>
          </div>

          <div className="border-t border-b border-depo-border py-3 mb-4 flex flex-wrap justify-between gap-2 text-sm">
            <div>
              <div className="text-[11px] text-depo-gray-3 tracking-widest uppercase">Señor(es)</div>
              <div className="font-semibold text-depo-dark">{factura.destinatario || '—'}</div>
              {factura.direccion ? <div className="text-depo-gray-2">{factura.direccion}</div> : null}
              {factura.rif ? <div className="text-depo-gray-2">RIF/C.I: {factura.rif}</div> : null}
            </div>
            <div className="text-right">
              <div className="text-[11px] text-depo-gray-3 tracking-widest uppercase">N° Factura</div>
              <div className="font-bold font-mono text-depo-dark">{factura.numero}</div>
              <div className="text-depo-gray-2 font-mono">{fmtFecha(factura.fecha)}</div>
            </div>
          </div>

          <table className="w-full border-collapse mb-4 text-sm">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Cant.</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Descripción</th>
                <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">P. Unit.</th>
                <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Importe</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id || i} className="border-b border-[#F5F3EE]">
                  <td className="px-3 py-2 font-mono text-center">{it.cantidad}</td>
                  <td className="px-3 py-2 font-medium text-depo-dark">{it.descripcion}</td>
                  <td className="px-3 py-2 text-right font-mono">${fmt(it.precio_unitario)}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">${fmt(it.importe)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end gap-8 text-sm mb-4">
            <div className="text-right">
              <div className="text-[11px] text-depo-gray-3 tracking-widest uppercase">Sub-Total</div>
              <div className="font-semibold font-mono">${fmt(factura.subtotal)}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-depo-gray-3 tracking-widest uppercase">Total</div>
              <div className="text-lg font-bold font-mono text-depo-dark">${fmt(factura.total)}</div>
            </div>
          </div>

          {pagos.length > 0 || saldoPendiente < Number(factura.total) ? (
            <div className="flex justify-end gap-8 text-sm mb-8">
              <div className="text-right">
                <div className="text-[11px] text-depo-gray-3 tracking-widest uppercase">Abonado</div>
                <div className="font-semibold font-mono text-green-700">${fmt(montoPagado)}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px] text-depo-gray-3 tracking-widest uppercase">Saldo</div>
                <div className={`font-bold font-mono ${saldoPendiente > 0 ? 'text-rose-600' : 'text-green-700'}`}>${fmt(saldoPendiente)}</div>
              </div>
            </div>
          ) : (
            <div className="mb-8" />
          )}

          {factura.notas ? (
            <div className="text-sm text-depo-gray-2 mb-6">
              <span className="text-[11px] text-depo-gray-3 tracking-widest uppercase">Notas: </span>
              {factura.notas}
            </div>
          ) : null}

          <div className="flex justify-between gap-8 pt-8 mt-4 border-t border-depo-border">
            <div className="text-center">
              <div className="border-t border-depo-dark w-40 pt-1 text-[10px] text-depo-gray-3 tracking-wider">FIRMA DEL REMITENTE</div>
            </div>
            <div className="text-center">
              <div className="border-t border-depo-dark w-40 pt-1 text-[10px] text-depo-gray-3 tracking-wider">FIRMA DEL CLIENTE</div>
            </div>
          </div>
        </div>

        {/* Panel de abonos */}
        <div className="bg-white border border-depo-border rounded-[10px] max-w-[720px] mx-auto mt-4 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[13px] font-medium text-depo-dark">Abonos</div>
              <div className="text-[11px] text-depo-gray-3 tracking-widest uppercase mt-[1px]">
                {pagos.length} abono{pagos.length !== 1 ? 's' : ''} · Saldo pendiente:{' '}
                <span className={saldoPendiente > 0 ? 'text-rose-600 font-medium' : 'text-green-700'}>${fmt(saldoPendiente)}</span>
              </div>
            </div>
            {saldoPendiente > 0 ? (
              <button
                onClick={abrirPago}
                className="bg-green-600 border-none text-white text-xs font-medium px-[14px] py-[6px] rounded transition-all hover:bg-green-700"
              >
                + Registrar abono
              </button>
            ) : null}
          </div>
          {pagos.length === 0 ? (
            <div className="text-sm text-depo-gray-3 text-center py-4">Sin abonos registrados</div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Fecha</th>
                  <th className="text-right text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Monto</th>
                  <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Notas</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((pg) => (
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
      </div>

      {openPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenPago(false)} />
          <div className="relative bg-white rounded-xl w-[380px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">Registrar abono</div>
            <div className="text-[11px] text-depo-gray-3 px-7 pt-1 shrink-0">
              {factura?.numero} · Saldo: <span className="text-rose-600 font-medium">${fmt(saldoPendiente)}</span>
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
    </>
  )
}

function cargarLogo(): Promise<{ data: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0)
      resolve({ data: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height })
    }
    img.onerror = () => resolve(null)
    img.src = '/logo.png'
  })
}

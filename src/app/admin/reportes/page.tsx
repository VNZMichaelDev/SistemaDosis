'use client'

import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '@/lib/api-client'

function formatBS(n: any) { const [i, d] = Number(n || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; }

function pad2(n: any) { return String(n).padStart(2, '0'); }
function formatYmdLocal(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function startOfTodayLocal() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }

export default function Reportes() {
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({ count: 0, total_usd: 0, total_bs: 0 });
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [detalle, setDetalle] = useState<any[]>([]);
  const [ventaPagos, setVentaPagos] = useState<any[]>([]);

  const [preset, setPreset] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reportTab, setReportTab] = useState('ventas');
  const [deptReport, setDeptReport] = useState<any[]>([]);
  const [deptLoading, setDeptLoading] = useState(false);
  const [cobertura, setCobertura] = useState<any>(null);
  const [coberturaLoading, setCoberturaLoading] = useState(false);

  const range = useMemo(() => {
    if (useCustomRange && customFrom && customTo) {
      return { from: customFrom, to: customTo, label: `${customFrom} → ${customTo}` };
    }
    const today0 = startOfTodayLocal();
    if (preset === 'hoy') return { from: formatYmdLocal(today0), to: formatYmdLocal(today0), label: 'Hoy' };
    if (preset === 'ayer') {
      const y = new Date(today0); y.setDate(y.getDate() - 1);
      return { from: formatYmdLocal(y), to: formatYmdLocal(y), label: 'Ayer' };
    }
    if (preset === 'mes') {
      const first = new Date(today0); first.setDate(1);
      return { from: formatYmdLocal(first), to: formatYmdLocal(today0), label: 'Este mes' };
    }
    const from = new Date(today0); from.setDate(from.getDate() - 6);
    return { from: formatYmdLocal(from), to: formatYmdLocal(today0), label: 'Últimos 7 días' };
  }, [preset, useCustomRange, customFrom, customTo]);

  async function load({ keepSelection }: { keepSelection?: boolean } = {}) {
    setLoading(true);
    setError('');
    try {
      const qs = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}&page=${page}&limit=10`;
      const [ventasData, pagosData] = await Promise.all([
        apiFetch(`/api/reportes/ventas${qs}`),
        apiFetch(`/api/reportes/pagos${qs}`),
      ]);
      setRows(ventasData.rows);
      setTotals(ventasData.totals);
      setPagos(pagosData.pagos || []);
      setTotalPages(ventasData.totalPages || 1);
      if (!keepSelection) { setSelected(null); setDetalle([]); setVentaPagos([]); }
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  async function loadDeptReport() {
    setDeptLoading(true);
    try {
      const qs = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      const data = await apiFetch(`/api/reportes/ventas-por-departamento${qs}`);
      setDeptReport(data.departamentos || []);
    } catch { setDeptReport([]); } finally { setDeptLoading(false); }
  }

  useEffect(() => { if (reportTab === 'departamentos') loadDeptReport(); }, [reportTab, range]);

  async function loadCobertura() {
    setCoberturaLoading(true);
    try {
      const qs = `?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
      const data = await apiFetch(`/api/reportes/cobertura${qs}`);
      setCobertura(data);
    } catch { setCobertura(null); } finally { setCoberturaLoading(false); }
  }

  useEffect(() => { if (reportTab === 'cobertura') loadCobertura(); }, [reportTab, range]);

  async function openVenta(id: any) {
    setSelected(null); setDetalle([]); setVentaPagos([]);
    try {
      const data = await apiFetch(`/api/reportes/ventas/${id}`);
      setSelected(data.venta); setDetalle(data.detalle); setVentaPagos(data.pagos || []);
    } catch (e: any) { setError(e?.data?.error || 'DETAIL_FAILED'); }
  }

  useEffect(() => { load(); }, [preset, useCustomRange, customFrom, customTo, page]);

  return (
    <>
      <div className="bg-depo-bg py-4 md:py-5 pr-4 md:pr-8 flex items-center justify-between gap-3 border-b border-depo-border-2">
        <div>
          <div className="text-[22px] font-medium text-depo-dark tracking-tight">Reportes</div>
          <div className="text-xs text-depo-gray-3 tracking-widest uppercase mt-[1px]">
            {range.label}
          </div>
        </div>
        <button onClick={() => load({ keepSelection: true })} disabled={loading}
          className="bg-transparent text-[#555] border border-depo-border-2 rounded-md py-[9px] px-4 text-[13px] font-normal cursor-pointer transition-all hover:border-[#999] hover:text-depo-dark font-sans">
          Recargar
        </button>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {/* Tipo de reporte */}
        <div className="mb-4">
          <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase font-semibold mb-2">Tipo de reporte</div>
          <div className="flex gap-1">
            {[{ k: 'ventas', l: 'Ventas' }, { k: 'departamentos', l: 'Por categoría' }, { k: 'cobertura', l: 'Cobertura' }].map((t) => (
              <button key={t.k} onClick={() => setReportTab(t.k)}
                className={`border rounded-md py-[7px] px-4 text-[13px] font-medium cursor-pointer transition-all font-sans ${reportTab === t.k ? 'bg-depo-dark text-white border-depo-dark' : 'bg-transparent text-[#555] border-depo-border-2 hover:border-[#999] hover:text-depo-dark'}`}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {/* Rango de fechas */}
        <div className="mb-4">
          <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase font-semibold mb-2">Rango de fechas</div>
          <div className="flex flex-wrap gap-2 items-center">
            {[{ k: 'hoy', l: 'Hoy' }, { k: 'ayer', l: 'Ayer' }, { k: '7d', l: '7 días' }, { k: 'mes', l: 'Este mes' }].map((b) => (
              <button key={b.k} onClick={() => { setPreset(b.k); setUseCustomRange(false); setPage(1); }}
                className={`border rounded-md py-[9px] px-4 text-[13px] font-normal cursor-pointer transition-all font-sans ${preset === b.k ? 'bg-depo-dark text-white border-depo-dark' : 'bg-transparent text-[#555] border-depo-border-2 hover:border-[#999] hover:text-depo-dark'}`}>
                {b.l}
              </button>
            ))}
            <div className="hidden md:block h-6 w-px bg-depo-border-2 mx-2"></div>
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-depo-gray-3 shrink-0">Desde:</label>
                <input type="date" value={customFrom} onChange={(e) => { setCustomFrom(e.target.value); if (e.target.value && customTo) { setUseCustomRange(true); setPage(1); } }}
                  className="flex-1 md:w-[140px] border border-depo-border-2 rounded-md py-[7px] px-3 text-[13px] text-depo-dark outline-none focus:border-[#1A1A1A] font-sans" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-depo-gray-3 shrink-0">Hasta:</label>
                <input type="date" value={customTo} onChange={(e) => { setCustomTo(e.target.value); if (e.target.value && customFrom) { setUseCustomRange(true); setPage(1); } }}
                  className="flex-1 md:w-[140px] border border-depo-border-2 rounded-md py-[7px] px-3 text-[13px] text-depo-dark outline-none focus:border-[#1A1A1A] font-sans" />
              </div>
              {useCustomRange && <button onClick={() => { setUseCustomRange(false); setCustomFrom(''); setCustomTo(''); setPage(1); }} className="text-[11px] text-[#DC2626] hover:underline shrink-0 self-start md:self-center">Limpiar</button>}
            </div>
          </div>
        </div>

        {reportTab === 'ventas' ? (
          <>
            {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
                <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Ventas</div>
                <div className="text-lg sm:text-xl font-medium text-depo-dark tracking-tight font-mono">{totals.count}</div>
              </div>
              <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
                <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Unidades</div>
                <div className="text-lg sm:text-xl font-medium text-depo-dark tracking-tight font-mono">{totals.total_unidades || 0}</div>
              </div>
              <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
                <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Total USD</div>
                <div className="text-lg sm:text-xl font-medium text-depo-dark tracking-tight font-mono">${Number(totals.total_usd).toFixed(2)}</div>
              </div>
              <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
                <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Total Bs</div>
                <div className="text-lg sm:text-xl font-medium text-depo-dark tracking-tight font-mono">{formatBS(totals.total_bs)}</div>
              </div>
              <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
                <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Ganancia</div>
                <div className="text-lg sm:text-xl font-medium text-green-700 tracking-tight font-mono">${Number(totals.total_ganancia || 0).toFixed(2)}</div>
              </div>
            </div>

            {totals.producto_mas_vendido && (
              <div className="bg-depo-yellow/20 border border-depo-yellow/40 rounded-lg p-3 px-4 mb-4">
                <div className="text-[10px] text-depo-dark/60 tracking-widest uppercase font-semibold mb-1">Producto más vendido</div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[15px] font-bold text-depo-dark">{totals.producto_mas_vendido.nombre}</span>
                    <span className="text-[11px] text-depo-dark/50 ml-2 font-mono">({totals.producto_mas_vendido.codigo})</span>
                  </div>
                  <span className="text-[18px] font-bold text-depo-dark font-mono ml-3">{Number(totals.producto_mas_vendido.total)} uds</span>
                </div>
              </div>
            )}

            {pagos.length > 0 && (
              <div className="bg-white border border-depo-border rounded-lg p-3 px-4 mb-4">
                <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-2">Ventas por método de pago</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {pagos.map((p) => (
                    <div key={p.metodo_pago} className="bg-depo-bg rounded-lg p-2">
                      <div className="text-[11px] text-depo-gray-3 mb-1">{p.metodo_pago}</div>
                      <div className="text-[13px] font-medium text-depo-dark font-mono">${Number(p.total_usd).toFixed(2)}</div>
                      <div className="text-[10px] text-depo-dark font-mono">{formatBS(p.total_bs)} Bs</div>
                      <div className="text-[10px] text-depo-gray-3">{p.count} venta{p.count !== 1 ? 's' : ''}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
                <div className="px-4 sm:px-6 py-3 border-b border-[#F0EDE6]">
                  <span className="text-[13px] font-medium text-depo-dark">Ventas</span>
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full border-collapse min-w-[600px]">
                    <thead>
                      <tr>
                        <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 sm:px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Fecha</th>
                        <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 sm:px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Mesa</th>
                        <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 sm:px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Método</th>
                        <th className="text-right text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 sm:px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">USD</th>
                        <th className="text-right text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 sm:px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Bs</th>
                        <th className="text-center text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-2 sm:px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                          <td className="px-2 sm:px-3 py-2.5 text-[11px] text-depo-dark whitespace-nowrap">
                            <div>{new Date(r.fecha).toLocaleDateString()}</div>
                            <div className="text-[9px] text-depo-gray-3">{new Date(r.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          </td>
                          <td className="px-2 sm:px-3 py-2.5 text-[11px] text-depo-dark whitespace-nowrap">
                            {r.mesa_nombre || <span className="text-[#CCC]">—</span>}
                          </td>
                          <td className="px-2 sm:px-3 py-2.5 text-[11px] text-depo-dark whitespace-nowrap">
                            <span className="bg-depo-bg px-1.5 py-0.5 rounded text-[10px]">{r.metodo_pago || 'Efectivo USD'}</span>
                          </td>
                          <td className="px-2 sm:px-3 py-2.5 text-[11px] text-depo-dark font-mono text-right whitespace-nowrap">{Number(r.total_usd).toFixed(2)}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-[11px] text-depo-dark font-mono text-right whitespace-nowrap">{formatBS(r.total_bs)}</td>
                          <td className="px-2 sm:px-3 py-2.5 text-center">
                            <button onClick={() => openVenta(r.id)}
                              className="bg-depo-bg border border-depo-border-2 text-[#444] text-[10px] font-medium px-2.5 py-1 rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans">Ver</button>
                          </td>
                        </tr>
                      ))}
                      {!loading && rows.length === 0 && (
                        <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={6}>Sin ventas</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-[#F0EDE6] bg-white">
                    <span className="text-xs text-depo-gray-3">Página {page} de {totalPages} ({totals.count} ventas)</span>
                    <div className="flex gap-1">
                      <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-3 py-1.5 rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans disabled:opacity-40 disabled:cursor-not-allowed">Anterior</button>
                      <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                        className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-3 py-1.5 rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans disabled:opacity-40 disabled:cursor-not-allowed">Siguiente</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
                <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6]">
                  <span className="text-[13px] font-medium text-depo-dark">Detalle de venta</span>
                </div>
                <div className="p-4 md:p-6">
                  {selected ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div><span className="text-depo-gray">Venta:</span> <span className="font-medium text-depo-dark">#{selected.id}</span></div>
                        <div><span className="text-depo-gray">Fecha:</span> <span className="font-medium text-depo-dark">{new Date(selected.fecha).toLocaleString()}</span></div>
                        <div><span className="text-depo-gray">Método:</span> <span className="font-medium text-depo-dark bg-depo-bg px-2 py-0.5 rounded">{selected.metodo_pago || 'Efectivo USD'}</span></div>
                        {selected.mesa_nombre && <div><span className="text-depo-gray">Mesa:</span> <span className="font-medium text-depo-dark">{selected.mesa_nombre}</span></div>}
                        <div><span className="text-depo-gray">Total USD:</span> <span className="font-medium text-depo-dark font-mono">${Number(selected.total_usd).toFixed(2)}</span></div>
                        <div><span className="text-depo-gray">Total Bs:</span> <span className="font-medium text-depo-dark font-mono">{formatBS(selected.total_bs)}</span></div>
                        {selected.metodo_pago === 'Pago Móvil' && selected.referencia && (
                          <div><span className="text-depo-gray">Referencia:</span> <span className="font-medium text-depo-dark font-mono">{selected.referencia}</span></div>
                        )}
                      </div>

                      {ventaPagos.length > 0 && (
                        <div className="border border-depo-border rounded-lg overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse min-w-[200px]">
                              <thead>
                                <tr>
                                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">Método</th>
                                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">USD</th>
                                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">Bs</th>
                                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">Ref.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ventaPagos.map((p, i) => (
                                  <tr key={i} className="border-b border-[#F5F3EE]">
                                    <td className="px-3 md:px-4 py-2 text-[13px] text-depo-dark">{p.metodo_pago}</td>
                                    <td className="px-3 md:px-4 py-2 text-[13px] text-depo-dark font-mono text-right">${Number(p.monto_usd).toFixed(2)}</td>
                                    <td className="px-3 md:px-4 py-2 text-[13px] text-depo-dark font-mono text-right">{formatBS(p.monto_bs)}</td>
                                    <td className="px-3 md:px-4 py-2 text-[13px] text-depo-dark font-mono text-right">{p.referencia || <span className="text-depo-gray-3">—</span>}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      <div className="border border-depo-border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse min-w-[460px]">
                            <thead>
                                <tr>
                                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">Producto</th>
                                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">Cant.</th>
                                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">USD</th>
                                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">Costo</th>
                                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">Ganancia</th>
                                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-4 py-2 bg-white border-b border-[#F0EDE6]">Subt.</th>
                                </tr>
                            </thead>
                            <tbody>
                              {detalle.map((d) => (
                                <tr key={d.id} className="border-b border-[#F5F3EE]">
                                  <td className="px-3 md:px-4 py-2 text-[13px] text-depo-dark">{d.nombre}</td>
                                  <td className="px-3 md:px-4 py-2 text-[13px] text-depo-dark font-mono text-right">{Number(d.cantidad).toFixed(3)}</td>
                                  <td className="px-3 md:px-4 py-2 text-[13px] text-depo-dark font-mono text-right">${Number(d.precio_usd).toFixed(2)}</td>
                                  <td className="px-3 md:px-4 py-2 text-[13px] text-depo-dark font-mono text-right">${Number(d.precio_costo || 0).toFixed(2)}</td>
                                  <td className="px-3 md:px-4 py-2 text-[13px] font-mono text-right">
                                    <span className={Number(d.subtotal - (d.precio_costo || 0) * d.cantidad) >= 0 ? 'text-green-700' : 'text-rose-600'}>
                                      ${(Number(d.subtotal) - Number(d.precio_costo || 0) * Number(d.cantidad)).toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="px-3 md:px-4 py-2 text-[13px] text-depo-dark font-mono text-right">${Number(d.subtotal).toFixed(2)}</td>
                                </tr>
                              ))}
                              {detalle.length === 0 && (
                                <tr><td className="px-3 md:px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={6}>Sin detalle</td></tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-depo-gray-3">Selecciona una venta para ver el detalle.</div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : reportTab === 'cobertura' ? (
          <div>
            {coberturaLoading ? (
              <div className="text-sm text-depo-gray-3 text-center py-6">Cargando...</div>
            ) : !cobertura ? (
              <div className="text-sm text-depo-gray-3 text-center py-6">Sin datos en este período</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
                    <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Ganancia semanal</div>
                    <div className="text-lg sm:text-xl font-medium text-green-700 tracking-tight font-mono">${Number(cobertura.ganancia_semanal || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
                    <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Deudas proveedores</div>
                    <div className="text-lg sm:text-xl font-medium text-rose-600 tracking-tight font-mono">${Number(cobertura.total_deudas || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
                    <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Saldo disponible</div>
                    <div className={`text-lg sm:text-xl font-medium tracking-tight font-mono ${cobertura.saldo_disponible >= 0 ? 'text-green-700' : 'text-rose-600'}`}>
                      ${Number(cobertura.saldo_disponible || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
                  <div className="px-4 sm:px-6 py-3 border-b border-[#F0EDE6]">
                    <span className="text-[13px] font-medium text-depo-dark">Detalle por proveedor</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[500px]">
                      <thead>
                        <tr>
                          <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Proveedor</th>
                          <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Facturado</th>
                          <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Pagado</th>
                          <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Saldo</th>
                          <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">% Ganancia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cobertura.proveedores.map((p: any, i: number) => (
                          <tr key={i} className="border-b border-[#F0EDE6] hover:bg-[#FFFAF0]">
                            <td className="px-4 py-3 text-[13px] text-depo-dark">{p.proveedor_nombre}</td>
                            <td className="px-4 py-3 text-[13px] text-depo-dark font-mono text-right">${Number(p.total_facturado).toFixed(2)}</td>
                            <td className="px-4 py-3 text-[13px] text-green-700 font-mono text-right">${Number(p.total_pagado).toFixed(2)}</td>
                            <td className="px-4 py-3 text-[13px] text-rose-600 font-mono text-right">${Number(p.saldo_pendiente).toFixed(2)}</td>
                            <td className="px-4 py-3 text-[13px] text-depo-dark font-mono text-right">
                              {cobertura.ganancia_semanal > 0 ? `${((p.saldo_pendiente / cobertura.ganancia_semanal) * 100).toFixed(1)}%` : '—'}
                            </td>
                          </tr>
                        ))}
                        {cobertura.proveedores.length === 0 && (
                          <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={5}>Sin deudas pendientes</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            {deptLoading ? (
              <div className="text-sm text-depo-gray-3 text-center py-6">Cargando...</div>
            ) : deptReport.length === 0 ? (
              <div className="text-sm text-depo-gray-3 text-center py-6">Sin datos en este período</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[500px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Categoría</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Vendido USD</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Vendido Bs</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-4 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Unidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptReport.map((d, i) => (
                      <tr key={i} className="border-b border-[#F0EDE6] hover:bg-[#FFFAF0]">
                        <td className="px-4 py-3 text-[13px] text-depo-dark">{d.departamento}</td>
                        <td className="px-4 py-3 text-[13px] text-depo-dark font-mono text-right">${Number(d.total_vendido_usd || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-[13px] text-depo-dark font-mono text-right">{formatBS(d.total_vendido_bs || 0)}</td>
                        <td className="px-4 py-3 text-[13px] text-depo-dark font-mono text-right">{Number(d.unidades || 0)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#FFF8F0] border-t-2 border-depo-dark">
                      <td className="px-4 py-3 text-[13px] font-semibold text-depo-dark">Total</td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-depo-dark font-mono text-right">
                        ${deptReport.reduce((s, d) => s + Number(d.total_vendido_usd || 0), 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-depo-dark font-mono text-right">
                        {formatBS(deptReport.reduce((s, d) => s + Number(d.total_vendido_bs || 0), 0))}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-semibold text-depo-dark font-mono text-right">
                        {deptReport.reduce((s, d) => s + Number(d.unidades || 0), 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

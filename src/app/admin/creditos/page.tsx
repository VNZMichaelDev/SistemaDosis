'use client'

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
const BS_METHODS = new Set(['Efectivo Bs', 'Pago Móvil', 'Punto de venta', 'Biopago']);

export default function Creditos() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<any>(null);

  // Modal Ver
  const [verModalOpen, setVerModalOpen] = useState(false);
  const [verCliente, setVerCliente] = useState<any>(null);
  const [verData, setVerData] = useState<any>(null);
  const [verLoading, setVerLoading] = useState(false);

  // Modal Pagar
  const [pagarModalOpen, setPagarModalOpen] = useState(false);
  const [pagarCliente, setPagarCliente] = useState<any>(null);
  const [pagarMonto, setPagarMonto] = useState('');
  const [pagarMetodo, setPagarMetodo] = useState('Efectivo USD');
  const [pagarRef, setPagarRef] = useState('');
  const [pagarError, setPagarError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/creditos');
      setClientes(data.clientes || []);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  const [tasa, setTasa] = useState(1);

  useEffect(() => {
    load();
    apiFetch('/api/config').then(d => { if (d?.config?.tasa_cambio) setTasa(Number(d.config.tasa_cambio)); }).catch(() => {});
  }, []);

  async function abrirVer(c: any) {
    setVerCliente(c);
    setVerModalOpen(true);
    setVerLoading(true);
    setVerData(null);
    try {
      const data = await apiFetch(`/api/creditos/${c.id}`);
      setVerData(data);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_DETAIL_FAILED');
    } finally {
      setVerLoading(false);
    }
  }

  function abrirPagar(c: any) {
    setPagarCliente(c);
    setPagarMonto('');
    setPagarMetodo('Efectivo USD');
    setPagarRef('');
    setPagarError('');
    setPagarModalOpen(true);
  }

  async function eliminarCliente(c: any) {
    const msg = c.deuda_total > 0
      ? `¿Eliminar a "${c.nombre}"? Tiene una deuda de $${c.deuda_total.toFixed(2)} que se perderá.`
      : `¿Eliminar a "${c.nombre}"?`;
    if (!confirm(msg)) return;
    setDeletingId(c.id);
    try {
      await apiFetch(`/api/creditos/${c.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.data?.error || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  async function confirmarPago() {
    setPagarError('');
    const monto = parseFloat(pagarMonto);
    if (isNaN(monto) || monto <= 0) {
      setPagarError('Ingresa un monto válido');
      return;
    }
    const esBs = BS_METHODS.has(pagarMetodo);
    const montoUsd = Number((esBs ? monto / tasa : monto).toFixed(2));
    if (montoUsd > pagarCliente.deuda_total + 0.001) {
      setPagarError('El monto no puede ser mayor a la deuda');
      return;
    }
    setBusyId(pagarCliente.id);
    try {
      await apiFetch(`/api/creditos/${pagarCliente.id}/pagar`, {
        method: 'POST',
        body: {
          monto_usd: montoUsd,
          metodo_pago: pagarMetodo,
          ...(pagarMetodo === 'Pago Móvil' && pagarRef ? { referencia: pagarRef } : {}),
        },
      });
      setPagarModalOpen(false);
      setPagarCliente(null);
      await load();
    } catch (e: any) {
      setPagarError(e?.data?.message || e?.data?.error || 'PAGO_FAILED');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {/* Topbar */}
      <div className="bg-depo-bg py-4 md:py-5 pr-4 md:pr-8 flex items-center justify-between border-b border-depo-border-2">
        <div>
          <div className="text-[22px] font-medium text-depo-dark tracking-tight">Créditos (Fiado)</div>
          <div className="text-xs text-depo-gray-3 tracking-widest uppercase mt-[1px]">Clientes con deuda pendiente</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error ? (
          <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
        ) : null}

        {/* Total deudas */}
        {(() => {
          const totalUsd = clientes.reduce((s, c) => s + c.deuda_total, 0);
          const totalBs = totalUsd * tasa;
          return totalUsd > 0 ? (
            <div className="bg-white border border-depo-border rounded-[10px] p-4 md:p-5 mb-4">
              <div className="text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase mb-2">Total deudas pendientes</div>
              <div className="flex items-baseline gap-3">
                <span className="text-[28px] font-bold text-[#DC2626] font-mono">${totalUsd.toFixed(2)}</span>
                <span className="text-[14px] text-[#999] font-mono">Bs {totalBs.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-depo-gray-3 mt-1">{clientes.filter(c => c.deuda_total > 0).length} cliente{clientes.filter(c => c.deuda_total > 0).length !== 1 ? 's' : ''} con deuda</div>
            </div>
          ) : null;
        })()}

        {/* Table */}
        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Listado de clientes</span>
            <span className="text-xs text-depo-gray-3">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[520px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Nombre</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Cédula</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Deuda</th>
                <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                  <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">{c.nombre}</td>
                  <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2 font-mono">{c.cedula}</td>
                  <td className="px-3 md:px-6 py-[14px] text-[13px]">
                    <div className="text-[#DC2626] font-semibold font-mono">${c.deuda_total.toFixed(2)}</div>
                    <div className="text-[11px] text-depo-gray-3 font-mono">Bs {(c.deuda_total * tasa).toFixed(2)}</div>
                  </td>
                  <td className="px-3 md:px-6 py-[14px]">
                    <div className="flex gap-[6px] justify-end">
                      <button
                        onClick={() => abrirVer(c)}
                        className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans"
                      >
                        Ver
                      </button>
                      <button
                        disabled={busyId === c.id || c.deuda_total <= 0}
                        onClick={() => abrirPagar(c)}
                        className="bg-[#E8E04A] border border-[#E8E04A] text-[#1A1A1A] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-[#F0E840] font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Pagar
                      </button>
                      <button
                        disabled={deletingId === c.id}
                        onClick={() => eliminarCliente(c)}
                        className="text-[#DC2626] hover:text-white hover:bg-[#DC2626] border border-[#DC2626] rounded px-[10px] py-[5px] text-xs font-medium transition-all disabled:opacity-40 font-sans"
                      >
                        {deletingId === c.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && clientes.length === 0 ? (
                <tr>
                  <td className="px-3 md:px-6 py-8 text-center text-sm text-depo-gray-3" colSpan={4}>
                    No hay clientes con crédito registrados
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* Modal Ver detalle */}
      {verModalOpen && verCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setVerModalOpen(false)} />
          <div className="relative bg-white rounded-[14px] p-5 md:p-6 w-full max-w-[92vw] md:w-[600px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="text-lg font-medium text-[#1A1A1A] mb-1">{verCliente.nombre}</div>
            <div className="text-xs text-[#888] mb-4 font-mono">Cédula: {verCliente.cedula} · Deuda: ${verCliente.deuda_total.toFixed(2)} (Bs {(verCliente.deuda_total * tasa).toFixed(2)})</div>

            {verLoading ? (
              <div className="text-sm text-[#888] py-8 text-center">Cargando detalle...</div>
            ) : verData ? (
              <div className="flex flex-col gap-4">
                {/* Ventas a crédito */}
                <div>
                  <div className="text-[13px] font-medium text-depo-dark mb-2">Ventas a crédito</div>
                  {verData.ventas?.length === 0 ? (
                    <div className="text-xs text-[#888]">Sin ventas registradas</div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {verData.ventas.map((v: any) => (
                        <div key={v.id} className="border border-[#E0DED8] rounded-lg p-3 bg-[#FAFAF8]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-depo-dark">Venta #{v.id}</span>
                            <span className="text-xs text-[#888] font-mono">{new Date(v.fecha).toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-[#DC2626] font-semibold font-mono mb-2">${v.total_usd.toFixed(2)} USD / Bs {v.total_bs.toFixed(2)}</div>
                          <div className="flex flex-col gap-1">
                            {v.detalle?.map((d: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-xs text-[#555]">
                                <span>{d.nombre} ({d.tipo === 'peso' ? `${d.cantidad.toFixed(2)}kg` : `${d.cantidad}u`})</span>
                                <span className="font-mono">${d.subtotal.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pagos realizados */}
                <div>
                  <div className="text-[13px] font-medium text-depo-dark mb-2">Pagos realizados</div>
                  {verData.pagos?.length === 0 ? (
                    <div className="text-xs text-[#888]">Sin pagos registrados</div>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {verData.pagos.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[#F0EDE6]">
                          <span className="text-[#888] font-mono">{new Date(p.fecha).toLocaleString()}</span>
                          <span className="text-[#16A34A] font-semibold font-mono">-${p.monto_usd.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            <button
              onClick={() => setVerModalOpen(false)}
              className="w-full mt-5 bg-[#1A1A1A] text-white border-none text-[13px] font-medium py-2.5 rounded-lg cursor-pointer hover:bg-[#333] font-sans"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Pagar */}
      {pagarModalOpen && pagarCliente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setPagarModalOpen(false)} />
          <div className="relative bg-white rounded-[14px] p-5 md:p-7 w-full max-w-[92vw] md:w-[360px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-[32px] mb-3">💵</div>
            <div className="text-lg font-medium text-[#1A1A1A] mb-1">Registrar pago</div>
            <div className="text-[13px] text-[#888] mb-4">{pagarCliente.nombre} · Deuda: ${pagarCliente.deuda_total.toFixed(2)} (Bs {(pagarCliente.deuda_total * tasa).toFixed(2)})</div>

            {/* Método de pago */}
            <div className="text-[11px] font-medium text-[#888] mb-2">Método de pago</div>
            <div className="grid grid-cols-3 gap-1.5 mb-4">
              {['Efectivo USD', 'Efectivo Bs', 'Punto de venta', 'Biopago', 'Zelle', 'Pago Móvil'].map((m) => (
                <button
                  key={m}
                  onClick={() => setPagarMetodo(m)}
                  className={`border rounded-lg py-2 text-[10px] font-medium cursor-pointer transition-all ${
                    pagarMetodo === m
                      ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                      : 'border-[#E0DED8] text-[#888] hover:border-[#999]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="bg-[#1A1A1A] rounded-[12px] p-5 mb-4">
              <div className="text-[11px] text-[#888] mb-2">{BS_METHODS.has(pagarMetodo) ? 'Monto a pagar (Bs)' : 'Monto a pagar (USD)'}</div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={BS_METHODS.has(pagarMetodo) ? pagarCliente.deuda_total * tasa : pagarCliente.deuda_total}
                autoFocus
                className="w-full bg-[#333] border border-[#555] rounded-lg py-3 px-4 text-[28px] font-semibold text-[#E8E04A] font-mono text-center outline-none focus:border-[#E8E04A]"
                placeholder="0.00"
                value={pagarMonto}
                onChange={(e) => setPagarMonto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmarPago();
                }}
              />
              {pagarMonto && !isNaN(parseFloat(pagarMonto)) && (
                <div className="text-center mt-2 text-[13px]">
                  {BS_METHODS.has(pagarMetodo) ? (
                    <span className="text-[#888]">≈ <span className="text-[#E8E04A] font-mono">${(parseFloat(pagarMonto) / tasa).toFixed(2)} USD</span></span>
                  ) : (
                    <span className="text-[#888]">≈ <span className="text-[#E8E04A] font-mono">Bs {(parseFloat(pagarMonto) * tasa).toFixed(2)}</span></span>
                  )}
                </div>
              )}
            </div>

            {pagarMetodo === 'Pago Móvil' && (
              <div className="mb-4">
                <div className="text-[11px] text-[#888] mb-1">Referencia (últimos 6 dígitos)</div>
                <input
                  type="text"
                  maxLength={6}
                  className="w-full bg-[#F5F3EE] border border-[#E0DED8] rounded-lg py-2 px-3 text-[14px] text-[#1A1A1A] font-mono text-center outline-none focus:border-[#1A1A1A]"
                  placeholder="123456"
                  value={pagarRef}
                  onChange={(e) => setPagarRef(e.target.value.replace(/\D/g, '').slice(0, 6))}
                />
              </div>
            )}

            {pagarError && (
              <div className="mb-4 text-xs text-[#DC2626] text-center">{pagarError}</div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setPagarModalOpen(false)}
                className="flex-1 bg-transparent border border-[#E0DED8] text-[#666] text-[13px] py-2.5 rounded-lg cursor-pointer hover:border-[#999] font-sans"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPago}
                disabled={busyId === pagarCliente.id}
                className="flex-[2] bg-[#E8E04A] text-[#1A1A1A] border-none text-[13px] font-medium py-2.5 rounded-lg cursor-pointer hover:bg-[#F0E840] font-sans disabled:opacity-50"
              >
                {busyId === pagarCliente.id ? 'Procesando...' : 'Confirmar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

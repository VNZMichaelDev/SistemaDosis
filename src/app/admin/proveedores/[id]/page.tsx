'use client'

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

function formatBS(n: any) { const [i, d] = Number(n || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; }

export default function FacturasProveedor() {
  const { id } = useParams();
  const router = useRouter();
  const [proveedor, setProveedor] = useState<any>(null);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [openFactura, setOpenFactura] = useState(false);
  const [editFactura, setEditFactura] = useState<any>(null);
  const [formNum, setFormNum] = useState('');
  const [formMonto, setFormMonto] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const [openPago, setOpenPago] = useState(false);
  const [pagoFacturaId, setPagoFacturaId] = useState<any>(null);
  const [pagoMonto, setPagoMonto] = useState('');
  const [pagoNotas, setPagoNotas] = useState('');
  const [savingPago, setSavingPago] = useState(false);

  const [openHistorial, setOpenHistorial] = useState(false);
  const [historialPagos, setHistorialPagos] = useState<any[]>([]);
  const [historialFactura, setHistorialFactura] = useState<any>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [provData, facData] = await Promise.all([
        apiFetch('/api/proveedores'),
        apiFetch(`/api/proveedores/${id}/facturas`)
      ]);
      const prov = (provData.proveedores || []).find((p: any) => p.id === Number(id));
      setProveedor(prov);
      setFacturas(facData.facturas || []);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  function openNewFactura() {
    setEditFactura(null);
    setFormNum('');
    setFormMonto('');
    setFormDesc('');
    setOpenFactura(true);
  }

  function openEditFactura(f: any) {
    setEditFactura(f);
    setFormNum(f.numero_factura || '');
    setFormMonto(String(f.monto_total));
    setFormDesc(f.descripcion || '');
    setOpenFactura(true);
  }

  async function submitFactura(e: any) {
    e.preventDefault();
    const monto = Number(formMonto);
    if (!monto || monto <= 0) return;
    setSaving(true);
    setError('');
    try {
      const body = { numero_factura: formNum.trim(), monto_total: monto, descripcion: formDesc.trim() };
      if (editFactura) {
        await apiFetch(`/api/proveedores/facturas/${editFactura.id}`, { method: 'PUT', body });
      } else {
        await apiFetch(`/api/proveedores/${id}/facturas`, { method: 'POST', body });
      }
      setOpenFactura(false);
      load();
    } catch (e: any) {
      setError(e?.data?.error || 'SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  }

  async function deleteFactura(f: any) {
    if (!confirm(`¿Eliminar factura "${f.numero_factura || '#' + f.id}"?`)) return;
    try {
      await apiFetch(`/api/proveedores/facturas/${f.id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setError(e?.data?.error || 'DELETE_FAILED');
    }
  }

  function openPagoForm(facturaId: any) {
    setPagoFacturaId(facturaId);
    setPagoMonto('');
    setPagoNotas('');
    setOpenPago(true);
  }

  async function submitPago(e: any) {
    e.preventDefault();
    const monto = Number(pagoMonto);
    if (!monto || monto <= 0) return;
    setSavingPago(true);
    setError('');
    try {
      await apiFetch(`/api/proveedores/facturas/${pagoFacturaId}/pagos`, {
        method: 'POST',
        body: { monto, notas: pagoNotas.trim() }
      });
      setOpenPago(false);
      load();
    } catch (e: any) {
      setError(e?.data?.error === 'EXCEEDS_BALANCE' ? 'El monto excede el saldo pendiente' : (e?.data?.error || 'SAVE_FAILED'));
    } finally {
      setSavingPago(false);
    }
  }

  async function openHistorialPagos(f: any) {
    setHistorialFactura(f);
    try {
      const data = await apiFetch(`/api/proveedores/facturas/${f.id}/pagos`);
      setHistorialPagos(data.pagos || []);
    } catch {
      setHistorialPagos([]);
    }
    setOpenHistorial(true);
  }

  const totalDeuda = facturas.reduce((sum, f) => sum + (f.saldo_pendiente || 0), 0);
  const totalFacturado = facturas.reduce((sum, f) => sum + Number(f.monto_total || 0), 0);
  const totalPagado = facturas.reduce((sum, f) => sum + Number(f.monto_pagado || 0), 0);

  if (!proveedor && !loading) {
    return (
      <div className="py-8 text-center">
        <div className="text-sm text-depo-gray-3 mb-3">Proveedor no encontrado</div>
        <button onClick={() => router.push('/admin/proveedores')} className="text-sm text-depo-dark underline">Volver a proveedores</button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-2 border-b border-depo-border-2 md:bg-transparent">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => router.push('/admin/proveedores')} className="text-[11px] text-depo-gray-3 hover:text-depo-dark mb-1 block">← Proveedores</button>
            <div className="text-lg font-medium text-depo-dark tracking-tight">{proveedor?.nombre || 'Cargando...'}</div>
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">
              {proveedor?.contacto && <span>Contacto: {proveedor.contacto} · </span>}
              {proveedor?.telefono && <span>{proveedor.telefono}</span>}
            </div>
          </div>
          <button onClick={openNewFactura}
            className="bg-depo-dark text-white border-none rounded-lg py-2 px-4 text-[12px] font-semibold cursor-pointer transition-colors hover:bg-[#333] tracking-wide active:scale-[0.97]">
            + Nueva factura
          </button>
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Total facturado</div>
            <div className="text-lg sm:text-xl font-medium text-depo-dark tracking-tight font-mono">${Number(totalFacturado).toFixed(2)}</div>
          </div>
          <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Total pagado</div>
            <div className="text-lg sm:text-xl font-medium text-green-700 tracking-tight font-mono">${Number(totalPagado).toFixed(2)}</div>
          </div>
          <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Saldo pendiente</div>
            <div className={`text-lg sm:text-xl font-medium tracking-tight font-mono ${totalDeuda > 0 ? 'text-rose-600' : 'text-green-700'}`}>${Number(totalDeuda).toFixed(2)}</div>
          </div>
          <div className="bg-white border border-depo-border rounded-lg p-3 px-4">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-[4px]">Facturas</div>
            <div className="text-lg sm:text-xl font-medium text-depo-dark tracking-tight font-mono">{facturas.length}</div>
          </div>
        </div>

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Facturas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]"># Factura</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Descripción</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Monto</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Pagado</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Saldo</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Fecha</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-mono text-depo-dark font-medium">{f.numero_factura || `#${f.id}`}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">{f.descripcion || <span className="text-[#CCC]">—</span>}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-dark font-mono text-right">${Number(f.monto_total).toFixed(2)}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-green-700 font-mono text-right">${Number(f.monto_pagado).toFixed(2)}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-mono text-right">
                      <span className={f.saldo_pendiente > 0 ? 'text-rose-600 font-medium' : 'text-green-700'}>
                        ${Number(f.saldo_pendiente).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-[14px] text-[11px] text-depo-gray-3 whitespace-nowrap">
                      {new Date(f.fecha_registro).toLocaleDateString()}
                    </td>
                    <td className="px-3 md:px-6 py-[14px]">
                      <div className="flex gap-[6px] justify-end">
                        {f.saldo_pendiente > 0 && (
                          <button onClick={() => openPagoForm(f.id)}
                            className="bg-green-600 border-none text-white text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-green-700 font-sans">
                            Pagar
                          </button>
                        )}
                        <button onClick={() => openHistorialPagos(f)}
                          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans">
                          Pagos
                        </button>
                        <button onClick={() => openEditFactura(f)}
                          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans">
                          Editar
                        </button>
                        <button onClick={() => deleteFactura(f)}
                          className="bg-depo-bg border border-depo-border-2 text-[#DC2626] text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-rose-50 hover:border-rose-300 font-sans">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && facturas.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={7}>Sin facturas registradas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {openFactura && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenFactura(false)} />
          <div className="relative bg-white rounded-xl w-[420px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">{editFactura ? 'Editar factura' : 'Nueva factura'}</div>
            <form onSubmit={submitFactura} className="space-y-[14px] overflow-y-auto px-7 py-5">
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block"># Factura</label>
                <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formNum} onChange={(e) => setFormNum(e.target.value)} placeholder="Número de factura (opcional)" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Monto total (USD) *</label>
                <input type="number" step="0.01" className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formMonto} onChange={(e) => setFormMonto(e.target.value)} placeholder="0.00" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Descripción</label>
                <textarea className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans resize-none" rows={2}
                  value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Describe la factura..." />
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button type="button" onClick={() => setOpenFactura(false)}
                  className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !Number(formMonto) || Number(formMonto) <= 0}
                  className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {openPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenPago(false)} />
          <div className="relative bg-white rounded-xl w-[380px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">Registrar pago</div>
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
                  {savingPago ? 'Registrando...' : 'Registrar pago'}
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
              Pagos — {historialFactura?.numero_factura || `Factura #${historialFactura?.id}`}
            </div>
            <div className="flex-1 overflow-y-auto px-7 pb-5">
              {historialPagos.length === 0 ? (
                <div className="text-sm text-depo-gray-3 text-center py-6">Sin pagos registrados</div>
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
  );
}

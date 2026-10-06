'use client'

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function ProductoFormModal({ open, initial, onClose, onSubmit }: { open: any; initial: any; onClose: any; onSubmit: any }) {
  const isEdit = Boolean(initial?.id);

  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [precioUsd, setPrecioUsd] = useState('');
  const [precioBs, setPrecioBs] = useState('');
  const [tasa, setTasa] = useState(1);
  const [tipo, setTipo] = useState('unidad');
  const [departamentoId, setDepartamentoId] = useState('');
  const [departamentos, setDepartamentos] = useState<any>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [precioCosto, setPrecioCosto] = useState('');
  const [margenGanancia, setMargenGanancia] = useState('');
  const [esReceta, setEsReceta] = useState(false);

  const [altCodigos, setAltCodigos] = useState<any>([]);
  const [newAltCodigo, setNewAltCodigo] = useState('');
  const [altCodigoBusy, setAltCodigoBusy] = useState(false);

  function loadAltCodigos() {
    if (!initial?.id) return;
    apiFetch(`/api/productos/${initial.id}/codigos`)
      .then((r) => setAltCodigos(r.codigos || []))
      .catch(() => {});
  }

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    setCodigo(initial?.codigo ?? '');
    setNombre(initial?.nombre ?? '');
    setPrecioUsd(initial?.precio_usd !== undefined ? String(initial.precio_usd) : '');
    setPrecioBs('');
    setPrecioCosto(initial?.precio_costo !== undefined ? String(initial.precio_costo) : '');
    setMargenGanancia(initial?.margen_ganancia !== undefined ? String(initial.margen_ganancia) : '');
    setEsReceta(Boolean(initial?.es_receta));
    setTipo(initial?.tipo ?? 'unidad');
    setDepartamentoId(initial?.departamento_id ? String(initial.departamento_id) : '');
    apiFetch('/api/departamentos').then(r => setDepartamentos(r.departamentos || [])).catch(() => {});
    apiFetch('/api/config').then(r => setTasa(r.config?.tasa_cambio || 1)).catch(() => {});
    if (initial?.id) loadAltCodigos();
  }, [open, initial]);

  async function addAltCodigo() {
    const code = newAltCodigo.trim();
    if (!code || !initial?.id) return;
    setAltCodigoBusy(true);
    setError('');
    try {
      await apiFetch(`/api/productos/${initial.id}/codigos`, { method: 'POST', body: { codigo: code } });
      setNewAltCodigo('');
      loadAltCodigos();
    } catch (e: any) {
      setError(e?.data?.error === 'CODIGO_EXISTS' ? 'Ese código ya existe' : (e?.data?.error || 'Error'));
    } finally {
      setAltCodigoBusy(false);
    }
  }

  async function removeAltCodigo(codigoId: any) {
    if (!initial?.id) return;
    setError('');
    try {
      await apiFetch(`/api/productos/${initial.id}/codigos/${codigoId}`, { method: 'DELETE' });
      loadAltCodigos();
    } catch (e: any) {
      setError(e?.data?.error || 'Error');
    }
  }

  const parsed = useMemo(() => {
    const isVariable = tipo === 'variable';
    const costo = Number(precioCosto);
    const margen = Number(margenGanancia);
    const precio = isVariable ? 0 : (costo > 0 && margen >= 0 ? Number((costo * (1 + margen / 100)).toFixed(2)) : Number(precioUsd));
    return {
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      precio_usd: precio,
      precio_costo: costo || 0,
      margen_ganancia: margen || 0,
      es_receta: esReceta,
      tipo,
      departamento_id: departamentoId ? Number(departamentoId) : null,
      valid:
        codigo.trim().length > 0 &&
        nombre.trim().length > 0 &&
        (isVariable || (Number.isFinite(precio) && precio >= 0)),
    };
  }, [codigo, nombre, precioUsd, precioCosto, margenGanancia, esReceta, tipo, departamentoId]);

  async function submit(e: any) {
    e.preventDefault();
    setError('');
    if (!parsed.valid) {
      setError('VALIDATION');
      return;
    }

    setSaving(true);
    try {
      await onSubmit(parsed);
      onClose();
    } catch (err: any) {
      setError(err?.data?.error || 'SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative bg-white rounded-xl w-[420px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">{isEdit ? 'Editar producto' : 'Nuevo producto'}</div>

        <form onSubmit={submit} className="space-y-[14px] overflow-y-auto px-7 py-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Código</label>
              <input
                className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="01"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Tipo</label>
              <select
                className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                <option value="unidad">Unidad</option>
                <option value="peso">Peso</option>
                <option value="variable">Sin precio fijo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Nombre del producto</label>
            <input
              className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Hamburguesa"
            />
          </div>

          {tipo === 'variable' ? (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-md px-4 py-3 text-sm text-[#92400E]">
              Producto sin precio fijo — el precio se pedirá al momento de facturar
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Precio costo (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={precioCosto}
                    onChange={(e) => setPrecioCosto(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Margen (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={margenGanancia}
                    onChange={(e) => setMargenGanancia(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Precio venta (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={precioUsd}
                    onChange={(e) => {
                      setPrecioUsd(e.target.value);
                      setPrecioCosto('');
                      setMargenGanancia('');
                    }}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Precio venta (Bs)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={precioBs}
                    onChange={(e) => {
                      const bs = e.target.value;
                      setPrecioBs(bs);
                      const num = Number(bs);
                      if (num > 0 && tasa > 0) {
                        setPrecioUsd(String(num / tasa));
                      }
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              {Number(precioCosto) > 0 && Number(margenGanancia) > 0 && (
                <div className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  Venta: ${Number(Number(precioCosto) * (1 + Number(margenGanancia) / 100)).toFixed(2)} — Ganancia: ${(Number(precioCosto) * Number(margenGanancia) / 100).toFixed(2)}
                </div>
              )}
            </>
          )}

          <div>
            <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Categoría</label>
            <select
              className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
              value={departamentoId}
              onChange={(e) => setDepartamentoId(e.target.value)}
            >
              <option value="">Sin categoría</option>
              {departamentos.map((d: any) => (
                <option key={d.id} value={d.id}>{d.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={esReceta}
                onChange={(e) => setEsReceta(e.target.checked)}
                className="w-4 h-4 accent-depo-dark cursor-pointer"
              />
              <span className="text-[13px] text-depo-dark font-sans">Es receta (tiene ingredientes)</span>
            </label>
          </div>

          {isEdit && (
            <div className="border-t border-depo-border-2 pt-3 mt-3">
              <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Códigos alternos</label>
              <div className="flex gap-2 mb-2">
                <input
                  className="flex-1 bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-3 text-[12px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={newAltCodigo}
                  onChange={(e) => setNewAltCodigo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAltCodigo(); } }}
                  placeholder="Agregar código..."
                />
                <button
                  type="button"
                  onClick={addAltCodigo}
                  disabled={altCodigoBusy || !newAltCodigo.trim()}
                  className="bg-depo-dark text-white border-none rounded-md px-3 py-[7px] text-[11px] font-medium cursor-pointer hover:bg-[#333] disabled:opacity-60 font-sans whitespace-nowrap"
                >
                  {altCodigoBusy ? '...' : 'Agregar'}
                </button>
              </div>
              {altCodigos.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {altCodigos.map((ac: any) => (
                    <span key={ac.id} className="inline-flex items-center gap-1 bg-depo-bg border border-depo-border-2 rounded px-2 py-1 text-[11px] font-mono text-depo-dark">
                      {ac.codigo}
                      <button
                        type="button"
                        onClick={() => removeAltCodigo(ac.id)}
                        className="text-[#999] hover:text-[#DC2626] leading-none text-sm pl-0.5"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-depo-gray-3">Sin códigos alternos</div>
              )}
            </div>
          )}

          {error ? (
            <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
          ) : null}

          <div className="flex gap-2 pt-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar producto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

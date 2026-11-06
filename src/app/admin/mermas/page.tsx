'use client'

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { getStoredUser, type StoredUser } from '@/lib/auth-client';

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="6.5" cy="6.5" r="4.5"/>
      <path d="M10 10l3.5 3.5"/>
    </svg>
  );
}

const MOTIVOS: { v: string; l: string; tipo: 'operativa' | 'financiera' | null }[] = [
  { v: 'merma_natural', l: 'Merma natural (limpieza, pelado, cocción)', tipo: 'operativa' },
  { v: 'error_cocina', l: 'Error de cocina (plato malo, quemado, comanda)', tipo: 'operativa' },
  { v: 'vencimiento', l: 'Vencimiento o deterioro', tipo: 'operativa' },
  { v: 'cadena_frio', l: 'Falla de cadena de frío', tipo: 'operativa' },
  { v: 'consumo_personal', l: 'Consumo de personal no registrado', tipo: 'financiera' },
  { v: 'cortesia', l: 'Cortesía no autorizada', tipo: 'financiera' },
  { v: 'robo', l: 'Robo / hormigueo', tipo: 'financiera' },
  { v: 'otro', l: 'Otro', tipo: null },
];

const MOTIVO_LABEL: Record<string, string> = Object.fromEntries(MOTIVOS.map(m => [m.v, m.l]));

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function presetRango(kind: 'mes' | 'pasado' | 'anio'): { from: string; to: string } {
  const hoy = new Date();
  if (kind === 'mes') return { from: ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), to: ymd(hoy) };
  if (kind === 'pasado') {
    return {
      from: ymd(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
      to: ymd(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
    };
  }
  return { from: ymd(new Date(hoy.getFullYear(), 0, 1)), to: ymd(hoy) };
}

const inputCls = 'bg-depo-bg border border-depo-border-2 rounded-md py-[7px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans';

export default function MermasPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mermas, setMermas] = useState<any[]>([]);
  const [ingredientes, setIngredientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [from, setFrom] = useState(() => presetRango('mes').from);
  const [to, setTo] = useState(() => presetRango('mes').to);
  const [fTipo, setFTipo] = useState('');
  const [fMotivo, setFMotivo] = useState('');
  const [q, setQ] = useState('');

  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fFecha, setFFecha] = useState(ymd(new Date()));
  const [fIngredienteId, setFIngredienteId] = useState('');
  const [fCantidad, setFCantidad] = useState('');
  const [fMotivoNuevo, setFMotivoNuevo] = useState('merma_natural');
  const [fTipoNuevo, setFTipoNuevo] = useState<'operativa' | 'financiera'>('operativa');
  const [fNotas, setFNotas] = useState('');

  useEffect(() => { setUser(getStoredUser()); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (fTipo) params.set('tipo', fTipo);
      if (fMotivo) params.set('motivo', fMotivo);
      const [mData, iData] = await Promise.all([
        apiFetch(`/api/mermas?${params.toString()}`),
        apiFetch('/api/ingredientes'),
      ]);
      setMermas(mData.mermas || []);
      setIngredientes(iData.ingredientes || []);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, fTipo, fMotivo])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term
      ? mermas.filter(m => (m.ingrediente_nombre || '').toLowerCase().includes(term))
      : mermas;
  }, [mermas, q]);

  const resumen = useMemo(() => {
    const total = filtered.reduce((s, m) => s + Number(m.costo_usd || 0), 0);
    const operativas = filtered.filter(m => m.tipo === 'operativa').reduce((s, m) => s + Number(m.costo_usd || 0), 0);
    const financieras = filtered.filter(m => m.tipo === 'financiera').reduce((s, m) => s + Number(m.costo_usd || 0), 0);
    return { total, operativas, financieras, count: filtered.length };
  }, [filtered]);

  function aplicarPreset(kind: 'mes' | 'pasado' | 'anio') {
    const r = presetRango(kind);
    setFrom(r.from);
    setTo(r.to);
  }

  function openNew() {
    setFFecha(ymd(new Date()));
    setFIngredienteId('');
    setFCantidad('');
    setFMotivoNuevo('merma_natural');
    setFTipoNuevo('operativa');
    setFNotas('');
    setOpenForm(true);
  }

  const ingSel = ingredientes.find(i => String(i.id) === fIngredienteId);
  const cant = Number(fCantidad) || 0;
  const costoEstimado = ingSel ? cant * Number(ingSel.precio_unitario || 0) : 0;
  const stockResultante = ingSel ? Number(ingSel.stock_actual) - cant : 0;

  async function submit(e: any) {
    e.preventDefault();
    if (!ingSel || cant <= 0) return;
    const motivoDef = MOTIVOS.find(m => m.v === fMotivoNuevo)!;
    const tipo = motivoDef.tipo ?? fTipoNuevo;
    setSaving(true);
    setError('');
    try {
      await apiFetch('/api/mermas', {
        method: 'POST',
        body: {
          ingrediente_id: ingSel.id,
          cantidad: cant,
          tipo,
          motivo: fMotivoNuevo,
          notas: fNotas.trim(),
          fecha: fFecha || undefined,
        },
      });
      setOpenForm(false);
      load();
    } catch (e: any) {
      const err = e?.data?.error;
      setError(err === 'INSUFFICIENT_STOCK' ? 'Stock insuficiente para registrar esa merma'
        : err === 'VALIDATION' ? 'Datos inválidos'
        : err || 'SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  }

  async function anular(m: any) {
    if (!confirm(`¿Anular la merma de "${m.ingrediente_nombre}" (${Number(m.cantidad).toFixed(2)})? Se devolverá al stock.`)) return;
    setError('');
    try {
      await apiFetch(`/api/mermas/${m.id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setError(e?.data?.error || 'DELETE_FAILED');
    }
  }

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-3 border-b border-depo-border-2 md:bg-transparent">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-lg font-medium text-depo-dark tracking-tight">Mermas y Pérdidas</div>
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Bitácora de pérdidas de materia prima</div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => aplicarPreset('mes')} className="bg-white border border-depo-border-2 text-[#444] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-depo-bg">Este mes</button>
            <button onClick={() => aplicarPreset('pasado')} className="bg-white border border-depo-border-2 text-[#444] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-depo-bg">Mes pasado</button>
            <button onClick={() => aplicarPreset('anio')} className="bg-white border border-depo-border-2 text-[#444] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-depo-bg">Año</button>
            <button onClick={openNew}
              className="bg-depo-dark text-white border-none rounded-lg py-1.5 px-4 text-[12px] font-semibold cursor-pointer transition-colors hover:bg-[#333] tracking-wide active:scale-[0.97]">
              + Registrar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Desde</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Hasta</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Tipo</label>
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              <option value="operativa">Operativas (mermas y desperdicios)</option>
              <option value="financiera">Financieras (robos y hormigueo)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-depo-gray-3 tracking-wider uppercase block mb-1">Motivo</label>
            <select value={fMotivo} onChange={(e) => setFMotivo(e.target.value)} className={inputCls}>
              <option value="">Todos</option>
              <optgroup label="Operativas">
                {MOTIVOS.filter(m => m.tipo === 'operativa').map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </optgroup>
              <optgroup label="Financieras">
                {MOTIVOS.filter(m => m.tipo === 'financiera').map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </optgroup>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div className="relative min-w-[180px] flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-depo-gray-3"><SearchIcon /></span>
            <input
              className="w-full bg-depo-input border border-depo-border-2 rounded-xl py-[7px] pr-3 pl-8 text-[13px] text-depo-dark outline-none transition-colors focus:border-depo-dark focus:bg-white placeholder:text-depo-gray-3"
              placeholder="Buscar ingrediente..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-white border border-depo-border rounded-[10px] px-4 py-3">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Pérdida total</div>
            <div className="text-lg font-semibold text-depo-dark font-mono">${resumen.total.toFixed(2)}</div>
          </div>
          <div className="bg-white border border-depo-border rounded-[10px] px-4 py-3">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Operativas</div>
            <div className="text-lg font-semibold text-amber-600 font-mono">${resumen.operativas.toFixed(2)}</div>
          </div>
          <div className="bg-white border border-depo-border rounded-[10px] px-4 py-3">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Financieras</div>
            <div className="text-lg font-semibold text-rose-600 font-mono">${resumen.financieras.toFixed(2)}</div>
          </div>
          <div className="bg-white border border-depo-border rounded-[10px] px-4 py-3">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Registros</div>
            <div className="text-lg font-semibold text-depo-dark font-mono">{resumen.count}</div>
          </div>
        </div>

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Bitácora de mermas</span>
            <span className="text-xs text-depo-gray-3">{loading ? 'Cargando...' : `${filtered.length} registro${filtered.length !== 1 ? 's' : ''}`}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[860px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Fecha</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Ingrediente</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Cantidad</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Costo</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Tipo</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Motivo</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Registró</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Notas</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2 font-mono">{m.fecha}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">{m.ingrediente_nombre}</td>
                    <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-right text-depo-dark">
                      {Number(m.cantidad).toFixed(2)} {m.ingrediente_unidad}
                    </td>
                    <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-right text-rose-600 font-medium">${Number(m.costo_usd).toFixed(2)}</td>
                    <td className="px-3 md:px-6 py-[14px]">
                      <span className={`text-[10px] font-semibold px-2 py-[3px] rounded-full uppercase tracking-wide ${m.tipo === 'operativa' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {m.tipo === 'operativa' ? 'Operativa' : 'Financiera'}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-[14px] text-[12px] text-depo-gray-2">{MOTIVO_LABEL[m.motivo] || m.motivo}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[12px] text-depo-gray-2">{m.usuario_nombre || '—'}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[12px] text-depo-gray-3 max-w-[200px] truncate" title={m.notas}>{m.notas || '—'}</td>
                    <td className="px-3 md:px-6 py-[14px]">
                      <div className="flex gap-[6px] justify-end">
                        {user?.rol === 'admin' && (
                          <button onClick={() => anular(m)}
                            className="bg-depo-bg border border-depo-border-2 text-[#DC2626] text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-rose-50 hover:border-rose-300 font-sans">
                            Anular
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={9}>Sin registros de mermas en este período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenForm(false)} />
          <div className="relative bg-white rounded-xl w-[440px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">Registrar merma</div>
            <form onSubmit={submit} className="space-y-[14px] overflow-y-auto px-7 py-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Fecha</label>
                  <input type="date" className={inputCls} value={fFecha} onChange={(e) => setFFecha(e.target.value)} />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Cantidad *</label>
                  <input type="number" step="0.01" min="0" className={inputCls} value={fCantidad}
                    onChange={(e) => setFCantidad(e.target.value)} placeholder="Ej: 3" autoFocus />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Ingrediente *</label>
                <select className={inputCls} value={fIngredienteId} onChange={(e) => setFIngredienteId(e.target.value)}>
                  <option value="">Seleccionar...</option>
                  {ingredientes.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} — stock {Number(i.stock_actual).toFixed(2)} {i.unidad}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Motivo *</label>
                <select className={inputCls} value={fMotivoNuevo} onChange={(e) => setFMotivoNuevo(e.target.value)}>
                  <optgroup label="Pérdidas operativas (mermas y desperdicios)">
                    {MOTIVOS.filter(m => m.tipo === 'operativa').map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </optgroup>
                  <optgroup label="Pérdidas financieras (robos y hormigueo)">
                    {MOTIVOS.filter(m => m.tipo === 'financiera').map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
                  </optgroup>
                  <option value="otro">Otro</option>
                </select>
              </div>

              {MOTIVOS.find(m => m.v === fMotivoNuevo)?.tipo === null && (
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Tipo de pérdida *</label>
                  <select className={inputCls} value={fTipoNuevo} onChange={(e) => setFTipoNuevo(e.target.value as any)}>
                    <option value="operativa">Operativa (merma o desperdicio)</option>
                    <option value="financiera">Financiera (robo o consumo no registrado)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Notas</label>
                <input className={inputCls} value={fNotas} onChange={(e) => setFNotas(e.target.value)}
                  placeholder='Ej: "vencido", "se quemó", "caído al suelo"' />
              </div>

              {ingSel && cant > 0 && (
                <div className="rounded-md bg-depo-bg border border-depo-border-2 px-3 py-2 text-[12px] text-depo-gray-2 space-y-[2px]">
                  <div>Costo de la merma: <span className="font-mono font-semibold text-rose-600">${costoEstimado.toFixed(2)}</span></div>
                  <div>
                    Stock resultante:{' '}
                    <span className={`font-mono font-semibold ${stockResultante < 0 ? 'text-rose-600' : 'text-depo-dark'}`}>
                      {stockResultante.toFixed(2)} {ingSel.unidad}
                    </span>
                    {stockResultante < 0 && ' (insuficiente)'}
                  </div>
                </div>
              )}

              {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

              <div className="flex gap-2 pt-2 justify-end">
                <button type="button" onClick={() => setOpenForm(false)}
                  className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !ingSel || cant <= 0}
                  className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

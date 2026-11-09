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

const cardCls = 'bg-white border border-depo-border rounded-[10px] px-4 py-3';
const labelCls = 'text-[10px] text-depo-gray-3 tracking-widest uppercase';

function fmtCant(n: number): string {
  return Number(n).toFixed(2);
}

function fmtUsd(n: number): string {
  return `$${Number(n).toFixed(2)}`;
}

/** Semáforo del food cost: meta 28%–35% de las ventas. */
function foodCostCls(pct: number | null): string {
  if (pct == null) return 'text-depo-dark';
  if (pct <= 35) return 'text-emerald-600';
  if (pct <= 45) return 'text-amber-600';
  return 'text-rose-600';
}

type Tab = 'bitacora' | 'analisis';

export default function MermasPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [tab, setTab] = useState<Tab>('bitacora');
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

  // Fase B/C: consumo teórico vs. real + indicadores
  const [cons, setCons] = useState<any>(null);
  const [consLoading, setConsLoading] = useState(false);
  const [verTodos, setVerTodos] = useState(false);
  const [openConteo, setOpenConteo] = useState(false);
  const [conteoFecha, setConteoFecha] = useState(ymd(new Date()));
  const [conteoValores, setConteoValores] = useState<Record<string, string>>({});
  const [conteoBusqueda, setConteoBusqueda] = useState('');
  const [savingConteo, setSavingConteo] = useState(false);

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

  async function loadConsumo() {
    setConsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ from, to });
      setCons(await apiFetch(`/api/consumo?${params.toString()}`));
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setConsLoading(false);
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, fTipo, fMotivo])

  useEffect(() => {
    if (tab === 'analisis') loadConsumo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, from, to])

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

  // Filas del análisis: solo ingredientes con movimiento, conteo o stock.
  const filasAnalisis = useMemo(() => {
    const rows: any[] = cons?.ingredientes || [];
    const conActividad = rows.filter((r: any) =>
      Number(r.teorico_cant) > 0 || Number(r.mermas_cant) > 0 || r.conteo_cant != null || Number(r.stock_actual) > 0);
    const orden = [...conActividad].sort((a: any, b: any) => {
      const pa = Number(a.mermas_costo) + Math.max(0, (a.diferencia_cant ?? 0) * Number(a.precio_unitario));
      const pb = Number(b.mermas_costo) + Math.max(0, (b.diferencia_cant ?? 0) * Number(b.precio_unitario));
      if (pb !== pa) return pb - pa;
      return String(a.nombre).localeCompare(String(b.nombre));
    });
    return verTodos ? rows : orden;
  }, [cons, verTodos]);

  const conteosFaltantes = useMemo(() => {
    const rows: any[] = cons?.ingredientes || [];
    return rows.filter((r: any) => r.conteo_cant == null).length;
  }, [cons]);

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

  function openConteoModal() {
    const rows: any[] = cons?.ingredientes || [];
    const valores: Record<string, string> = {};
    for (const r of rows) {
      // Prefill con el último conteo si existe, si no con el stock del sistema.
      valores[String(r.ingrediente_id)] = String(r.conteo_cant ?? r.stock_actual ?? 0);
    }
    setConteoValores(valores);
    setConteoFecha(to || ymd(new Date()));
    setConteoBusqueda('');
    setOpenConteo(true);
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

  async function submitConteo(e: any) {
    e.preventDefault();
    const items = Object.entries(conteoValores)
      .filter(([, v]) => v !== '')
      .map(([id, v]) => ({ ingrediente_id: Number(id), cantidad: Number(v) }))
      .filter(it => Number.isFinite(it.cantidad) && it.cantidad >= 0);
    if (items.length === 0) return;
    setSavingConteo(true);
    setError('');
    try {
      await apiFetch('/api/conteos', {
        method: 'POST',
        body: { fecha: conteoFecha, items },
      });
      setOpenConteo(false);
      loadConsumo();
    } catch (e: any) {
      setError(e?.data?.error || 'SAVE_FAILED');
    } finally {
      setSavingConteo(false);
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

  const tabCls = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-colors ${active
      ? 'bg-depo-dark text-white border-depo-dark'
      : 'bg-white text-[#444] border-depo-border-2 hover:bg-depo-bg'}`;

  const conteoFiltrado = useMemo(() => {
    const rows: any[] = cons?.ingredientes || [];
    const term = conteoBusqueda.trim().toLowerCase();
    return term ? rows.filter(r => String(r.nombre).toLowerCase().includes(term)) : rows;
  }, [cons, conteoBusqueda]);

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-3 border-b border-depo-border-2 md:bg-transparent">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-lg font-medium text-depo-dark tracking-tight">Mermas y Pérdidas</div>
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">
              {tab === 'bitacora' ? 'Bitácora de pérdidas de materia prima' : 'Consumo teórico vs. real · Food cost %'}
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => aplicarPreset('mes')} className="bg-white border border-depo-border-2 text-[#444] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-depo-bg">Este mes</button>
            <button onClick={() => aplicarPreset('pasado')} className="bg-white border border-depo-border-2 text-[#444] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-depo-bg">Mes pasado</button>
            <button onClick={() => aplicarPreset('anio')} className="bg-white border border-depo-border-2 text-[#444] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-depo-bg">Año</button>
            {tab === 'bitacora' ? (
              <button onClick={openNew}
                className="bg-depo-dark text-white border-none rounded-lg py-1.5 px-4 text-[12px] font-semibold cursor-pointer transition-colors hover:bg-[#333] tracking-wide active:scale-[0.97]">
                + Registrar
              </button>
            ) : (
              <button onClick={openConteoModal}
                className="bg-depo-dark text-white border-none rounded-lg py-1.5 px-4 text-[12px] font-semibold cursor-pointer transition-colors hover:bg-[#333] tracking-wide active:scale-[0.97]">
                + Conteo de cierre
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5">
          <button onClick={() => setTab('bitacora')} className={tabCls(tab === 'bitacora')}>Bitácora</button>
          <button onClick={() => setTab('analisis')} className={tabCls(tab === 'analisis')}>Consumo y Food Cost</button>
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
          {tab === 'bitacora' && (
            <>
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
            </>
          )}
          {tab === 'analisis' && (
            <div className="text-[11px] text-depo-gray-3 pb-2">
              Registra compras y mermas del día <b>antes</b> del conteo de cierre.
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

        {tab === 'bitacora' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className={cardCls}>
                <div className={labelCls}>Pérdida total</div>
                <div className="text-lg font-semibold text-depo-dark font-mono">{fmtUsd(resumen.total)}</div>
              </div>
              <div className={cardCls}>
                <div className={labelCls}>Operativas</div>
                <div className="text-lg font-semibold text-amber-600 font-mono">{fmtUsd(resumen.operativas)}</div>
              </div>
              <div className={cardCls}>
                <div className={labelCls}>Financieras</div>
                <div className="text-lg font-semibold text-rose-600 font-mono">{fmtUsd(resumen.financieras)}</div>
              </div>
              <div className={cardCls}>
                <div className={labelCls}>Registros</div>
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
                          {fmtCant(m.cantidad)} {m.ingrediente_unidad}
                        </td>
                        <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-right text-rose-600 font-medium">{fmtUsd(m.costo_usd)}</td>
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
          </>
        ) : (
          <>
            {/* ===== FASE C: INDICADORES ===== */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
              <div className={cardCls}>
                <div className={labelCls}>Food cost %</div>
                <div className={`text-lg font-semibold font-mono ${foodCostCls(cons?.food_cost_pct ?? null)}`}>
                  {cons?.food_cost_pct != null ? `${cons.food_cost_pct.toFixed(1)}%` : '—'}
                </div>
                <div className="text-[10px] text-depo-gray-3">Meta 28%–35%</div>
              </div>
              <div className={cardCls}>
                <div className={labelCls}>Ventas</div>
                <div className="text-lg font-semibold text-depo-dark font-mono">{fmtUsd(cons?.ventas_total ?? 0)}</div>
                <div className="text-[10px] text-depo-gray-3">período seleccionado</div>
              </div>
              <div className={cardCls}>
                <div className={labelCls}>Costo teórico</div>
                <div className="text-lg font-semibold text-depo-dark font-mono">{fmtUsd(cons?.costo_teorico ?? 0)}</div>
                <div className="text-[10px] text-depo-gray-3">recetas × ventas</div>
              </div>
              <div className={cardCls}>
                <div className={labelCls}>Mermas anotadas</div>
                <div className="text-lg font-semibold text-amber-600 font-mono">{fmtUsd(cons?.mermas_costo ?? 0)}</div>
                <div className="text-[10px] text-depo-gray-3">bitácora fase A</div>
              </div>
              <div className={cardCls}>
                <div className={labelCls}>No registrado</div>
                <div className={`text-lg font-semibold font-mono ${(cons?.perdida_costo ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {fmtUsd(cons?.perdida_costo ?? 0)}
                </div>
                <div className="text-[10px] text-depo-gray-3">falta vs. conteo</div>
              </div>
              <div className={cardCls}>
                <div className={labelCls}>Compras</div>
                <div className="text-lg font-semibold text-depo-dark font-mono">{fmtUsd(cons?.compras_total ?? 0)}</div>
                <div className="text-[10px] text-depo-gray-3">facturas proveedor</div>
              </div>
            </div>

            {consLoading && !cons && <div className="mb-4 text-sm text-depo-gray-3">Cargando análisis...</div>}

            {conteosFaltantes > 0 && (
              <div className="mb-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm text-amber-800">
                  Falta el inventario contado de <b>{conteosFaltantes} ingrediente{conteosFaltantes !== 1 ? 's' : ''}</b>.
                  Sin conteo no se pueden detectar pérdidas no registradas.
                </div>
                <button onClick={openConteoModal}
                  className="bg-amber-600 text-white text-[12px] font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-700">
                  Registrar conteo
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
              {/* ===== RANKING DE PÉRDIDAS ===== */}
              <div className="bg-white border border-depo-border rounded-[10px] px-4 py-3">
                <div className={labelCls + ' mb-2'}>Mayores pérdidas</div>
                {(cons?.ranking || []).length === 0 && (
                  <div className="text-sm text-depo-gray-3 py-2">Sin pérdidas registradas en este período 🎉</div>
                )}
                <div className="flex flex-col gap-2">
                  {(cons?.ranking || []).map((r: any, idx: number) => {
                    const max = cons.ranking[0]?.perdida_costo || 1;
                    const pct = (Number(r.perdida_costo) / max) * 100;
                    return (
                      <div key={r.ingrediente_id}>
                        <div className="flex items-center justify-between text-[12px] mb-[3px]">
                          <span className="text-depo-dark font-medium truncate mr-2">{idx + 1}. {r.nombre}</span>
                          <span className="font-mono text-rose-600 font-semibold shrink-0">{fmtUsd(r.perdida_costo)}</span>
                        </div>
                        <div className="h-[6px] bg-depo-bg rounded-full overflow-hidden">
                          <div className="h-full bg-rose-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[10px] text-depo-gray-3 mt-[2px]">
                          mermas {fmtUsd(r.mermas_costo)} · sin registrar {fmtUsd(r.no_registrado_costo)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ===== RESUMEN TEÓRICO VS. REAL ===== */}
              <div className="bg-white border border-depo-border rounded-[10px] px-4 py-3 lg:col-span-2">
                <div className={labelCls + ' mb-2'}>Teórico vs. real (costo)</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="text-[11px] text-depo-gray-3">Teórico (recetas)</div>
                    <div className="text-base font-semibold text-depo-dark font-mono">{fmtUsd(cons?.costo_teorico ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-depo-gray-3">Mermas anotadas</div>
                    <div className="text-base font-semibold text-amber-600 font-mono">{fmtUsd(cons?.mermas_costo ?? 0)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-depo-gray-3">No registrado</div>
                    <div className={`text-base font-semibold font-mono ${(cons?.perdida_costo ?? 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {fmtUsd(cons?.perdida_costo ?? 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-depo-gray-3">Real (total)</div>
                    <div className="text-base font-semibold text-depo-dark font-mono">{fmtUsd(cons?.costo_real ?? 0)}</div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-depo-gray-3 border-t border-[#F0EDE6] pt-2">
                  Food cost teórico: <b className={foodCostCls(cons?.food_cost_teorico_pct ?? null)}>
                    {cons?.food_cost_teorico_pct != null ? `${cons.food_cost_teorico_pct.toFixed(1)}%` : '—'}
                  </b>{' '}
                  · real: <b className={foodCostCls(cons?.food_cost_pct ?? null)}>
                    {cons?.food_cost_pct != null ? `${cons.food_cost_pct.toFixed(1)}%` : '—'}
                  </b>
                  {cons && Number(cons.sobrante_costo) > 0 && (
                    <> · sobrante de conteo: <b className="text-amber-600">{fmtUsd(cons.sobrante_costo)}</b></>
                  )}
                </div>
              </div>
            </div>

            {/* ===== TABLA TEÓRICO VS. REAL POR INGREDIENTE ===== */}
            <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
              <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between gap-3 flex-wrap">
                <span className="text-[13px] font-medium text-depo-dark">Consumo por ingrediente</span>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-depo-gray-2 cursor-pointer">
                    <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
                    Ver todos
                  </label>
                  <span className="text-xs text-depo-gray-3">
                    {consLoading ? 'Cargando...' : `${filasAnalisis.length} ingrediente${filasAnalisis.length !== 1 ? 's' : ''}`}
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[980px]">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Ingrediente</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Teórico</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Mermas</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Conteo</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Stock sistema</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Diferencia</th>
                      <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Real</th>
                      <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filasAnalisis.map((r: any) => {
                      const dif = r.diferencia_cant;
                      const difCosto = r.diferencia_costo;
                      const estado = dif == null ? 'sin'
                        : Math.abs(dif) < 0.005 ? 'ok'
                        : dif > 0 ? 'falta' : 'sobra';
                      const estadoCls = estado === 'ok' ? 'bg-emerald-100 text-emerald-700'
                        : estado === 'falta' ? 'bg-rose-100 text-rose-700'
                        : estado === 'sobra' ? 'bg-amber-100 text-amber-700'
                        : 'bg-depo-bg text-depo-gray-3';
                      const estadoTxt = estado === 'ok' ? 'OK'
                        : estado === 'falta' ? 'Falta'
                        : estado === 'sobra' ? 'Sobra'
                        : 'Sin conteo';
                      return (
                        <tr key={r.ingrediente_id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                          <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">
                            {r.nombre}
                            <div className="text-[10px] text-depo-gray-3 font-normal">
                              {fmtUsd(r.precio_unitario)} / {r.unidad}
                              {r.conteo_fecha && ` · conteo ${r.conteo_fecha}`}
                            </div>
                          </td>
                          <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-right text-depo-dark">
                            {fmtCant(r.teorico_cant)} {r.unidad}
                            <div className="text-[11px] text-depo-gray-3">{fmtUsd(r.teorico_costo)}</div>
                          </td>
                          <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-right text-amber-600">
                            {fmtCant(r.mermas_cant)} {r.unidad}
                            <div className="text-[11px] text-depo-gray-3">{fmtUsd(r.mermas_costo)}</div>
                          </td>
                          <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-right text-depo-dark">
                            {r.conteo_cant != null ? `${fmtCant(r.conteo_cant)} ${r.unidad}` : '—'}
                          </td>
                          <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-right text-depo-dark">
                            {fmtCant(r.stock_actual)} {r.unidad}
                          </td>
                          <td className={`px-3 md:px-6 py-[14px] font-mono text-[13px] text-right font-medium ${dif == null ? 'text-depo-gray-3' : dif > 0 ? 'text-rose-600' : dif < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {dif == null ? '—' : `${dif > 0 ? '+' : ''}${fmtCant(dif)} ${r.unidad}`}
                            {difCosto != null && Math.abs(difCosto) >= 0.01 && (
                              <div className="text-[11px] font-normal">{dif > 0 ? '' : ''}{fmtUsd(difCosto)}</div>
                            )}
                          </td>
                          <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-right text-depo-dark">
                            {fmtCant(r.real_cant)} {r.unidad}
                          </td>
                          <td className="px-3 md:px-6 py-[14px]">
                            <span className={`text-[10px] font-semibold px-2 py-[3px] rounded-full uppercase tracking-wide ${estadoCls}`}>
                              {estadoTxt}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {!consLoading && filasAnalisis.length === 0 && (
                      <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={8}>
                        Sin movimientos ni conteos en este período
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ===== MODAL: REGISTRAR MERMA ===== */}
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
                  <div>Costo de la merma: <span className="font-mono font-semibold text-rose-600">{fmtUsd(costoEstimado)}</span></div>
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

      {/* ===== MODAL: CONTEO DE CIERRE ===== */}
      {openConteo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenConteo(false)} />
          <div className="relative bg-white rounded-xl w-[520px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">Conteo de inventario (cierre)</div>
            <form onSubmit={submitConteo} className="flex flex-col overflow-hidden px-7 py-5 gap-3">
              <div className="text-[12px] text-depo-gray-2">
                Cuenta lo que <b>realmente hay</b> en almacén. Primero registra las compras y mermas del día.
              </div>
              <div className="flex gap-3 items-end">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Fecha del conteo</label>
                  <input type="date" className={inputCls} value={conteoFecha} onChange={(e) => setConteoFecha(e.target.value)} />
                </div>
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-depo-gray-3"><SearchIcon /></span>
                  <input
                    className="w-full bg-depo-input border border-depo-border-2 rounded-xl py-[7px] pr-3 pl-8 text-[13px] text-depo-dark outline-none transition-colors focus:border-depo-dark focus:bg-white placeholder:text-depo-gray-3"
                    placeholder="Buscar ingrediente..."
                    value={conteoBusqueda}
                    onChange={(e) => setConteoBusqueda(e.target.value)}
                  />
                </div>
              </div>

              <div className="overflow-y-auto border border-depo-border rounded-lg max-h-[45vh]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Ingrediente</th>
                      <th className="text-right text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Sistema</th>
                      <th className="text-right text-[10px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 py-2 bg-depo-table-header border-b border-[#F0EDE6]">Contado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conteoFiltrado.map((r: any) => {
                      const key = String(r.ingrediente_id);
                      const val = conteoValores[key] ?? '';
                      const num = Number(val);
                      const dif = val === '' ? null : num - Number(r.stock_actual);
                      return (
                        <tr key={key} className="border-b border-[#F5F3EE]">
                          <td className="px-3 py-2 text-[13px] text-depo-dark">{r.nombre}</td>
                          <td className="px-3 py-2 font-mono text-[12px] text-right text-depo-gray-3">
                            {fmtCant(r.stock_actual)} {r.unidad}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number" step="0.01" min="0"
                              className={`w-[110px] bg-depo-bg border rounded-md py-[5px] px-2 font-mono text-[13px] text-right outline-none focus:bg-white ${dif != null && Math.abs(dif) >= 0.005 ? (dif < 0 ? 'border-rose-300 text-rose-600' : 'border-amber-300 text-amber-700') : 'border-depo-border-2 text-depo-dark'}`}
                              value={val}
                              onChange={(e) => setConteoValores(v => ({ ...v, [key]: e.target.value }))}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {conteoFiltrado.length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-depo-gray-3">Sin resultados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

              <div className="flex gap-2 pt-1 justify-end">
                <button type="button" onClick={() => setOpenConteo(false)}
                  className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={savingConteo}
                  className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
                  {savingConteo ? 'Guardando...' : 'Guardar conteo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

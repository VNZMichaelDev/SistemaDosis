'use client'

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="6.5" cy="6.5" r="4.5"/>
      <path d="M10 10l3.5 3.5"/>
    </svg>
  );
}

export default function Ingredientes() {
  const [ingredientes, setIngredientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [openStock, setOpenStock] = useState(false);
  const [stockIng, setStockIng] = useState<any>(null);
  const [stockCantidad, setStockCantidad] = useState('');
  const [stockNotas, setStockNotas] = useState('');
  const [savingStock, setSavingStock] = useState(false);
  const [q, setQ] = useState('');

  const [formNombre, setFormNombre] = useState('');
  const [formUnidad, setFormUnidad] = useState('kg');
  const [formStockMinimo, setFormStockMinimo] = useState('');
  const [formPrecioUnitario, setFormPrecioUnitario] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/ingredientes');
      setIngredientes(data.ingredientes || []);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setFormNombre('');
    setFormUnidad('kg');
    setFormStockMinimo('');
    setFormPrecioUnitario('');
    setOpenForm(true);
  }

  function openEdit(i: any) {
    setEditing(i);
    setFormNombre(i.nombre);
    setFormUnidad(i.unidad);
    setFormStockMinimo(String(i.stock_minimo));
    setFormPrecioUnitario(String(i.precio_unitario));
    setOpenForm(true);
  }

  async function submitForm(e: any) {
    e.preventDefault();
    if (!formNombre.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body: any = {
        nombre: formNombre.trim(),
        unidad: formUnidad,
        stock_minimo: Number(formStockMinimo) || 0,
        precio_unitario: Number(formPrecioUnitario) || 0
      };
      if (editing) {
        body.stock_actual = editing.stock_actual;
        await apiFetch(`/api/ingredientes/${editing.id}`, { method: 'PUT', body });
      } else {
        body.stock_actual = 0;
        await apiFetch('/api/ingredientes', { method: 'POST', body });
      }
      setOpenForm(false);
      load();
    } catch (e: any) {
      setError(e?.data?.error || 'SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  }

  async function deleteIng(i: any) {
    if (!confirm(`¿Eliminar ingrediente "${i.nombre}"?`)) return;
    try {
      await apiFetch(`/api/ingredientes/${i.id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setError(e?.data?.error || 'DELETE_FAILED');
    }
  }

  function openStockModal(i: any) {
    setStockIng(i);
    setStockCantidad('');
    setStockNotas('');
    setOpenStock(true);
  }

  async function submitStock(e: any) {
    e.preventDefault();
    const cant = Number(stockCantidad);
    if (!cant) return;
    setSavingStock(true);
    setError('');
    try {
      await apiFetch(`/api/ingredientes/${stockIng.id}/stock`, {
        method: 'PUT',
        body: { cantidad: cant, notas: stockNotas.trim() }
      });
      setOpenStock(false);
      load();
    } catch (e: any) {
      setError(e?.data?.error === 'INSUFFICIENT_STOCK' ? 'Stock insuficiente' : (e?.data?.error || 'SAVE_FAILED'));
    } finally {
      setSavingStock(false);
    }
  }

  const filtered = q.trim()
    ? ingredientes.filter(i => i.nombre.toLowerCase().includes(q.toLowerCase()))
    : ingredientes;

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-2 border-b border-depo-border-2 md:bg-transparent">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-medium text-depo-dark tracking-tight">Ingredientes</div>
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Stock de materia prima</div>
          </div>
          <button onClick={openNew}
            className="bg-depo-dark text-white border-none rounded-lg py-2 px-4 text-[12px] font-semibold cursor-pointer transition-colors hover:bg-[#333] tracking-wide active:scale-[0.97]">
            + Nuevo
          </button>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-depo-gray-3"><SearchIcon /></span>
          <input
            className="w-full bg-depo-input border border-depo-border-2 rounded-xl py-2.5 pr-3 pl-8 text-[13px] text-depo-dark outline-none transition-colors focus:border-depo-dark focus:bg-white placeholder:text-depo-gray-3"
            placeholder="Buscar ingrediente..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Listado de ingredientes</span>
            <span className="text-xs text-depo-gray-3">{filtered.length} ingrediente{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Nombre</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Unidad</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Stock</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Mínimo</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Precio/uni</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((i) => (
                  <tr key={i.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">{i.nombre}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">{i.unidad}</td>
                    <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-right">
                      <span className={i.stock_actual <= i.stock_minimo && i.stock_minimo > 0 ? 'text-rose-600 font-medium' : 'text-depo-dark'}>
                        {Number(i.stock_actual).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-depo-gray-2 text-right">{Number(i.stock_minimo).toFixed(2)}</td>
                    <td className="px-3 md:px-6 py-[14px] font-mono text-[13px] text-depo-dark text-right">${Number(i.precio_unitario).toFixed(2)}</td>
                    <td className="px-3 md:px-6 py-[14px]">
                      <div className="flex gap-[6px] justify-end">
                        <button onClick={() => openStockModal(i)}
                          className="bg-green-600 border-none text-white text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-green-700 font-sans">
                          + Stock
                        </button>
                        <button onClick={() => openEdit(i)}
                          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans">
                          Editar
                        </button>
                        <button onClick={() => deleteIng(i)}
                          className="bg-depo-bg border border-depo-border-2 text-[#DC2626] text-xs font-medium px-[12px] py-[5px] rounded transition-all hover:bg-rose-50 hover:border-rose-300 font-sans">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={6}>Sin ingredientes</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {openForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenForm(false)} />
          <div className="relative bg-white rounded-xl w-[420px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">{editing ? 'Editar ingrediente' : 'Nuevo ingrediente'}</div>
            <form onSubmit={submitForm} className="space-y-[14px] overflow-y-auto px-7 py-5">
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Nombre *</label>
                <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Harina Pan" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Unidad</label>
                  <select className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={formUnidad} onChange={(e) => setFormUnidad(e.target.value)}>
                    <option value="kg">Kg</option>
                    <option value="g">Gramos</option>
                    <option value="l">Litros</option>
                    <option value="ml">Mililitros</option>
                    <option value="unidad">Unidad</option>
                    <option value="docena">Docena</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Stock mínimo</label>
                  <input type="number" step="0.01" className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={formStockMinimo} onChange={(e) => setFormStockMinimo(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Precio unitario (USD)</label>
                <input type="number" step="0.01" className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formPrecioUnitario} onChange={(e) => setFormPrecioUnitario(e.target.value)} placeholder="0.00" />
              </div>

              {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

              <div className="flex gap-2 pt-2 justify-end">
                <button type="button" onClick={() => setOpenForm(false)}
                  className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !formNombre.trim()}
                  className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {openStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={() => setOpenStock(false)} />
          <div className="relative bg-white rounded-xl w-[380px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-2 shrink-0">
              Ajustar stock — {stockIng?.nombre}
            </div>
            <div className="text-[11px] text-depo-gray-3 px-7 mb-1">Stock actual: {Number(stockIng?.stock_actual).toFixed(2)} {stockIng?.unidad}</div>
            <form onSubmit={submitStock} className="space-y-[14px] overflow-y-auto px-7 py-5">
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Cantidad (+ para agregar, - para restar)</label>
                <input type="number" step="0.01" className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={stockCantidad} onChange={(e) => setStockCantidad(e.target.value)} placeholder="Ej: 10 o -5" autoFocus />
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Notas</label>
                <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={stockNotas} onChange={(e) => setStockNotas(e.target.value)} placeholder="Compra, ajuste, merma..." />
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button type="button" onClick={() => setOpenStock(false)}
                  className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={savingStock || !Number(stockCantidad)}
                  className="bg-green-600 text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-green-700 disabled:opacity-60">
                  {savingStock ? 'Guardando...' : 'Aplicar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

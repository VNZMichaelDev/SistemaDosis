'use client'

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function Recetas() {
  const [productos, setProductos] = useState<any[]>([]);
  const [selectedProducto, setSelectedProducto] = useState<any>(null);
  const [receta, setReceta] = useState<any[]>([]);
  const [ingredientes, setIngredientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  async function loadProductos() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/productos?limit=200');
      setProductos((data.products || []).filter((p: any) => p.es_receta));
    } catch { } finally { setLoading(false); }
  }

  async function loadIngredientes() {
    try {
      const data = await apiFetch('/api/ingredientes');
      setIngredientes(data.ingredientes || []);
    } catch { }
  }

  async function loadReceta(productoId: any) {
    try {
      const data = await apiFetch(`/api/recetas/${productoId}`);
      setReceta(data.receta || []);
    } catch { setReceta([]); }
  }

  useEffect(() => { loadProductos(); loadIngredientes(); }, []);

  useEffect(() => {
    if (selectedProducto) loadReceta(selectedProducto.id);
  }, [selectedProducto]);

  function addIngrediente() {
    setReceta([...receta, { ingrediente_id: '', cantidad: 1, ingrediente_nombre: '', ingrediente_unidad: '' }]);
  }

  function updateReceta(index: any, field: any, value: any) {
    const updated = [...receta];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'ingrediente_id') {
      const ing = ingredientes.find(i => i.id === Number(value));
      if (ing) {
        updated[index].ingrediente_nombre = ing.nombre;
        updated[index].ingrediente_unidad = ing.unidad;
      }
    }
    setReceta(updated);
  }

  function removeIngrediente(index: any) {
    setReceta(receta.filter((_, i) => i !== index));
  }

  async function saveReceta() {
    if (!selectedProducto) return;
    setSaving(true);
    setError('');
    try {
      const ingredientesPayload = receta
        .filter(r => r.ingrediente_id && r.cantidad > 0)
        .map(r => ({ ingrediente_id: Number(r.ingrediente_id), cantidad: Number(r.cantidad) }));
      await apiFetch(`/api/recetas/${selectedProducto.id}`, {
        method: 'PUT',
        body: { ingredientes: ingredientesPayload }
      });
    } catch (e: any) {
      setError(e?.data?.error || 'SAVE_FAILED');
    } finally { setSaving(false); }
  }

  const filtered = q.trim()
    ? productos.filter(p => p.nombre.toLowerCase().includes(q.toLowerCase()) || p.codigo.toLowerCase().includes(q.toLowerCase()))
    : productos;

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-2 border-b border-depo-border-2 md:bg-transparent">
        <div>
          <div className="text-lg font-medium text-depo-dark tracking-tight">Recetas</div>
          <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Asignar ingredientes a productos-receta</div>
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
            <div className="px-4 py-3 border-b border-[#F0EDE6]">
              <span className="text-[13px] font-medium text-depo-dark">Productos-receta</span>
              <input
                className="w-full mt-2 bg-depo-input border border-depo-border-2 rounded-lg py-2 px-3 text-[12px] text-depo-dark outline-none focus:border-depo-dark placeholder:text-depo-gray-3"
                placeholder="Buscar..."
                value={q} onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProducto(p)}
                  className={`w-full text-left px-4 py-3 border-b border-[#F5F3EE] transition-colors text-[13px] ${selectedProducto?.id === p.id ? 'bg-depo-dark text-white' : 'hover:bg-depo-table-header text-depo-dark'}`}>
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-[11px] opacity-60">{p.codigo}</div>
                </button>
              ))}
              {!loading && filtered.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-depo-gray-3">
                  {productos.length === 0 ? 'No hay productos con check "Receta"' : 'Sin resultados'}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {selectedProducto ? (
              <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
                <div className="px-4 md:px-6 py-3 border-b border-[#F0EDE6] flex items-center justify-between">
                  <div>
                    <span className="text-[13px] font-medium text-depo-dark">{selectedProducto.nombre}</span>
                    <span className="text-[11px] text-depo-gray-3 ml-2">({selectedProducto.codigo})</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addIngrediente}
                      className="bg-depo-dark text-white border-none rounded-md py-[7px] px-3 text-[11px] font-semibold cursor-pointer hover:bg-[#333]">
                      + Ingrediente
                    </button>
                    <button onClick={saveReceta} disabled={saving}
                      className="bg-green-600 text-white border-none rounded-md py-[7px] px-3 text-[11px] font-semibold cursor-pointer hover:bg-green-700 disabled:opacity-60">
                      {saving ? 'Guardando...' : 'Guardar receta'}
                    </button>
                  </div>
                </div>

                <div className="p-4 md:p-6">
                  {receta.length === 0 ? (
                    <div className="text-sm text-depo-gray-3 text-center py-6">
                      Sin ingredientes asignados. Haz click en &quot;+ Ingrediente&quot; para comenzar.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {receta.map((r, idx) => (
                        <div key={idx} className="flex gap-3 items-end">
                          <div className="flex-1">
                            <label className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-1 block">Ingrediente</label>
                            <select
                              className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[8px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark font-sans"
                              value={r.ingrediente_id}
                              onChange={(e) => updateReceta(idx, 'ingrediente_id', e.target.value)}>
                              <option value="">Seleccionar...</option>
                              {ingredientes.map((i) => (
                                <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-[120px]">
                            <label className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-1 block">Cantidad</label>
                            <input type="number" step="0.01" min="0"
                              className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[8px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark font-sans"
                              value={r.cantidad} onChange={(e) => updateReceta(idx, 'cantidad', e.target.value)} />
                          </div>
                          <div className="w-[70px]">
                            <label className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-1 block">Unidad</label>
                            <div className="py-[8px] px-3 text-[13px] text-depo-gray-2">{r.ingrediente_unidad || '—'}</div>
                          </div>
                          <button onClick={() => removeIngrediente(idx)}
                            className="bg-depo-bg border border-depo-border-2 text-[#DC2626] text-xs font-medium px-3 py-[8px] rounded transition-all hover:bg-rose-50 hover:border-rose-300 font-sans shrink-0">
                            Quitar
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white border border-depo-border rounded-[10px] p-8 text-center">
                <div className="text-sm text-depo-gray-3">Selecciona un producto-receta para editar su receta</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

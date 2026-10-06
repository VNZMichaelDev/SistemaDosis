'use client'

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function Departamentos() {
  const [departamentos, setDepartamentos] = useState<any>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<any>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formNombre, setFormNombre] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/departamentos');
      setDepartamentos(data.departamentos || []);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setFormNombre('');
    setFormDesc('');
    setError('');
    setShowModal(true);
  }

  function openEdit(d: any) {
    setEditing(d);
    setFormNombre(d.nombre);
    setFormDesc(d.descripcion || '');
    setError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditing(null);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    if (!formNombre.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      const body = { nombre: formNombre.trim(), descripcion: formDesc.trim() };
      if (editing?.id) {
        await apiFetch(`/api/departamentos/${editing.id}`, { method: 'PUT', body });
      } else {
        await apiFetch('/api/departamentos', { method: 'POST', body });
      }
      closeModal();
      await load();
    } catch (err: any) {
      setError(err?.data?.error || 'SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDepartamento(d: any) {
    const ok = window.confirm(`Eliminar departamento "${d.nombre}"? Los productos quedarán sin departamento.`);
    if (!ok) return;
    setBusyId(d.id);
    setError('');
    try {
      await apiFetch(`/api/departamentos/${d.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.data?.error || 'DELETE_FAILED');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="bg-depo-bg py-4 md:py-5 pr-4 md:pr-8 flex items-center justify-between border-b border-depo-border-2">
        <div>
          <div className="text-[22px] font-medium text-depo-dark tracking-tight">Departamentos</div>
          <div className="text-xs text-depo-gray-3 tracking-widest uppercase mt-[1px]">Categorías de productos</div>
        </div>
        <button onClick={openCreate} className="bg-depo-dark text-white border-none rounded-md py-[9px] px-5 text-[13px] font-medium cursor-pointer transition-colors hover:bg-[#333] font-sans tracking-wide">
          + Nuevo
        </button>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error ? (
          <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
        ) : null}

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Listado de departamentos</span>
            <span className="text-xs text-depo-gray-3">{departamentos.length} departamento{departamentos.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[520px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Nombre</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Descripción</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Productos</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {departamentos.map((d: any) => (
                  <tr key={d.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">{d.nombre}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">{d.descripcion || '—'}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-mono text-depo-dark">{d.total_productos}</td>
                    <td className="px-3 md:px-6 py-[14px]">
                      <div className="flex gap-[6px] justify-end">
                        <button
                          onClick={() => openEdit(d)}
                          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans"
                        >
                          Editar
                        </button>
                        <button
                          disabled={busyId === d.id}
                          onClick={() => deleteDepartamento(d)}
                          className="bg-[#FFF1F1] border border-[#FECACA] text-[#DC2626] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-[#FEE2E2] font-sans disabled:opacity-60"
                        >
                          {busyId === d.id ? '...' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && departamentos.length === 0 ? (
                  <tr>
                    <td className="px-3 md:px-6 py-8 text-center text-sm text-depo-gray-3" colSpan={4}>
                      No hay departamentos creados
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/45" onClick={closeModal} />
          <div className="relative bg-white rounded-xl p-7 w-[380px]" onClick={(e) => e.stopPropagation()}>
            <div className="text-base font-medium text-depo-dark mb-5">{editing ? 'Editar departamento' : 'Nuevo departamento'}</div>
            <form onSubmit={handleSubmit} className="space-y-[14px]">
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Nombre</label>
                <input
                  autoFocus
                  className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  placeholder="Ej: Carnes"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Descripción</label>
                <input
                  className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Descripción opcional"
                />
              </div>
              {error && showModal ? (
                <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
              ) : null}
              <div className="flex gap-2 pt-2 justify-end">
                <button type="button" onClick={closeModal} className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

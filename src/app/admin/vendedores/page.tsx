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

export default function Vendedores() {
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [q, setQ] = useState('');

  const [formNombre, setFormNombre] = useState('');
  const [formCedula, setFormCedula] = useState('');
  const [formComision, setFormComision] = useState('');
  const [formUsuarioId, setFormUsuarioId] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [vData, uData] = await Promise.all([
        apiFetch('/api/vendedores'),
        apiFetch('/api/usuarios')
      ]);
      setVendedores(vData.vendedores || []);
      setUsuarios(uData.users || []);
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
    setFormCedula('');
    setFormComision('');
    setFormUsuarioId('');
    setOpenForm(true);
  }

  function openEdit(v: any) {
    setEditing(v);
    setFormNombre(v.nombre);
    setFormCedula(v.cedula);
    setFormComision(String(v.comision_porcentaje || ''));
    setFormUsuarioId(v.usuario_id ? String(v.usuario_id) : '');
    setOpenForm(true);
  }

  async function submitForm(e: any) {
    e.preventDefault();
    if (!formNombre.trim() || !formCedula.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        nombre: formNombre.trim(),
        cedula: formCedula.trim(),
        comision_porcentaje: Number(formComision) || 0,
        usuario_id: formUsuarioId ? Number(formUsuarioId) : null
      };
      if (editing) {
        await apiFetch(`/api/vendedores/${editing.id}`, { method: 'PUT', body });
      } else {
        await apiFetch('/api/vendedores', { method: 'POST', body });
      }
      setOpenForm(false);
      load();
    } catch (e: any) {
      if (e?.data?.error === 'VENDEDOR_EXISTS') {
        setError('Ya existe un vendedor con esa cédula');
      } else if (e?.data?.error === 'USUARIO_YA_ASIGNADO') {
        setError(e?.data?.message || 'Este usuario ya está asignado a otro vendedor');
      } else {
        setError(e?.data?.error || 'SAVE_FAILED');
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteVendedor(v: any) {
    if (!confirm(`¿Eliminar vendedor "${v.nombre}"?`)) return;
    try {
      await apiFetch(`/api/vendedores/${v.id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setError(e?.data?.error || 'DELETE_FAILED');
    }
  }

  const filtered = q.trim()
    ? vendedores.filter(v => v.nombre.toLowerCase().includes(q.toLowerCase()) || v.cedula.includes(q))
    : vendedores;

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-2 border-b border-depo-border-2 md:bg-transparent">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-medium text-depo-dark tracking-tight">Vendedores</div>
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Gestión de vendedores y meseros</div>
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
            placeholder="Buscar vendedor..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Listado de vendedores</span>
            <span className="text-xs text-depo-gray-3">{filtered.length} vendedor{filtered.length !== 1 ? 'es' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[650px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Nombre</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Cédula</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Comisión</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Usuario</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((v) => (
                  <tr key={v.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">{v.nombre}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2 font-mono">{v.cedula}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2 font-mono">{v.comision_porcentaje > 0 ? `${v.comision_porcentaje}%` : <span className="text-[#CCC]">—</span>}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px]">
                      {v.usuario_nombre ? (
                        <span className="inline-block px-[10px] py-[3px] rounded text-[11px] font-medium tracking-wide bg-blue-50 text-blue-700">{v.usuario_nombre}</span>
                      ) : (
                        <span className="text-[#CCC]">—</span>
                      )}
                    </td>
                    <td className="px-3 md:px-6 py-[14px]">
                      <div className="flex gap-[6px] justify-end">
                        <button onClick={() => openEdit(v)}
                          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans">
                          Editar
                        </button>
                        <button onClick={() => deleteVendedor(v)}
                          className="bg-depo-bg border border-depo-border-2 text-[#DC2626] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-rose-50 hover:border-rose-300 font-sans">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={5}>Sin vendedores</td></tr>
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
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">{editing ? 'Editar vendedor' : 'Nuevo vendedor'}</div>
            <form onSubmit={submitForm} className="space-y-[14px] overflow-y-auto px-7 py-5">
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Nombre *</label>
                <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Juan Pérez" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Cédula *</label>
                  <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={formCedula} onChange={(e) => setFormCedula(e.target.value)} placeholder="V-12345678" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Comisión %</label>
                  <input type="number" step="0.1" min="0" className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={formComision} onChange={(e) => setFormComision(e.target.value)} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Usuario asignado</label>
                <select className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formUsuarioId} onChange={(e) => setFormUsuarioId(e.target.value)}>
                  <option value="">Sin usuario asignado</option>
                  {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>{u.usuario} ({u.rol})</option>
                  ))}
                </select>
                <div className="text-[11px] text-depo-gray-3 mt-1">Al asignar un usuario, al tomar pedido se identificará automáticamente al vendedor</div>
              </div>

              {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

              <div className="flex gap-2 pt-2 justify-end">
                <button type="button" onClick={() => setOpenForm(false)}
                  className="bg-transparent border border-depo-border-2 text-[#666] px-[18px] py-[9px] rounded-md text-[13px] font-sans cursor-pointer hover:border-[#999]">
                  Cancelar
                </button>
                <button type="submit" disabled={saving || !formNombre.trim() || !formCedula.trim()}
                  className="bg-depo-dark text-white border-none px-[22px] py-[9px] rounded-md text-[13px] font-medium font-sans cursor-pointer hover:bg-[#333] disabled:opacity-60">
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

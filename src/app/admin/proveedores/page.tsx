'use client'

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
      <circle cx="6.5" cy="6.5" r="4.5"/>
      <path d="M10 10l3.5 3.5"/>
    </svg>
  );
}

export default function Proveedores() {
  const router = useRouter();
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [q, setQ] = useState('');

  const [formNombre, setFormNombre] = useState('');
  const [formContacto, setFormContacto] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formDireccion, setFormDireccion] = useState('');
  const [formNotas, setFormNotas] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/proveedores');
      setProveedores(data.proveedores || []);
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
    setFormContacto('');
    setFormTelefono('');
    setFormDireccion('');
    setFormNotas('');
    setOpenForm(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setFormNombre(p.nombre);
    setFormContacto(p.contacto || '');
    setFormTelefono(p.telefono || '');
    setFormDireccion(p.direccion || '');
    setFormNotas(p.notas || '');
    setOpenForm(true);
  }

  async function submitForm(e: any) {
    e.preventDefault();
    if (!formNombre.trim()) return;
    setSaving(true);
    setError('');
    try {
      const body = {
        nombre: formNombre.trim(),
        contacto: formContacto.trim(),
        telefono: formTelefono.trim(),
        direccion: formDireccion.trim(),
        notas: formNotas.trim()
      };
      if (editing) {
        await apiFetch(`/api/proveedores/${editing.id}`, { method: 'PUT', body });
      } else {
        await apiFetch('/api/proveedores', { method: 'POST', body });
      }
      setOpenForm(false);
      load();
    } catch (e: any) {
      setError(e?.data?.error || 'SAVE_FAILED');
    } finally {
      setSaving(false);
    }
  }

  async function deleteProveedor(p: any) {
    if (!confirm(`¿Eliminar proveedor "${p.nombre}"?`)) return;
    try {
      await apiFetch(`/api/proveedores/${p.id}`, { method: 'DELETE' });
      load();
    } catch (e: any) {
      setError(e?.data?.error || 'DELETE_FAILED');
    }
  }

  const filtered = q.trim()
    ? proveedores.filter(p => p.nombre.toLowerCase().includes(q.toLowerCase()) || (p.contacto || '').toLowerCase().includes(q.toLowerCase()))
    : proveedores;

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-2 border-b border-depo-border-2 md:bg-transparent">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-medium text-depo-dark tracking-tight">Proveedores</div>
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Gestión de proveedores y deudas</div>
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
            placeholder="Buscar proveedor..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error && <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>}

        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Listado de proveedores</span>
            <span className="text-xs text-depo-gray-3">{filtered.length} proveedor{filtered.length !== 1 ? 'es' : ''}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[600px]">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Nombre</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Contacto</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Teléfono</th>
                  <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Dirección</th>
                  <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                    <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">{p.nombre}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">{p.contacto || <span className="text-[#CCC]">—</span>}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2 font-mono">{p.telefono || <span className="text-[#CCC]">—</span>}</td>
                    <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">{p.direccion || <span className="text-[#CCC]">—</span>}</td>
                    <td className="px-3 md:px-6 py-[14px]">
                      <div className="flex gap-[6px] justify-end">
                        <button onClick={() => router.push(`/admin/proveedores/${p.id}`)}
                          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans">
                          Facturas
                        </button>
                        <button onClick={() => openEdit(p)}
                          className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans">
                          Editar
                        </button>
                        <button onClick={() => deleteProveedor(p)}
                          className="bg-depo-bg border border-depo-border-2 text-[#DC2626] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-rose-50 hover:border-rose-300 font-sans">
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td className="px-4 py-8 text-center text-sm text-depo-gray-3" colSpan={5}>Sin proveedores</td></tr>
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
            <div className="text-base font-medium text-depo-dark px-7 pt-7 pb-0 shrink-0">{editing ? 'Editar proveedor' : 'Nuevo proveedor'}</div>
            <form onSubmit={submitForm} className="space-y-[14px] overflow-y-auto px-7 py-5">
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Nombre *</label>
                <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="Ej: Carnicería López" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Contacto</label>
                  <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={formContacto} onChange={(e) => setFormContacto(e.target.value)} placeholder="Nombre del contacto" />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Teléfono</label>
                  <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                    value={formTelefono} onChange={(e) => setFormTelefono(e.target.value)} placeholder="0412-1234567" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Dirección</label>
                <input className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                  value={formDireccion} onChange={(e) => setFormDireccion(e.target.value)} placeholder="Dirección del proveedor" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Notas</label>
                <textarea className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans resize-none" rows={2}
                  value={formNotas} onChange={(e) => setFormNotas(e.target.value)} placeholder="Notas adicionales..." />
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
    </>
  );
}

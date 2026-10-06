'use client'

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import UsuarioEditModal from './UsuarioEditModal';

export default function Usuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<any>(null);
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState('mesero');
  const [deptosList, setDeptosList] = useState<any[]>([]);
  const [createDeptos, setCreateDeptos] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/api/departamentos').then((d) => setDeptosList(d.departamentos || [])).catch(() => {});
  }, []);

  function toggleCreateDepto(id: any) {
    setCreateDeptos((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/usuarios');
      setUsers(data.users);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  async function createUser() {
    setError('');
    try {
      await apiFetch('/api/usuarios', {
        method: 'POST',
        body: { usuario, password, rol, departamentos_precios: rol === 'empleado' ? createDeptos : undefined },
      });
      setUsuario('');
      setPassword('');
      setRol('cocina');
      setCreateDeptos([]);
      await load();
    } catch (e: any) {
      setError(e?.data?.error || 'CREATE_FAILED');
    }
  }

  async function saveUser(payload: any) {
    if (!editing?.id) return;
    await apiFetch(`/api/usuarios/${editing.id}`, {
      method: 'PUT',
      body: payload,
    });
    await load();
  }

  async function deleteUser(u: any) {
    const ok = window.confirm(`Eliminar usuario "${u.usuario}"?`);
    if (!ok) return;
    setBusyId(u.id);
    setError('');
    try {
      await apiFetch(`/api/usuarios/${u.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      setError(e?.data?.error || 'DELETE_FAILED');
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      {/* Topbar */}
      <div className="bg-depo-bg py-4 md:py-5 pr-4 md:pr-8 flex items-center justify-between border-b border-depo-border-2">
        <div>
          <div className="text-[22px] font-medium text-depo-dark tracking-tight">Usuarios</div>
          <div className="text-xs text-depo-gray-3 tracking-widest uppercase mt-[1px]">Administra usuarios y roles</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error ? (
          <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
        ) : null}

        {/* Create form */}
        <div className="bg-white border border-depo-border rounded-lg p-5 mb-6">
          <div className="text-[13px] font-medium text-depo-dark mb-4">Nuevo usuario</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Usuario</label>
              <input
                className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="ej: caja1"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Contraseña</label>
              <input
                type="password"
                className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Rol</label>
              <select
                className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
                value={rol}
                onChange={(e) => { setRol(e.target.value); if (e.target.value === 'admin') setCreateDeptos([]); }}
              >
                <option value="admin">Admin</option>
                <option value="encargado">Encargado</option>
                <option value="empleado">Empleado</option>
                <option value="mesero">Mesero</option>
                <option value="cocina">Cocina</option>
              </select>
            </div>
            {rol === 'empleado' && deptosList.length > 0 ? (
              <div>
                <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Departamentos (precios)</label>
                <div className="max-h-[120px] overflow-y-auto border border-depo-border-2 rounded-md bg-depo-bg p-1.5 space-y-0.5">
                  {deptosList.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-white text-[12px] text-depo-dark">
                      <input
                        type="checkbox"
                        className="accent-depo-dark"
                        checked={createDeptos.includes(d.id)}
                        onChange={() => toggleCreateDepto(d.id)}
                      />
                      {d.nombre}
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="flex items-end">
              <button
                onClick={createUser}
                className="w-full bg-depo-dark text-white border-none rounded-md py-[9px] px-5 text-[13px] font-medium cursor-pointer transition-colors hover:bg-[#333] font-sans tracking-wide"
              >
                Crear
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Listado de usuarios</span>
            <span className="text-xs text-depo-gray-3">{users.length} usuario{users.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[480px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Usuario</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Rol</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Departamentos (precios)</th>
                <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                  <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">{u.usuario}</td>
                  <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2 whitespace-nowrap">
                    <span className={`inline-block px-[10px] py-[3px] rounded text-[11px] font-medium tracking-wide capitalize ${
                      u.rol === 'admin' ? 'bg-[#EEF2FF] text-[#3730A3]' :
                      u.rol === 'encargado' ? 'bg-[#E8F5E9] text-[#2E7D32]' :
                      u.rol === 'empleado' ? 'bg-[#E8F5E9] text-[#2E7D32]' :
                      u.rol === 'mesero' ? 'bg-[#FFF3E0] text-[#E65100]' :
                      u.rol === 'cocina' ? 'bg-[#F3E5F5] text-[#7B1FA2]' :
                      'bg-[#F1EFE8] text-[#5F5E5A]'
                    }`}>
                      {u.rol === 'mesero' ? 'Mesero' : u.rol === 'cocina' ? 'Cocina' : u.rol === 'empleado' ? 'Empleado' : u.rol}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-[14px] text-[12px] text-depo-gray-2">
                    {u.departamentos_precios && u.departamentos_precios.length > 0
                      ? deptosList.filter((d) => u.departamentos_precios.includes(d.id)).map((d) => d.nombre).join(', ')
                      : <span className="text-[#CCC]">—</span>}
                  </td>
                  <td className="px-3 md:px-6 py-[14px]">
                    <div className="flex gap-[6px] justify-end">
                      <button
                        onClick={() => {
                          setEditing(u);
                          setOpenEdit(true);
                        }}
                        className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans"
                      >
                        Editar
                      </button>
                      <button
                        disabled={busyId === u.id}
                        onClick={() => deleteUser(u)}
                        className="bg-[#FFF1F1] border border-[#FECACA] text-[#DC2626] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-[#FEE2E2] font-sans disabled:opacity-60"
                      >
                        {busyId === u.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && users.length === 0 ? (
                <tr>
                  <td className="px-3 md:px-6 py-8 text-center text-sm text-depo-gray-3" colSpan={4}>
                    Sin usuarios
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      <UsuarioEditModal
        open={openEdit}
        initial={editing}
        onClose={() => setOpenEdit(false)}
        onSubmit={saveUser}
      />
    </>
  );
}

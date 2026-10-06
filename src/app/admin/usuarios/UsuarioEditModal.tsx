'use client'

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function UsuarioEditModal({ open, initial, onClose, onSubmit }: {
  open: boolean;
  initial: any;
  onClose: () => void;
  onSubmit: (payload: any) => Promise<any>;
}) {
  const [rol, setRol] = useState('mesero');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deptosList, setDeptosList] = useState<any[]>([]);
  const [editDeptos, setEditDeptos] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/api/departamentos').then((d) => setDeptosList(d.departamentos || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaving(false);
    setRol(initial?.rol ?? 'mesero');
    setPassword('');
    setEditDeptos(initial?.departamentos_precios || []);
  }, [open, initial]);

  function toggleDepto(id: any) {
    setEditDeptos((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  const payload = useMemo(() => {
    const out: any = { rol };
    if (password.trim().length > 0) out.password = password;
    out.departamentos_precios = rol === 'empleado' ? editDeptos : [];
    return out;
  }, [rol, password, editDeptos]);

  async function submit(e: any) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit(payload);
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
      <div className="relative bg-white rounded-xl p-7 w-[420px]" onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-medium text-depo-dark mb-5">Editar usuario: {initial?.usuario ?? ''}</div>

        <form onSubmit={submit} className="space-y-[14px]">
          <div>
            <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Rol</label>
            <select
              className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
              value={rol}
              onChange={(e) => { setRol(e.target.value); if (e.target.value === 'admin') setEditDeptos([]); }}
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
              <div className="max-h-[140px] overflow-y-auto border border-depo-border-2 rounded-md bg-depo-bg p-1.5 space-y-0.5">
                {deptosList.map((d) => (
                  <label key={d.id} className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-white text-[12px] text-depo-dark">
                    <input
                      type="checkbox"
                      className="accent-depo-dark"
                      checked={editDeptos.includes(d.id)}
                      onChange={() => toggleDepto(d.id)}
                    />
                    {d.nombre}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">
              Nueva contraseña (opcional)
            </label>
            <input
              type="password"
              className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dejar en blanco para no cambiar"
            />
          </div>

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
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

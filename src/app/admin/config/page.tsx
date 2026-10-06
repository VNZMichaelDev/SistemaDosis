'use client'

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function Config() {
  const [tasa, setTasa] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    setOk('');
    try {
      const data = await apiFetch('/api/config');
      setTasa(String(data.config.tasa_cambio));
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError('');
    setOk('');
    try {
      await apiFetch('/api/config', { method: 'PUT', body: { tasa_cambio: Number(tasa) } });
      setOk('Guardado correctamente');
    } catch (e: any) {
      setError(e?.data?.error || 'SAVE_FAILED');
    } finally {
      setSaving(false);
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
          <div className="text-[22px] font-medium text-depo-dark tracking-tight">Tasa $</div>
          <div className="text-xs text-depo-gray-3 tracking-widest uppercase mt-[1px]">Tasa de cambio (USD a Bs)</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {error ? (
          <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
        ) : null}
        {ok ? (
          <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 border border-emerald-200">{ok}</div>
        ) : null}

        <div className="bg-white border border-depo-border rounded-[10px] p-6 max-w-md">
          <div className="mb-4">
            <label className="text-[11px] font-medium text-depo-gray tracking-wider uppercase mb-[5px] block">Tasa de cambio</label>
            <input
              type="number"
              step="0.01"
              className="w-full bg-depo-bg border border-depo-border-2 rounded-md py-[9px] px-3 text-[13px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white font-sans"
              value={tasa}
              onChange={(e) => setTasa(e.target.value)}
              placeholder="Ej: 36.50"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving || loading}
              className="bg-depo-dark text-white border-none rounded-md py-[9px] px-5 text-[13px] font-medium cursor-pointer transition-colors hover:bg-[#333] font-sans tracking-wide disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={load}
              disabled={loading}
              className="bg-transparent text-[#555] border border-depo-border-2 rounded-md py-[9px] px-4 text-[13px] font-normal cursor-pointer transition-all hover:border-[#999] hover:text-depo-dark font-sans"
            >
              Recargar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

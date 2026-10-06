'use client'

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import ProductoFormModal from './ProductoFormModal';

function formatBS(n: any) { const [i, d] = Number(n || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; }

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  );
}

export default function Inventario() {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [products, setProducts] = useState<any>([]);
  const [departamentos, setDepartamentos] = useState<any>([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [busyId, setBusyId] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [tasa, setTasa] = useState(1);
  const searchTimer = useRef<any>(null);

  async function load(pg?: any) {
    const p = pg ?? page;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (deptFilter) params.set('departamento_id', deptFilter);
      params.set('page', String(p));
      params.set('limit', '20');

      const [prodData, deptData, configData] = await Promise.all([
        apiFetch(`/api/productos?${params.toString()}`),
        apiFetch('/api/departamentos'),
        apiFetch('/api/config')
      ]);
      setProducts(prodData.products);
      setPage(prodData.page || p);
      setTotalPages(prodData.totalPages || 1);
      setTotalCount(prodData.totalCount || 0);
      setDepartamentos(deptData.departamentos || []);
      if (configData.config?.tasa_cambio) setTasa(configData.config.tasa_cambio);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  function goPage(p: any) {
    if (p < 1 || p > totalPages) return;
    setPage(p);
    load(p);
  }

  function handleSearchChange(val: any) {
    setQ(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load(1);
    }, 300);
  }

  function handleDeptFilterChange(val: any) {
    setDeptFilter(val);
    setPage(1);
    setTimeout(() => load(1), 0);
  }

  async function saveProduct(payload: any) {
    if (editing?.id) {
      await apiFetch(`/api/productos/${editing.id}`, {
        method: 'PUT',
        body: payload,
      });
    } else {
      await apiFetch('/api/productos', {
        method: 'POST',
        body: payload,
      });
    }
    await load(page);
  }

  async function deleteProduct(p: any) {
    const ok = window.confirm(`Eliminar producto "${p.nombre}" (${p.codigo})?`);
    if (!ok) return;
    setBusyId(p.id);
    setError('');
    try {
      await apiFetch(`/api/productos/${p.id}`, { method: 'DELETE' });
      await load();
    } catch (e: any) {
      const errorCode = e?.data?.error;
      if (errorCode === 'PRODUCT_HAS_SALES') {
        setError('No se puede eliminar: el producto tiene ventas registradas');
      } else {
        setError(errorCode || 'Error al eliminar');
      }
    } finally {
      setBusyId(null);
    }
  }

  function tipoPillClass(tipo: any) {
    if (tipo === 'peso') return 'bg-[#EEF2FF] text-[#3730A3]';
    return 'bg-[#FFF7ED] text-[#C2410C]';
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="bg-white px-3 md:px-0 py-3 flex flex-col gap-2 border-b border-depo-border-2 md:bg-transparent">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-medium text-depo-dark tracking-tight">Menú</div>
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase">Productos</div>
          </div>
          <button
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
            className="bg-depo-dark text-white border-none rounded-lg py-2 px-4 text-[12px] font-semibold cursor-pointer transition-colors hover:bg-[#333] tracking-wide active:scale-[0.97]"
          >
            + Nuevo
          </button>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-depo-gray-3">
            <SearchIcon />
          </span>
          <input
            className="w-full bg-depo-input border border-depo-border-2 rounded-xl py-2.5 pr-3 pl-8 text-[13px] text-depo-dark outline-none transition-colors focus:border-depo-dark focus:bg-white placeholder:text-depo-gray-3"
            placeholder="Buscar código o nombre..."
            value={q}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={deptFilter}
            onChange={(e) => handleDeptFilterChange(e.target.value)}
            className="flex-1 bg-depo-input border border-depo-border-2 rounded-xl py-2.5 px-3 text-[12px] text-depo-dark outline-none focus:border-depo-dark focus:bg-white cursor-pointer"
          >
            <option value="">Todas las categorías</option>
            {departamentos.map((d: any) => (
              <option key={d.id} value={d.id}>{d.nombre} ({d.total_productos})</option>
            ))}
          </select>
          <button
            onClick={load}
            disabled={loading}
            className="bg-depo-input text-depo-gray-2 border border-depo-border-2 rounded-xl py-2.5 px-3 text-[12px] font-medium cursor-pointer transition-all hover:border-depo-gray-3 hover:text-depo-dark active:scale-[0.97]"
          >
            Recargar
          </button>
        </div>
      </div>

      <div className="flex-1 py-3 overflow-y-auto">
        {error ? (
          <div className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
        ) : null}

        {/* Stats simplificados */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <div className="bg-white border border-depo-border rounded-lg p-3">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-1">Total productos</div>
            <div className="text-xl font-medium text-depo-dark tracking-tight font-mono">{totalCount}</div>
            <div className="inline-block text-[9px] font-medium px-[5px] py-[1px] rounded mt-0.5 tracking-wide bg-depo-gray-4 text-[#5F5E5A]">
              En menú
            </div>
          </div>
          <div className="bg-white border border-depo-border rounded-lg p-3">
            <div className="text-[10px] text-depo-gray-3 tracking-widest uppercase mb-1">Categorías</div>
            <div className="text-xl font-medium text-depo-dark tracking-tight font-mono">{departamentos.length}</div>
            <div className="inline-block text-[9px] font-medium px-[5px] py-[1px] rounded mt-0.5 tracking-wide bg-depo-gray-4 text-[#5F5E5A]">
              departamentos
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-[#F0EDE6] flex items-center justify-between">
            <span className="text-[13px] font-medium text-depo-dark">Listado de productos</span>
            <span className="text-xs text-depo-gray-3">{totalCount} producto{totalCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[780px]">
            <thead>
              <tr>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Código</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Nombre</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Costo</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Margen</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Precio Venta</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Tipo</th>
                <th className="text-center text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Receta</th>
                <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Categoría</th>
                <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: any) => (
                <tr key={p.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                  <td className="px-3 md:px-6 py-[14px] text-[13px] font-mono text-depo-gray-3 font-medium">
                    {p.codigo}
                    {p.codigos_alternos > 0 ? (
                      <span className="ml-1.5 text-[9px] text-depo-gray-3 bg-depo-bg border border-depo-border-2 rounded px-1 py-[1px]">+{p.codigos_alternos}</span>
                    ) : null}
                  </td>
                  <td className="px-3 md:px-6 py-[14px] text-[13px] font-medium text-depo-dark">{p.nombre}</td>
                  <td className="px-3 md:px-6 py-[14px] font-mono text-depo-dark text-[13px]">
                    ${Number(p.precio_costo || 0).toFixed(2)}
                  </td>
                  <td className="px-3 md:px-6 py-[14px] font-mono text-depo-dark text-[13px]">
                    {p.margen_ganancia > 0 ? `${Number(p.margen_ganancia).toFixed(1)}%` : <span className="text-[#CCC]">—</span>}
                  </td>
                  <td className="px-3 md:px-6 py-[14px] font-mono text-depo-dark">
                    <span className="text-[13px] font-bold">Bs {formatBS(p.precio_usd * tasa)}</span><br/>
                    <span className="text-[11px]">${Number(p.precio_usd).toFixed(2)} USD</span>
                  </td>
                  <td className="px-3 md:px-6 py-[14px]">
                    <span className={`inline-block px-[10px] py-[3px] rounded text-[11px] font-medium tracking-wide capitalize ${tipoPillClass(p.tipo)}`}>
                      {p.tipo}
                    </span>
                  </td>
                  <td className="px-3 md:px-6 py-[14px] text-center">
                    {p.es_receta ? (
                      <span className="inline-block px-[10px] py-[3px] rounded text-[11px] font-medium tracking-wide bg-amber-100 text-amber-700">Si</span>
                    ) : (
                      <span className="text-[#CCC]">—</span>
                    )}
                  </td>
                  <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">
                    {p.departamento_nombre || <span className="text-[#CCC]">—</span>}
                  </td>
                  <td className="px-3 md:px-6 py-[14px]">
                    <div className="flex gap-[6px] justify-end">
                      <button
                        onClick={() => {
                          setEditing(p);
                          setOpenForm(true);
                        }}
                        className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans"
                      >
                        Editar
                      </button>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => deleteProduct(p)}
                        className="bg-[#FFF1F1] border border-[#FECACA] text-[#DC2626] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-[#FEE2E2] font-sans disabled:opacity-60"
                      >
                        {busyId === p.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && products.length === 0 ? (
                <tr>
                    <td className="px-3 md:px-6 py-8 text-center text-sm text-depo-gray-3" colSpan={9}>
                    Sin productos
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-[13px]">
              <span className="text-depo-gray-3">Página {page} de {totalPages}</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => goPage(page - 1)}
                  disabled={page <= 1}
                  className="bg-white border border-depo-border-2 rounded-md px-3 py-1.5 text-[12px] text-depo-dark cursor-pointer hover:border-[#999] disabled:opacity-40 disabled:cursor-default font-sans"
                >
                  Anterior
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let p;
                  if (totalPages <= 5) {
                    p = i + 1;
                  } else if (page <= 3) {
                    p = i + 1;
                  } else if (page >= totalPages - 2) {
                    p = totalPages - 4 + i;
                  } else {
                    p = page - 2 + i;
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => goPage(p)}
                      className={`min-w-[32px] rounded-md px-2.5 py-1.5 text-[12px] font-sans cursor-pointer border ${
                        p === page
                          ? 'bg-depo-dark text-white border-depo-dark'
                          : 'bg-white border-depo-border-2 text-depo-dark hover:border-[#999]'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => goPage(page + 1)}
                  disabled={page >= totalPages}
                  className="bg-white border border-depo-border-2 rounded-md px-3 py-1.5 text-[12px] text-depo-dark cursor-pointer hover:border-[#999] disabled:opacity-40 disabled:cursor-default font-sans"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>

      <ProductoFormModal
        open={openForm}
        initial={editing}
        onClose={() => setOpenForm(false)}
        onSubmit={saveProduct}
      />
    </>
  );
}

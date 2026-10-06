'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '@/lib/api-client'

export default function Facturas() {
  const [tab, setTab] = useState('pedidos');
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [facturas, setFacturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selected, setSelected] = useState<any>(null);
  const [detalle, setDetalle] = useState<any[]>([]);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<any>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [toast, setToast] = useState('');

  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productos, setProductos] = useState<any[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [selectedQty, setSelectedQty] = useState<any>({});

  async function loadPedidos() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/pedidos/pendientes');
      setPedidos(data.pedidos || []);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  async function loadFacturas(p = 1) {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/api/facturas?page=${p}&limit=20&search=${encodeURIComponent(search)}&pagada=0`);
      setFacturas(data.facturas || []);
      setPage(data.page || 1);
      setTotalPages(data.pages || 1);
    } catch (e: any) {
      setError(e?.data?.error || 'LOAD_FAILED');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'pedidos') loadPedidos();
    else loadFacturas();
  }, [tab]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 2500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function abrirPedido(p: any) {
    setSelected({ tipo: 'pedido', ...p });
    setDetalle(p.items || []);
  }

  async function abrirFactura(f: any) {
    setSelected({ tipo: 'factura', ...f });
    setDetalleLoading(true);
    try {
      const data = await apiFetch(`/api/reportes/ventas/${f.id}`);
      setDetalle(data.detalle || []);
    } catch {
      setDetalle([]);
    } finally {
      setDetalleLoading(false);
    }
  }

  async function eliminarItemPedido(item: any, pedidoId: any) {
    if (!confirm(`¿Quitar "${item.producto_nombre}" del pedido?`)) return;
    setDeletingId(item.id);
    try {
      const data = await apiFetch(`/api/pedidos/${pedidoId}/items/${item.id}`, { method: 'DELETE' });
      if (data.ok) {
        setDetalle(data.items || []);
        setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, items: data.items } : p));
        setToast('Item eliminado del pedido');
      }
    } catch (e: any) {
      setToast(e?.data?.message || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  async function eliminarItemFactura(item: any) {
    if (!selected) return;
    if (!confirm(`¿Quitar "${item.nombre}" de la factura #${selected.id}?`)) return;
    setDeletingId(item.id);
    try {
      const data = await apiFetch(`/api/facturas/${selected.id}/items/${item.id}`, { method: 'DELETE' });
      if (data.ok) {
        if (data.venta) {
          setSelected({ tipo: 'factura', ...data.venta });
          setDetalle(data.detalle || []);
        } else {
          setSelected(null);
          setDetalle([]);
          loadFacturas(page);
        }
        setToast('Item eliminado');
      }
    } catch (e: any) {
      setToast(e?.data?.message || 'Error al eliminar');
    } finally {
      setDeletingId(null);
    }
  }

  const buscarProductos = useCallback(async (q: any) => {
    if (!q || q.length < 1) { setProductos([]); return; }
    setProductLoading(true);
    try {
      const data = await apiFetch(`/api/productos?q=${encodeURIComponent(q)}`);
      setProductos(data.products || data.productos || data || []);
    } catch {
      setProductos([]);
    } finally {
      setProductLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showProductSearch) return;
    const t = setTimeout(() => buscarProductos(productSearch), 250);
    return () => clearTimeout(t);
  }, [productSearch, showProductSearch, buscarProductos]);

  function abrirBusquedaProducto() {
    setProductSearch('');
    setProductos([]);
    setSelectedQty({});
    setShowProductSearch(true);
  }

  async function agregarProductoAPedido(producto: any, pedidoId: any) {
    const qty = Number(selectedQty[producto.id]) || 1;
    const subtotal = Number((qty * producto.precio_usd).toFixed(2));
    setAddingItem(true);
    try {
      const data = await apiFetch(`/api/pedidos/${pedidoId}/items`, {
        method: 'POST',
        body: {
          items: [{
            producto_id: producto.id,
            cantidad: qty,
            precio_usd: producto.precio_usd,
            subtotal
          }]
        }
      });
      if (data.pedido) {
        setDetalle(data.items || []);
        setPedidos(prev => prev.map(p => p.id === pedidoId ? { ...p, items: data.items } : p));
        setShowProductSearch(false);
        setToast(`${producto.nombre} agregado al pedido`);
      }
    } catch (e: any) {
      setToast(e?.data?.message || 'Error al agregar');
    } finally {
      setAddingItem(false);
    }
  }

  async function agregarProductoAFactura(producto: any) {
    if (!selected) return;
    const qty = Number(selectedQty[producto.id]) || 1;
    const subtotal = Number((qty * producto.precio_usd).toFixed(2));
    setAddingItem(true);
    try {
      const data = await apiFetch(`/api/facturas/${selected.id}/items`, {
        method: 'POST',
        body: {
          producto_id: producto.id,
          cantidad: qty,
          precio_usd: producto.precio_usd,
          subtotal
        }
      });
      if (data.ok) {
        setSelected({ tipo: 'factura', ...data.venta });
        setDetalle(data.detalle || []);
        setShowProductSearch(false);
        setToast(`${producto.nombre} agregado`);
      }
    } catch (e: any) {
      setToast(e?.data?.message || 'Error al agregar');
    } finally {
      setAddingItem(false);
    }
  }

  function formatFecha(fecha: any) {
    if (!fecha) return '';
    try {
      const d = new Date(fecha.replace(' ', 'T') + (fecha.includes('Z') ? '' : 'Z'));
      return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return fecha;
    }
  }

  function getEstadoBadge(p: any) {
    if (p.estado === 'listo') return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Listo</span>;
    if (p.estado === 'preparando') return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">Preparando</span>;
    return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Pendiente</span>;
  }

  function cerrarModal() {
    setSelected(null);
    setDetalle([]);
    setShowProductSearch(false);
  }

  return (
    <>
      <div className="bg-depo-bg py-4 md:py-5 pr-4 md:pr-8 flex items-center justify-between border-b border-depo-border-2">
        <div>
          <div className="text-[22px] font-medium text-depo-dark tracking-tight">Facturas</div>
          <div className="text-xs text-depo-gray-3 tracking-widest uppercase mt-[1px]">Pendientes de cobro</div>
        </div>
      </div>

      <div className="flex-1 py-4 md:py-6 pr-4 md:pr-8 overflow-y-auto">
        {toast && (
          <div className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-200">{toast}</div>
        )}
        {error ? (
          <div className="mb-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 border border-rose-200">{error}</div>
        ) : null}

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          <button
            onClick={() => { setTab('pedidos'); setError(''); }}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${tab === 'pedidos' ? 'bg-depo-dark text-white' : 'bg-white text-depo-gray-3 border border-depo-border-2 hover:bg-depo-bg'}`}
          >
            Pedidos sin cobrar
          </button>
          <button
            onClick={() => { setTab('facturas'); setError(''); }}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${tab === 'facturas' ? 'bg-depo-dark text-white' : 'bg-white text-depo-gray-3 border border-depo-border-2 hover:bg-depo-bg'}`}
          >
            Facturas pendientes
          </button>
        </div>

        {/* Search (solo facturas) */}
        {tab === 'facturas' && (
          <div className="mb-4 flex gap-2">
            <input
              type="text"
              placeholder="Buscar por # de factura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadFacturas(1); }}
              className="flex-1 max-w-[240px] bg-white border border-depo-border-2 rounded-lg px-3 py-2 text-[13px] text-depo-dark outline-none focus:border-depo-dark"
            />
            <button
              onClick={() => loadFacturas(1)}
              className="bg-depo-dark text-white text-[12px] font-medium px-4 py-2 rounded-lg hover:bg-depo-dark-2 transition-colors"
            >
              Buscar
            </button>
          </div>
        )}

        {tab === 'pedidos' ? (
          /* PEDIDOS LISTOS NO PAGADOS */
          <div className="space-y-2">
            {loading && pedidos.length === 0 && (
              <div className="text-center text-sm text-depo-gray-3 py-8">Cargando pedidos...</div>
            )}
            {!loading && pedidos.length === 0 && (
              <div className="text-center text-sm text-depo-gray-3 py-8">No hay pedidos pendientes de cobro</div>
            )}
            {pedidos.map((p) => {
              const total = p.items?.reduce((s: any, i: any) => s + Number(i.subtotal), 0) || 0;
              return (
                <button
                  key={p.id}
                  onClick={() => abrirPedido(p)}
                  className="w-full bg-white rounded-2xl border border-depo-border p-4 text-left hover:border-depo-yellow transition-all"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] font-bold text-depo-dark">{p.mesa_nombre}</span>
                        <span className="text-[10px] text-depo-gray-6 font-mono">#{p.id}</span>
                        {getEstadoBadge(p)}
                      </div>
                      {p.cliente && (
                        <div className="text-[12px] text-depo-yellow font-semibold mt-0.5">👤 {p.cliente}</div>
                      )}
                    </div>
                    <span className="text-[14px] font-mono font-bold text-depo-dark">${total.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {p.items?.slice(0, 5).map((item: any) => (
                      <span key={item.id} className="bg-depo-bg text-depo-gray-5 text-[11px] px-2.5 py-1 rounded-lg">
                        {Number(item.cantidad)}× {item.producto_nombre}
                      </span>
                    ))}
                    {p.items?.length > 5 && (
                      <span className="text-depo-gray-6 text-[11px]">+{p.items.length - 5} más</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* FACTURAS PENDIENTES */
          <>
            <div className="bg-white border border-depo-border rounded-[10px] overflow-hidden">
              <div className="px-4 md:px-6 py-3 border-b border-[#F0EDE6] flex items-center justify-between">
                <span className="text-[13px] font-medium text-depo-dark">Listado de facturas</span>
                <span className="text-xs text-depo-gray-3">{facturas.length} factura{facturas.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[520px]">
                <thead>
                  <tr>
                    <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">#</th>
                    <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Fecha</th>
                    <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Método</th>
                    <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Mesa</th>
                    <th className="text-left text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Total</th>
                    <th className="text-right text-[11px] font-medium text-depo-gray-3 tracking-widest uppercase px-3 md:px-6 py-3 bg-depo-table-header border-b border-[#F0EDE6]">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((f) => (
                    <tr key={f.id} className="border-b border-[#F5F3EE] hover:bg-depo-table-header transition-colors">
                      <td className="px-3 md:px-6 py-[14px] text-[13px] font-semibold text-depo-dark font-mono">#{f.id}</td>
                      <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">{formatFecha(f.fecha)}</td>
                      <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">{f.metodo_pago}</td>
                      <td className="px-3 md:px-6 py-[14px] text-[13px] text-depo-gray-2">{f.mesa_nombre || '—'}</td>
                      <td className="px-3 md:px-6 py-[14px] text-[13px] font-semibold font-mono text-depo-dark">${f.total_usd.toFixed(2)}</td>
                      <td className="px-3 md:px-6 py-[14px]">
                        <div className="flex gap-[6px] justify-end">
                          <button
                            onClick={() => abrirFactura(f)}
                            className="bg-depo-bg border border-depo-border-2 text-[#444] text-xs font-medium px-[14px] py-[5px] rounded transition-all hover:bg-depo-input hover:border-[#CCC] font-sans"
                          >
                            Ver / Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && facturas.length === 0 ? (
                    <tr>
                      <td className="px-3 md:px-6 py-8 text-center text-sm text-depo-gray-3" colSpan={6}>
                        No hay facturas pendientes de cobro
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  disabled={page <= 1}
                  onClick={() => loadFacturas(page - 1)}
                  className="text-[12px] px-3 py-1.5 rounded-lg border border-depo-border-2 text-depo-gray-2 hover:bg-depo-input disabled:opacity-40"
                >
                  ← Anterior
                </button>
                <span className="text-[12px] text-depo-gray-3 py-1.5">Página {page} de {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => loadFacturas(page + 1)}
                  className="text-[12px] px-3 py-1.5 rounded-lg border border-depo-border-2 text-depo-gray-2 hover:bg-depo-input disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Detalle (Pedido o Factura) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={cerrarModal} />
          <div className="relative bg-white rounded-[14px] p-5 md:p-6 w-full max-w-[92vw] md:w-[620px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-medium text-[#1A1A1A]">
                  {selected.tipo === 'pedido' ? `Pedido #${selected.id}` : `Factura #${selected.id}`}
                </div>
                <div className="text-xs text-[#888] mt-0.5">
                  {selected.tipo === 'pedido'
                    ? `${selected.mesa_nombre}${selected.cliente ? ` · 👤 ${selected.cliente}` : ''}`
                    : `${formatFecha(selected.fecha)} · ${selected.metodo_pago} · ${selected.mesa_nombre || 'Sin mesa'}`}
                </div>
              </div>
              {selected.tipo === 'pedido' ? getEstadoBadge(selected) : (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">Pendiente</span>
              )}
            </div>

            {selected.tipo === 'factura' && detalleLoading ? (
              <div className="text-sm text-[#888] py-8 text-center">Cargando detalle...</div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[13px] font-medium text-depo-dark">Productos</div>
                  <button
                    onClick={abrirBusquedaProducto}
                    className="text-[11px] font-medium text-depo-dark bg-depo-bg border border-depo-border-2 px-3 py-1 rounded-lg hover:bg-depo-input transition-colors"
                  >
                    + Agregar producto
                  </button>
                </div>

                {detalle.length === 0 ? (
                  <div className="text-xs text-[#888] py-4 text-center">Sin productos</div>
                ) : (
                  <div className="flex flex-col gap-2 mb-4">
                    {detalle.map((d) => {
                      const nombre = d.producto_nombre || d.nombre;
                      const esPedido = selected.tipo === 'pedido';
                      return (
                        <div key={d.id} className="flex items-center justify-between border border-[#E0DED8] rounded-lg p-3 bg-[#FAFAF8]">
                          <div className="flex-1">
                            <div className="text-[13px] font-medium text-depo-dark">{nombre}</div>
                            <div className="text-[11px] text-[#888]">
                              {d.tipo === 'peso' ? `${Number(d.cantidad).toFixed(2)} kg` : `${Number(d.cantidad)} u`} × ${Number(d.precio_usd).toFixed(2)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[13px] font-semibold font-mono text-depo-dark">${Number(d.subtotal).toFixed(2)}</span>
                            <button
                              onClick={() => esPedido ? eliminarItemPedido(d, selected.id) : eliminarItemFactura(d)}
                              disabled={deletingId === d.id}
                              className="text-[#DC2626] hover:text-white hover:bg-[#DC2626] border border-[#DC2626] rounded-md w-7 h-7 flex items-center justify-center transition-all text-[13px] disabled:opacity-40"
                              title="Quitar item"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="border-t border-[#E0DED8] pt-3 flex justify-between">
                  <span className="text-[13px] font-medium text-depo-dark">Total</span>
                  <span className="text-[15px] font-bold font-mono text-depo-dark">
                    ${(detalle.reduce((s, d) => s + Number(d.subtotal), 0)).toFixed(2)}
                  </span>
                </div>
              </>
            )}

            <button
              onClick={cerrarModal}
              className="w-full mt-5 bg-[#1A1A1A] text-white border-none text-[13px] font-medium py-2.5 rounded-lg cursor-pointer hover:bg-[#333] font-sans"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal Buscar Producto */}
      {showProductSearch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowProductSearch(false)} />
          <div className="relative bg-white rounded-[14px] p-5 w-full max-w-[92vw] md:w-[440px] max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="text-[15px] font-medium text-[#1A1A1A] mb-3">Agregar producto</div>
            <input
              type="text"
              autoFocus
              placeholder="Buscar producto..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="w-full bg-[#F5F3EE] border border-[#E0DED8] rounded-lg px-3 py-2 text-[13px] text-[#1A1A1A] outline-none focus:border-[#1A1A1A] mb-3"
            />
            <div className="flex-1 overflow-y-auto">
              {productLoading ? (
                <div className="text-xs text-[#888] py-4 text-center">Buscando...</div>
              ) : productos.length === 0 ? (
                <div className="text-xs text-[#888] py-4 text-center">{productSearch.length > 0 ? 'Sin resultados' : 'Escribe para buscar'}</div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {productos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between border border-[#E0DED8] rounded-lg p-2.5 hover:bg-[#FAFAF8] transition-colors">
                      <div className="flex-1">
                        <div className="text-[13px] font-medium text-depo-dark">{p.nombre}</div>
                        <div className="text-[11px] text-[#888] font-mono">${Number(p.precio_usd).toFixed(2)} · {p.codigo}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={selectedQty[p.id] || 1}
                          onChange={(e) => setSelectedQty((prev: any) => ({ ...prev, [p.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                          className="w-12 bg-[#F5F3EE] border border-[#E0DED8] rounded px-1.5 py-1 text-[12px] text-center text-depo-dark font-mono outline-none focus:border-[#1A1A1A]"
                        />
                        <button
                          onClick={() => {
                            if (selected?.tipo === 'pedido') agregarProductoAPedido(p, selected.id);
                            else agregarProductoAFactura(p);
                          }}
                          disabled={addingItem}
                          className="bg-[#E8E04A] text-[#1A1A1A] text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-[#F0E840] transition-colors disabled:opacity-50"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowProductSearch(false)}
              className="w-full mt-4 bg-[#1A1A1A] text-white border-none text-[13px] font-medium py-2.5 rounded-lg cursor-pointer hover:bg-[#333] font-sans"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

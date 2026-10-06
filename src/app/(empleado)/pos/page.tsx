'use client'

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '@/lib/api-client';
import { sendNotification } from '@/lib/notify';
import { usePedidosRealtime } from '@/lib/use-pedidos-realtime';

function formatUSD(n: any) { return '$' + Number(n || 0).toFixed(2); }
function formatBS(n: any) { const [i, d] = Number(n || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; }

export default function TomarPedidoPage() {
  const [productos, setProductos] = useState<any[]>([]);
  const [departamentos, setDepartamentos] = useState<any[]>([]);
  const [mesas, setMesas] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<any>(null);
  const [cart, setCart] = useState<any[]>(() => {
    try { const saved = sessionStorage.getItem('depos_cart'); return saved ? JSON.parse(saved) : []; }
    catch { return []; }
  });
  const [selectedMesa, setSelectedMesa] = useState<any>(() => {
    try { const saved = sessionStorage.getItem('depos_mesa'); return saved ? Number(saved) : null; }
    catch { return null; }
  });
  const [pedidoNotas, setPedidoNotas] = useState(() => {
    try { return sessionStorage.getItem('depos_notas') || ''; }
    catch { return ''; }
  });
  const [pedidoCliente, setPedidoCliente] = useState(() => {
    try { return sessionStorage.getItem('depos_cliente') || ''; }
    catch { return ''; }
  });
  const [tasa, setTasa] = useState(1);
  const [showCart, setShowCart] = useState(false);
  const [sending, setSending] = useState(false);
  const [pedidoDirecto, setPedidoDirecto] = useState(false);
  const [activePedido, setActivePedido] = useState<any>(null);
  const [activeMesaIds, setActiveMesaIds] = useState<any>(() => new Set());
  const [toast, setToast] = useState<any>(null);
  const activePedidoRef = useRef<any>(null);
  const searchRef = useRef<any>(null);
  const audioCtxRef = useRef<any>(null);
  const lastSoundTime = useRef(0);

  const playReadySound = useCallback(() => {
    const now = Date.now();
    if (now - lastSoundTime.current < 1500) return;
    lastSoundTime.current = now;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const t = ctx.currentTime;
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.5, t + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.01, t + i * 0.15 + 0.4);
        osc.start(t + i * 0.15);
        osc.stop(t + i * 0.15 + 0.4);
      });
    } catch { /* audio not available */ }
  }, []);

  usePedidosRealtime(
    (data) => {
      try {
        const currentPedido = activePedidoRef.current;
        if (data.type === 'pedido_actualizado' && data.estado === 'listo') {
          playReadySound();
          const mesa = data.mesa_nombre || `#${data.pedido_id}`;
          const cliente = data.cliente ? ` (${data.cliente})` : '';
          setToast(`✅ ${mesa}${cliente} — Listo para servir`);
          setTimeout(() => setToast(null), 5000);
          sendNotification('Pedido listo', `${mesa}${cliente} — Listo para servir`, `listo-${data.pedido_id}`);
          loadActiveMesaIds();
          if (currentPedido && currentPedido.id === data.pedido_id) refreshActivePedido();
        }
        if (data.type === 'pedido_actualizado' && data.estado === 'facturado') {
          playReadySound();
          const mesa = data.mesa_nombre || `#${data.pedido_id}`;
          const cliente = data.cliente ? ` (${data.cliente})` : '';
          setToast(`🍽️ ${mesa}${cliente} — Pedido listo, llevar a la mesa`);
          setTimeout(() => setToast(null), 5000);
          sendNotification('Pedido listo', `${mesa}${cliente} — Listo para servir`, `listo-${data.pedido_id}`);
          loadActiveMesaIds();
          if (currentPedido && currentPedido.id === data.pedido_id) {
            setCart([]);
            setShowCart(false);
            try { sessionStorage.removeItem('depos_cart'); } catch { /* */ }
            refreshActivePedido();
          }
        }
        if (data.type === 'pedido_cancelado') {
          if (currentPedido && currentPedido.id === data.pedido_id) {
            setCart([]);
            setShowCart(false);
            try { sessionStorage.removeItem('depos_cart'); } catch { /* */ }
            setToast(`🗑️ Pedido #${data.pedido_id} cancelado por otro usuario`);
            setTimeout(() => setToast(null), 3000);
          }
          loadActiveMesaIds();
          refreshActivePedido();
        }
        if (data.type === 'nuevo_pedido' || data.type === 'pedido_pagado') {
          loadActiveMesaIds();
        }
      } catch { /* ignore */ }
    },
    () => {
      refreshActivePedido();
      loadActiveMesaIds();
    },
  );

  function loadActiveMesaIds() {
    apiFetch('/api/pedidos/activos').then((d) => {
      const ids = new Set((d.pedidos || []).map((p: any) => p.mesa_id));
      setActiveMesaIds(ids);
    }).catch(() => {});
  }

  async function refreshActivePedido(mesaId?: any) {
    const mid = mesaId ?? selectedMesa;
    if (!mid) { setActivePedido(null); return; }
    try {
      const data = await apiFetch('/api/pedidos/activos');
      const p = (data.pedidos || []).find((pd: any) => pd.mesa_id === mid && pd.estado !== 'facturado');
      setActivePedido(p || null);
    } catch { /* */ }
  }

  useEffect(() => {
    apiFetch('/api/productos?limit=1000').then((d) => setProductos(d.products || []));
    apiFetch('/api/departamentos').then((d) => setDepartamentos(d.departamentos || []));
    apiFetch('/api/mesas').then((d) => setMesas(d.mesas || []));
    apiFetch('/api/config').then((d) => setTasa(d.config?.tasa_cambio || 1));
    loadActiveMesaIds();

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        refreshActivePedido();
        loadActiveMesaIds();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { activePedidoRef.current = activePedido; }, [activePedido]);

  useEffect(() => { try { sessionStorage.setItem('depos_mesa', selectedMesa ?? ''); } catch { /* */ } }, [selectedMesa]);
  useEffect(() => { try { sessionStorage.setItem('depos_notas', pedidoNotas); } catch { /* */ } }, [pedidoNotas]);
  useEffect(() => { try { sessionStorage.setItem('depos_cliente', pedidoCliente); } catch { /* */ } }, [pedidoCliente]);

  useEffect(() => {
    if (!selectedMesa) { setActivePedido(null); return; }
    refreshActivePedido(selectedMesa);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMesa]);

  const filtered = productos.filter((p) => {
    if (deptFilter && p.departamento_id !== deptFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
  });

  function addToCart(prod: any) {
    setToast(null);
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === prod.id);
      if (existing) {
        return prev.map((i) =>
          i.producto_id === prod.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { producto_id: prod.id, nombre: prod.nombre, precio_usd: prod.precio_usd, cantidad: 1, subtotal: prod.precio_usd }];
    });
    setToast(`✓ ${prod.nombre}`);
    setTimeout(() => setToast(null), 1200);
  }

  function updateQty(prodId: any, delta: any) {
    setCart((prev) =>
      prev.map((i) => (i.producto_id === prodId ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i))
    );
  }

  function removeFromCart(prodId: any) {
    setCart((prev) => prev.filter((i) => i.producto_id !== prodId));
    if (cart.length <= 1) setShowCart(false);
  }

  const totalUsd = cart.reduce((s, i) => s + i.precio_usd * i.cantidad, 0);
  const totalBs = totalUsd * tasa;
  const cartCount = cart.reduce((s, i) => s + i.cantidad, 0);

  async function enviarPedido() {
    if (!selectedMesa || cart.length === 0) return;
    if (sending) return;  // ← Evita doble clic / envío concurrente
    setSending(true);
    const wasDirecto = pedidoDirecto;
    try {
      const items = cart.map((i) => ({
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_usd: i.precio_usd,
        subtotal: i.precio_usd * i.cantidad,
      }));
      const mesaName = mesas.find((m) => m.id === selectedMesa)?.nombre || '';

      if (activePedido && activePedido.id) {
        const res = await apiFetch(`/api/pedidos/${activePedido.id}/items`, {
          method: 'POST',
          body: { items },
        });
        if (res?.pedido) setActivePedido(res.pedido);
        setCart([]);
        setShowCart(false);
        try { sessionStorage.removeItem('depos_cart'); } catch { /* */ }
        setToast(`✅ Productos agregados a ${mesaName} (Pedido #${activePedido.id})`);
      } else {
        const res = await apiFetch('/api/pedidos', {
          method: 'POST',
          body: { mesa_id: selectedMesa, notas: pedidoNotas, cliente: pedidoCliente, listo: pedidoDirecto, items },
        });
        if (res?.pedido) setActivePedido(res.pedido);
        setCart([]);
        setPedidoNotas('');
        setPedidoCliente('');
        setPedidoDirecto(false);
        try {
          sessionStorage.removeItem('depos_cart');
          sessionStorage.removeItem('depos_notas');
          sessionStorage.removeItem('depos_cliente');
        } catch { /* */ }
        setToast(wasDirecto ? `✅ ${mesaName} — Listo para cobrar` : `✅ Pedido enviado a cocina — ${mesaName}`);
      }
      loadActiveMesaIds();
      setTimeout(() => setToast(null), 3000);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('PEDIDO_FACTURADO') || msg.includes('PEDIDO_CANCELADO')) {
        setCart([]);
        setShowCart(false);
        try { sessionStorage.removeItem('depos_cart'); } catch { /* */ }
        setToast('❌ Pedido cancelado, puedes crear uno nuevo');
        await refreshActivePedido(selectedMesa);
      } else {
        setToast('❌ Error al enviar pedido');
      }
      setTimeout(() => setToast(null), 3000);
    }
    setSending(false);
  }

  return (
    <div className="h-full flex flex-col bg-depo-bg relative">
      {/* Toast flotante */}
      {toast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[200] bg-depo-dark text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-2xl whitespace-nowrap animate-fadeIn border border-depo-dark-7">
          {toast}
        </div>
      )}

      <div className="shrink-0 p-3 pb-2 border-b border-depo-border bg-white">
        <div className="flex items-center gap-2 mb-2">
          <input
            ref={searchRef}
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-depo-bg border border-depo-border rounded-xl px-4 py-3 text-sm outline-none focus:border-depo-yellow focus:bg-white"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <button
            onClick={() => setDeptFilter(null)}
            className={`shrink-0 text-[12px] px-4 py-2 rounded-full font-semibold tracking-wide uppercase transition-all ${
              deptFilter === null ? 'bg-depo-dark text-white' : 'bg-depo-input text-depo-gray-2'
            }`}
          >
            Todos
          </button>
          {departamentos.map((d) => (
            <button
              key={d.id}
              onClick={() => setDeptFilter(d.id)}
              className={`shrink-0 text-[12px] px-4 py-2 rounded-full font-semibold tracking-wide uppercase transition-all ${
                deptFilter === d.id ? 'bg-depo-dark text-white' : 'bg-depo-input text-depo-gray-2'
              }`}
            >
              {d.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 pb-20">
        <div className="grid grid-cols-2 gap-2">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="bg-white rounded-xl border border-depo-border p-3 text-left active:scale-[0.97] active:border-depo-yellow transition-all min-h-[80px] flex flex-col justify-between"
            >
              <div className="text-[13px] font-semibold text-depo-dark leading-tight mb-1 line-clamp-2">{p.nombre}</div>
              <div>
                <div className="text-[14px] font-mono font-bold text-depo-dark">Bs {formatBS(p.precio_usd * tasa)}</div>
                <div className="text-[10px] text-depo-gray font-mono">{formatUSD(p.precio_usd)}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {!showCart && (
        <button
          onClick={() => { if (cart.length > 0) setShowCart(true); }}
          className={`fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 text-sm font-semibold transition-all pb-[max(12px,env(safe-area-inset-bottom))] ${
            cart.length > 0
              ? 'bg-depo-dark text-white'
              : 'bg-depo-input text-depo-gray-6'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span className="bg-depo-yellow text-depo-dark text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{cartCount}</span>
          </span>
          <span className="font-mono">{formatUSD(totalUsd)}</span>
        </button>
      )}

      {showCart && (
        <div className="fixed inset-0 z-50 flex flex-col bg-depo-dark animate-slide-up">
          <div className="shrink-0 p-3 border-b border-depo-dark-2 flex items-center justify-between">
            <button onClick={() => setShowCart(false)} className="text-white text-[20px] leading-none px-1 cursor-pointer">←</button>
            <h2 className="text-white text-[14px] font-bold tracking-wide">Pedido</h2>
            <button onClick={() => { setCart([]); setShowCart(false); }} className="text-depo-gray-2 text-[12px] cursor-pointer">Vaciar</button>
          </div>

          <div className="shrink-0 p-3 border-b border-depo-dark-2">
            <label className="text-[9px] uppercase tracking-wider text-depo-gray-2 block mb-1.5 font-semibold">Mesa</label>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
              {mesas.map((m) => {
                const tienePedido = activeMesaIds.has(m.id);
                return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMesa(m.id)}
                  className={`shrink-0 text-[12px] px-3.5 py-2 rounded-xl font-semibold transition-all ${
                    selectedMesa === m.id
                      ? 'bg-depo-yellow text-depo-dark'
                      : tienePedido
                        ? 'bg-depo-yellow/20 text-depo-yellow border border-depo-yellow/40'
                        : 'bg-depo-dark-4 text-depo-gray-7'
                  }`}
                >
                  {m.nombre}
                </button>
                );
              })}
            </div>
            {activePedido && (
              <div className="mt-2 text-[11px] text-depo-yellow font-semibold flex items-center gap-1">
                <span>📋 Pedido #{activePedido.id} activo</span>
                <span className="text-depo-gray-5 font-normal">—</span>
                <span className="text-depo-gray-5 font-normal capitalize">{activePedido.estado}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 && (
              <div className="text-center text-depo-gray-5 text-[13px] mt-12">Agrega productos del menú</div>
            )}
            {cart.map((item) => (
              <div key={item.producto_id} className="flex items-center gap-2 bg-depo-dark rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <div className="text-white text-[13px] font-semibold truncate">{item.nombre}</div>
                  <div className="text-[12px] font-mono text-depo-yellow">{formatUSD(item.precio_usd)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (item.cantidad <= 1) removeFromCart(item.producto_id); else updateQty(item.producto_id, -1); }}
                    className="w-11 h-11 rounded-xl bg-depo-dark-2 text-white text-[18px] font-bold flex items-center justify-center active:bg-depo-gray-5 cursor-pointer select-none">-</button>
                  <span className="text-white text-[15px] font-mono w-7 text-center font-bold">{item.cantidad}</span>
                  <button onClick={() => updateQty(item.producto_id, 1)}
                    className="w-11 h-11 rounded-xl bg-depo-dark-2 text-white text-[18px] font-bold flex items-center justify-center active:bg-depo-gray-5 cursor-pointer select-none">+</button>
                  <button onClick={() => removeFromCart(item.producto_id)} className="text-depo-gray-5 active:text-red-400 text-[22px] ml-1 w-11 h-11 flex items-center justify-center cursor-pointer select-none">×</button>
                </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 px-3 pb-1.5">
            <input
              type="text"
              placeholder="Cliente / Para (ej: Juan, Mesa 3)..."
              value={pedidoCliente}
              onChange={(e) => setPedidoCliente(e.target.value)}
              className="w-full bg-depo-dark-4 border border-depo-dark-7 rounded-xl px-3.5 py-2.5 text-[13px] text-white outline-none placeholder-depo-gray-5"
            />
          </div>

          <div className="shrink-0 px-3 pb-2">
            <input
              type="text"
              placeholder="Notas para cocina..."
              value={pedidoNotas}
              onChange={(e) => setPedidoNotas(e.target.value)}
              className="w-full bg-depo-dark-4 border border-depo-dark-7 rounded-xl px-3.5 py-2.5 text-[13px] text-white outline-none placeholder-depo-gray-5"
            />
          </div>

            <div className="shrink-0 p-3 border-t border-depo-dark-2 space-y-2 bg-depo-dark-5 pb-[max(12px,env(safe-area-inset-bottom))]">
              <div className="flex justify-between text-white text-[13px]">
                <span className="text-depo-gray">Total Bs</span>
                <span className="font-mono font-bold text-[15px]">Bs {formatBS(totalBs)}</span>
              </div>
              <div className="flex justify-between text-white text-[13px]">
                <span className="text-depo-gray">Total USD</span>
                <span className="font-mono font-bold">{formatUSD(totalUsd)}</span>
              </div>
            {activePedido && (
              <button
                onClick={async () => {
                  if (!confirm(`¿Cancelar Pedido #${activePedido.id} de ${activePedido.mesa_nombre}?`)) return;
                  try {
                    await apiFetch(`/api/pedidos/${activePedido.id}/cancelar`, { method: 'POST' });
                    setActivePedido(null);
                    setCart([]);
                    setShowCart(false);
                    setToast(`🗑️ Pedido #${activePedido.id} cancelado`);
                    setTimeout(() => setToast(null), 3000);
                  } catch {
                    setToast('❌ Error al cancelar');
                    setTimeout(() => setToast(null), 3000);
                  }
                }}
                className="w-full py-2.5 rounded-xl bg-red-700 text-white text-[12px] font-bold uppercase tracking-wide active:bg-red-600 cursor-pointer"
              >
                🗑️ Cancelar Pedido #{activePedido.id}
              </button>
            )}
            <label className="flex items-center gap-2 py-1 cursor-pointer">
              <input type="checkbox" checked={pedidoDirecto} onChange={(e) => setPedidoDirecto(e.target.checked)}
                className="w-4 h-4 accent-depo-yellow" />
              <span className="text-white text-[12px]">Directo (no va a cocina)</span>
            </label>
            <button
              onClick={enviarPedido}
              disabled={!selectedMesa || cart.length === 0 || sending}
              className="w-full py-3.5 rounded-xl bg-depo-yellow text-depo-dark text-[14px] font-bold uppercase tracking-wide active:bg-yellow-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              {sending ? 'Enviando...' : activePedido ? `Agregar al Pedido #${activePedido.id}` : pedidoDirecto ? `Marcar Listo y Facturar` : selectedMesa ? 'Enviar a Cocina' : 'Selecciona una mesa'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

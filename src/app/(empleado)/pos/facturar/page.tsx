'use client'

import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api-client';
import { sendNotification } from '@/lib/notify';
import { usePedidosRealtime } from '@/lib/use-pedidos-realtime';

function formatUSD(n: any) { return '$' + Number(n || 0).toFixed(2); }
function formatBS(n: any) { const [i, d] = Number(n || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; }
function formatFecha(s: any) { const d = new Date(s); return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }); }
const BS_METHODS = new Set(['efectivo_bs', 'pago_movil', 'biopago', 'punto']);

const METODOS_PAGO: any[] = [
  { id: 'efectivo_usd', label: '💵 Efectivo USD' },
  { id: 'efectivo_bs', label: '💵 Efectivo Bs' },
  { id: 'punto', label: '💳 Punto Venta' },
  { id: 'pago_movil', label: '📱 Pago Móvil' },
  { id: 'biopago', label: '🔵 Biopago' },
  { id: 'zelle', label: '🏦 Zelle' },
  { id: 'transferencia', label: '🏦 Transferencia' },
  { id: 'credito', label: '📋 Crédito' },
];

const METODO_MAP: any = {
  efectivo_usd: 'Efectivo USD', efectivo_bs: 'Efectivo Bs', punto: 'Punto de Venta',
  pago_movil: 'Pago Móvil', biopago: 'Biopago', zelle: 'Zelle',
  transferencia: 'Transferencia', credito: 'Credito',
};

export default function FacturarPage() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedPedido, setSelectedPedido] = useState<any>(null);
  const [tasa, setTasa] = useState(1);
  const [toast, setToast] = useState<any>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterPago, setFilterPago] = useState('todas');

  const pollRef = useRef<any>(null);

  async function loadPedidos() {
    setLoading(true);
    try {
      const url = search.trim() ? `/api/pedidos/buscar?q=${encodeURIComponent(search.trim())}` : '/api/pedidos/buscar';
      const data = await apiFetch(url);
      setPedidos(data.pedidos || []);
    }
    catch { /* silent */ }
    setLoading(false);
  }

  usePedidosRealtime(
    (data) => {
      if (data.type === 'pedido_actualizado' && data.estado === 'listo') {
        const mesa = data.mesa_nombre || `#${data.pedido_id}`;
        const cliente = data.cliente ? ` (${data.cliente})` : '';
        setToast(`✅ ${mesa}${cliente} — Listo para cobrar`);
        setTimeout(() => setToast(null), 5000);
        loadPedidos();
        sendNotification('Pedido listo para cobrar', `${mesa}${cliente}`, `listo-${data.pedido_id}`);
      } else if (data.type === 'pedido_pagado' || data.type === 'pedido_actualizado' || data.type === 'pedido_cancelado') {
        loadPedidos();
      }
    },
    () => {
      loadPedidos();
    },
  );

  useEffect(() => {
    loadPedidos();
    apiFetch('/api/config').then((d) => setTasa(d.config?.tasa_cambio || 1));

    pollRef.current = setInterval(loadPedidos, 5000);

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadPedidos();
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(pollRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscarPedidos() {
    setLoading(true);
    try { const data = await apiFetch(`/api/pedidos/buscar?q=${encodeURIComponent(search)}`); setPedidos(data.pedidos || []); }
    catch { /* silent */ }
    setLoading(false);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#F9F9F6' }}>
      {toast && (
        <div style={{ position: 'fixed', top: '12px', left: '12px', right: '12px', zIndex: 200, backgroundColor: '#059669', color: 'white', padding: '12px 20px', borderRadius: '16px', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}>
          {toast}
        </div>
      )}

      <div style={{ flexShrink: 0, padding: '12px', backgroundColor: 'white', borderBottom: '1px solid #E5E7EB' }}>
        <h1 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1E3A2F' }}>🧾 Facturar</h1>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Buscar mesa o # pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscarPedidos()}
            style={{ flex: 1, backgroundColor: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '10px 14px', fontSize: '14px', outline: 'none' }}
          />
          <button onClick={buscarPedidos} disabled={loading} style={{ padding: '10px 16px', backgroundColor: '#1E3A2F', color: 'white', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
            Buscar
          </button>
        </div>
        <div className="flex gap-1.5 mt-2">
          <button onClick={loadPedidos} disabled={loading} style={{ flex: 1, padding: '8px', backgroundColor: '#F3F4F6', color: '#9CA3AF', borderRadius: '12px', fontSize: '11px', fontWeight: '600', border: 'none', cursor: 'pointer' }}>
            ↻ Recargar
          </button>
        </div>
        <div className="flex gap-1 mt-2">
          {[
            { k: 'todas', l: 'Todas' },
            { k: 'no_pagadas', l: 'No pagadas' },
            { k: 'pagadas', l: 'Pagadas' },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setFilterPago(t.k)}
              style={{
                flex: 1,
                padding: '8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: filterPago === t.k ? '#1E3A2F' : '#F3F4F6',
                color: filterPago === t.k ? 'white' : '#9CA3AF',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {t.l}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-1 md:grid-cols-2 gap-2 content-start">
        {loading && pedidos.length === 0 && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6B7280', fontSize: '13px', marginTop: '48px' }}>Cargando...</div>
        )}

        {selectedPedido ? (
          <PedidoDetail
            pedido={selectedPedido}
            tasa={tasa}
            onBack={() => setSelectedPedido(null)}
            onFacturado={() => {
              setSelectedPedido(null);
              loadPedidos();
              setToast('✅ Pedido facturado');
              setTimeout(() => setToast(null), 3000);
            }}
            showCheckout={showCheckout}
            setShowCheckout={setShowCheckout}
          />
        ) : (
          pedidos.filter((p) => {
            if (filterPago === 'pagadas') return p.pagado;
            if (filterPago === 'no_pagadas') return !p.pagado;
            return true;
          }).map((p) => {
            const total = p.items?.reduce((s: any, i: any) => s + Number(i.subtotal), 0) || 0;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPedido(p)}
                style={{ width: '100%', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '16px', textAlign: 'left', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px', fontWeight: '800', color: '#1E3A2F' }}>{p.mesa_nombre}</span>
                      <span style={{ fontSize: '10px', color: '#6B7280', fontFamily: 'monospace' }}>#{p.id}</span>
                    </div>
                    {p.cliente && (
                      <div style={{ fontSize: '12px', color: '#059669', fontWeight: '600', marginTop: '2px' }}>👤 {p.cliente}</div>
                    )}
                  </div>
                  <span style={{
                    flexShrink: 0,
                    fontSize: '11px',
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontWeight: '600',
                    backgroundColor: p.pagado ? 'white' : p.estado === 'listo' ? '#D1FAE5' : '#FEF3C7',
                    color: p.pagado ? '#1E3A2F' : p.estado === 'listo' ? '#059669' : '#D97706',
                    border: p.pagado ? '1px solid #E5E7EB' : p.estado === 'facturado' ? '1px solid rgba(217,119,6,0.3)' : 'none'
                  }}>
                    {p.pagado ? '✅ Pagado' : p.estado === 'listo' ? '✅ Listo' : p.estado === 'facturado' ? '💰 Facturado' : '⏳ En cocina'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {p.items?.slice(0, 4).map((item: any) => (
                    <span key={item.id} style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF', fontSize: '11px', padding: '4px 10px', borderRadius: '8px' }}>
                      {item.cantidad}× {item.producto_nombre}
                    </span>
                  ))}
                  {p.items?.length > 4 && (
                    <span style={{ color: '#6B7280', fontSize: '11px' }}>+{p.items.length - 4} más</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontFamily: 'monospace', fontWeight: 'bold', color: '#1E3A2F' }}>{formatUSD(total)}</span>
                  <span style={{
                    fontSize: '12px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontWeight: '800',
                    letterSpacing: '0.05em',
                    backgroundColor: p.pagado || p.estado === 'facturado' ? 'white' : '#F2B705',
                    color: '#1E3A2F',
                    border: p.pagado || p.estado === 'facturado' ? '1px solid #E5E7EB' : 'none'
                  }}>
                    {p.pagado ? '✅ Pagado' : p.estado === 'facturado' ? 'Ver más →' : 'Cobrar →'}
                  </span>
                </div>
              </button>
            );
          })
        )}

        {!loading && pedidos.length === 0 && !selectedPedido && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6B7280', fontSize: '13px', marginTop: '48px' }}>No hay pedidos listos para facturar</div>
        )}
      </div>
    </div>
  );
}

function PedidoDetail({ pedido, tasa, onBack, onFacturado, showCheckout, setShowCheckout }: any) {
  const items = pedido.items || [];
  const totalUsd = items.reduce((s: any, i: any) => s + Number(i.subtotal), 0);
  const totalBs = totalUsd * tasa;

  return (
    <div className="space-y-3">
      <button onClick={onBack} style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 0', cursor: 'pointer', border: 'none', background: 'none' }}>
        ← Volver
      </button>

      <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '16px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#1E3A2F' }}>{pedido.mesa_nombre}</h2>
            <span style={{ fontSize: '11px', color: '#6B7280' }}>#{pedido.id} · {formatFecha(pedido.created_at)}</span>
            {pedido.cliente && (
              <div style={{ fontSize: '13px', color: '#059669', fontWeight: 'bold', marginTop: '4px' }}>👤 {pedido.cliente}</div>
            )}
          </div>
          <span style={{
            fontSize: '11px',
            padding: '6px 12px',
            borderRadius: '9999px',
            fontWeight: 'bold',
            backgroundColor: pedido.pagado ? 'white' : pedido.estado === 'listo' ? '#D1FAE5' : '#FEF3C7',
            color: pedido.pagado ? '#1E3A2F' : pedido.estado === 'listo' ? '#059669' : '#D97706',
            border: pedido.pagado ? '1px solid #E5E7EB' : pedido.estado === 'facturado' ? '1px solid rgba(217,119,6,0.3)' : 'none'
          }}>
            {pedido.pagado ? '✅ Pagado' : pedido.estado === 'listo' ? '✅ Listo' : pedido.estado === 'facturado' ? '💰 Facturado' : '⏳ En cocina'}
          </span>
        </div>

        {/* Items */}
        <div>
          {items.map((item: any) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', fontSize: '14px', borderBottom: '1px solid #E5E7EB' }}>
              <span style={{ color: '#1E3A2F', fontWeight: 'medium' }}>
                <span style={{ color: '#059669', fontWeight: 'bold', fontFamily: 'monospace', marginRight: '6px' }}>{item.cantidad}×</span>
                {item.producto_nombre}
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{formatUSD(item.subtotal)}</span>
            </div>
          ))}
        </div>

        {pedido.notas && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#B45309', backgroundColor: '#FEF3C7', borderRadius: '12px', padding: '8px 12px', border: '1px solid rgba(217,119,6,0.3)' }}>📝 {pedido.notas}</div>
        )}

        {/* Totales */}
        <div style={{ borderTop: '1px solid #E5E7EB', marginTop: '12px', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '800' }}>
            <span>Total Bs</span>
            <span style={{ fontFamily: 'monospace' }}>Bs {formatBS(totalBs)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#9CA3AF' }}>
            <span>Total USD</span>
            <span style={{ fontFamily: 'monospace' }}>{formatUSD(totalUsd)}</span>
          </div>
        </div>

        {pedido.estado !== 'facturado' && !pedido.pagado && (
          <button
            onClick={() => setShowCheckout(true)}
            style={{ width: '100%', marginTop: '16px', padding: '14px', borderRadius: '16px', backgroundColor: '#059669', color: 'white', fontSize: '15px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer' }}
          >
            💰 Cobrar {formatUSD(totalUsd)}
          </button>
        )}
      </div>

      {showCheckout && (
        <CheckoutModal
          pedido={pedido}
          items={items}
          totalUsd={totalUsd}
          totalBs={totalBs}
          tasa={tasa}
          onClose={() => setShowCheckout(false)}
          onSuccess={onFacturado}
        />
      )}
    </div>
  );
}

function CheckoutModal({ pedido, items, totalUsd, totalBs, tasa, onClose, onSuccess }: any) {
  const [metodo, setMetodo] = useState('efectivo_usd');
  const [referencia, setReferencia] = useState('');
  const [sending, setSending] = useState(false);
  const [isMultipago, setIsMultipago] = useState(false);
  const [pagos, setPagos] = useState<any[]>([{ metodo_pago: 'efectivo_usd', monto_usd: totalUsd, referencia: '' }]);
  const [creditoCedula, setCreditoCedula] = useState('');
  const [creditoNombre, setCreditoNombre] = useState('');
  const [creditoTipo, setCreditoTipo] = useState('existente');

  const isCredito = !isMultipago && metodo === 'credito';

  function montoUsdDelPago(p: any) {
    return BS_METHODS.has(p.metodo_pago) ? Number(p.monto_usd || 0) / tasa : Number(p.monto_usd || 0);
  }

  function addPago() { setPagos([...pagos, { metodo_pago: 'efectivo_usd', monto_usd: 0, referencia: '' }]); }
  function updatePago(idx: any, field: any, value: any) { setPagos(pagos.map((p, i) => i === idx ? { ...p, [field]: value } : p)); }
  function updatePagoFields(idx: any, fields: any) { setPagos(pagos.map((p, i) => i === idx ? { ...p, ...fields } : p)); }
  function removePago(idx: any) { setPagos(pagos.filter((_: any, i: number) => i !== idx)); }

  const sumaPagosUsd = pagos.reduce((s, p) => s + montoUsdDelPago(p), 0);
  const sumaPagosBs = pagos.reduce((s, p) => s + (BS_METHODS.has(p.metodo_pago) ? Number(p.monto_usd || 0) : Number(p.monto_usd || 0) * tasa), 0);
  const diff = totalUsd - sumaPagosUsd;
  const difAbs = Math.abs(diff);
  const sobre = diff < 0;
  const diffBs = totalBs - sumaPagosBs;

  async function cobrar() {
    setSending(true);
    try {
      if (isCredito && creditoTipo === 'existente' && !creditoCedula) { alert('Ingresa la cédula del cliente'); setSending(false); return; }
      if (isCredito && creditoTipo === 'nuevo' && (!creditoNombre || !creditoCedula)) { alert('Ingresa nombre y cédula'); setSending(false); return; }
      if (isMultipago && pagos.some((p) => p.metodo_pago === 'credito')) {
        if (creditoTipo === 'existente' && !creditoCedula) { alert('Ingresa la cédula del cliente para el pago a crédito'); setSending(false); return; }
        if (creditoTipo === 'nuevo' && (!creditoNombre || !creditoCedula)) { alert('Ingresa nombre y cédula para el pago a crédito'); setSending(false); return; }
      }

      const body: any = {
        pedido_id: pedido.id,
        total_usd: Number(totalUsd.toFixed(2)),
        total_bs: Number(totalBs.toFixed(2)),
        metodo_pago: isMultipago ? 'Multipago' : METODO_MAP[metodo],
        referencia: metodo === 'pago_movil' ? referencia : '',
        items: items.map((i: any) => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_usd: i.precio_usd, subtotal: i.subtotal })),
      };

      if (isMultipago) {
        body.pagos = pagos.map((p) => {
          const esBs = BS_METHODS.has(p.metodo_pago);
          const montoUsd = esBs ? Number(p.monto_usd || 0) / tasa : Number(p.monto_usd || 0);
          const montoBs = esBs ? Number(p.monto_usd || 0) : Number(p.monto_usd || 0) * tasa;
          return { metodo_pago: METODO_MAP[p.metodo_pago], monto_usd: Number(montoUsd.toFixed(2)), monto_bs: Number(montoBs.toFixed(2)), referencia: p.referencia || '' };
        });
      }

      if (isCredito || (isMultipago && pagos.some((p) => p.metodo_pago === 'credito'))) {
        body.credito = { tipo: creditoTipo, nombre: creditoNombre || undefined, cedula: creditoCedula };
      }

      await apiFetch('/api/ventas', { method: 'POST', body });
      onSuccess();
      onClose();
    } catch (e: any) {
      alert('Error: ' + (e.data?.error || e.message));
    }
    setSending(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)' }} />
      <div style={{ position: 'relative', backgroundColor: 'white', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: '448px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ flexShrink: 0, padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1E3A2F' }}>Cobrar</h3>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1E3A2F' }}>{pedido.mesa_nombre}</span>
          <button onClick={onClose} style={{ color: '#6B7280', fontSize: '22px', lineHeight: 'none', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'none' }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ backgroundColor: '#F3F4F6', borderRadius: '16px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: 'bold' }}>Total</span>
              <span style={{ fontSize: '18px', fontFamily: 'monospace', fontWeight: '800' }}>Bs {formatBS(totalBs)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', fontSize: '13px' }}>
              <span style={{ color: '#6B7280' }}>Total USD</span>
              <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{formatUSD(totalUsd)}</span>
            </div>
          </div>

          {/* Multipago toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={isMultipago} onChange={(e) => setIsMultipago(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: '#1E3A2F' }} />
            <span style={{ fontSize: '13px', color: '#9CA3AF', fontWeight: '500' }}>Dividir pago (Multipago)</span>
          </label>

          {isMultipago ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pagos.map((p, idx) => {
                const esBs = BS_METHODS.has(p.metodo_pago);
                return (
                <div key={idx} style={{ backgroundColor: '#F3F4F6', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <select value={p.metodo_pago} onChange={(e) => updatePagoFields(idx, { metodo_pago: e.target.value, monto_usd: 0 })}
                    style={{ width: '100%', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', outline: 'none' }}>
                    {METODOS_PAGO.filter((m) => m.id !== 'credito').map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <input type="number" step="0.01" placeholder={esBs ? 'Monto Bs' : 'Monto USD'} value={p.monto_usd}
                    onChange={(e) => updatePago(idx, 'monto_usd', e.target.value)}
                    style={{ width: '100%', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }} />
                  {Number(p.monto_usd) > 0 && (
                    <div style={{ fontSize: '11px', color: '#6B7280', fontFamily: 'monospace', textAlign: 'right', paddingLeft: '4px' }}>
                      {esBs ? `≈ ${formatUSD(Number(p.monto_usd) / tasa)} USD` : `≈ ${formatBS(Number(p.monto_usd) * tasa)} Bs`}
                    </div>
                  )}
                  {p.metodo_pago === 'pago_movil' && (
                    <input type="text" placeholder="Referencia (6 dígitos)" maxLength={6} value={p.referencia}
                      onChange={(e) => updatePago(idx, 'referencia', e.target.value)}
                      style={{ width: '100%', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                  )}
                </div>
                {pagos.length > 1 && (
                  <button onClick={() => removePago(idx)} style={{ color: '#DC2626', fontSize: '20px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'none' }}>×</button>
                )}
              </div>
                </div>
                );
              })}
              <button onClick={addPago} style={{ width: '100%', padding: '10px', borderRadius: '16px', backgroundColor: '#1E3A2F', color: 'white', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>+ Agregar pago</button>
              <div style={{ fontSize: '13px', fontFamily: 'monospace', backgroundColor: '#F3F4F6', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: Math.abs(diffBs) < 0.01 ? '#16A34A' : diffBs < 0 ? '#DC2626' : '#D97706', fontWeight: Math.abs(diffBs) < 0.01 ? 'bold' : 'normal' }}>
                    {Math.abs(diffBs) < 0.01 ? '✓ Exacto' : diffBs < 0 ? `Sobra ${formatBS(Math.abs(diffBs))}` : `Falta ${formatBS(diffBs)}`}
                  </span>
                  <span style={{ fontWeight: 'bold' }}>Bs {formatBS(sumaPagosBs)} / Bs {formatBS(totalBs)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6B7280' }}>
                  <span>Total USD</span>
                  <span style={{ fontWeight: 'bold' }}>{formatUSD(sumaPagosUsd)}</span>
                </div>
                {Math.abs(diff) > 0.01 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: difAbs < 0.01 ? '#16A34A' : sobre ? '#DC2626' : '#6B7280', fontWeight: difAbs < 0.01 ? 'bold' : 'normal' }}>
                      {difAbs < 0.01 ? '✓ Exacto' : sobre ? `Sobra ${formatUSD(difAbs)}` : `Falta ${formatUSD(difAbs)}`}
                    </span>
                    <span style={{ fontWeight: 'bold' }}>{formatUSD(sumaPagosUsd)} / {formatUSD(totalUsd)}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                {METODOS_PAGO.map((m) => (
                  <button key={m.id} onClick={() => setMetodo(m.id)}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      backgroundColor: metodo === m.id ? '#1E3A2F' : '#F3F4F6',
                      color: metodo === m.id ? 'white' : '#9CA3AF',
                      border: 'none',
                      cursor: 'pointer'
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
              {metodo === 'pago_movil' && (
                <input type="text" placeholder="Referencia (6 dígitos)" maxLength={6} value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  style={{ width: '100%', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', outline: 'none' }} />
              )}
              {metodo === 'credito' && (
                <div style={{ backgroundColor: '#F3F4F6', borderRadius: '16px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setCreditoTipo('existente')}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: creditoTipo === 'existente' ? '#1E3A2F' : 'white', color: creditoTipo === 'existente' ? 'white' : '#9CA3AF', border: 'none', cursor: 'pointer' }}>Existente</button>
                    <button onClick={() => setCreditoTipo('nuevo')}
                      style={{ flex: 1, padding: '10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: creditoTipo === 'nuevo' ? '#1E3A2F' : 'white', color: creditoTipo === 'nuevo' ? 'white' : '#9CA3AF', border: 'none', cursor: 'pointer' }}>Nuevo</button>
                  </div>
                  {creditoTipo === 'nuevo' && (
                    <input type="text" placeholder="Nombre del cliente" value={creditoNombre}
                      onChange={(e) => setCreditoNombre(e.target.value)}
                      style={{ width: '100%', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', outline: 'none' }} />
                  )}
                  <input type="text" placeholder="Cédula" value={creditoCedula}
                    onChange={(e) => setCreditoCedula(e.target.value)}
                    style={{ width: '100%', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '10px 12px', fontSize: '13px', fontFamily: 'monospace', outline: 'none' }} />
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ flexShrink: 0, padding: '16px', borderTop: '1px solid #E5E7EB', backgroundColor: 'white', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <button onClick={cobrar} disabled={sending || (isMultipago && difAbs > 0.01)}
            style={{ width: '100%', padding: '16px', borderRadius: '16px', backgroundColor: '#059669', color: 'white', fontSize: '16px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', opacity: sending || (isMultipago && difAbs > 0.01) ? 0.3 : 1 }}>
            {sending ? 'Procesando...' : `Cobrar Bs ${formatBS(totalBs)} (${formatUSD(totalUsd)})`}
          </button>
        </div>
      </div>
    </div>
  );
}

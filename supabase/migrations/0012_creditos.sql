-- ============================================================
-- 0012 — CRÉDITOS (FIADO)
-- Port transaccional de los endpoints de créditos.
-- El original (better-sqlite3) usaba db.transaction(...); en
-- Postgres con PostgREST eso se replica con funciones RPC.
-- ============================================================

-- ------------------------------------------------------------
-- POST /api/creditos/:id/pagar
-- Descuenta la deuda, registra el pago, crea la venta de cobro
-- (+ venta_pagos) e inserta detalle_venta proporcional para que
-- los reportes de ganancia incluyan el cobro.
-- ------------------------------------------------------------
create or replace function public.pagar_credito(
  p_cliente_id bigint,
  p_monto double precision,
  p_metodo_pago text,
  p_venta_referencia text,
  p_pago_referencia text,
  p_total_bs double precision,
  p_usuario_id bigint
) returns bigint
language plpgsql
set search_path = public
as $$
declare
  v_deuda double precision;
  v_total_original double precision := 0;
  v_proporcion double precision := 0;
  v_venta_id bigint;
  item record;
begin
  -- El cliente se bloquea para evitar pagos concurrentes (anti OVERPAY)
  select deuda_total into v_deuda
    from clientes_credito
   where id = p_cliente_id
     for update;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if p_monto > v_deuda + 0.001 then
    raise exception 'OVERPAY';
  end if;

  -- Proporción de ganancia: se calcula ANTES de insertar la nueva venta,
  -- igual que el original (creditVentas se leía antes del tx).
  select coalesce(sum(v.total_usd), 0)
    into v_total_original
    from credito_ventas cv
    join ventas v on v.id = cv.venta_id
   where cv.cliente_id = p_cliente_id
     and v.metodo_pago = 'Credito';

  if v_total_original > 0 then
    v_proporcion := p_monto / v_total_original;
  end if;

  update clientes_credito
     set deuda_total = round((deuda_total - p_monto)::numeric, 2)::double precision
   where id = p_cliente_id;

  insert into credito_pagos (cliente_id, monto_usd, fecha)
  values (p_cliente_id, p_monto, now());

  insert into ventas (fecha, total_usd, total_bs, metodo_pago, referencia, pagada, usuario_id)
  values (now(), p_monto, p_total_bs, p_metodo_pago, p_venta_referencia, true, p_usuario_id)
  returning id into v_venta_id;

  -- Pago en venta_pagos para los reportes por método de pago
  insert into venta_pagos (venta_id, metodo_pago, monto_usd, monto_bs, referencia)
  values (v_venta_id, p_metodo_pago, p_monto, p_total_bs, p_pago_referencia);

  -- Detalle proporcional para ganancia en reportes
  if v_proporcion > 0 then
    for item in
      select dv.producto_id, dv.cantidad, dv.precio_usd, dv.precio_costo, dv.subtotal
        from credito_ventas cv
        join ventas v on v.id = cv.venta_id
        join detalle_venta dv on dv.venta_id = cv.venta_id
       where cv.cliente_id = p_cliente_id
         and v.metodo_pago = 'Credito'
    loop
      insert into detalle_venta (venta_id, producto_id, cantidad, precio_usd, precio_costo, subtotal)
      values (v_venta_id, item.producto_id,
              item.cantidad * v_proporcion,
              item.precio_usd,
              item.precio_costo,
              item.subtotal * v_proporcion);
    end loop;
  end if;

  return v_venta_id;
end;
$$;

-- ------------------------------------------------------------
-- DELETE /api/creditos/:id
-- Borra pagos → ventas de crédito → cliente (en transacción).
-- ------------------------------------------------------------
create or replace function public.eliminar_cliente_credito(p_cliente_id bigint)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not exists (select 1 from clientes_credito where id = p_cliente_id) then
    raise exception 'NOT_FOUND';
  end if;

  delete from credito_pagos where cliente_id = p_cliente_id;
  delete from credito_ventas where cliente_id = p_cliente_id;
  delete from clientes_credito where id = p_cliente_id;
end;
$$;

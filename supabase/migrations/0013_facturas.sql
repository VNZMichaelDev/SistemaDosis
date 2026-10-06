-- ============================================================
-- 0013 — FACTURAS (edición de ventas)
-- Port transaccional de los endpoints de edición de facturas.
-- El original (better-sqlite3) usaba db.transaction(...); en
-- Postgres con PostgREST eso se replica con funciones RPC.
-- ============================================================

-- El original (SQLite con tipado dinámico) aceptaba cantidades
-- fraccionadas en pedido_items (productos vendidos por peso).
-- Postgres rechazaría el cast double precision → integer.
alter table pedido_items
  alter column cantidad type double precision using cantidad::double precision;

-- ------------------------------------------------------------
-- POST /api/facturas/:id/items
-- Agrega un ítem, recalcula totales, ajusta la deuda del cliente
-- si la venta es a crédito y replica el ítem en el pedido.
-- ------------------------------------------------------------
create or replace function public.factura_agregar_item(
  p_venta_id bigint,
  p_producto_id bigint,
  p_cantidad double precision,
  p_precio_usd double precision,
  p_subtotal double precision,
  p_precio_costo double precision,
  p_tasa double precision
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_venta ventas%rowtype;
  v_total double precision;
  v_total_bs double precision;
  v_cliente_id bigint;
  v_diff double precision;
begin
  select * into v_venta from ventas where id = p_venta_id;
  if not found then
    raise exception 'VENTA_NOT_FOUND';
  end if;
  if not exists (select 1 from productos where id = p_producto_id) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  insert into detalle_venta (venta_id, producto_id, cantidad, precio_usd, precio_costo, subtotal)
  values (p_venta_id, p_producto_id, p_cantidad, p_precio_usd, p_precio_costo, p_subtotal);

  select coalesce(sum(subtotal), 0) into v_total
    from detalle_venta
   where venta_id = p_venta_id;

  v_total := round(v_total::numeric, 2)::double precision;
  v_total_bs := round((v_total * p_tasa)::numeric, 2)::double precision;

  update ventas set total_usd = v_total, total_bs = v_total_bs where id = p_venta_id;

  if v_venta.metodo_pago = 'Credito' then
    select cliente_id into v_cliente_id from credito_ventas where venta_id = p_venta_id;
    if found then
      v_diff := round((v_total - v_venta.total_usd)::numeric, 2)::double precision;
      if v_diff > 0 then
        update clientes_credito
           set deuda_total = round((deuda_total + v_diff)::numeric, 2)::double precision
         where id = v_cliente_id;
      end if;
    end if;
  end if;

  if v_venta.pedido_id is not null then
    insert into pedido_items (pedido_id, producto_id, cantidad, precio_usd, subtotal, notas, created_at)
    values (v_venta.pedido_id, p_producto_id, p_cantidad, p_precio_usd, p_subtotal, '', now());
  end if;
end;
$$;

-- ------------------------------------------------------------
-- DELETE /api/facturas/:id/items/:itemId
-- Quita un ítem, recalcula totales; si la venta queda vacía la
-- elimina (con sus pagos y su vínculo de crédito), si no ajusta
-- la deuda del cliente cuando es a crédito.
-- ------------------------------------------------------------
create or replace function public.factura_quitar_item(
  p_venta_id bigint,
  p_item_id bigint,
  p_tasa double precision
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_venta ventas%rowtype;
  v_total double precision;
  v_total_bs double precision;
  v_cliente_id bigint;
  v_diff double precision;
begin
  select * into v_venta from ventas where id = p_venta_id;
  if not found then
    raise exception 'VENTA_NOT_FOUND';
  end if;
  if not exists (select 1 from detalle_venta where id = p_item_id and venta_id = p_venta_id) then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  delete from detalle_venta where id = p_item_id;

  select coalesce(sum(subtotal), 0) into v_total
    from detalle_venta
   where venta_id = p_venta_id;

  v_total := round(v_total::numeric, 2)::double precision;
  v_total_bs := round((v_total * p_tasa)::numeric, 2)::double precision;

  if v_total <= 0 then
    delete from detalle_venta where venta_id = p_venta_id;
    delete from venta_pagos where venta_id = p_venta_id;
    delete from credito_ventas where venta_id = p_venta_id;
    delete from ventas where id = p_venta_id;
  else
    update ventas set total_usd = v_total, total_bs = v_total_bs where id = p_venta_id;

    if v_venta.metodo_pago = 'Credito' then
      select cliente_id into v_cliente_id from credito_ventas where venta_id = p_venta_id;
      if found then
        v_diff := round((v_venta.total_usd - v_total)::numeric, 2)::double precision;
        if v_diff > 0 then
          update clientes_credito
             set deuda_total = round((deuda_total - v_diff)::numeric, 2)::double precision
           where id = v_cliente_id;
        end if;
      end if;
    end if;
  end if;
end;
$$;

-- ============================================================
-- 0020 — SIN STOCK NO SE VENTA
-- crear_venta ahora valida el stock de las recetas ANTES de
-- registrar la venta. Si falta material, la venta completa se
-- rechaza (rollback total) y el error lista los ingredientes:
--   SIN_STOCK: Carne de res: falta 1.5 kg; Aceite: falta 0.5 l
-- Se elimina el recorte silencioso greatest(0, ...) que dejaba
-- el inventario en cero sin avisar.
-- ============================================================
create or replace function crear_venta(
  p_total_usd double precision,
  p_total_bs double precision,
  p_metodo_pago text,
  p_referencia text,
  p_pagada boolean,
  p_usuario_id bigint,
  p_pedido_id bigint,
  p_cliente_id bigint,
  p_items jsonb,
  p_pagos jsonb
) returns bigint
language plpgsql
as $$
declare
  v_venta_id bigint;
  it jsonb;
  v_pid bigint;
  v_costo double precision;
  v_es_receta boolean;
  r record;
  v_resta double precision;
  v_tasa double precision;
  p jsonb;
  v_monto_bs double precision;
  v_estado text;
  v_faltantes text;
begin
  -- 1) Validar stock de recetas ANTES de registrar nada
  select coalesce(string_agg(format('%s: falta %s %s', f.nombre, round(f.falta::numeric, 3), f.unidad), '; '), '')
    into v_faltantes
    from (
      select i.id, i.nombre, i.unidad,
             sum(ri.cantidad * (it2->>'cantidad')::double precision) - i.stock_actual as falta
        from jsonb_array_elements(p_items) as it2
        join productos p2 on p2.id = (it2->>'producto_id')::bigint
                          and coalesce(p2.es_receta, false)
        join receta_ingredientes ri on ri.producto_id = p2.id
        join ingredientes i on i.id = ri.ingrediente_id
       group by i.id, i.nombre, i.unidad, i.stock_actual
      having sum(ri.cantidad * (it2->>'cantidad')::double precision) - i.stock_actual > 0.0005
    ) f;
  if coalesce(v_faltantes, '') <> '' then
    raise exception 'SIN_STOCK: %', v_faltantes;
  end if;

  insert into ventas (total_usd, total_bs, metodo_pago, referencia, pagada, usuario_id, pedido_id)
  values (p_total_usd, p_total_bs, p_metodo_pago, coalesce(p_referencia, ''), p_pagada, p_usuario_id, p_pedido_id)
  returning id into v_venta_id;

  -- Detalle + descuento de ingredientes de recetas
  for it in select * from jsonb_array_elements(p_items) loop
    v_pid := (it->>'producto_id')::bigint;

    select coalesce(precio_costo, 0), coalesce(es_receta, false)
      into v_costo, v_es_receta
      from productos where id = v_pid;

    insert into detalle_venta (venta_id, producto_id, cantidad, precio_usd, precio_costo, subtotal)
    values (
      v_venta_id,
      v_pid,
      (it->>'cantidad')::double precision,
      (it->>'precio_usd')::double precision,
      coalesce(v_costo, 0),
      (it->>'subtotal')::double precision
    );

    if coalesce(v_es_receta, false) then
      for r in
        select ri.ingrediente_id, ri.cantidad, i.stock_actual, i.nombre, i.unidad
        from receta_ingredientes ri
        join ingredientes i on i.id = ri.ingrediente_id
        where ri.producto_id = v_pid
        for update of i
      loop
        v_resta := round((r.cantidad * (it->>'cantidad')::double precision)::numeric, 3)::double precision;
        -- Re-chequeo con fila bloqueada: si otra venta tomó el stock
        -- entre la validación inicial y aquí, se rechaza igualmente.
        if round((r.stock_actual - v_resta)::numeric, 3) < 0 then
          raise exception 'SIN_STOCK: %: falta % %', r.nombre, v_resta, r.unidad;
        end if;
        update ingredientes
        set stock_actual = greatest(0, round((r.stock_actual - v_resta)::numeric, 3)::double precision)
        where id = r.ingrediente_id;
      end loop;
    end if;
  end loop;

  -- Crédito: registrar venta a crédito y aumentar deuda
  if p_cliente_id is not null then
    insert into credito_ventas (cliente_id, venta_id) values (p_cliente_id, v_venta_id);
    update clientes_credito
    set deuda_total = round((deuda_total + round(p_total_usd::numeric, 2))::numeric, 2)::double precision
    where id = p_cliente_id;
  end if;

  -- Pagos (multipago) o pago móvil con referencia
  v_tasa := case when p_total_usd > 0 then p_total_bs / p_total_usd else 0 end;

  if p_pagos is not null and jsonb_array_length(p_pagos) > 0 then
    for p in select * from jsonb_array_elements(p_pagos) loop
      v_monto_bs := round(((p->>'monto_usd')::double precision * v_tasa)::numeric, 2)::double precision;
      insert into venta_pagos (venta_id, metodo_pago, monto_usd, monto_bs, referencia)
      values (v_venta_id, p->>'metodo_pago', (p->>'monto_usd')::double precision, v_monto_bs, coalesce(p->>'referencia', ''));
    end loop;
  elsif p_metodo_pago = 'Pago Móvil' and coalesce(p_referencia, '') <> '' then
    v_monto_bs := round((p_total_usd * v_tasa)::numeric, 2)::double precision;
    insert into venta_pagos (venta_id, metodo_pago, monto_usd, monto_bs, referencia)
    values (v_venta_id, 'Pago Móvil', p_total_usd, v_monto_bs, p_referencia);
  end if;

  -- Marcar pedido como pagado (y facturado si estaba listo)
  if p_pedido_id is not null then
    select estado into v_estado from pedidos where id = p_pedido_id;
    if v_estado = 'listo' then
      update pedidos set estado = 'facturado', pagado = true, updated_at = now() where id = p_pedido_id;
    else
      update pedidos set pagado = true, updated_at = now() where id = p_pedido_id;
    end if;
  end if;

  return v_venta_id;
end;
$$;

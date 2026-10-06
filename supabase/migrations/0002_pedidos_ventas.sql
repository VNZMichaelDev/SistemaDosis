-- DePOS Dosis — funciones transaccionales de pedidos y ventas
-- (equivalen a las db.transaction() del Express original)

-- Cantidades fraccionadas (productos por peso): SQLite las aceptaba por type affinity
alter table pedido_items alter column cantidad type double precision using cantidad::double precision;

-- ============================================================
-- Crear pedido + items en una sola transacción
-- ============================================================
create or replace function crear_pedido(
  p_mesa_id bigint,
  p_notas text,
  p_cliente text,
  p_usuario_id bigint,
  p_vendedor_id bigint,
  p_estado text,
  p_items jsonb
) returns bigint
language plpgsql
as $$
declare
  v_id bigint;
  it jsonb;
begin
  insert into pedidos (mesa_id, notas, cliente, usuario_id, vendedor_id, estado)
  values (p_mesa_id, coalesce(p_notas, ''), coalesce(p_cliente, ''), p_usuario_id, p_vendedor_id, p_estado)
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    insert into pedido_items (pedido_id, producto_id, cantidad, precio_usd, subtotal, notas)
    values (
      v_id,
      (it->>'producto_id')::bigint,
      (it->>'cantidad')::double precision,
      (it->>'precio_usd')::double precision,
      (it->>'subtotal')::double precision,
      coalesce(it->>'notas', '')
    );
  end loop;

  return v_id;
end;
$$;

-- ============================================================
-- Agregar items a un pedido existente
-- ============================================================
create or replace function agregar_items_pedido(
  p_pedido_id bigint,
  p_items jsonb
) returns void
language plpgsql
as $$
declare
  it jsonb;
begin
  for it in select * from jsonb_array_elements(p_items) loop
    insert into pedido_items (pedido_id, producto_id, cantidad, precio_usd, subtotal, notas)
    values (
      p_pedido_id,
      (it->>'producto_id')::bigint,
      (it->>'cantidad')::double precision,
      (it->>'precio_usd')::double precision,
      (it->>'subtotal')::double precision,
      coalesce(it->>'notas', '')
    );
  end loop;

  update pedidos set updated_at = now() where id = p_pedido_id;
end;
$$;

-- ============================================================
-- Quitar un item de un pedido (delete + updated_at atómicos)
-- ============================================================
create or replace function pedido_quitar_item(
  p_pedido_id bigint,
  p_item_id bigint
) returns boolean
language plpgsql
as $$
declare
  v_count bigint;
begin
  delete from pedido_items where id = p_item_id and pedido_id = p_pedido_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return false;
  end if;
  update pedidos set updated_at = now() where id = p_pedido_id;
  return true;
end;
$$;

-- ============================================================
-- Crear venta completa (transacción del POST /api/ventas):
-- venta + detalle + descuento de ingredientes (recetas) +
-- crédito + multipago + marca pedido pagado
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
begin
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
        select ri.ingrediente_id, ri.cantidad, i.stock_actual
        from receta_ingredientes ri
        join ingredientes i on i.id = ri.ingrediente_id
        where ri.producto_id = v_pid
      loop
        v_resta := round((r.cantidad * (it->>'cantidad')::double precision)::numeric, 3)::double precision;
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
      values (
        v_venta_id,
        p->>'metodo_pago',
        (p->>'monto_usd')::double precision,
        v_monto_bs,
        coalesce(p->>'referencia', '')
      );
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

-- ============================================================
-- Buscar pedidos (GET /api/pedidos/buscar?q=) con la misma
-- lógica SQL del original: CAST(id AS TEXT) LIKE o mesa LIKE
-- ============================================================
create or replace function pedidos_buscar_json(p_q text)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'mesa_id', p.mesa_id,
        'estado', p.estado,
        'notas', p.notas,
        'usuario_id', p.usuario_id,
        'created_at', p.created_at,
        'updated_at', p.updated_at,
        'cliente', p.cliente,
        'cancelado', p.cancelado,
        'pagado', p.pagado,
        'vendedor_id', p.vendedor_id,
        'mesa_nombre', m.nombre,
        'usuario_nombre', u.usuario,
        'vendedor_nombre', v.nombre,
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', pi.id,
              'pedido_id', pi.pedido_id,
              'producto_id', pi.producto_id,
              'cantidad', pi.cantidad,
              'precio_usd', pi.precio_usd,
              'subtotal', pi.subtotal,
              'notas', pi.notas,
              'created_at', pi.created_at,
              'producto_nombre', pr.nombre
            ) order by pi.id
          )
          from pedido_items pi
          join productos pr on pr.id = pi.producto_id
          where pi.pedido_id = p.id
        ), '[]'::jsonb)
      )
      order by p.updated_at desc
    ),
    '[]'::jsonb
  )
  from pedidos p
  join mesas m on m.id = p.mesa_id
  join usuarios u on u.id = p.usuario_id
  left join vendedores v on v.id = p.vendedor_id
  where p.cancelado = false
    and (cast(p.id as text) like '%' || p_q || '%' or m.nombre like '%' || p_q || '%')
  limit 20;
$$;

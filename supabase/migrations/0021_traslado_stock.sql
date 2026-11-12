-- ============================================================
-- 0021 — TRASLADOS DESCUENTAN INVENTARIO (igual que ventas)
-- Al emitir una factura de traslado se descuenta el stock de los
-- ingredientes de las recetas de los productos enviados. Si falta
-- material, la venta completa se rechaza (rollback total):
--   SIN_STOCK: Carne de res: falta 1.5 kg
-- Al borrar la factura (admin) se devuelve el stock descontado.
-- ============================================================

alter table facturas_traslado_items add column if not exists ingrediente_id bigint references ingredientes(id) on delete set null;

create or replace function public.crear_factura_traslado(
  p_numero text,
  p_destinatario text,
  p_direccion text,
  p_rif text,
  p_fecha date,
  p_notas text,
  p_items jsonb,
  p_usuario_id bigint
) returns bigint
language plpgsql
as $$
declare
  v_id bigint;
  it jsonb;
  v_pid bigint;
  v_ing bigint;
  v_es_receta boolean;
  r record;
  v_resta double precision;
  v_stock double precision;
  v_nombre text;
  v_unidad text;
  v_faltantes text;
begin
  -- 1) Validar stock ANTES de registrar nada:
  --    items con ingrediente_id (salida directa) + items con receta
  select coalesce(string_agg(format('%s: falta %s %s', f.nombre, round(f.falta::numeric, 3), f.unidad), '; '), '')
    into v_faltantes
    from (
      select k.id, k.nombre, k.unidad, sum(k.cant) - k.stock_actual as falta
        from (
          select i.id, i.nombre, i.unidad, i.stock_actual,
                 sum((it->>'cantidad')::double precision) as cant
            from jsonb_array_elements(p_items) as it
            join ingredientes i on i.id = (it->>'ingrediente_id')::bigint
           group by i.id, i.nombre, i.unidad, i.stock_actual
          union all
          select i.id, i.nombre, i.unidad, i.stock_actual,
                 sum(ri.cantidad * (it->>'cantidad')::double precision) as cant
            from jsonb_array_elements(p_items) as it2
            join productos p2 on p2.id = (it2->>'producto_id')::bigint
                          and coalesce(p2.es_receta, false)
            join receta_ingredientes ri on ri.producto_id = p2.id
            join ingredientes i on i.id = ri.ingrediente_id
           group by i.id, i.nombre, i.unidad, i.stock_actual
        ) k
       group by k.id, k.nombre, k.unidad, k.stock_actual
      having sum(k.cant) - k.stock_actual > 0.0005
    ) f;
  if coalesce(v_faltantes, '') <> '' then
    raise exception 'SIN_STOCK: %', v_faltantes;
  end if;

  -- 2) Factura + items
  insert into facturas_traslado (numero, destinatario, direccion, rif, fecha, subtotal, total, notas, usuario_id)
  values (p_numero, p_destinatario, p_direccion, p_rif, p_fecha,
          round((select coalesce(sum((i->>'importe')::double precision), 0) from jsonb_array_elements(p_items) i)::numeric, 2)::double precision,
          round((select coalesce(sum((i->>'importe')::double precision), 0) from jsonb_array_elements(p_items) i)::numeric, 2)::double precision,
          p_notas, p_usuario_id)
  returning id into v_id;

  insert into facturas_traslado_items (factura_id, producto_id, ingrediente_id, descripcion, cantidad, precio_unitario, importe)
  select v_id,
         (i->>'producto_id')::bigint,
         (i->>'ingrediente_id')::bigint,
         i->>'descripcion',
         (i->>'cantidad')::double precision,
         (i->>'precio_unitario')::double precision,
         (i->>'importe')::double precision
    from jsonb_array_elements(p_items) i;

  -- 3) Descontar stock (ingrediente directo y/o receta del producto)
  for it in select * from jsonb_array_elements(p_items) loop
    -- a) Salida directa de ingrediente
    v_ing := (it->>'ingrediente_id')::bigint;
    if v_ing is not null then
      select nombre, unidad, stock_actual into v_nombre, v_unidad, v_stock
        from ingredientes where id = v_ing for update;
      if found then
        v_resta := round((it->>'cantidad')::double precision::numeric, 3)::double precision;
        if round((v_stock - v_resta)::numeric, 3) < 0 then
          raise exception 'SIN_STOCK: %: falta % %', v_nombre, v_resta, v_unidad;
        end if;
        update ingredientes
           set stock_actual = round((v_stock - v_resta)::numeric, 3)::double precision
         where id = v_ing;
      end if;
    end if;

    -- b) Ingrediente de la receta del producto
    v_pid := (it->>'producto_id')::bigint;
    if v_pid is not null then
      select coalesce(es_receta, false) into v_es_receta from productos where id = v_pid;
      if coalesce(v_es_receta, false) then
        for r in
          select ri.ingrediente_id, ri.cantidad, i.stock_actual, i.nombre, i.unidad
            from receta_ingredientes ri
            join ingredientes i on i.id = ri.ingrediente_id
           where ri.producto_id = v_pid
           for update of i
        loop
          v_resta := round((r.cantidad * (it->>'cantidad')::double precision)::numeric, 3)::double precision;
          if round((r.stock_actual - v_resta)::numeric, 3) < 0 then
            raise exception 'SIN_STOCK: %: falta % %', r.nombre, v_resta, r.unidad;
          end if;
          update ingredientes
             set stock_actual = round((r.stock_actual - v_resta)::numeric, 3)::double precision
           where id = r.ingrediente_id;
        end loop;
      end if;
    end if;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.crear_factura_traslado(text, text, text, text, date, text, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.crear_factura_traslado(text, text, text, text, date, text, jsonb, bigint) to service_role;

-- ==================== ANULAR (DEVUELVE STOCK) ====================
create or replace function public.anular_factura_traslado(p_id bigint)
returns void
language plpgsql
as $$
declare
  it record;
  r record;
  v_es_receta boolean;
  v_suma double precision;
begin
  if not exists (select 1 from facturas_traslado where id = p_id) then
    raise exception 'TRASLADO_NOT_FOUND';
  end if;

  for it in
    select producto_id, ingrediente_id, cantidad from facturas_traslado_items where factura_id = p_id
  loop
    -- a) Ingrediente salido directamente
    if it.ingrediente_id is not null then
      v_suma := round((it.cantidad)::numeric, 3)::double precision;
      update ingredientes
         set stock_actual = round((stock_actual + v_suma)::numeric, 3)::double precision
       where id = it.ingrediente_id;
    end if;

    -- b) Ingredientes de la receta del producto
    if it.producto_id is not null then
      select coalesce(es_receta, false) into v_es_receta from productos where id = it.producto_id;
      if coalesce(v_es_receta, false) then
        for r in select ingrediente_id, cantidad from receta_ingredientes where producto_id = it.producto_id loop
          v_suma := round((r.cantidad * it.cantidad)::numeric, 3)::double precision;
          update ingredientes
             set stock_actual = round((stock_actual + v_suma)::numeric, 3)::double precision
           where id = r.ingrediente_id;
        end loop;
      end if;
    end if;
  end loop;

  delete from facturas_traslado where id = p_id;
end;
$$;

revoke execute on function public.anular_factura_traslado(bigint) from public, anon, authenticated;
grant execute on function public.anular_factura_traslado(bigint) to service_role;

-- Reportes: funciones RPC con las agregaciones (SUM / GROUP BY) del backend Express original.
-- Todas reciben rango opcional (null = sin filtro de fecha), salvo reporte_cobertura (obligatorio).

create or replace function reporte_ventas_totales(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language sql
stable
as $$
with v as (
  select id, fecha, total_usd, total_bs, metodo_pago, pagada
  from ventas
  where (metodo_pago <> 'Credito' or pagada = true)
    and ((p_from is null or p_to is null) or (fecha >= p_from and fecha <= p_to))
),
dd as (
  select dv.producto_id, dv.cantidad, dv.subtotal, dv.precio_costo
  from detalle_venta dv
  join v on v.id = dv.venta_id
)
select jsonb_build_object(
  'count', (select count(*) from v),
  'total_usd', (select coalesce(sum(total_usd), 0) from v),
  'total_bs', (select coalesce(sum(total_bs), 0) from v),
  'total_unidades', (select coalesce(sum(cantidad), 0) from dd),
  'total_ganancia', (select coalesce(sum(subtotal - (precio_costo * cantidad)), 0) from dd),
  'producto_mas_vendido', (
    select jsonb_build_object('nombre', p.nombre, 'codigo', p.codigo, 'total', sum(d.cantidad))
    from dd d
    join productos p on p.id = d.producto_id
    group by d.producto_id, p.id, p.nombre, p.codigo
    order by sum(d.cantidad) desc
    limit 1
  ),
  'por_metodo_pago', coalesce(
    (
      select jsonb_agg(jsonb_build_object(
        'metodo_pago', metodo_pago,
        'count', cnt,
        'total_usd', total_usd,
        'total_bs', total_bs
      ) order by total_usd desc)
      from (
        select metodo_pago, count(*) as cnt, sum(total_usd) as total_usd, sum(total_bs) as total_bs
        from v
        group by metodo_pago
      ) t
    ),
    '[]'::jsonb
  )
)
$$;

create or replace function reporte_pagos(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'metodo_pago', t.metodo_pago,
        'count', t.cnt,
        'total_usd', t.total_usd,
        'total_bs', t.total_bs
      )
      order by t.total_usd desc
    ),
    '[]'::jsonb
  )
  from (
    select
      coalesce(vp.metodo_pago, v.metodo_pago) as metodo_pago,
      count(distinct v.id) as cnt,
      sum(coalesce(vp.monto_usd, v.total_usd)) as total_usd,
      sum(coalesce(vp.monto_bs, v.total_bs)) as total_bs
    from ventas v
    left join venta_pagos vp on vp.venta_id = v.id
    where (v.metodo_pago <> 'Credito' or v.pagada = true)
      and ((p_from is null or p_to is null) or (v.fecha >= p_from and v.fecha <= p_to))
    group by coalesce(vp.metodo_pago, v.metodo_pago)
    order by total_usd desc
  ) t
$$;

create or replace function reporte_ventas_por_departamento(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'departamento', t.departamento,
        'departamento_id', t.departamento_id,
        'total_ventas', t.total_ventas,
        'total_vendido_usd', t.total_vendido_usd,
        'total_vendido_bs', t.total_vendido_bs,
        'unidades', t.unidades
      )
      order by t.total_vendido_usd desc
    ),
    '[]'::jsonb
  )
  from (
    select
      coalesce(d.nombre, 'Sin departamento') as departamento,
      d.id as departamento_id,
      count(distinct dv.venta_id) as total_ventas,
      sum(dv.subtotal) as total_vendido_usd,
      coalesce(sum(dv.subtotal * case when v.total_usd > 0 then v.total_bs / v.total_usd else 0 end), 0) as total_vendido_bs,
      sum(dv.cantidad) as unidades
    from detalle_venta dv
    join ventas v on v.id = dv.venta_id
    join productos p on p.id = dv.producto_id
    left join departamentos d on d.id = p.departamento_id
    where (v.metodo_pago <> 'Credito' or v.pagada = true)
      and ((p_from is null or p_to is null) or (v.fecha >= p_from and v.fecha <= p_to))
    group by d.id, d.nombre
    order by total_vendido_usd desc
  ) t
$$;

create or replace function reporte_pagos_movil(p_from timestamptz default null, p_to timestamptz default null)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'pagos', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', x.id,
            'fecha', x.fecha,
            'total_usd', x.total_usd,
            'total_bs', x.total_bs,
            'referencia', x.referencia,
            'usuario_nombre', u.usuario
          )
          order by x.fecha desc
        ),
        '[]'::jsonb
      )
      from (
        select v.id, v.fecha, v.total_usd, v.total_bs, v.referencia, v.usuario_id
        from ventas v
        where v.metodo_pago = 'Pago Móvil'
          and ((p_from is null or p_to is null) or (v.fecha >= p_from and v.fecha <= p_to))
        order by v.fecha desc
        limit 200
      ) x
      left join usuarios u on u.id = x.usuario_id
    ),
    'multipago', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', y.id,
            'fecha', y.fecha,
            'monto_usd', y.monto_usd,
            'monto_bs', y.monto_bs,
            'referencia', y.referencia,
            'usuario_nombre', y.usuario_nombre
          )
          order by y.fecha desc
        ),
        '[]'::jsonb
      )
      from (
        select v.id, v.fecha, vp.monto_usd, vp.monto_bs, vp.referencia, u.usuario as usuario_nombre
        from venta_pagos vp
        join ventas v on v.id = vp.venta_id
        left join usuarios u on u.id = v.usuario_id
        where vp.metodo_pago = 'Pago Móvil' and v.metodo_pago = 'Multipago'
          and ((p_from is null or p_to is null) or (v.fecha >= p_from and v.fecha <= p_to))
        order by v.fecha desc
        limit 200
      ) y
    )
  )
$$;

create or replace function reporte_cobertura(p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'total_ganancia', (
      select coalesce(sum(dv.subtotal - (dv.precio_costo * dv.cantidad)), 0)
      from detalle_venta dv
      join ventas v on v.id = dv.venta_id
      where (v.metodo_pago <> 'Credito' or v.pagada = true)
        and v.fecha >= p_from and v.fecha <= p_to
    ),
    'proveedores', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'proveedor_id', t.proveedor_id,
            'proveedor_nombre', t.proveedor_nombre,
            'total_facturado', t.total_facturado,
            'total_pagado', t.total_pagado,
            'saldo_pendiente', t.saldo_pendiente
          )
          order by t.saldo_pendiente desc
        ),
        '[]'::jsonb
      )
      from (
        select
          p.id as proveedor_id,
          p.nombre as proveedor_nombre,
          coalesce(sum(fp.monto_total), 0) as total_facturado,
          coalesce(sum(pg_sub.total_pagado), 0) as total_pagado,
          (coalesce(sum(fp.monto_total), 0) - coalesce(sum(pg_sub.total_pagado), 0)) as saldo_pendiente
        from proveedores p
        left join facturas_proveedor fp on fp.proveedor_id = p.id
        left join (
          select factura_proveedor_id, sum(monto) as total_pagado
          from pagos_proveedor
          group by factura_proveedor_id
        ) pg_sub on pg_sub.factura_proveedor_id = fp.id
        where p.activo = true
        group by p.id, p.nombre
        having (coalesce(sum(fp.monto_total), 0) - coalesce(sum(pg_sub.total_pagado), 0)) > 0
        order by saldo_pendiente desc
      ) t
    )
  )
$$;

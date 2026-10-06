-- Port de la transacción de PUT /api/recetas/:productoId (backend/src/server.js):
--   db.transaction(() => { DELETE FROM receta_ingredientes WHERE producto_id = ?;
--                          INSERT ... por cada ingrediente con cantidad > 0 })
-- El handler lo invoca vía: supabaseAdmin().rpc('replace_receta', { p_producto_id, p_items })

create or replace function public.replace_receta(p_producto_id bigint, p_items jsonb)
returns void
language plpgsql
as $$
begin
  delete from receta_ingredientes where producto_id = p_producto_id;

  insert into receta_ingredientes (producto_id, ingrediente_id, cantidad)
  select p_producto_id,
         (item ->> 'ingrediente_id')::bigint,
         (item ->> 'cantidad')::double precision
  from jsonb_array_elements(p_items) as item
  where (item ->> 'cantidad')::double precision > 0;
end;
$$;

-- Solo el service_role (backend) debe ejecutarla
revoke execute on function public.replace_receta(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.replace_receta(bigint, jsonb) to service_role;

-- =====================================================================
-- EfectiGana - 003: permisos de lectura para la web y la app
-- Los proyectos nuevos de Supabase no dan acceso automático a las tablas.
-- Sin esto la web no puede leer pozos, sorteos ni el perfil del usuario.
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- (la seguridad sigue a cargo de las políticas RLS: cada usuario solo ve lo suyo)
-- =====================================================================

grant usage on schema public to anon, authenticated;

-- Información pública: pozos, sorteos y configuración
grant select on public.pools, public.draws, public.settings to anon, authenticated;

-- Información privada (RLS: cada usuario ve solo la suya; el admin ve todo)
grant select on public.profiles, public.entries, public.transactions, public.recharge_requests to authenticated;

-- Funciones que usa la web
grant execute on function public.phone_available(text)            to anon, authenticated;
grant execute on function public.username_available(text)         to anon, authenticated;
grant execute on function public.pool_participants(smallint)       to anon, authenticated;
grant execute on function public.place_bet(smallint, int)          to authenticated;
grant execute on function public.create_recharge_request(numeric)  to authenticated;
grant execute on function public.set_my_username(text)             to authenticated;
grant execute on function public.admin_adjust_balance(uuid, numeric, text) to authenticated;
grant execute on function public.admin_resolve_recharge(bigint, boolean)   to authenticated;
grant execute on function public.admin_set_blocked(uuid, boolean)          to authenticated;
grant execute on function public.admin_run_due_draws()                     to authenticated;
grant execute on function public.is_admin()                                to anon, authenticated;

-- Comprobación: debe mostrar los 4 pozos con su sorteo abierto
select p.name, p.ticket_price, d.total, d.draw_at at time zone 'America/Lima' as sorteo_lima
from public.pools p left join public.draws d on d.pool_id = p.id and d.status = 'open'
order by p.sort;

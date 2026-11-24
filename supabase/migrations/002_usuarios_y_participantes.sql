-- =====================================================================
-- EfectiGana - 002: nombre de usuario único e inmutable + participantes
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- (se puede ejecutar más de una vez sin problema)
-- =====================================================================

-- 1) Columna username (3 a 20 caracteres: letras, números, punto o guion bajo)
alter table public.profiles add column if not exists username text;

do $$
begin
  alter table public.profiles add constraint profiles_username_format
    check (username is null or username ~ '^[A-Za-z0-9_.]{3,20}$');
exception when duplicate_object then null;
end $$;

-- No se puede repetir (sin importar mayúsculas/minúsculas)
create unique index if not exists profiles_username_unique on public.profiles (lower(username));

-- 2) Guardar el username al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, phone, username)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'phone', ''),
    nullif(trim(new.raw_user_meta_data->>'username'), '')
  );
  return new;
end $$;

-- 3) Una vez elegido, el username NO se puede cambiar (ni siquiera desde el panel)
create or replace function public.lock_username()
returns trigger language plpgsql as $$
begin
  if old.username is not null and new.username is distinct from old.username then
    raise exception 'El nombre de usuario no se puede cambiar';
  end if;
  return new;
end $$;

drop trigger if exists profiles_lock_username on public.profiles;
create trigger profiles_lock_username
  before update on public.profiles
  for each row execute function public.lock_username();

-- 4) ¿Está libre este username? (se usa en el formulario de registro)
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists(select 1 from public.profiles where lower(username) = lower(trim(p_username)));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- 5) Usuarios antiguos sin username: lo eligen una sola vez
create or replace function public.set_my_username(p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v text := trim(p_username);
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if v !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'Usa de 3 a 20 caracteres: letras, números, punto o guion bajo';
  end if;
  if not public.username_available(v) then
    raise exception 'Ese nombre de usuario ya está en uso';
  end if;
  update public.profiles set username = v where id = auth.uid() and username is null;
  if not found then raise exception 'Ya tienes un nombre de usuario y no se puede cambiar'; end if;
  return v;
end $$;
revoke all on function public.set_my_username(text) from public, anon;
grant execute on function public.set_my_username(text) to authenticated;

-- 6) Participantes del sorteo abierto de un pozo (solo nombre de usuario y jugadas)
create or replace function public.pool_participants(p_pool smallint)
returns table(username text, tickets bigint, last_play timestamptz)
language sql stable security definer set search_path = public as $$
  select coalesce(p.username, p.code) as username,
         sum(e.tickets)::bigint       as tickets,
         max(e.created_at)            as last_play
  from public.draws d
  join public.entries e  on e.draw_id = d.id
  join public.profiles p on p.id = e.user_id
  where d.pool_id = p_pool and d.status = 'open'
  group by p.id, p.username, p.code
  order by sum(e.tickets) desc, max(e.created_at) asc;
$$;
grant execute on function public.pool_participants(smallint) to anon, authenticated;

-- 7) El ganador se muestra con su nombre de usuario
create or replace function public.run_due_draws()
returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  v_draw   public.draws;
  v_pct    numeric := coalesce((select value::numeric from settings where key = 'commission_pct'), 0);
  v_ticket int;
  v_winner uuid;
  v_comm   numeric(12,2);
  v_prize  numeric(12,2);
  v_new    numeric(12,2);
  v_label  text;
  v_count  int := 0;
begin
  for v_draw in
    select * from draws where status = 'open' and draw_at <= now() order by id for update skip locked
  loop
    if v_draw.tickets > 0 then
      v_ticket := 1 + (abs(('x' || encode(extensions.gen_random_bytes(7), 'hex'))::bit(56)::bigint) % v_draw.tickets)::int;

      select e.user_id into v_winner from (
        select user_id, sum(tickets) over (order by id) as acc from entries where draw_id = v_draw.id
      ) e where e.acc >= v_ticket order by e.acc limit 1;

      v_comm  := round(v_draw.total * v_pct / 100, 2);
      v_prize := v_draw.total - v_comm;

      update profiles set balance = balance + v_prize where id = v_winner
        returning balance, coalesce(username, code) into v_new, v_label;

      insert into transactions(user_id, type, amount, balance_after, description)
      values (v_winner, 'premio', v_prize, v_new,
              format('¡Ganaste el %s! Sorteo #%s', (select name from pools where id = v_draw.pool_id), v_draw.id));

      update draws set status = 'closed', closed_at = now(), commission = v_comm, prize = v_prize,
             winner_id = v_winner, winner_label = v_label, winner_ticket = v_ticket
       where id = v_draw.id;
    else
      update draws set status = 'closed', closed_at = now(), commission = 0, prize = 0 where id = v_draw.id;
    end if;

    insert into draws(pool_id, draw_at) values (v_draw.pool_id, public.next_draw_at(greatest(now(), v_draw.draw_at)));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.run_due_draws() from public, anon, authenticated;

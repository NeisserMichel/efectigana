-- =====================================================================
-- EfectiGana - Esquema completo de base de datos (Supabase / Postgres)
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- CONFIGURACIÓN
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key   text primary key,
  value text not null
);
insert into public.settings(key, value) values
  ('commission_pct', '10'),            -- % que se queda la casa de cada pozo
  ('whatsapp_number', '51917486188'),  -- número para recargas
  ('min_recharge', '1'),
  ('max_recharge', '1000')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- PERFILES (uno por usuario registrado)
-- ---------------------------------------------------------------------
create sequence if not exists public.profile_code_seq start 1001;

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  code       text unique not null default ('EG-' || nextval('public.profile_code_seq')),
  email      text not null,
  phone      text unique not null check (phone ~ '^9[0-9]{8}$'),
  balance    numeric(12,2) not null default 0 check (balance >= 0),
  is_admin   boolean not null default false,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, email, phone)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'phone', ''));
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Verificar si un teléfono ya está registrado (antes del registro)
create or replace function public.phone_available(p_phone text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists(select 1 from public.profiles where phone = p_phone);
$$;
grant execute on function public.phone_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- POZOS Y SORTEOS
-- ---------------------------------------------------------------------
create table if not exists public.pools (
  id           smallint primary key,
  name         text not null,
  ticket_price numeric(12,2) not null check (ticket_price > 0),
  color        text not null default '#16a34a',
  sort         smallint not null default 0
);
insert into public.pools(id, name, ticket_price, color, sort) values
  (1, 'Pozo Bronce',  0.50, '#d97706', 1),
  (2, 'Pozo Plata',   1.00, '#64748b', 2),
  (3, 'Pozo Oro',     3.00, '#eab308', 3),
  (4, 'Pozo Diamante',5.00, '#0ea5e9', 4)
on conflict (id) do nothing;

-- Próximo domingo 8:00 p.m. hora de Lima
create or replace function public.next_draw_at(p_from timestamptz default now())
returns timestamptz language plpgsql stable as $$
declare
  lima   timestamp := p_from at time zone 'America/Lima';
  target timestamp;
begin
  target := date_trunc('day', lima) + ((7 - extract(dow from lima)::int) % 7) * interval '1 day' + interval '20 hours';
  if target <= lima then
    target := target + interval '7 days';
  end if;
  return target at time zone 'America/Lima';
end $$;

create table if not exists public.draws (
  id            bigserial primary key,
  pool_id       smallint not null references public.pools(id),
  draw_at       timestamptz not null,
  status        text not null default 'open' check (status in ('open','closed')),
  total         numeric(12,2) not null default 0,
  tickets       int not null default 0,
  participants  int not null default 0,
  commission    numeric(12,2),
  prize         numeric(12,2),
  winner_id     uuid references public.profiles(id),
  winner_label  text,
  winner_ticket int,
  closed_at     timestamptz
);
create unique index if not exists draws_one_open_per_pool on public.draws(pool_id) where status = 'open';

insert into public.draws(pool_id, draw_at)
select p.id, public.next_draw_at()
from public.pools p
where not exists (select 1 from public.draws d where d.pool_id = p.id and d.status = 'open');

create table if not exists public.entries (
  id         bigserial primary key,
  draw_id    bigint not null references public.draws(id),
  user_id    uuid not null references public.profiles(id),
  tickets    int not null check (tickets > 0),
  amount     numeric(12,2) not null,
  created_at timestamptz not null default now()
);
create index if not exists entries_draw_idx on public.entries(draw_id);
create index if not exists entries_user_idx on public.entries(user_id);

-- ---------------------------------------------------------------------
-- MOVIMIENTOS Y SOLICITUDES DE RECARGA
-- ---------------------------------------------------------------------
create table if not exists public.transactions (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles(id),
  type          text not null check (type in ('recarga','apuesta','premio','descuento_admin','ajuste_admin')),
  amount        numeric(12,2) not null,      -- positivo suma, negativo resta
  balance_after numeric(12,2) not null,
  description   text,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists tx_user_idx on public.transactions(user_id, created_at desc);

create table if not exists public.recharge_requests (
  id          bigserial primary key,
  user_id     uuid not null references public.profiles(id),
  amount      numeric(12,2) not null check (amount > 0),
  status      text not null default 'pendiente' check (status in ('pendiente','aprobada','rechazada')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid
);

-- ---------------------------------------------------------------------
-- SEGURIDAD (RLS): el saldo SOLO cambia mediante las funciones de abajo
-- ---------------------------------------------------------------------
alter table public.settings          enable row level security;
alter table public.profiles          enable row level security;
alter table public.pools             enable row level security;
alter table public.draws             enable row level security;
alter table public.entries           enable row level security;
alter table public.transactions      enable row level security;
alter table public.recharge_requests enable row level security;

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using (id = auth.uid() or public.is_admin());

drop policy if exists pools_read on public.pools;
create policy pools_read on public.pools for select using (true);

drop policy if exists draws_read on public.draws;
create policy draws_read on public.draws for select using (true);

drop policy if exists entries_self on public.entries;
create policy entries_self on public.entries for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists tx_self on public.transactions;
create policy tx_self on public.transactions for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists rr_self on public.recharge_requests;
create policy rr_self on public.recharge_requests for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- FUNCIÓN: apostar en un pozo (descuenta saldo automáticamente)
-- ---------------------------------------------------------------------
create or replace function public.place_bet(p_pool smallint, p_tickets int)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_prof  public.profiles;
  v_pool  public.pools;
  v_draw  public.draws;
  v_cost  numeric(12,2);
  v_new   numeric(12,2);
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if p_tickets is null or p_tickets < 1 or p_tickets > 1000 then
    raise exception 'Cantidad de jugadas inválida (1 a 1000)';
  end if;

  select * into v_pool from pools where id = p_pool;
  if not found then raise exception 'Pozo no existe'; end if;

  select * into v_draw from draws where pool_id = p_pool and status = 'open' for update;
  if not found or v_draw.draw_at <= now() then
    raise exception 'El sorteo de este pozo ya está cerrado, intenta en unos minutos';
  end if;

  select * into v_prof from profiles where id = v_uid for update;
  if v_prof.is_blocked then raise exception 'Tu cuenta está bloqueada, contacta a soporte'; end if;

  v_cost := v_pool.ticket_price * p_tickets;
  if v_prof.balance < v_cost then
    raise exception 'Saldo insuficiente. Necesitas S/ % y tienes S/ %', v_cost, v_prof.balance;
  end if;

  v_new := v_prof.balance - v_cost;
  update profiles set balance = v_new where id = v_uid;

  insert into entries(draw_id, user_id, tickets, amount) values (v_draw.id, v_uid, p_tickets, v_cost);

  update draws set
    total = total + v_cost,
    tickets = tickets + p_tickets,
    participants = (select count(distinct user_id) from entries where draw_id = v_draw.id)
  where id = v_draw.id;

  insert into transactions(user_id, type, amount, balance_after, description, created_by)
  values (v_uid, 'apuesta', -v_cost, v_new,
          format('%s jugada(s) en %s - sorteo #%s', p_tickets, v_pool.name, v_draw.id), v_uid);

  return v_new;
end $$;
revoke all on function public.place_bet(smallint, int) from public, anon;
grant execute on function public.place_bet(smallint, int) to authenticated;

-- ---------------------------------------------------------------------
-- FUNCIÓN: crear solicitud de recarga (antes de ir a WhatsApp)
-- ---------------------------------------------------------------------
create or replace function public.create_recharge_request(p_amount numeric)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_id  bigint;
  v_min numeric := (select value::numeric from settings where key = 'min_recharge');
  v_max numeric := (select value::numeric from settings where key = 'max_recharge');
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
  if p_amount is null or p_amount < v_min or p_amount > v_max then
    raise exception 'El monto debe estar entre S/ % y S/ %', v_min, v_max;
  end if;
  if (select count(*) from recharge_requests where user_id = auth.uid() and status = 'pendiente') >= 5 then
    raise exception 'Tienes demasiadas solicitudes pendientes. Espera a que se aprueben.';
  end if;
  insert into recharge_requests(user_id, amount) values (auth.uid(), round(p_amount, 2)) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.create_recharge_request(numeric) from public, anon;
grant execute on function public.create_recharge_request(numeric) to authenticated;

-- ---------------------------------------------------------------------
-- FUNCIONES DE ADMINISTRADOR
-- ---------------------------------------------------------------------
-- Sumar (monto positivo) o descontar (monto negativo) saldo a un usuario
create or replace function public.admin_adjust_balance(p_user uuid, p_amount numeric, p_reason text)
returns numeric language plpgsql security definer set search_path = public as $$
declare
  v_prof public.profiles;
  v_new  numeric(12,2);
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Monto inválido'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'Indica el motivo'; end if;

  select * into v_prof from profiles where id = p_user for update;
  if not found then raise exception 'Usuario no encontrado'; end if;

  v_new := v_prof.balance + round(p_amount, 2);
  if v_new < 0 then
    raise exception 'El usuario solo tiene S/ %. No se puede descontar S/ %', v_prof.balance, abs(p_amount);
  end if;

  update profiles set balance = v_new where id = p_user;
  insert into transactions(user_id, type, amount, balance_after, description, created_by)
  values (p_user, case when p_amount < 0 then 'descuento_admin' else 'ajuste_admin' end,
          round(p_amount, 2), v_new, p_reason, auth.uid());
  return v_new;
end $$;

-- Aprobar o rechazar una solicitud de recarga (aprobar = acredita el saldo)
create or replace function public.admin_resolve_recharge(p_request bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_req public.recharge_requests;
  v_new numeric(12,2);
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  select * into v_req from recharge_requests where id = p_request for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_req.status <> 'pendiente' then raise exception 'La solicitud ya fue procesada'; end if;

  update recharge_requests
     set status = case when p_approve then 'aprobada' else 'rechazada' end,
         resolved_at = now(), resolved_by = auth.uid()
   where id = p_request;

  if p_approve then
    update profiles set balance = balance + v_req.amount where id = v_req.user_id returning balance into v_new;
    insert into transactions(user_id, type, amount, balance_after, description, created_by)
    values (v_req.user_id, 'recarga', v_req.amount, v_new,
            format('Recarga Yape - solicitud #%s', v_req.id), auth.uid());
  end if;
end $$;

-- Bloquear / desbloquear usuario
create or replace function public.admin_set_blocked(p_user uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  update profiles set is_blocked = p_blocked where id = p_user;
end $$;

revoke all on function public.admin_adjust_balance(uuid, numeric, text) from public, anon;
revoke all on function public.admin_resolve_recharge(bigint, boolean) from public, anon;
revoke all on function public.admin_set_blocked(uuid, boolean) from public, anon;
grant execute on function public.admin_adjust_balance(uuid, numeric, text) to authenticated;
grant execute on function public.admin_resolve_recharge(bigint, boolean) to authenticated;
grant execute on function public.admin_set_blocked(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- SORTEO: elige 1 ganador por pozo (cada jugada = 1 boleto), descuenta
-- la comisión y acredita el premio automáticamente.
-- ---------------------------------------------------------------------
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
      -- número aleatorio criptográficamente seguro entre 1 y total de boletos
      v_ticket := 1 + (abs(('x' || encode(extensions.gen_random_bytes(7), 'hex'))::bit(56)::bigint) % v_draw.tickets)::int;

      select e.user_id into v_winner from (
        select user_id, sum(tickets) over (order by id) as acc from entries where draw_id = v_draw.id
      ) e where e.acc >= v_ticket order by e.acc limit 1;

      v_comm  := round(v_draw.total * v_pct / 100, 2);
      v_prize := v_draw.total - v_comm;

      update profiles set balance = balance + v_prize where id = v_winner
        returning balance, code || ' · ***' || right(phone, 3) into v_new, v_label;

      insert into transactions(user_id, type, amount, balance_after, description)
      values (v_winner, 'premio', v_prize, v_new,
              format('¡Ganaste el %s! Sorteo #%s', (select name from pools where id = v_draw.pool_id), v_draw.id));

      update draws set status = 'closed', closed_at = now(), commission = v_comm, prize = v_prize,
             winner_id = v_winner, winner_label = v_label, winner_ticket = v_ticket
       where id = v_draw.id;
    else
      update draws set status = 'closed', closed_at = now(), commission = 0, prize = 0 where id = v_draw.id;
    end if;

    -- abrir la ronda de la siguiente semana
    insert into draws(pool_id, draw_at) values (v_draw.pool_id, public.next_draw_at(greatest(now(), v_draw.draw_at)));
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function public.run_due_draws() from public, anon, authenticated;

-- El admin puede forzar la ejecución (solo procesa sorteos cuya hora ya llegó)
create or replace function public.admin_run_due_draws()
returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado'; end if;
  return public.run_due_draws();
end $$;
revoke all on function public.admin_run_due_draws() from public, anon;
grant execute on function public.admin_run_due_draws() to authenticated;

-- Ejecutar el sorteo automáticamente: revisa cada minuto si llegó el domingo 8 p.m.
select cron.unschedule(jobid) from cron.job where jobname = 'efectigana-sorteos';
select cron.schedule('efectigana-sorteos', '* * * * *', $$select public.run_due_draws();$$);

-- ---------------------------------------------------------------------
-- TIEMPO REAL: pozos en vivo y saldo en vivo
-- ---------------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.draws; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.profiles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.recharge_requests; exception when duplicate_object then null; end;
end $$;

-- ---------------------------------------------------------------------
-- DESPUÉS DE REGISTRARTE EN LA WEB, conviértete en administrador con:
--   update public.profiles set is_admin = true where email = 'TU_CORREO@gmail.com';
-- ---------------------------------------------------------------------

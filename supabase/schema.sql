-- =====================================================================
-- FarmaPlan · Esquema de base de datos para Supabase (PostgreSQL)
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run
-- Crea tablas, índices, Row Level Security (permisos por tienda),
-- reglas del flujo de aprobación y publicación en tiempo real.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Posiciones (catálogo fijo)
-- ---------------------------------------------------------------------
create table if not exists public.positions (
  id text primary key,
  name text not null,
  short text not null,
  sort int not null
);
insert into public.positions (id, name, short, sort) values
  ('DT', 'Gerente de Tienda (DT)', 'DT', 1),
  ('APV_SR', 'APV Senior', 'APV Sr', 2),
  ('APV_ASIST', 'APV Asistente de Piso de Venta', 'APV Asist.', 3),
  ('APV_FARM', 'APV Farmacias', 'APV Farm.', 4),
  ('FARMACEUTICO', 'Farmacéutico', 'Farmac.', 5),
  ('MAESTRANZA', 'Maestranza', 'Maestr.', 6)
on conflict (id) do update set name = excluded.name, short = excluded.short, sort = excluded.sort;

-- ---------------------------------------------------------------------
-- Tiendas y parámetros
-- ---------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  region text not null default '',
  address text not null default '',
  is_demo boolean not null default false,
  -- 7 elementos (0 = domingo): {"closed": bool, "open": "HH:MM", "close": "HH:MM"}
  hours jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  min_staff int not null default 2,
  key_positions text[] not null default '{FARMACEUTICO}',
  key_positions_blocking boolean not null default true,
  target_by_hour int[] null check (target_by_hour is null or array_length(target_by_hour, 1) = 24),
  max_daily_hours numeric not null default 9,
  min_daily_hours numeric not null default 4,
  max_weekly_hours numeric not null default 48,
  min_rest_hours numeric not null default 12,
  max_consecutive_days int not null default 6,
  contract_tolerance_pct numeric not null default 10,
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

-- ---------------------------------------------------------------------
-- Usuarios y permisos (1 fila por usuario de Supabase Auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('admin', 'gerente')),
  store_id uuid null references public.stores(id) on delete set null,
  is_demo boolean not null default false
);

-- ---------------------------------------------------------------------
-- Empleados
-- ---------------------------------------------------------------------
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  position_id text not null references public.positions(id),
  active boolean not null default true,
  contract_weekly_hours numeric null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists employees_store_idx on public.employees(store_id);

-- ---------------------------------------------------------------------
-- Planificaciones mensuales
-- ---------------------------------------------------------------------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  status text not null default 'pendiente'
    check (status in ('pendiente', 'en_preparacion', 'enviada', 'observada', 'aprobada')),
  changed_after_submit boolean not null default false,
  submitted_at timestamptz null,
  approved_at timestamptz null,
  last_comment text null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  updated_by_name text null,
  unique (store_id, year, month)
);

-- ---------------------------------------------------------------------
-- Turnos, francos, vacaciones, licencias y ausencias (una fila por registro)
-- ---------------------------------------------------------------------
create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('turno', 'franco', 'vacaciones', 'licencia', 'ausencia')),
  start text null check (start is null or start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  "end" text null check ("end" is null or "end" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  position_id text null references public.positions(id),
  notes text null,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  check (kind <> 'turno' or (start is not null and "end" is not null))
);
create index if not exists entries_store_date_idx on public.entries(store_id, date);
create index if not exists entries_plan_idx on public.entries(plan_id);
create index if not exists entries_employee_idx on public.entries(employee_id);

-- Vista de ausencias y licencias (derivada de entries)
create or replace view public.v_ausencias with (security_invoker = on) as
  select e.id, e.store_id, e.employee_id, emp.name as empleado, e.date, e.kind, e.notes
  from public.entries e join public.employees emp on emp.id = e.employee_id
  where e.kind in ('vacaciones', 'licencia', 'ausencia');

-- ---------------------------------------------------------------------
-- Historial de cambios y aprobaciones
-- ---------------------------------------------------------------------
create table if not exists public.plan_history (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  action text not null check (action in ('creacion', 'edicion', 'envio', 'observacion', 'aprobacion', 'reapertura', 'edicion_post_envio')),
  from_status text null,
  to_status text null,
  comment text null,
  user_id uuid null,
  user_name text null,
  at timestamptz not null default now()
);
create index if not exists plan_history_plan_idx on public.plan_history(plan_id);

-- ---------------------------------------------------------------------
-- Alertas (instantánea guardada en cada cambio de estado de la planificación;
-- la aplicación además las recalcula en vivo a partir de los turnos)
-- ---------------------------------------------------------------------
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  severity text not null check (severity in ('error', 'advertencia')),
  code text not null,
  message text not null,
  date date null,
  employee_id uuid null,
  created_at timestamptz not null default now()
);
create index if not exists alerts_plan_idx on public.alerts(plan_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- =====================================================================
-- Funciones auxiliares de permisos
-- =====================================================================
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_store() returns uuid
language sql stable security definer set search_path = public as $$
  select store_id from public.profiles where id = auth.uid();
$$;

create or replace function public.can_access_store(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or s = public.my_store();
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.positions enable row level security;
alter table public.stores enable row level security;
alter table public.store_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.plans enable row level security;
alter table public.entries enable row level security;
alter table public.plan_history enable row level security;
alter table public.alerts enable row level security;

drop policy if exists positions_read on public.positions;
create policy positions_read on public.positions for select to authenticated using (true);

-- Tiendas y parámetros: lectura de la propia tienda; escritura sólo administración
drop policy if exists stores_read on public.stores;
create policy stores_read on public.stores for select to authenticated using (public.can_access_store(id));
drop policy if exists stores_admin on public.stores;
create policy stores_admin on public.stores for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists settings_read on public.store_settings;
create policy settings_read on public.store_settings for select to authenticated using (public.can_access_store(store_id));
drop policy if exists settings_admin on public.store_settings;
create policy settings_admin on public.store_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Perfiles: cada usuario ve el suyo; administración ve y gestiona todos
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_admin on public.profiles;
create policy profiles_admin on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Datos operativos: gerente sólo su tienda; administración todas
do $$
declare t text;
begin
  foreach t in array array['employees', 'plans', 'entries', 'plan_history', 'alerts'] loop
    execute format('drop policy if exists %I on public.%I', t || '_scoped', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_access_store(store_id)) with check (public.can_access_store(store_id))',
      t || '_scoped', t);
  end loop;
end $$;

-- =====================================================================
-- Reglas del flujo de aprobación (aplicadas en la base, no sólo en la interfaz)
-- =====================================================================
create or replace function public.guard_plan_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare prev text;
begin
  if public.is_admin() then
    return new;
  end if;
  -- (también cubre los upsert, que disparan el trigger de INSERT)
  select status into prev from public.plans where id = new.id;
  -- El gerente no puede aprobar ni observar
  if new.status in ('aprobada', 'observada') and new.status is distinct from prev then
    raise exception 'Sólo un administrador puede aprobar u observar una planificación';
  end if;
  -- Una planificación aprobada no puede ser modificada por el gerente
  if prev = 'aprobada' then
    raise exception 'La planificación está aprobada: debe reabrirla un administrador';
  end if;
  return new;
end $$;
drop trigger if exists plans_guard on public.plans;
create trigger plans_guard before insert or update on public.plans
  for each row execute function public.guard_plan_status();

create or replace function public.guard_entries_approved() returns trigger
language plpgsql security definer set search_path = public as $$
declare st text;
begin
  if public.is_admin() then
    return coalesce(new, old);
  end if;
  select status into st from public.plans where id = coalesce(new.plan_id, old.plan_id);
  if st = 'aprobada' then
    raise exception 'La planificación está aprobada: no se pueden modificar sus horarios';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists entries_guard on public.entries;
create trigger entries_guard before insert or update or delete on public.entries
  for each row execute function public.guard_entries_approved();

-- =====================================================================
-- Tiempo real (los dashboards se actualizan cuando un gerente guarda)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['stores', 'store_settings', 'employees', 'plans', 'entries', 'plan_history'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =====================================================================
-- Primer administrador: después de crear tu usuario en Authentication → Users,
-- reemplazá el UUID y el correo y ejecutá:
--
-- insert into public.profiles (id, email, name, role)
-- values ('00000000-0000-0000-0000-000000000000', 'rrhh@tuempresa.com', 'RR. HH.', 'admin');
-- =====================================================================

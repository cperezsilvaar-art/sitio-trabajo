-- =====================================================================
-- Portal RH · Gestiones, sanciones y aprobaciones
-- Esquema para Supabase (PostgreSQL). Ejecutar completo en SQL Editor.
--
-- La seguridad NO depende de la interfaz: las reglas se aplican aquí con
-- RLS (quién ve y escribe qué) y triggers (circuito de estados,
-- prohibición de autoaprobación, bloqueo de lo aprobado e historial
-- de sólo agregado).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- Tablas ----------

create table if not exists public.profiles (
  id text primary key,                       -- = auth.users.id
  email text not null unique,
  name text not null,
  role text not null check (role in ('gerente','gerente_area','coordinador','admin_rh')),
  store_ids text[] not null default '{}',
  areas text[] not null default '{}',
  active boolean not null default true
);

create table if not exists public.stores (
  id text primary key, name text not null, area text not null
);

create table if not exists public.employees (
  id text primary key, legajo text not null unique, name text not null, position text not null default '',
  store_id text not null references public.stores(id), dni text, hire_date date, active boolean not null default true
);

create table if not exists public.measure_types (
  id text primary key, name text not null, description text not null default '', active boolean not null default true,
  requires_attachment boolean not null default false, requires_antecedentes boolean not null default false, "order" int not null default 0
);

create table if not exists public.situation_types (
  id text primary key, name text not null, active boolean not null default true
);

create table if not exists public.files (
  id text primary key, name text not null, mime text not null, size bigint not null,
  data text not null,                        -- base64 (para archivos grandes, migrar a Supabase Storage)
  created_at timestamptz not null default now(), created_by text not null
);

create table if not exists public.templates (
  id text primary key, title text not null,
  category text not null check (category in ('sancion','comunicacion','procedimiento','instructivo','otro')),
  description text not null default '', active boolean not null default true,
  measure_type_ids text[] not null default '{}', gestion_kinds text[] not null default '{}', current_version_id text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.template_versions (
  id text primary key, template_id text not null references public.templates(id), version int not null,
  body text not null, fields jsonb not null default '[]', file_id text references public.files(id), file_name text,
  change_notes text not null default '', created_by text not null, created_by_name text not null,
  created_at timestamptz not null default now(), unique (template_id, version)
);

create table if not exists public.policy (
  id text primary key check (id = 'policy'),
  approver_roles text[] not null default '{coordinador,admin_rh}',
  restrict_to_area boolean not null default true,
  routing jsonb not null default '{}',
  comment_required_on_approve boolean not null default false,
  review_sla_days int not null default 2,
  draft_disclaimer text not null default '',
  certificate_days int not null default 2,
  vacation_notice_days int not null default 45
);
insert into public.policy (id) values ('policy') on conflict do nothing;

create table if not exists public.requests (
  id text primary key, number text not null unique,
  status text not null check (status in ('borrador','enviada','pendiente_revision','requiere_modificaciones','aprobada','rechazada','cerrada')),
  manager_id text not null references public.profiles(id), manager_name text not null,
  coordinator_id text references public.profiles(id), coordinator_name text,
  employee_id text not null default '', employee_name text not null default '', legajo text not null default '', position text not null default '',
  store_id text not null default '', store_name text not null default '', area text not null default '',
  incident_date text not null default '', situation_type_id text not null default '', situation_type_name text not null default '',
  measure_type_id text not null default '', measure_type_name text not null default '',
  template_id text not null default '', template_version_id text not null default '',
  description text not null default '', antecedentes text not null default '',
  extra jsonb not null default '{}', attachments jsonb not null default '[]',
  revision int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  submitted_at timestamptz, decided_at timestamptz,
  approved_by text references public.profiles(id), approved_by_name text, approved_at timestamptz, approved_revision int,
  final_document_id text, closed_at timestamptz, notified_at timestamptz
);

create table if not exists public.request_revisions (
  id text primary key, request_id text not null references public.requests(id), revision int not null,
  data jsonb not null, rendered text not null, template_version int not null,
  created_by text not null, created_by_name text not null, created_at timestamptz not null default now(), reason text not null default '',
  unique (request_id, revision)
);

create table if not exists public.final_documents (
  id text primary key, request_id text not null references public.requests(id), revision int not null,
  template_version_id text not null references public.template_versions(id), content text not null, sha256 text not null,
  approved_by text not null references public.profiles(id), approved_by_name text not null, approved_at timestamptz not null,
  docx_file_id text references public.files(id)
);

create table if not exists public.audit_events (
  id text primary key, entity text not null, entity_id text not null, action text not null,
  actor_id text not null, actor_name text not null, actor_role text not null, at timestamptz not null default now(),
  from_status text, to_status text, revision int, comment text, internal boolean not null default false
);
create index if not exists audit_entity_idx on public.audit_events (entity, entity_id);

create table if not exists public.notifications (
  id text primary key, user_id text not null references public.profiles(id), request_id text,
  message text not null, read boolean not null default false, at timestamptz not null default now(), link text
);
create index if not exists notifications_user_idx on public.notifications (user_id, read);

-- Licencias y vacaciones
create table if not exists public.gestiones (
  id text primary key, number text not null unique,
  kind text not null check (kind in ('licencia','vacaciones')),
  status text not null check (status in ('pendiente_certificado','pendiente_firma','enviada','observada','recibida','cerrada','anulada')),
  manager_id text not null references public.profiles(id), manager_name text not null,
  coordinator_id text references public.profiles(id), coordinator_name text,
  employee_id text not null, employee_name text not null, legajo text not null, position text not null default '', hire_date text not null default '',
  store_id text not null, store_name text not null, area text not null,
  start_date text not null default '', end_date text not null default '', days int not null default 0,
  leave_type text not null default '', leave_type_name text not null default '', notice_date text not null default '',
  period_year int not null default 0, template_version_id text not null default '', notes text not null default '',
  attachments jsonb not null default '[]',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), submitted_at timestamptz,
  reviewed_by text references public.profiles(id), reviewed_by_name text, reviewed_at timestamptz, return_date text
);

-- Cartelera de comunicados
create table if not exists public.announcements (
  id text primary key, title text not null, body text not null,
  priority text not null default 'normal' check (priority in ('normal','importante','urgente')),
  areas text[] not null default '{}', pinned boolean not null default false, active boolean not null default true,
  author_id text not null references public.profiles(id), author_name text not null,
  published_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  expires_at text, attachments jsonb not null default '[]'
);
create table if not exists public.announcement_reads (
  id text primary key, announcement_id text not null references public.announcements(id),
  user_id text not null references public.profiles(id), user_name text not null, at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

-- Headcount y vacantes
create table if not exists public.headcount (
  id text primary key, store_id text not null references public.stores(id), position text not null,
  authorized int not null check (authorized >= 0), updated_by_name text not null default '', updated_at timestamptz not null default now(),
  unique (store_id, position)
);
create table if not exists public.vacancies (
  id text primary key, number text not null unique,
  status text not null check (status in ('pendiente_area','rechazada','autorizada','en_busqueda','entrevistas','preocupacional','ingreso','cubierta','cancelada')),
  store_id text not null references public.stores(id), store_name text not null, area text not null, position text not null,
  shift text not null default '', workday text not null default 'completa', reason text not null check (reason in ('reemplazo','nueva')),
  replaced_employee_id text not null default '', replaced_employee_name text not null default '', leaving_reason text not null default '',
  leaving_date text not null default '', needed_by text not null default '', profile_notes text not null default '',
  manager_id text not null references public.profiles(id), manager_name text not null,
  area_manager_id text references public.profiles(id), area_manager_name text, area_decided_at timestamptz,
  coordinator_id text references public.profiles(id), coordinator_name text,
  candidate_name text not null default '', candidate_legajo text not null default '', hire_date text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), closed_at timestamptz
);

-- ---------- Funciones de apoyo ----------

create or replace function public.me() returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()::text and active
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$ select role from public.me() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$ select coalesce((select role = 'admin_rh' from public.me()), false) $$;

create or replace function public.is_approver() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select m.role = any(p.approver_roles) from public.me() m, public.policy p), false)
$$;

/** ¿El usuario actual puede ver la solicitud? */
create or replace function public.can_see_request(r public.requests) returns boolean
language sql stable security definer set search_path = public as $$
  select case (select role from public.me())
    when 'admin_rh' then true
    when 'coordinador' then r.area = any((public.me()).areas) or r.coordinator_id = auth.uid()::text
    when 'gerente' then r.manager_id = auth.uid()::text
    else false end
$$;

create or replace function public.can_see_request_id(rid text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_see_request(r) from public.requests r where r.id = rid), false)
$$;

create or replace function public.can_see_gestion(g public.gestiones) returns boolean
language sql stable security definer set search_path = public as $$
  select case (select role from public.me())
    when 'admin_rh' then true
    when 'coordinador' then g.area = any((public.me()).areas) or g.coordinator_id = auth.uid()::text
    when 'gerente' then g.manager_id = auth.uid()::text
    else false end
$$;

create or replace function public.can_see_gestion_id(gid text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_see_gestion(g) from public.gestiones g where g.id = gid), false)
$$;

create or replace function public.gestiones_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  u public.profiles := public.me();
  data_changed boolean;
begin
  if u.id is null then raise exception 'Usuario sin perfil activo.'; end if;
  if tg_op = 'INSERT' then
    if u.role <> 'gerente' or new.manager_id <> u.id then raise exception 'Las licencias y vacaciones las carga el gerente, a su nombre.'; end if;
    if not (new.store_id = any(u.store_ids)) then raise exception 'La tienda no está a su cargo.'; end if;
    if new.status not in ('pendiente_certificado','pendiente_firma','enviada') then raise exception 'Estado inicial inválido.'; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'Las gestiones no se borran: se anulan.'; end if;
  if old.status in ('cerrada','anulada') then raise exception 'La gestión está cerrada.'; end if;
  if new.manager_id <> old.manager_id or new.number <> old.number or new.kind <> old.kind or new.employee_id <> old.employee_id then
    raise exception 'Datos de origen inmutables.';
  end if;
  data_changed := row(new.start_date, new.end_date, new.days, new.leave_type, new.notice_date, new.period_year, new.notes, new.attachments)
       is distinct from row(old.start_date, old.end_date, old.days, old.leave_type, old.notice_date, old.period_year, old.notes, old.attachments);
  if data_changed and (u.id <> old.manager_id or old.status not in ('pendiente_certificado','pendiente_firma','observada')) then
    raise exception 'En este estado los datos de la gestión no pueden modificarse.';
  end if;
  if new.status is distinct from old.status then
    if not (
      (old.status in ('pendiente_certificado','pendiente_firma') and new.status in ('enviada','anulada')) or
      (old.status = 'enviada' and new.status in ('recibida','observada','anulada')) or
      (old.status = 'observada' and new.status in ('enviada','pendiente_firma','pendiente_certificado','anulada')) or
      (old.status = 'recibida' and new.status in ('cerrada','anulada'))
    ) then raise exception 'Transición no permitida: % → %.', old.status, new.status; end if;
    if new.status in ('recibida','observada') then
      if not public.is_approver() or u.id = old.manager_id then raise exception 'La recepción la registra RH.'; end if;
      new.reviewed_by := u.id; new.reviewed_at := now();
    end if;
    if new.status in ('enviada','pendiente_firma','pendiente_certificado') and u.id <> old.manager_id then
      raise exception 'Sólo el gerente envía la gestión.';
    end if;
    if new.status = 'cerrada' and u.id <> old.manager_id and not public.is_approver() then raise exception 'No puede cerrarla.'; end if;
    if new.status = 'anulada' and old.status = 'recibida' and not public.is_approver() then raise exception 'Ya fue recibida: la anula RH.'; end if;
    if new.status = 'anulada' and u.id <> old.manager_id and not public.is_approver() then raise exception 'No puede anularla.'; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists gestiones_guard on public.gestiones;
create trigger gestiones_guard before insert or update or delete on public.gestiones
for each row execute function public.gestiones_guard();

create or replace function public.can_see_vacancy(v public.vacancies) returns boolean
language sql stable security definer set search_path = public as $$
  select case (select role from public.me())
    when 'admin_rh' then true
    when 'coordinador' then v.area = any((public.me()).areas)
    when 'gerente_area' then v.area = any((public.me()).areas)
    when 'gerente' then v.manager_id = auth.uid()::text
    else false end
$$;

create or replace function public.can_see_vacancy_id(vid text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select public.can_see_vacancy(v) from public.vacancies v where v.id = vid), false)
$$;

/** RH de las áreas de la tienda (o administrador). */
create or replace function public.is_rh_of_store(sid text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or (public.my_role() = 'coordinador' and exists (
    select 1 from public.stores s where s.id = sid and s.area = any((public.me()).areas)))
$$;

/** Lugares disponibles en el headcount (sin contar la vacante indicada). */
create or replace function public.headcount_available(sid text, pos text, replaced text, skip text) returns int
language sql stable security definer set search_path = public as $$
  with open as (
    select * from public.vacancies v where v.store_id = sid and v.position = pos and v.id <> coalesce(skip, '')
      and v.status in ('pendiente_area','autorizada','en_busqueda','entrevistas','preocupacional','ingreso')
  ), act as (
    select e.id from public.employees e where e.active and e.store_id = sid and e.position = pos
  )
  select coalesce((select authorized from public.headcount h where h.store_id = sid and h.position = pos), 0)
    - ((select count(*) from act)::int
       - (select count(*) from act where act.id in (select replaced_employee_id from open where reason = 'reemplazo'))::int
       - (case when replaced <> '' and replaced in (select id from act) then 1 else 0 end))
    - (select count(*) from open)::int
$$;

create or replace function public.vacancies_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare u public.profiles := public.me(); rh boolean;
begin
  if u.id is null then raise exception 'Usuario sin perfil activo.'; end if;
  rh := u.role in ('coordinador','admin_rh');
  if tg_op = 'INSERT' then
    if u.role <> 'gerente' or new.manager_id <> u.id then raise exception 'Las vacantes las pide el gerente, a su nombre.'; end if;
    if not (new.store_id = any(u.store_ids)) then raise exception 'La tienda no está a su cargo.'; end if;
    if new.status <> 'pendiente_area' then raise exception 'Las vacantes nacen esperando al gerente de área.'; end if;
    if new.reason = 'reemplazo' and exists (select 1 from public.vacancies v where v.replaced_employee_id = new.replaced_employee_id
        and v.status in ('pendiente_area','autorizada','en_busqueda','entrevistas','preocupacional','ingreso')) then
      raise exception 'Ya hay una vacante abierta para reemplazar a esa persona.';
    end if;
    if public.headcount_available(new.store_id, new.position, case when new.reason = 'reemplazo' then new.replaced_employee_id else '' end, new.id) <= 0 then
      raise exception 'Sin vacante disponible en el headcount para %.', new.position;
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then raise exception 'Las vacantes no se borran: se cancelan.'; end if;
  if old.status in ('cubierta','cancelada','rechazada') then raise exception 'La vacante está cerrada.'; end if;
  if row(new.store_id, new.position, new.reason, new.replaced_employee_id, new.manager_id, new.number)
     is distinct from row(old.store_id, old.position, old.reason, old.replaced_employee_id, old.manager_id, old.number) then
    raise exception 'Los datos del pedido no se modifican: cancelá y pedí otra.';
  end if;
  if new.status is distinct from old.status then
    if new.status in ('autorizada','rechazada') then
      if u.role <> 'gerente_area' or not (old.area = any(u.areas)) or old.status <> 'pendiente_area' then raise exception 'La autoriza el gerente de área.'; end if;
      new.area_manager_id := u.id; new.area_decided_at := now();
    elsif new.status = 'cancelada' then
      if not (rh or u.role = 'gerente_area' or (u.id = old.manager_id and old.status = 'pendiente_area')) then raise exception 'No puede cancelarla.'; end if;
    elsif not (rh and (
      (old.status = 'autorizada' and new.status = 'en_busqueda') or (old.status = 'en_busqueda' and new.status = 'entrevistas') or
      (old.status = 'entrevistas' and new.status = 'preocupacional') or (old.status = 'preocupacional' and new.status = 'ingreso') or
      (old.status = 'ingreso' and new.status = 'cubierta'))) then
      raise exception 'Transición no permitida: % → %.', old.status, new.status;
    end if;
  elsif not (rh or u.role = 'gerente_area' or u.id = old.manager_id) then
    raise exception 'No puede modificar la vacante.';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists vacancies_guard on public.vacancies;
create trigger vacancies_guard before insert or update or delete on public.vacancies
for each row execute function public.vacancies_guard();

-- ---------- Reglas del circuito (trigger) ----------

create or replace function public.requests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  u public.profiles := public.me();
  pol public.policy := (select p from public.policy p where id = 'policy');
  data_changed boolean;
begin
  if u.id is null then raise exception 'Usuario sin perfil activo.'; end if;

  if tg_op = 'INSERT' then
    if u.role <> 'gerente' or new.manager_id <> u.id then raise exception 'Sólo un gerente inicia solicitudes, a su nombre.'; end if;
    if new.status <> 'borrador' then raise exception 'Las solicitudes nacen como borrador.'; end if;
    if new.store_id <> '' and not (new.store_id = any(u.store_ids)) then raise exception 'La tienda no está a su cargo.'; end if;
    return new;
  end if;

  if tg_op = 'DELETE' then raise exception 'Las solicitudes no se borran: quedan en el historial.'; end if;

  -- Columnas de datos que completa el gerente.
  data_changed := row(new.employee_id, new.employee_name, new.legajo, new.position, new.store_id, new.store_name, new.area,
                      new.incident_date, new.situation_type_id, new.measure_type_id, new.template_id, new.template_version_id,
                      new.description, new.antecedentes, new.extra, new.attachments)
           is distinct from row(old.employee_id, old.employee_name, old.legajo, old.position, old.store_id, old.store_name, old.area,
                      old.incident_date, old.situation_type_id, old.measure_type_id, old.template_id, old.template_version_id,
                      old.description, old.antecedentes, old.extra, old.attachments);

  if new.manager_id <> old.manager_id or new.number <> old.number or new.created_at <> old.created_at then
    raise exception 'Datos de origen inmutables.';
  end if;

  if data_changed then
    if u.id <> old.manager_id then raise exception 'Sólo el gerente que inició la solicitud puede modificar sus datos.'; end if;
    if old.status not in ('borrador','requiere_modificaciones') then
      raise exception 'La solicitud no admite cambios en estado %. Cualquier cambio posterior requiere rectificación y nueva aprobación.', old.status;
    end if;
    if new.store_id <> '' and not (new.store_id = any(u.store_ids)) then raise exception 'La tienda no está a su cargo.'; end if;
  end if;

  if new.status is distinct from old.status then
    -- Transiciones válidas
    if not (
      (old.status = 'borrador' and new.status = 'enviada') or
      (old.status = 'requiere_modificaciones' and new.status = 'enviada') or
      (old.status in ('enviada','pendiente_revision') and new.status in ('pendiente_revision','aprobada','rechazada','requiere_modificaciones')) or
      (old.status = 'aprobada' and new.status in ('cerrada','borrador')) or
      (old.status = 'rechazada' and new.status = 'cerrada')
    ) then
      raise exception 'Transición no permitida: % → %.', old.status, new.status;
    end if;

    if new.status = 'enviada' then
      if u.id <> old.manager_id then raise exception 'Sólo el gerente envía su solicitud.'; end if;
      if new.revision < 1 or new.revision is distinct from (select max(revision) from public.request_revisions where request_id = new.id) then
        raise exception 'Cada envío debe registrar una nueva versión de la solicitud.';
      end if;
    end if;

    if new.status in ('pendiente_revision','aprobada','rechazada','requiere_modificaciones') then
      if not public.is_approver() then raise exception 'La decisión es exclusiva de usuarios autorizados de RH.'; end if;
      if u.id = old.manager_id then raise exception 'Nadie puede decidir sobre una solicitud que inició.'; end if;
      if pol.restrict_to_area and u.role = 'coordinador' and not (old.area = any(u.areas)) then
        raise exception 'La solicitud corresponde a un área que usted no cubre.';
      end if;
    end if;

    if new.status = 'aprobada' then
      if new.approved_by is distinct from u.id then raise exception 'La aprobación debe registrarse a nombre de quien aprueba.'; end if;
      if new.approved_revision is distinct from old.revision then raise exception 'Se aprueba la última versión enviada.'; end if;
      if not exists (select 1 from public.final_documents d where d.id = new.final_document_id and d.request_id = new.id
                     and d.revision = old.revision and d.approved_by = u.id) then
        raise exception 'Falta el documento definitivo de la versión aprobada.';
      end if;
      new.approved_at := now();
    end if;

    if new.status = 'cerrada' then
      if not public.is_approver() then raise exception 'Sólo RH cierra casos.'; end if;
      if old.status = 'aprobada' and old.notified_at is null then raise exception 'Registre la notificación antes de cerrar.'; end if;
    end if;

    if old.status = 'aprobada' and new.status = 'borrador' then
      if old.notified_at is not null then raise exception 'La medida ya fue notificada: no puede rectificarse.'; end if;
      if u.id <> old.manager_id and not public.is_approver() then raise exception 'No puede rectificar esta solicitud.'; end if;
      if new.final_document_id is not null or new.approved_by is not null then raise exception 'La rectificación deja sin efecto la aprobación anterior.'; end if;
    end if;
  else
    -- Sin cambio de estado: no se puede tocar la aprobación.
    if row(new.approved_by, new.approved_at, new.approved_revision, new.final_document_id)
       is distinct from row(old.approved_by, old.approved_at, old.approved_revision, old.final_document_id) then
      raise exception 'Los datos de aprobación sólo cambian al aprobar o rectificar.';
    end if;
    if new.revision is distinct from old.revision and (u.id <> old.manager_id or old.status not in ('borrador','requiere_modificaciones')) then
      raise exception 'El número de versión sólo avanza al reenviar.';
    end if;
    if new.notified_at is distinct from old.notified_at then
      if old.status <> 'aprobada' or old.notified_at is not null then raise exception 'La notificación sólo se registra una vez, sobre una medida aprobada.'; end if;
      if u.id <> old.manager_id and not public.is_approver() then raise exception 'No puede registrar la notificación.'; end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists requests_guard on public.requests;
create trigger requests_guard before insert or update or delete on public.requests
for each row execute function public.requests_guard();

-- Registro automático de cada cambio de estado (además de los que escribe la aplicación).
create or replace function public.requests_status_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare u public.profiles := public.me();
begin
  if new.status is distinct from old.status then
    insert into public.audit_events (id, entity, entity_id, action, actor_id, actor_name, actor_role, from_status, to_status, revision, comment, internal)
    values ('db-' || gen_random_uuid(), 'request', new.id, 'cambio_estado_db', u.id, u.name, u.role, old.status, new.status, new.revision,
            'Registro automático de la base de datos.', true);
  end if;
  return null;
end $$;

drop trigger if exists requests_status_log on public.requests;
create trigger requests_status_log after update on public.requests
for each row execute function public.requests_status_log();

-- Tablas de sólo agregado: versiones, documentos definitivos, auditoría y archivos.
create or replace function public.append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'Registro del historial: no puede modificarse ni eliminarse (%).', tg_table_name;
end $$;

do $$ declare t text; begin
  foreach t in array array['template_versions','request_revisions','final_documents','audit_events','files','announcement_reads'] loop
    execute format('drop trigger if exists %I_append_only on public.%I', t, t);
    execute format('create trigger %I_append_only before update or delete on public.%I for each row execute function public.append_only()', t, t);
  end loop;
end $$;

-- Las revisiones sólo las crea el gerente, en estados editables, y con numeración consecutiva.
create or replace function public.revisions_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  select * into r from public.requests where id = new.request_id;
  if r.manager_id <> auth.uid()::text then raise exception 'Sólo el gerente de la solicitud registra versiones.'; end if;
  if new.created_by <> auth.uid()::text then raise exception 'Autor inválido.'; end if;
  if new.revision <> (select coalesce(max(revision), 0) + 1 from public.request_revisions where request_id = new.request_id) then
    raise exception 'Numeración de versión inválida.';
  end if;
  return new;
end $$;
drop trigger if exists revisions_guard on public.request_revisions;
create trigger revisions_guard before insert on public.request_revisions for each row execute function public.revisions_guard();

-- Los documentos definitivos sólo los genera un aprobador autorizado que no sea el solicitante.
create or replace function public.final_docs_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.requests;
begin
  select * into r from public.requests where id = new.request_id;
  if not public.is_approver() then raise exception 'Sólo RH genera documentos definitivos.'; end if;
  if r.manager_id = auth.uid()::text then raise exception 'No puede aprobar su propia solicitud.'; end if;
  if new.approved_by <> auth.uid()::text then raise exception 'El aprobador debe ser el usuario actual.'; end if;
  if r.status not in ('enviada','pendiente_revision') or new.revision <> r.revision then raise exception 'La solicitud no está pendiente o la versión no coincide.'; end if;
  if new.sha256 <> encode(digest(new.content, 'sha256'), 'hex') then raise exception 'La huella SHA-256 no coincide con el contenido.'; end if;
  return new;
end $$;
drop trigger if exists final_docs_guard on public.final_documents;
create trigger final_docs_guard before insert on public.final_documents for each row execute function public.final_docs_guard();

-- Las versiones de modelos se numeran en orden.
create or replace function public.template_versions_guard() returns trigger
language plpgsql as $$
begin
  if new.version <> (select coalesce(max(version), 0) + 1 from public.template_versions where template_id = new.template_id) then
    raise exception 'Numeración de versión de modelo inválida.';
  end if;
  return new;
end $$;
drop trigger if exists template_versions_guard on public.template_versions;
create trigger template_versions_guard before insert on public.template_versions for each row execute function public.template_versions_guard();

-- Nadie se otorga a sí mismo permisos de administrador.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id = auth.uid()::text and (new.role <> old.role or new.active is distinct from old.active) then
    raise exception 'No puede modificar su propio rol ni desactivarse.';
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- ---------- RLS ----------

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.employees enable row level security;
alter table public.measure_types enable row level security;
alter table public.situation_types enable row level security;
alter table public.files enable row level security;
alter table public.templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.policy enable row level security;
alter table public.requests enable row level security;
alter table public.request_revisions enable row level security;
alter table public.final_documents enable row level security;
alter table public.audit_events enable row level security;
alter table public.notifications enable row level security;
alter table public.gestiones enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;
alter table public.headcount enable row level security;
alter table public.vacancies enable row level security;

-- Catálogos: lectura para usuarios activos; escritura sólo administradores de RH.
do $$ declare t text; begin
  foreach t in array array['profiles','stores','measure_types','situation_types','templates','template_versions','policy'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (public.me() is not null)', t, t);
    execute format('drop policy if exists %I_admin_ins on public.%I', t, t);
    execute format('create policy %I_admin_ins on public.%I for insert to authenticated with check (public.is_admin())', t, t);
  end loop;
  foreach t in array array['profiles','stores','measure_types','situation_types','templates','policy'] loop
    execute format('drop policy if exists %I_admin_upd on public.%I', t, t);
    execute format('create policy %I_admin_upd on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;
-- Los gerentes sólo ven modelos activos.
drop policy if exists templates_read on public.templates;
create policy templates_read on public.templates for select to authenticated
  using (public.me() is not null and (active or public.my_role() <> 'gerente'));

-- Colaboradores: el gerente ve los de sus tiendas; RH ve todos.
drop policy if exists employees_read on public.employees;
create policy employees_read on public.employees for select to authenticated
  using (public.my_role() in ('coordinador','admin_rh') or store_id = any((public.me()).store_ids));
drop policy if exists employees_admin on public.employees;
create policy employees_admin on public.employees for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Archivos: cualquiera sube a su nombre; lectura para usuarios activos (los ids no son adivinables).
drop policy if exists files_read on public.files;
create policy files_read on public.files for select to authenticated using (public.me() is not null);
drop policy if exists files_ins on public.files;
create policy files_ins on public.files for insert to authenticated with check (created_by = auth.uid()::text);

-- Solicitudes
drop policy if exists requests_read on public.requests;
create policy requests_read on public.requests for select to authenticated using (public.can_see_request(requests));
drop policy if exists requests_ins on public.requests;
create policy requests_ins on public.requests for insert to authenticated with check (manager_id = auth.uid()::text);
drop policy if exists requests_upd on public.requests;
create policy requests_upd on public.requests for update to authenticated using (public.can_see_request(requests)) with check (true);

drop policy if exists revisions_read on public.request_revisions;
create policy revisions_read on public.request_revisions for select to authenticated using (public.can_see_request_id(request_id));
drop policy if exists revisions_ins on public.request_revisions;
create policy revisions_ins on public.request_revisions for insert to authenticated with check (public.can_see_request_id(request_id));

drop policy if exists finals_read on public.final_documents;
create policy finals_read on public.final_documents for select to authenticated using (public.can_see_request_id(request_id));
drop policy if exists finals_ins on public.final_documents;
create policy finals_ins on public.final_documents for insert to authenticated with check (public.can_see_request_id(request_id));

-- Licencias y vacaciones
drop policy if exists gestiones_read on public.gestiones;
create policy gestiones_read on public.gestiones for select to authenticated using (public.can_see_gestion(gestiones));
drop policy if exists gestiones_ins on public.gestiones;
create policy gestiones_ins on public.gestiones for insert to authenticated with check (manager_id = auth.uid()::text);
drop policy if exists gestiones_upd on public.gestiones;
create policy gestiones_upd on public.gestiones for update to authenticated using (public.can_see_gestion(gestiones)) with check (true);

-- Headcount: todos lo leen; lo edita RH del área de la tienda.
drop policy if exists hc_read on public.headcount;
create policy hc_read on public.headcount for select to authenticated using (public.me() is not null);
drop policy if exists hc_write on public.headcount;
create policy hc_write on public.headcount for all to authenticated using (public.is_rh_of_store(store_id)) with check (public.is_rh_of_store(store_id));
-- RH del área también da de alta y baja colaboradores (al cubrir una vacante).
drop policy if exists employees_rh on public.employees;
create policy employees_rh on public.employees for all to authenticated using (public.is_rh_of_store(store_id)) with check (public.is_rh_of_store(store_id));

-- Vacantes
drop policy if exists vac_read on public.vacancies;
create policy vac_read on public.vacancies for select to authenticated using (public.can_see_vacancy(vacancies));
drop policy if exists vac_ins on public.vacancies;
create policy vac_ins on public.vacancies for insert to authenticated with check (manager_id = auth.uid()::text);
drop policy if exists vac_upd on public.vacancies;
create policy vac_upd on public.vacancies for update to authenticated using (public.can_see_vacancy(vacancies)) with check (true);

-- Cartelera: RH publica; cada gerente ve lo vigente para su área y registra su lectura.
drop policy if exists ann_read on public.announcements;
create policy ann_read on public.announcements for select to authenticated using (
  public.my_role() in ('coordinador','admin_rh')
  or (public.my_role() = 'gerente' and active and (expires_at is null or expires_at >= to_char(now(), 'YYYY-MM-DD'))
      and (cardinality(areas) = 0 or areas && (public.me()).areas)));
drop policy if exists ann_ins on public.announcements;
create policy ann_ins on public.announcements for insert to authenticated with check (
  public.my_role() in ('coordinador','admin_rh') and author_id = auth.uid()::text);
drop policy if exists ann_upd on public.announcements;
create policy ann_upd on public.announcements for update to authenticated using (
  public.my_role() in ('coordinador','admin_rh') and (author_id = auth.uid()::text or public.is_admin()))
  with check (author_id = (select a.author_id from public.announcements a where a.id = announcements.id));
drop policy if exists annr_read on public.announcement_reads;
create policy annr_read on public.announcement_reads for select to authenticated using (
  user_id = auth.uid()::text or public.my_role() in ('coordinador','admin_rh'));
drop policy if exists annr_ins on public.announcement_reads;
create policy annr_ins on public.announcement_reads for insert to authenticated with check (user_id = auth.uid()::text);

-- Auditoría: el gerente no ve observaciones internas; nadie escribe a nombre de otro.
drop policy if exists audit_read on public.audit_events;
create policy audit_read on public.audit_events for select to authenticated using (
  case when entity = 'request' then public.can_see_request_id(entity_id) and (not internal or public.my_role() <> 'gerente')
       when entity = 'announcement' then true
       when entity = 'vacancy' then public.can_see_vacancy_id(entity_id)
       when entity = 'headcount' then true
       when entity = 'gestion' then public.can_see_gestion_id(entity_id) and (not internal or public.my_role() <> 'gerente')
       else public.my_role() in ('coordinador','admin_rh') end);
drop policy if exists audit_ins on public.audit_events;
create policy audit_ins on public.audit_events for insert to authenticated with check (
  actor_id = auth.uid()::text and actor_role = public.my_role()
  and (not internal or public.my_role() <> 'gerente' or action = 'documento_descargado'));

drop policy if exists notif_read on public.notifications;
create policy notif_read on public.notifications for select to authenticated using (user_id = auth.uid()::text);
drop policy if exists notif_ins on public.notifications;
create policy notif_ins on public.notifications for insert to authenticated with check (public.me() is not null);
drop policy if exists notif_upd on public.notifications;
create policy notif_upd on public.notifications for update to authenticated using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);

-- Tiempo real
do $$ begin
  begin
    alter publication supabase_realtime add table public.requests, public.notifications, public.audit_events, public.templates, public.gestiones, public.announcements, public.vacancies, public.headcount;
  exception when others then null;
  end;
end $$;

-- ---------- Primer administrador ----------
-- 1) Crear el usuario en Authentication → Users y copiar su UID.
-- 2) Ejecutar:
-- insert into public.profiles (id, email, name, role, areas)
-- values ('<UID>', 'rrhh@empresa.com', 'Administración RH', 'admin_rh', '{"Área 1","Área 2","Área 3"}');

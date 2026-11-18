-- PRUEBA DE PERMISOS: usar SOLO en una base de prueba descartable (inserta datos ficticios).
-- Requiere un esquema "auth" con auth.uid() que lea current_setting('test.uid') — ver README.
\set ON_ERROR_STOP 1
insert into profiles values
 ('00000000-0000-0000-0000-00000000000a','admin@x','Admin','admin_rh','{}','{"Área 3"}',true),
 ('00000000-0000-0000-0000-00000000000c','c3@x','Coord 3','coordinador','{}','{"Área 3"}',true),
 ('00000000-0000-0000-0000-00000000000d','c1@x','Coord 1','coordinador','{}','{"Área 1"}',true),
 ('00000000-0000-0000-0000-00000000000e','g@x','Gerente','gerente','{s1}','{"Área 3"}',true);
insert into stores values ('s1','Suc 1','Área 3'),('s2','Suc 2','Área 1');
insert into employees values ('e1','100','Ana','Cajera','s1',null,null,true);
insert into templates (id,title,category) values ('t1','Aperc','sancion');
insert into template_versions (id,template_id,version,body,created_by,created_by_name) values ('tv1','t1',1,'{{colaborador}}','x','x');
create or replace function pg_temp.expect_error(sql text, pattern text) returns text language plpgsql as $$
begin execute sql; raise exception 'SE ESPERABA ERROR y no lo hubo: %', sql;
exception when others then
  if sqlerrm like 'SE ESPERABA%' then raise; end if;
  if sqlerrm !~* pattern then raise exception 'Error distinto (%): %', pattern, sqlerrm; end if;
  return 'ok bloqueado: ' || sqlerrm; end $$;
set role authenticated;

-- Gerente
set test.uid = '00000000-0000-0000-0000-00000000000e';
insert into requests (id, number, status, manager_id, manager_name, store_id, area) values ('r1','MD-1','borrador','00000000-0000-0000-0000-00000000000e','Gerente','s1','Área 3');
select pg_temp.expect_error($$insert into requests (id, number, status, manager_id, manager_name, store_id) values ('r2','MD-2','borrador','00000000-0000-0000-0000-00000000000e','G','s2')$$, 'tienda');
update requests set employee_id='e1', employee_name='Ana', description='hechos', template_version_id='tv1', coordinator_id='00000000-0000-0000-0000-00000000000c', revision=1 where id='r1';
insert into request_revisions (id, request_id, revision, data, rendered, template_version, created_by, created_by_name) values ('rv1','r1',1,'{}','Ana',1,'00000000-0000-0000-0000-00000000000e','G');
update requests set status='enviada', submitted_at=now() where id='r1';
select pg_temp.expect_error($$update requests set status='aprobada' where id='r1'$$, 'exclusiva');
select pg_temp.expect_error($$update requests set description='otra' where id='r1'$$, 'no admite cambios');
select pg_temp.expect_error($$insert into final_documents values ('d0','r1',1,'tv1','x',encode(digest('x','sha256'),'hex'),'00000000-0000-0000-0000-00000000000e','G',now(),null)$$, 'RH');

-- Otro coordinador: no ve la solicitud
set test.uid = '00000000-0000-0000-0000-00000000000d';
select 'coord otra área ve: ' || count(*) from requests;
select pg_temp.expect_error($$insert into final_documents values ('d1','r1',1,'tv1','x',encode(digest('x','sha256'),'hex'),'00000000-0000-0000-0000-00000000000d','C1',now(),null)$$, 'row-level|pendiente');

-- Coordinador del área
set test.uid = '00000000-0000-0000-0000-00000000000c';
select 'coord área ve: ' || count(*) from requests;
update requests set status='pendiente_revision', coordinator_name='Coord 3' where id='r1';
insert into audit_events (id, entity, entity_id, action, actor_id, actor_name, actor_role, internal, comment) values ('a1','request','r1','observacion_interna','00000000-0000-0000-0000-00000000000c','Coord 3','coordinador',true,'nota');
select pg_temp.expect_error($$insert into final_documents values ('d2','r1',1,'tv1','Ana','hash-falso','00000000-0000-0000-0000-00000000000c','C3',now(),null)$$, 'SHA');
insert into final_documents values ('d3','r1',1,'tv1','Ana',encode(digest('Ana','sha256'),'hex'),'00000000-0000-0000-0000-00000000000c','Coord 3',now(),null);
update requests set status='aprobada', approved_by='00000000-0000-0000-0000-00000000000c', approved_by_name='Coord 3', approved_revision=1, final_document_id='d3', decided_at=now() where id='r1';
update final_documents set content='otro' where id='d3';
update audit_events set comment='x' where id='a1';
delete from audit_events where id='a1';
select 'documento intacto: ' || (content = 'Ana') from final_documents where id='d3';
select 'auditoría intacta: ' || (comment = 'nota') from audit_events where id='a1';
select pg_temp.expect_error($$update requests set status='cerrada' where id='r1'$$, 'notificación');

-- Gerente después de la aprobación
set test.uid = '00000000-0000-0000-0000-00000000000e';
select 'gerente ve observaciones internas: ' || count(*) from audit_events where internal and action='observacion_interna';
select pg_temp.expect_error($$update requests set antecedentes='x' where id='r1'$$, 'rectificación');
select pg_temp.expect_error($$update requests set approved_by=null where id='r1'$$, 'aprobación');
update requests set notified_at=now() where id='r1';
set test.uid = '00000000-0000-0000-0000-00000000000c';
update requests set status='cerrada', closed_at=now() where id='r1';
select pg_temp.expect_error($$update requests set status='borrador' where id='r1'$$, 'Transición');
select 'eventos automáticos de estado: ' || count(*) from audit_events where action='cambio_estado_db';

-- Administrador: no puede autoaprobarse ni quitarse el rol
set test.uid = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect_error($$update profiles set role='gerente' where id='00000000-0000-0000-0000-00000000000a'$$, 'propio rol');
set test.uid = '00000000-0000-0000-0000-00000000000c';
update policy set restrict_to_area=false;
select 'coord cambió política: ' || (select count(*) from policy where restrict_to_area=false);

-- ===== Licencias y vacaciones =====
set test.uid = '00000000-0000-0000-0000-00000000000e';
insert into gestiones (id, number, kind, status, manager_id, manager_name, employee_id, employee_name, legajo, store_id, store_name, area, leave_type, start_date, end_date)
values ('g1','LIC-1','licencia','pendiente_certificado','00000000-0000-0000-0000-00000000000e','Gerente','e1','Ana','100','s1','Suc 1','Área 3','enfermedad','2026-11-16','2026-11-18');
select pg_temp.expect_error($$insert into gestiones (id, number, kind, status, manager_id, manager_name, employee_id, employee_name, legajo, store_id, store_name, area) values ('g2','LIC-2','licencia','enviada','00000000-0000-0000-0000-00000000000e','G','e1','Ana','100','s2','Suc 2','Área 1')$$, 'tienda');
select pg_temp.expect_error($$update gestiones set status='recibida' where id='g1'$$, 'Transición|RH');
update gestiones set attachments='[{"file_id":"f","role":"certificado"}]', status='enviada', submitted_at=now() where id='g1';
select pg_temp.expect_error($$update gestiones set status='recibida' where id='g1'$$, 'RH');
set test.uid = '00000000-0000-0000-0000-00000000000d';
select 'coord otra área ve gestiones: ' || count(*) from gestiones;
set test.uid = '00000000-0000-0000-0000-00000000000c';
update gestiones set status='recibida' where id='g1';
select 'recibida por: ' || reviewed_by from gestiones where id='g1';
set test.uid = '00000000-0000-0000-0000-00000000000e';
select pg_temp.expect_error($$update gestiones set notes='cambio' where id='g1'$$, 'no pueden modificarse');
update gestiones set status='cerrada', return_date='2026-11-19' where id='g1';
select pg_temp.expect_error($$update gestiones set status='anulada' where id='g1'$$, 'cerrada');

-- ===== Cartelera =====
set test.uid = '00000000-0000-0000-0000-00000000000c';
insert into announcements (id, title, body, areas, author_id, author_name) values ('a1','Cierre','Texto','{"Área 3"}','00000000-0000-0000-0000-00000000000c','Coord 3');
insert into announcements (id, title, body, areas, author_id, author_name) values ('a2','Sólo Área 1','Texto','{"Área 1"}','00000000-0000-0000-0000-00000000000c','Coord 3');
set test.uid = '00000000-0000-0000-0000-00000000000e';
select 'gerente Área 3 ve comunicados: ' || string_agg(id, ',') from announcements;
select pg_temp.expect_error($$insert into announcements (id, title, body, author_id, author_name) values ('a3','x','x','00000000-0000-0000-0000-00000000000e','G')$$, 'row-level');
insert into announcement_reads (id, announcement_id, user_id, user_name) values ('a1:g','a1','00000000-0000-0000-0000-00000000000e','G');
select pg_temp.expect_error($$insert into announcement_reads (id, announcement_id, user_id, user_name) values ('a1:c','a1','00000000-0000-0000-0000-00000000000c','C')$$, 'row-level');
set test.uid = '00000000-0000-0000-0000-00000000000d';
update announcements set title='editado por otro' where id='a1';
select 'otro coordinador no pudo editar: ' || (title = 'Cierre') from announcements where id='a1';

// Solicitudes de ejemplo para el modo demostración, en distintos estados del circuito.
import { emptyRequestData } from './service';
import { employees, measureTypes, profiles, situationTypes, stores } from './seed';
import { renderForRequest, sha256 } from './template';
import type {
  AuditEvent, DisciplinaryRequest, FinalDocument, Notification, RequestData, RequestRevision, RequestStatus, TemplateVersion,
} from './types';

const ago = (d: number, h = 0) => new Date(Date.now() - d * 86400000 - h * 3600000).toISOString();
const day = (d: number) => ago(d).slice(0, 10);

interface Spec {
  n: string; manager: string; emp: string; sit: number; measure: string; tpl: string; status: RequestStatus;
  incident: number; submitted?: number; description: string; antecedentes?: string; extra?: Record<string, string>;
  feedback?: string; revisions?: number;
}

const SPECS: Spec[] = [
  {
    n: 'MD-2026-1112-A41C', manager: 'u-ger310', emp: 'e-5', sit: 1, measure: 'm-apercibimiento', tpl: 't-apercibimiento', status: 'enviada', incident: 5, submitted: 3,
    description: 'El colaborador registró ingreso con demoras de entre 15 y 40 minutos los días 3, 5, 6 y 10 del corriente, según el reporte del reloj biométrico. En todos los casos no dio aviso previo a la gerencia. El 10/11 la demora obligó a abrir la caja 2 con una sola persona en la línea durante el pico de la mañana.',
    antecedentes: 'Llamado de atención verbal el 20/09 por la misma causa, registrado en el acta de reunión de equipo.',
  },
  {
    n: 'MD-2026-1108-B7D2', manager: 'u-ger310', emp: 'e-11', sit: 5, measure: 'm-suspension', tpl: 't-suspension', status: 'requiere_modificaciones', incident: 9, submitted: 7,
    description: 'Al realizar el arqueo de cierre del turno tarde, la caja a cargo de la colaboradora presentó un faltante de $85.400. Se revisó el registro de operaciones y no se encontraron anulaciones ni devoluciones que lo justifiquen. Estuvieron presentes el encargado de turno y la cajera del turno siguiente.',
    antecedentes: 'Apercibimiento del 02/06 por diferencia de caja.', extra: { dias_suspension: '3', fecha_inicio_suspension: day(-3), fecha_reintegro: day(-6) },
    feedback: 'Falta adjuntar el acta de arqueo firmada y la planilla de cierre. Además, aclarar si la colaboradora hizo su descargo; en caso contrario, sugiero empezar por una citación a descargo.',
  },
  {
    n: 'MD-2026-1103-C19F', manager: 'u-ger101', emp: 'e-1', sit: 2, measure: 'm-apercibimiento', tpl: 't-apercibimiento', status: 'aprobada', incident: 14, submitted: 12,
    description: 'El colaborador no se presentó a trabajar el sábado 01/11 en el turno de 8 a 16 h, ni avisó por ningún medio. Se lo llamó dos veces al teléfono registrado sin respuesta. El lunes 03/11 se presentó sin certificado ni justificación. La tienda debió cubrir el turno con horas extra de otro colaborador.',
    antecedentes: 'Sin antecedentes disciplinarios.', revisions: 2,
  },
  {
    n: 'MD-2026-1114-D88E', manager: 'u-ger205', emp: 'e-3', sit: 4, measure: 'm-llamado', tpl: 't-llamado', status: 'borrador', incident: 2,
    description: 'No realizó el control de vencimientos de la góndola de',
  },
  {
    n: 'MD-2026-1020-E03A', manager: 'u-ger310', emp: 'e-17', sit: 4, measure: 'm-llamado', tpl: 't-llamado', status: 'cerrada', incident: 30, submitted: 28,
    description: 'Durante la recepción de mercadería del 17/10 el colaborador firmó el remito sin controlar los bultos contra la factura. Al día siguiente se detectó un faltante de dos cajas de dermocosmética que ya no pudo reclamarse al proveedor por haberse dado conformidad.',
  },
];

export function buildDemoRequests(versions: TemplateVersion[]) {
  const requests: DisciplinaryRequest[] = [];
  const revisions: RequestRevision[] = [];
  const docs: Promise<FinalDocument>[] = [];
  const events: AuditEvent[] = [];
  const notifications: Notification[] = [];

  const ev = (r: DisciplinaryRequest, actor: string, at: string, action: string, extra: Partial<AuditEvent> = {}) => {
    const p = profiles.find((x) => x.id === actor)!;
    events.push({
      id: `ev-${r.number}-${events.length}`, entity: 'request', entity_id: r.id, action, actor_id: p.id, actor_name: p.name,
      actor_role: p.role, at, internal: false, ...extra,
    });
  };

  for (const s of SPECS) {
    const mgr = profiles.find((p) => p.id === s.manager)!;
    const e = employees.find((x) => x.id === s.emp)!;
    const st = stores.find((x) => x.id === (mgr.store_ids.includes(e.store_id) ? e.store_id : mgr.store_ids[0]))!;
    const emp = { ...e, store_id: st.id };
    const m = measureTypes.find((x) => x.id === s.measure)!;
    const sit = situationTypes[s.sit - 1];
    const tv = versions.filter((v) => v.template_id === s.tpl).sort((a, b) => b.version - a.version)[0];
    const coord = profiles.find((p) => p.role === 'coordinador' && p.areas.includes(st.area))!;
    const data: RequestData = {
      ...emptyRequestData(), employee_id: emp.id, employee_name: emp.name, legajo: emp.legajo, position: emp.position,
      store_id: st.id, store_name: st.name, area: st.area, incident_date: day(s.incident), situation_type_id: sit.id,
      situation_type_name: sit.name, measure_type_id: m.id, measure_type_name: m.name, template_id: s.tpl,
      template_version_id: tv.id, description: s.description, antecedentes: s.antecedentes ?? '', extra: s.extra ?? {},
    };
    const submitted = s.submitted !== undefined;
    const nrev = submitted ? s.revisions ?? 1 : 0;
    const r: DisciplinaryRequest = {
      ...data, id: `r-${s.n}`, number: s.n, status: s.status, manager_id: mgr.id, manager_name: mgr.name,
      coordinator_id: submitted ? coord.id : null, coordinator_name: submitted ? coord.name : null, revision: nrev,
      created_at: ago(s.submitted ?? s.incident - 1, 3), updated_at: ago(1), submitted_at: submitted ? ago(s.submitted!) : null,
      decided_at: null, approved_by: null, approved_by_name: null, approved_at: null, approved_revision: null,
      final_document_id: null, closed_at: null, notified_at: null,
    };
    ev(r, mgr.id, r.created_at, 'creada', { to_status: 'borrador', comment: `Borrador iniciado para ${emp.name}.` });

    for (let i = 1; i <= nrev; i++) {
      const d = i === 1 && nrev > 1 ? { ...data, description: data.description.split('.').slice(0, 2).join('.') + '.' } : data;
      const at = ago(s.submitted! - (i - 1));
      revisions.push({
        id: `rev-${s.n}-${i}`, request_id: r.id, revision: i, data: d,
        rendered: renderForRequest(tv.body, tv.fields, { ...d, number: r.number, manager_name: mgr.name }, { final: false, issued_at: at }),
        template_version: tv.version, created_by: mgr.id, created_by_name: mgr.name, created_at: at,
        reason: i === 1 ? 'Envío inicial a RH.' : 'Se amplía la descripción de los hechos según lo pedido por RH.',
      });
      ev(r, mgr.id, at, i === 1 ? 'enviada' : 'reenviada', { from_status: i === 1 ? 'borrador' : 'requiere_modificaciones', to_status: 'enviada', revision: i, comment: i === 1 ? 'Envío inicial a RH.' : 'Se amplía la descripción.' });
      ev(r, mgr.id, at, 'asignada', { revision: i, comment: `Asignada a ${coord.name} (${st.area}).` });
      if (i < nrev) {
        ev(r, coord.id, ago(s.submitted! - i, 2), 'tomada', { from_status: 'enviada', to_status: 'pendiente_revision', revision: i });
        ev(r, coord.id, ago(s.submitted! - i, 1), 'observacion_interna', { revision: i, internal: true, comment: 'Revisar si corresponde apercibimiento o llamado de atención: primera falta.' });
        ev(r, coord.id, ago(s.submitted! - i), 'modificaciones_solicitadas', { from_status: 'pendiente_revision', to_status: 'requiere_modificaciones', revision: i, comment: 'Detallar los llamados telefónicos realizados y el impacto en la operación.' });
      }
    }

    if (s.status === 'requiere_modificaciones') {
      ev(r, coord.id, ago(s.submitted! - 1, 3), 'tomada', { from_status: 'enviada', to_status: 'pendiente_revision', revision: nrev });
      ev(r, coord.id, ago(s.submitted! - 1, 2), 'observacion_interna', { revision: nrev, internal: true, comment: 'Segundo faltante en el año. Consultar a Legales antes de suspender.' });
      ev(r, coord.id, ago(s.submitted! - 1), 'modificaciones_solicitadas', { from_status: 'pendiente_revision', to_status: 'requiere_modificaciones', revision: nrev, comment: s.feedback });
      r.decided_at = ago(s.submitted! - 1);
      notifications.push({ id: `n-${s.n}`, user_id: mgr.id, request_id: r.id, message: `${r.number}: RH solicita modificaciones. ${s.feedback}`, read: false, at: r.decided_at });
    }
    if (s.status === 'enviada') {
      notifications.push({ id: `n-${s.n}`, user_id: coord.id, request_id: r.id, message: `${mgr.name} envió ${r.number} (${m.name} – ${emp.name}) para su aprobación.`, read: false, at: r.submitted_at! });
    }
    if (s.status === 'aprobada' || s.status === 'cerrada') {
      const at = ago(s.submitted! - nrev, 2);
      const content = renderForRequest(tv.body, tv.fields, { ...data, number: r.number, manager_name: mgr.name }, { final: true, approved_by_name: coord.name, issued_at: at });
      const id = `doc-${s.n}`;
      docs.push(sha256(content).then((h) => ({
        id, request_id: r.id, revision: nrev, template_version_id: tv.id, content, sha256: h,
        approved_by: coord.id, approved_by_name: coord.name, approved_at: at, docx_file_id: null,
      })));
      Object.assign(r, { approved_by: coord.id, approved_by_name: coord.name, approved_at: at, approved_revision: nrev, final_document_id: id, decided_at: at });
      ev(r, coord.id, ago(s.submitted! - nrev, 3), 'tomada', { from_status: 'enviada', to_status: 'pendiente_revision', revision: nrev });
      ev(r, coord.id, at, 'aprobada', { from_status: 'pendiente_revision', to_status: 'aprobada', revision: nrev, comment: `Aprobada la versión ${nrev}.` });
    }
    if (s.status === 'cerrada') {
      r.notified_at = ago(s.submitted! - 2);
      r.closed_at = ago(s.submitted! - 3);
      ev(r, mgr.id, r.notified_at, 'notificada', { revision: nrev, comment: `Notificada al colaborador el ${r.notified_at.slice(0, 10)}. Firmó en conformidad.` });
      ev(r, coord.id, r.closed_at, 'cerrada', { from_status: 'aprobada', to_status: 'cerrada', revision: nrev, comment: 'Original firmado recibido y archivado en el legajo.' });
    }
    r.updated_at = events.filter((x) => x.entity_id === r.id).reduce((m, x) => (x.at > m ? x.at : m), r.created_at);
    requests.push(r);
  }
  return Promise.all(docs).then((final_documents) => ({
    requests, request_revisions: revisions, final_documents, audit_events: events, notifications,
  }));
}

// Solicitudes de ejemplo para el modo demostración, en distintos estados del circuito.
import { emptyRequestData } from './service';
import { employees, measureTypes, profiles, situationTypes, stores } from './seed';
import { renderForRequest, sha256 } from './template';
import type {
  Vacancy,
  Announcement, AnnouncementRead, Gestion, StoredFile,
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

/* ---------- Licencias y vacaciones de ejemplo ---------- */

/** PDF mínimo válido con una línea de texto (sirve como "certificado" o "notificación firmada" de muestra). */
function samplePdf(text: string) {
  const content = `BT /F1 14 Tf 72 760 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return btoa(pdf);
}

/** Próximo lunes a partir de hoy + n días. */
function mondayAfter(n: number) {
  const x = new Date(Date.now() + n * 86400000);
  while (x.getUTCDay() !== 1) x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}
const plus = (iso: string, n: number) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);

export function buildDemoGestiones(versions: TemplateVersion[]) {
  const tv = versions.filter((v) => v.template_id === 't-vacaciones').sort((a, b) => b.version - a.version)[0];
  const gestiones: Gestion[] = [];
  const files: StoredFile[] = [];
  const events: AuditEvent[] = [];
  const notifications: Notification[] = [];
  const P = (id: string) => profiles.find((p) => p.id === id)!;

  const make = (n: string, kind: Gestion['kind'], mgrId: string, empId: string, extra: Partial<Gestion>): Gestion => {
    const mgr = P(mgrId);
    const e = employees.find((x) => x.id === empId)!;
    const st = stores.find((x) => x.id === (mgr.store_ids.includes(e.store_id) ? e.store_id : mgr.store_ids[0]))!;
    const coord = profiles.find((p) => p.role === 'coordinador' && p.areas.includes(st.area))!;
    return {
      id: `g-${n}`, number: n, kind, status: 'enviada', manager_id: mgr.id, manager_name: mgr.name,
      coordinator_id: coord.id, coordinator_name: coord.name, employee_id: e.id, employee_name: e.name, legajo: e.legajo,
      position: e.position, hire_date: e.hire_date ?? '', store_id: st.id, store_name: st.name, area: st.area,
      start_date: '', end_date: '', days: 0, leave_type: '', leave_type_name: '', notice_date: '', period_year: 0,
      template_version_id: kind === 'vacaciones' ? tv.id : '', notes: '', attachments: [],
      created_at: ago(2), updated_at: ago(1), submitted_at: null, reviewed_by: null, reviewed_by_name: null, reviewed_at: null, return_date: null,
      ...extra,
    };
  };
  const file = (id: string, name: string, text: string, by: string) => {
    const data = samplePdf(text);
    files.push({ id, name, mime: 'application/pdf', size: Math.round((data.length * 3) / 4), data, created_at: ago(1), created_by: by });
    return { file_id: id, name, size: Math.round((data.length * 3) / 4), mime: 'application/pdf', uploaded_at: ago(1), uploaded_by: P(by).name };
  };
  const ev = (g: Gestion, actor: string, at: string, action: string, extra: Partial<AuditEvent> = {}) => {
    const p = P(actor);
    events.push({ id: `ev-${g.number}-${events.length}`, entity: 'gestion', entity_id: g.id, action, actor_id: p.id, actor_name: p.name, actor_role: p.role, at, internal: false, ...extra });
  };

  // 1. Licencia por enfermedad sin certificado (vencido el plazo).
  const l1 = make('LIC-2026-1113-7Q2M', 'licencia', 'u-ger310', 'e-5', {
    status: 'pendiente_certificado', leave_type: 'enfermedad', leave_type_name: 'Enfermedad inculpable',
    start_date: day(5), end_date: day(1), notice_date: day(5), notes: 'Avisó por WhatsApp a las 7:40 que no venía por fiebre.', created_at: ago(5), updated_at: ago(5),
  });
  l1.days = 5;
  ev(l1, 'u-ger310', l1.created_at, 'creada', { to_status: 'pendiente_certificado' as never, comment: `Aviso de licencia (Enfermedad inculpable) para ${l1.employee_name}.` });
  notifications.push({ id: 'n-l1', user_id: 'u-coord3', request_id: null, link: `/gestiones/${l1.id}`, message: `Valeria Sosa avisó una licencia: ${l1.employee_name} (${l1.store_name}), Enfermedad inculpable. Falta el certificado.`, read: false, at: l1.created_at });

  // 2. Licencia con certificado, enviada a RH.
  const l2 = make('LIC-2026-1116-K8D1', 'licencia', 'u-ger310', 'e-11', {
    status: 'enviada', leave_type: 'enfermedad', leave_type_name: 'Enfermedad inculpable', start_date: day(2), end_date: plus(day(2), 4),
    notice_date: day(2), days: 5, submitted_at: ago(1),
  });
  l2.attachments = [{ ...file('f-cert-l2', 'certificado-medico.pdf', `Certificado medico - ${l2.employee_name} - reposo 5 dias`, 'u-ger310'), role: 'certificado' }];
  ev(l2, 'u-ger310', ago(2), 'creada', { to_status: 'pendiente_certificado' as never, comment: `Aviso de licencia para ${l2.employee_name}.` });
  ev(l2, 'u-ger310', ago(1), 'enviada', { from_status: 'pendiente_certificado' as never, to_status: 'enviada' as never, comment: 'Adjuntó: certificado-medico.pdf.' });
  notifications.push({ id: 'n-l2', user_id: 'u-coord3', request_id: null, link: `/gestiones/${l2.id}`, message: `Valeria Sosa envió el certificado de la licencia de ${l2.employee_name}.`, read: false, at: ago(1) });

  // 3. Vacaciones generadas, falta la notificación firmada.
  const s3 = mondayAfter(60);
  const v1 = make('VAC-2026-1117-P4ZT', 'vacaciones', 'u-ger310', 'e-17', { status: 'pendiente_firma', start_date: s3, end_date: plus(s3, 13), days: 14, period_year: 2026 });
  ev(v1, 'u-ger310', v1.created_at, 'creada', { to_status: 'pendiente_firma' as never, comment: `Vacaciones del ${s3} (14 días) para ${v1.employee_name}.` });

  // 4. Vacaciones con la notificación firmada, enviadas a RH.
  const s4 = mondayAfter(50);
  const v2 = make('VAC-2026-1110-W2HE', 'vacaciones', 'u-ger101', 'e-7', { status: 'enviada', start_date: s4, end_date: plus(s4, 20), days: 21, period_year: 2026, submitted_at: ago(1) });
  v2.attachments = [{ ...file('f-firm-v2', 'notificacion-vacaciones-firmada.pdf', `Notificacion de vacaciones firmada - ${v2.employee_name}`, 'u-ger101'), role: 'firmada' }];
  ev(v2, 'u-ger101', ago(3), 'creada', { to_status: 'pendiente_firma' as never, comment: `Vacaciones del ${s4} (21 días) para ${v2.employee_name}.` });
  ev(v2, 'u-ger101', ago(1), 'enviada', { from_status: 'pendiente_firma' as never, to_status: 'enviada' as never, comment: 'Adjuntó: notificacion-vacaciones-firmada.pdf.' });
  notifications.push({ id: 'n-v2', user_id: 'u-coord1', request_id: null, link: `/gestiones/${v2.id}`, message: `Sofía Álvarez envió la notificación de vacaciones firmada de ${v2.employee_name}.`, read: false, at: ago(1) });

  // 5. Licencia recibida por RH.
  const l3 = make('LIC-2026-1104-M5RA', 'licencia', 'u-ger205', 'e-3', {
    status: 'recibida', leave_type: 'matrimonio', leave_type_name: 'Matrimonio', start_date: day(12), end_date: plus(day(12), 9), days: 10,
    notice_date: day(30), submitted_at: ago(13), reviewed_by: 'u-coord2', reviewed_by_name: 'Paula Gómez', reviewed_at: ago(11), created_at: ago(13), updated_at: ago(11),
  });
  l3.attachments = [{ ...file('f-acta-l3', 'acta-matrimonio.pdf', `Acta de matrimonio - ${l3.employee_name}`, 'u-ger205'), role: 'certificado' }];
  ev(l3, 'u-ger205', ago(13), 'creada', { to_status: 'enviada' as never, comment: 'Aviso de licencia por matrimonio con acta adjunta.' });
  ev(l3, 'u-coord2', ago(11), 'recibida', { from_status: 'enviada' as never, to_status: 'recibida' as never, comment: 'Recibida y conforme. Cargada en novedades.' });

  gestiones.push(l1, l2, v1, v2, l3);
  return { gestiones, files, audit_events: events, notifications };
}

/* ---------- Comunicados de ejemplo ---------- */

export function buildDemoAnnouncements(): { announcements: Announcement[]; announcement_reads: AnnouncementRead[] } {
  const announcements: Announcement[] = [
    {
      id: 'ann-demo-1', title: 'Cierre de novedades de noviembre: viernes 21 a las 12 h',
      body: 'Recordamos que el viernes 21/11 a las 12 h cierra la carga de novedades para la liquidación de noviembre.\n\nAntes de esa hora: licencias con su certificado, vacaciones con la notificación firmada y horas extra autorizadas. Lo que llegue después pasa a diciembre.',
      priority: 'urgente', areas: [], pinned: true, active: true, author_id: 'u-coord3', author_name: 'Christian Pérez',
      published_at: ago(1), updated_at: ago(1), expires_at: day(-4), attachments: [],
    },
    {
      id: 'ann-demo-2', title: 'Nuevo modelo de notificación de vacaciones',
      body: 'Desde hoy las vacaciones se cargan en el portal: "Cargar vacaciones" genera la notificación con el modelo vigente. Hacela firmar por el colaborador con 45 días de anticipación y subí la copia firmada.',
      priority: 'importante', areas: [], pinned: false, active: true, author_id: 'u-coord1', author_name: 'Martín Ríos',
      published_at: ago(3), updated_at: ago(3), expires_at: null, attachments: [],
    },
    {
      id: 'ann-demo-3', title: 'Área 3: capacitación de Venta por Obras Sociales en Academia',
      body: 'Ya está disponible en Academia Farmatodo el curso "Venta por Obras Sociales". Pedimos que todo el equipo lo complete antes de fin de mes. Cualquier problema de acceso, avisen a su coordinador.',
      priority: 'normal', areas: ['Área 3'], pinned: false, active: true, author_id: 'u-coord3', author_name: 'Christian Pérez',
      published_at: ago(6), updated_at: ago(6), expires_at: null, attachments: [],
    },
  ];
  const announcement_reads: AnnouncementRead[] = [
    { id: 'ann-demo-2:u-ger101', announcement_id: 'ann-demo-2', user_id: 'u-ger101', user_name: 'Sofía Álvarez', at: ago(2) },
    { id: 'ann-demo-3:u-ger310', announcement_id: 'ann-demo-3', user_id: 'u-ger310', user_name: 'Valeria Sosa', at: ago(5) },
  ];
  return { announcements, announcement_reads };
}

/* ---------- Vacantes de ejemplo ---------- */

export function buildDemoVacancies(): { vacancies: Vacancy[]; audit_events: AuditEvent[]; notifications: Notification[] } {
  const vacancies: Vacancy[] = [];
  const audit_events: AuditEvent[] = [];
  const notifications: Notification[] = [];
  const P = (id: string) => profiles.find((p) => p.id === id)!;
  const ev = (v: Vacancy, actor: string, at: string, action: string, to: string | null, comment: string, from: string | null = null) => {
    const p = P(actor);
    audit_events.push({ id: `ev-${v.number}-${audit_events.length}`, entity: 'vacancy', entity_id: v.id, action, actor_id: p.id, actor_name: p.name, actor_role: p.role, at, internal: false, from_status: from as never, to_status: to as never, comment });
  };
  const base = (n: string, mgr: string, storeId: string, position: string, extra: Partial<Vacancy>): Vacancy => {
    const st = stores.find((s) => s.id === storeId)!;
    const am = profiles.find((p) => p.role === 'gerente_area' && p.areas.includes(st.area))!;
    const co = profiles.find((p) => p.role === 'coordinador' && p.areas.includes(st.area))!;
    return {
      id: `vac-${n}`, number: n, status: 'pendiente_area', store_id: st.id, store_name: st.name, area: st.area, position, shift: 'Mañana', workday: 'completa',
      reason: 'nueva', replaced_employee_id: '', replaced_employee_name: '', leaving_reason: '', leaving_date: '', needed_by: day(-20), profile_notes: '',
      manager_id: mgr, manager_name: P(mgr).name, area_manager_id: am.id, area_manager_name: am.name, area_decided_at: null,
      coordinator_id: co.id, coordinator_name: co.name, candidate_name: '', candidate_legajo: '', hire_date: '',
      created_at: ago(1), updated_at: ago(1), closed_at: null, ...extra,
    };
  };

  // 1. Recién pedida: espera al gerente de área.
  const v1 = base('VTE-2026-1117-R7KQ', 'u-ger310', 's-310', 'Repositor/a', { created_at: ago(1), profile_notes: 'Turno mañana, para reposición y recepción de mercadería. Disponibilidad sábados.' });
  ev(v1, 'u-ger310', v1.created_at, 'vacante_solicitada', 'pendiente_area', 'Repositor/a · Sucursal 310. Posición disponible dentro del headcount.');
  notifications.push({ id: 'n-vte1', user_id: 'u-ga3', request_id: null, link: `/vacantes/${v1.id}`, message: `Valeria Sosa solicita una vacante de Repositor/a en ${v1.store_name}. Espera tu autorización.`, read: false, at: v1.created_at });

  // 2. Reemplazo en entrevistas.
  const g = employees.find((e) => e.id === 'e-13')!;
  const v2 = base('VTE-2026-1104-M2LD', 'u-ger101', 's-101', g.position, {
    status: 'entrevistas', reason: 'reemplazo', replaced_employee_id: g.id, replaced_employee_name: g.name, leaving_reason: 'Renuncia', leaving_date: day(-6),
    created_at: ago(14), updated_at: ago(2), area_decided_at: ago(13), shift: 'Tarde',
  });
  ev(v2, 'u-ger101', ago(14), 'vacante_solicitada', 'pendiente_area', `${g.position} · Sucursal 101. Reemplazo de ${g.name} (Renuncia).`);
  ev(v2, 'u-ga1', ago(13), 'vacante_autorizada', 'autorizada', 'Autorizada. Priorizar disponibilidad horaria de tarde.', 'pendiente_area');
  ev(v2, 'u-coord1', ago(11), 'vacante_etapa', 'en_busqueda', 'Publicada en Bumeran, Computrabajo y LinkedIn. Pedimos referidos al equipo.', 'autorizada');
  ev(v2, 'u-coord1', ago(7), 'novedad', null, '38 postulantes. Preseleccionamos 6 para entrevista telefónica.');
  ev(v2, 'u-coord1', ago(4), 'vacante_etapa', 'entrevistas', 'Entrevistas presenciales el jueves y viernes con la gerente de la tienda.', 'en_busqueda');
  ev(v2, 'u-coord1', ago(2), 'novedad', null, 'Quedan 2 finalistas. Definimos el lunes.');

  // 3. Reemplazo en preocupacional, con candidata elegida.
  const f = employees.find((e) => e.id === 'e-6')!;
  const v3 = base('VTE-2026-1028-B9TE', 'u-ger310', 's-311', f.position, {
    status: 'preocupacional', reason: 'reemplazo', replaced_employee_id: f.id, replaced_employee_name: f.name, leaving_reason: 'Traslado a otra tienda', leaving_date: day(-3),
    created_at: ago(21), updated_at: ago(1), area_decided_at: ago(20), candidate_name: 'María Laura Quiroga',
  });
  ev(v3, 'u-ger310', ago(21), 'vacante_solicitada', 'pendiente_area', `${f.position} · Sucursal 311. Reemplazo de ${f.name} (Traslado a otra tienda).`);
  ev(v3, 'u-ga3', ago(20), 'vacante_autorizada', 'autorizada', 'Autorizada.', 'pendiente_area');
  ev(v3, 'u-coord3', ago(18), 'vacante_etapa', 'en_busqueda', 'Búsqueda publicada. Farmacéutico/a con matrícula provincial vigente.', 'autorizada');
  ev(v3, 'u-coord3', ago(10), 'vacante_etapa', 'entrevistas', '4 candidatos con matrícula. Entrevistas con Valeria y la DT.', 'en_busqueda');
  ev(v3, 'u-coord3', ago(3), 'vacante_etapa', 'preocupacional', 'Elegida: María Laura Quiroga. Turno de preocupacional el miércoles; pedimos documentación y matrícula.', 'entrevistas');
  ev(v3, 'u-coord3', ago(1), 'novedad', null, 'Preocupacional realizado. Esperamos el resultado (48 h).');

  // 4. Rechazada por el gerente de área.
  const v4 = base('VTE-2026-1112-Z1PA', 'u-ger205', 's-205', 'Repositor/a', { status: 'rechazada', created_at: ago(6), updated_at: ago(5), area_decided_at: ago(5), closed_at: ago(5) });
  ev(v4, 'u-ger205', ago(6), 'vacante_solicitada', 'pendiente_area', 'Repositor/a · Sucursal 205. Posición disponible dentro del headcount.');
  ev(v4, 'u-ga2', ago(5), 'vacante_rechazada', 'rechazada', 'Por ahora no: el volumen de la tienda no lo justifica. Lo revemos en enero.', 'pendiente_area');

  vacancies.push(v1, v2, v3, v4);
  return { vacancies, audit_events, notifications };
}

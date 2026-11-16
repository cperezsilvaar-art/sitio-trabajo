// Reglas del circuito de aprobación. Funciones puras: se usan en la interfaz, en el servicio
// y en las pruebas. supabase/schema.sql replica las mismas reglas en la base de datos.

import type {
  DisciplinaryRequest, FieldDef, MeasureType, Policy, Profile, RequestData, RequestStatus, Store,
} from './types';

export type Action =
  | 'editar'
  | 'enviar'
  | 'tomar'
  | 'aprobar'
  | 'rechazar'
  | 'pedir_modificaciones'
  | 'cerrar'
  | 'registrar_notificacion'
  | 'rectificar'
  | 'observar'
  | 'descargar_definitivo';

/** Transiciones de estado permitidas, independientemente de quién las haga. */
export const TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  borrador: ['enviada'],
  enviada: ['pendiente_revision', 'aprobada', 'rechazada', 'requiere_modificaciones'],
  pendiente_revision: ['aprobada', 'rechazada', 'requiere_modificaciones'],
  requiere_modificaciones: ['enviada'],
  aprobada: ['cerrada', 'borrador'],
  rechazada: ['cerrada'],
  cerrada: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus) {
  return TRANSITIONS[from].includes(to);
}

/** Estados en los que el gerente puede modificar los datos. */
export const EDITABLE: RequestStatus[] = ['borrador', 'requiere_modificaciones'];
/** Estados con decisión vigente de RH: los datos quedan bloqueados. */
export const LOCKED: RequestStatus[] = ['aprobada', 'rechazada', 'cerrada'];

export function isApprover(user: Profile, policy: Policy) {
  return user.active && policy.approver_roles.includes(user.role);
}

/** ¿El usuario puede ver la solicitud? */
export function canView(user: Profile, req: DisciplinaryRequest) {
  if (user.role === 'admin_rh') return true;
  if (user.role === 'coordinador') return user.areas.includes(req.area) || req.coordinator_id === user.id;
  return req.manager_id === user.id;
}

/** Devuelve el motivo por el que no puede, o null si puede. */
export function denyReason(action: Action, user: Profile, req: DisciplinaryRequest, policy: Policy): string | null {
  if (!user.active) return 'Su usuario está desactivado.';
  if (!canView(user, req)) return 'No tiene acceso a esta solicitud.';
  const own = req.manager_id === user.id;

  switch (action) {
    case 'editar':
    case 'enviar':
      if (!own) return 'Sólo el gerente que inició la solicitud puede modificarla o enviarla.';
      if (!EDITABLE.includes(req.status)) return `La solicitud está "${req.status}" y no admite cambios.`;
      return null;
    case 'tomar':
      if (!isApprover(user, policy)) return 'Sólo usuarios autorizados de RH pueden tomar solicitudes.';
      if (req.status !== 'enviada') return 'Sólo se toman solicitudes recién enviadas.';
      if (own) return 'No puede revisar una solicitud que usted mismo inició.';
      return null;
    case 'aprobar':
    case 'rechazar':
    case 'pedir_modificaciones':
      if (!isApprover(user, policy)) return 'La decisión es exclusiva de usuarios autorizados de RH.';
      if (own) return 'Nadie puede aprobar, rechazar ni devolver su propia solicitud.';
      if (policy.restrict_to_area && user.role === 'coordinador' && !user.areas.includes(req.area)) {
        return 'La solicitud corresponde a un área que usted no cubre.';
      }
      if (req.status !== 'enviada' && req.status !== 'pendiente_revision') {
        return 'La solicitud no está pendiente de decisión.';
      }
      return null;
    case 'cerrar':
      if (user.role === 'gerente') return 'El cierre lo registra RH.';
      if (!isApprover(user, policy)) return 'Sólo RH puede cerrar solicitudes.';
      if (req.status !== 'aprobada' && req.status !== 'rechazada') return 'Sólo se cierran solicitudes decididas.';
      if (req.status === 'aprobada' && !req.notified_at) return 'Antes de cerrar, registre la notificación al colaborador.';
      return null;
    case 'registrar_notificacion':
      if (req.status !== 'aprobada') return 'Sólo se notifica una medida aprobada.';
      if (!own && !isApprover(user, policy)) return 'No puede registrar la notificación.';
      if (req.notified_at) return 'La notificación ya fue registrada.';
      return null;
    case 'rectificar':
      if (req.status !== 'aprobada') return 'Sólo se rectifica una medida aprobada que aún no fue cerrada.';
      if (req.notified_at) return 'La medida ya fue notificada: no puede rectificarse; inicie una nueva solicitud.';
      if (!own && !isApprover(user, policy)) return 'No puede rectificar esta solicitud.';
      return null;
    case 'observar':
      if (user.role === 'gerente') return 'Las observaciones internas son de RH.';
      return null;
    case 'descargar_definitivo':
      if (req.status !== 'aprobada' && req.status !== 'cerrada') return 'No hay versión definitiva: la solicitud no está aprobada.';
      if (!req.final_document_id) return 'No hay documento definitivo vigente.';
      return null;
  }
}

export function can(action: Action, user: Profile, req: DisciplinaryRequest, policy: Policy) {
  return denyReason(action, user, req, policy) === null;
}

/** Coordinador que recibe la solicitud según el área de la tienda. */
export function resolveCoordinator(area: string, policy: Policy, users: Profile[]): Profile | null {
  const routed = policy.routing[area];
  const active = users.filter((u) => u.active && u.role === 'coordinador');
  if (routed) {
    const u = active.find((x) => x.id === routed);
    if (u) return u;
  }
  return active.find((u) => u.areas.includes(area)) ?? null;
}

export interface ValidationIssue {
  field: string;
  message: string;
}

/** Valida que la solicitud tenga todo lo necesario antes de enviarla. */
export function validateRequest(
  data: RequestData,
  ctx: { measure?: MeasureType; fields: FieldDef[]; stores: Store[]; managerStoreIds: string[]; today?: string },
): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const req = (field: string, value: unknown, label: string) => {
    if (value === undefined || value === null || String(value).trim() === '') out.push({ field, message: `Falta: ${label}.` });
  };
  req('employee_id', data.employee_id, 'colaborador');
  req('legajo', data.legajo, 'legajo');
  req('store_id', data.store_id, 'tienda');
  req('incident_date', data.incident_date, 'fecha del incidente');
  req('situation_type_id', data.situation_type_id, 'tipo de situación');
  req('measure_type_id', data.measure_type_id, 'tipo de medida');
  req('template_id', data.template_id, 'modelo de documento');

  const today = ctx.today ?? new Date().toISOString().slice(0, 10);
  if (data.incident_date && data.incident_date > today) {
    out.push({ field: 'incident_date', message: 'La fecha del incidente no puede ser futura.' });
  }
  if (data.store_id && !ctx.managerStoreIds.includes(data.store_id)) {
    out.push({ field: 'store_id', message: 'La tienda no está a su cargo.' });
  }
  if ((data.description ?? '').trim().length < 80) {
    out.push({
      field: 'description',
      message: 'La descripción de los hechos debe ser detallada (al menos 80 caracteres): qué pasó, cuándo, dónde y quiénes lo presenciaron.',
    });
  }
  if (ctx.measure?.requires_antecedentes && !(data.antecedentes ?? '').trim()) {
    out.push({ field: 'antecedentes', message: `Para "${ctx.measure.name}" deben indicarse los antecedentes (o escribir "Sin antecedentes").` });
  }
  if (ctx.measure?.requires_attachment && data.attachments.length === 0) {
    out.push({ field: 'attachments', message: `Para "${ctx.measure.name}" debe adjuntarse documentación respaldatoria.` });
  }
  if (ctx.measure && !ctx.measure.active) {
    out.push({ field: 'measure_type_id', message: 'El tipo de medida elegido fue desactivado por RH.' });
  }
  for (const f of ctx.fields) {
    if (f.required) req(`extra.${f.key}`, data.extra?.[f.key], f.label.toLowerCase());
    const v = data.extra?.[f.key];
    if (v && f.type === 'select' && f.options && !f.options.includes(v)) {
      out.push({ field: `extra.${f.key}`, message: `Valor no válido para ${f.label}.` });
    }
    if (v && f.type === 'number' && Number.isNaN(Number(v))) {
      out.push({ field: `extra.${f.key}`, message: `${f.label} debe ser un número.` });
    }
  }
  return out;
}

/** Días hábiles aproximados (lunes a viernes) entre dos fechas ISO. */
export function businessDaysBetween(fromIso: string, toIso: string) {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  let n = 0;
  const d = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()));
  const end = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  while (d.getTime() < end) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

export function isOverdue(req: DisciplinaryRequest, policy: Policy, now = new Date().toISOString()) {
  if (!req.submitted_at || (req.status !== 'enviada' && req.status !== 'pendiente_revision')) return false;
  return businessDaysBetween(req.submitted_at, now) > policy.review_sla_days;
}

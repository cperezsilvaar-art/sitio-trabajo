// Reglas de licencias y vacaciones. Funciones puras: interfaz, servicio y pruebas.
// supabase/schema.sql replica los permisos y transiciones en la base.

import type { Gestion, GestionStatus, Policy, Profile } from './types';
import { LEAVE_TYPES } from './types';
import { businessDaysBetween, isApprover } from './workflow';

export const G_TRANSITIONS: Record<GestionStatus, GestionStatus[]> = {
  pendiente_certificado: ['enviada', 'anulada'],
  pendiente_firma: ['enviada', 'anulada'],
  enviada: ['recibida', 'observada', 'anulada'],
  observada: ['enviada', 'pendiente_firma', 'anulada'],
  recibida: ['cerrada', 'anulada'],
  cerrada: [],
  anulada: [],
};

/** Estados en que el gerente puede corregir datos o adjuntos. */
export const G_EDITABLE: GestionStatus[] = ['pendiente_certificado', 'pendiente_firma', 'observada'];

export type GAction = 'editar' | 'enviar' | 'revisar' | 'cerrar' | 'anular';

export function canSeeGestion(u: Profile, g: Gestion) {
  if (u.role === 'admin_rh') return true;
  if (u.role === 'coordinador') return u.areas.includes(g.area) || g.coordinator_id === u.id;
  return g.manager_id === u.id;
}

export function gDenyReason(a: GAction, u: Profile, g: Gestion, policy: Policy): string | null {
  if (!u.active) return 'Su usuario está desactivado.';
  if (!canSeeGestion(u, g)) return 'No tiene acceso a esta gestión.';
  const own = g.manager_id === u.id;
  switch (a) {
    case 'editar':
    case 'enviar':
      if (!own) return 'Sólo el gerente que la cargó puede modificarla.';
      if (!G_EDITABLE.includes(g.status)) return 'En este estado no admite cambios.';
      return null;
    case 'revisar':
      if (!isApprover(u, policy)) return 'La recepción la registra RH.';
      if (own) return 'No puede dar por recibida una gestión que usted cargó.';
      if (g.status !== 'enviada') return 'Sólo se revisan gestiones enviadas a RH.';
      return null;
    case 'cerrar':
      if (g.status !== 'recibida') return 'Primero RH debe darla por recibida.';
      if (!own && !isApprover(u, policy)) return 'No puede cerrarla.';
      return null;
    case 'anular':
      if (['cerrada', 'anulada'].includes(g.status)) return 'Ya está cerrada o anulada.';
      if (g.status === 'recibida' && !isApprover(u, policy)) return 'Ya fue recibida por RH: pedile a RH que la anule.';
      if (!own && !isApprover(u, policy)) return 'No puede anularla.';
      return null;
  }
}

export const gCan = (a: GAction, u: Profile, g: Gestion, p: Policy) => gDenyReason(a, u, g, p) === null;

/* ---------- Fechas ---------- */

const d = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
export const isoDate = (x: Date) => x.toISOString().slice(0, 10);

export function daysInclusive(from: string, to: string) {
  if (!from || !to) return 0;
  return Math.round((d(to).getTime() - d(from).getTime()) / 86400000) + 1;
}

export function addDays(iso: string, n: number) {
  const x = d(iso);
  x.setUTCDate(x.getUTCDate() + n);
  return isoDate(x);
}

/** Años de antigüedad al 31/12 del período (art. 150 LCT). */
export function seniorityYears(hireDate: string, periodYear: number) {
  if (!hireDate) return 0;
  const h = d(hireDate);
  const ref = d(`${periodYear}-12-31`);
  let y = ref.getUTCFullYear() - h.getUTCFullYear();
  if (ref.getUTCMonth() < h.getUTCMonth() || (ref.getUTCMonth() === h.getUTCMonth() && ref.getUTCDate() < h.getUTCDate())) y--;
  return Math.max(0, y);
}

/** Días corridos de vacaciones que corresponden según antigüedad (art. 150 LCT). */
export function vacationEntitlement(hireDate: string, periodYear: number) {
  const y = seniorityYears(hireDate, periodYear);
  if (y < 5) return 14;
  if (y < 10) return 21;
  if (y < 20) return 28;
  return 35;
}

/** Trabajó menos de la mitad de los días hábiles del año: corresponde 1 día cada 20 trabajados (art. 153). */
export function joinedLateInPeriod(hireDate: string, periodYear: number) {
  return !!hireDate && hireDate >= `${periodYear}-07-01` && hireDate <= `${periodYear}-12-31`;
}

export interface Check { level: 'error' | 'warn' | 'info'; field: string; message: string }

export function vacationChecks(g: Pick<Gestion, 'start_date' | 'end_date' | 'hire_date' | 'period_year'>, policy: Policy, today = isoDate(new Date())): Check[] {
  const out: Check[] = [];
  if (!g.start_date) out.push({ level: 'error', field: 'start_date', message: 'Falta la fecha de inicio.' });
  if (!g.end_date) out.push({ level: 'error', field: 'end_date', message: 'Falta la fecha de fin.' });
  if (!g.period_year) out.push({ level: 'error', field: 'period_year', message: 'Falta el período.' });
  if (!g.start_date || !g.end_date) return out;
  const days = daysInclusive(g.start_date, g.end_date);
  if (days < 1) {
    out.push({ level: 'error', field: 'end_date', message: 'La fecha de fin es anterior a la de inicio.' });
    return out;
  }
  if (d(g.start_date).getUTCDay() !== 1) {
    out.push({ level: 'warn', field: 'start_date', message: 'Las vacaciones deben comenzar un lunes, o el día hábil siguiente si es feriado (art. 151 LCT).' });
  }
  const notice = policy.vacation_notice_days ?? 45;
  const advance = daysInclusive(today, g.start_date) - 1;
  if (advance < notice) {
    out.push({ level: 'warn', field: 'start_date', message: `Se notifica con ${Math.max(advance, 0)} días de anticipación; la ley pide al menos ${notice} (art. 154 LCT). Sólo es válido si el colaborador lo pidió o está de acuerdo: dejalo aclarado en observaciones.` });
  }
  const md = g.start_date.slice(5);
  if (md > '04-30' && md < '10-01') {
    out.push({ level: 'info', field: 'start_date', message: 'Fuera del período 1/10 – 30/4 (art. 154 LCT): corresponde cuando lo pide el colaborador o por acuerdo.' });
  }
  if (g.hire_date && g.period_year) {
    const ent = vacationEntitlement(g.hire_date, g.period_year);
    if (joinedLateInPeriod(g.hire_date, g.period_year)) {
      out.push({ level: 'warn', field: 'end_date', message: 'Ingresó en el segundo semestre: le corresponde 1 día cada 20 trabajados (art. 153 LCT). Verificá los días con RH.' });
    } else if (days > ent) {
      out.push({ level: 'warn', field: 'end_date', message: `Son ${days} días y por antigüedad le corresponden ${ent} (art. 150 LCT). Si es acumulación o acuerdo, aclaralo.` });
    } else {
      out.push({ level: 'info', field: 'end_date', message: `${days} días corridos. Por antigüedad le corresponden ${ent} en el período ${g.period_year}.` });
    }
  }
  return out;
}

export function leaveRequiresCertificate(leaveType: string) {
  return LEAVE_TYPES.find((t) => t.id === leaveType)?.certificate ?? false;
}

export function leaveChecks(g: Pick<Gestion, 'leave_type' | 'start_date' | 'end_date' | 'notice_date'>): Check[] {
  const out: Check[] = [];
  if (!g.leave_type) out.push({ level: 'error', field: 'leave_type', message: 'Falta el tipo de licencia.' });
  if (!g.start_date) out.push({ level: 'error', field: 'start_date', message: 'Falta la fecha de inicio.' });
  if (!g.end_date) out.push({ level: 'error', field: 'end_date', message: 'Falta la fecha de fin (o estimada según el certificado).' });
  if (!g.notice_date) out.push({ level: 'error', field: 'notice_date', message: 'Indicá cuándo avisó el colaborador.' });
  if (g.start_date && g.end_date && daysInclusive(g.start_date, g.end_date) < 1) {
    out.push({ level: 'error', field: 'end_date', message: 'La fecha de fin es anterior a la de inicio.' });
  }
  if (g.notice_date && g.start_date && g.notice_date > addDays(g.start_date, 0) && g.leave_type === 'enfermedad') {
    out.push({ level: 'warn', field: 'notice_date', message: 'El aviso fue posterior al inicio: el colaborador debe avisar en el transcurso de la primera jornada (art. 209 LCT).' });
  }
  return out;
}

/** Licencia sin certificado pasado el plazo. */
export function certificateOverdue(g: Gestion, policy: Policy, now = new Date().toISOString()) {
  if (g.kind !== 'licencia' || g.status !== 'pendiente_certificado' || !g.start_date) return false;
  return businessDaysBetween(`${g.start_date}T00:00:00Z`, now) > (policy.certificate_days ?? 2);
}

/** Estado al que va una gestión según sus adjuntos. */
export function statusFor(g: Pick<Gestion, 'kind' | 'leave_type' | 'attachments'>): GestionStatus {
  if (g.kind === 'vacaciones') return g.attachments.some((a) => a.role === 'firmada') ? 'enviada' : 'pendiente_firma';
  if (leaveRequiresCertificate(g.leave_type) && !g.attachments.some((a) => a.role === 'certificado')) return 'pendiente_certificado';
  return 'enviada';
}

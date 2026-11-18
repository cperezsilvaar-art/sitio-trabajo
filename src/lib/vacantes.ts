// Reglas de headcount y vacantes. Funciones puras: interfaz, servicio y pruebas.
// supabase/schema.sql replica permisos y transiciones en la base.

import type { AuditEvent, Employee, Headcount, Profile, Vacancy, VacancyStatus } from './types';
import { VACANCY_STAGES } from './types';

/** Vacantes que todavía ocupan un lugar del headcount. */
export const OPEN_STATUSES: VacancyStatus[] = ['pendiente_area', 'autorizada', 'en_busqueda', 'entrevistas', 'preocupacional', 'ingreso'];
/** Etapas que maneja RH, en orden. */
export const RH_STAGES: VacancyStatus[] = ['en_busqueda', 'entrevistas', 'preocupacional', 'ingreso', 'cubierta'];

export interface Slot {
  store_id: string;
  position: string;
  authorized: number;
  /** Colaboradores activos en el puesto. */
  active: number;
  /** De esos, cuántos se van y ya tienen una vacante de reemplazo abierta. */
  leaving: number;
  /** Vacantes abiertas (en cualquier etapa antes de cubrirse). */
  open: number;
  available: number;
}

/** Disponibilidad de un puesto en una tienda. */
export function slotFor(storeId: string, position: string, hc: Headcount[], employees: Employee[], vacancies: Vacancy[]): Slot {
  const authorized = hc.find((h) => h.store_id === storeId && h.position === position)?.authorized ?? 0;
  const actives = employees.filter((e) => e.active && e.store_id === storeId && e.position === position);
  const open = vacancies.filter((v) => v.store_id === storeId && v.position === position && OPEN_STATUSES.includes(v.status));
  const leaving = actives.filter((e) => open.some((v) => v.reason === 'reemplazo' && v.replaced_employee_id === e.id)).length;
  const available = authorized - (actives.length - leaving) - open.length;
  return { store_id: storeId, position, authorized, active: actives.length, leaving, open: open.length, available };
}

/** Todos los puestos con headcount o con gente en una tienda. */
export function slotsForStore(storeId: string, hc: Headcount[], employees: Employee[], vacancies: Vacancy[]): Slot[] {
  const positions = new Set([
    ...hc.filter((h) => h.store_id === storeId).map((h) => h.position),
    ...employees.filter((e) => e.active && e.store_id === storeId).map((e) => e.position),
  ]);
  return [...positions].sort().map((p) => slotFor(storeId, p, hc, employees, vacancies));
}

/**
 * ¿Se puede pedir esta vacante? Un reemplazo de alguien activo libera su lugar;
 * una posición nueva necesita lugar disponible en el headcount.
 */
export function canRequest(
  v: Pick<Vacancy, 'store_id' | 'position' | 'reason' | 'replaced_employee_id'>,
  hc: Headcount[], employees: Employee[], vacancies: Vacancy[],
): { ok: boolean; reason?: string; slot: Slot } {
  const slot = slotFor(v.store_id, v.position, hc, employees, vacancies);
  if (slot.authorized === 0) return { ok: false, slot, reason: 'Ese puesto no tiene headcount autorizado en la tienda. Consultá con RH.' };
  if (v.reason === 'reemplazo') {
    if (!v.replaced_employee_id) return { ok: false, slot, reason: 'Indicá a quién se reemplaza.' };
    const e = employees.find((x) => x.id === v.replaced_employee_id);
    if (!e || e.store_id !== v.store_id) return { ok: false, slot, reason: 'El colaborador a reemplazar no es de esta tienda.' };
    if (e.position !== v.position) return { ok: false, slot, reason: `${e.name} no ocupa el puesto ${v.position}.` };
    const already = vacancies.find((x) => OPEN_STATUSES.includes(x.status) && x.replaced_employee_id === e.id);
    if (already) return { ok: false, slot, reason: `Ya hay una vacante abierta para reemplazar a ${e.name} (${already.number}).` };
    // Si ya se fue (inactivo), su lugar ya figura libre en "available".
    const freed = e.active ? 1 : 0;
    if (slot.available + freed <= 0) return { ok: false, slot, reason: 'No hay lugar en el headcount para este puesto.' };
    return { ok: true, slot };
  }
  if (slot.available <= 0) {
    return { ok: false, slot, reason: `Sin vacante disponible: ${slot.authorized} autorizados, ${slot.active - slot.leaving} ocupados y ${slot.open} en proceso.` };
  }
  return { ok: true, slot };
}

/* ---------- Permisos ---------- */

export function canSeeVacancy(u: Profile, v: Vacancy) {
  if (u.role === 'admin_rh') return true;
  if (u.role === 'coordinador' || u.role === 'gerente_area') return u.areas.includes(v.area);
  return v.manager_id === u.id;
}

export type VAction = 'autorizar' | 'tomar' | 'avanzar' | 'novedad' | 'cancelar';

export function vDenyReason(a: VAction, u: Profile, v: Vacancy): string | null {
  if (!u.active) return 'Su usuario está desactivado.';
  if (!canSeeVacancy(u, v)) return 'No tiene acceso a esta vacante.';
  const rh = u.role === 'coordinador' || u.role === 'admin_rh';
  switch (a) {
    case 'autorizar':
      if (u.role !== 'gerente_area') return 'La autoriza el gerente de área.';
      if (v.manager_id === u.id) return 'No puede autorizar su propio pedido.';
      if (v.status !== 'pendiente_area') return 'La vacante no está esperando autorización.';
      return null;
    case 'tomar':
      if (!rh) return 'La búsqueda la gestiona RH.';
      if (v.status !== 'autorizada') return 'Sólo se toman vacantes autorizadas.';
      return null;
    case 'avanzar':
      if (!rh) return 'Las etapas las actualiza RH.';
      if (!RH_STAGES.includes(v.status) || v.status === 'cubierta') return 'La vacante no está en búsqueda.';
      return null;
    case 'novedad':
      if (['cubierta', 'cancelada', 'rechazada'].includes(v.status)) return 'La vacante está cerrada.';
      return null;
    case 'cancelar':
      if (['cubierta', 'cancelada', 'rechazada'].includes(v.status)) return 'La vacante ya está cerrada.';
      if (v.manager_id === u.id) return v.status === 'pendiente_area' ? null : 'Ya fue autorizada: pedile a RH o al gerente de área que la cancele.';
      if (u.role === 'gerente_area' || rh) return null;
      return 'No puede cancelarla.';
  }
}

export const vCan = (a: VAction, u: Profile, v: Vacancy) => vDenyReason(a, u, v) === null;

/** Siguiente etapa de RH. */
export function nextStage(s: VacancyStatus): VacancyStatus | null {
  if (s === 'autorizada') return 'en_busqueda';
  const i = RH_STAGES.indexOf(s);
  return i >= 0 && i < RH_STAGES.length - 1 ? RH_STAGES[i + 1] : null;
}

/* ---------- Tiempos ---------- */

export interface StageTime { status: VacancyStatus; from: string; to: string | null; days: number }

const dayDiff = (a: string, b: string) => Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));

/** Cuándo entró la vacante a cada etapa y cuántos días estuvo, a partir del historial. */
export function stageTimes(v: Vacancy, events: AuditEvent[], now = new Date().toISOString()): StageTime[] {
  const changes = events
    .filter((e) => e.entity === 'vacancy' && e.entity_id === v.id && e.to_status)
    .sort((a, b) => a.at.localeCompare(b.at));
  const out: StageTime[] = [];
  for (const e of changes) {
    const st = e.to_status as unknown as VacancyStatus;
    if (out.length) out[out.length - 1].to = e.at;
    out.push({ status: st, from: e.at, to: null, days: 0 });
  }
  if (!out.length) out.push({ status: v.status, from: v.created_at, to: null, days: 0 });
  for (const s of out) s.days = dayDiff(s.from, s.to ?? (['cubierta', 'cancelada', 'rechazada'].includes(s.status) ? s.from : now));
  return out;
}

export function totalDays(v: Vacancy, now = new Date().toISOString()) {
  return dayDiff(v.created_at, v.closed_at ?? now);
}

export function stageIndex(s: VacancyStatus) {
  return VACANCY_STAGES.indexOf(s);
}

/** Gerente de área que autoriza según el área de la tienda. */
export function resolveAreaManager(area: string, users: Profile[]) {
  return users.find((u) => u.active && u.role === 'gerente_area' && u.areas.includes(area)) ?? null;
}

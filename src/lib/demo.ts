import { analyzePlan } from './calc';
import { addDays, fromMin, monthDates, nowIso, prevMonth, toMin, uid, weekday } from './dates';
import type { DayHours, Employee, Entry, HistoryItem, Plan, PlanStatus, PositionId, Profile, Store, StoreSettings } from './types';

/**
 * Datos de DEMOSTRACIÓN (ficticios). Todas las filas generadas llevan is_demo = true
 * y los nombres de tienda incluyen "Demo" para diferenciarlas de los datos reales.
 */

export const DEMO_PASSWORD = 'demo1234';

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const FIRST = ['Lucía', 'Martín', 'Sofía', 'Diego', 'Valentina', 'Joaquín', 'Camila', 'Tomás', 'Florencia', 'Nicolás', 'Agustina', 'Matías', 'Julieta', 'Facundo', 'Micaela', 'Santiago', 'Rocío', 'Federico', 'Carolina', 'Gonzalo', 'Paula', 'Ignacio', 'Daniela', 'Ezequiel', 'Brenda', 'Lautaro', 'Antonella', 'Franco', 'Milagros', 'Emiliano', 'Natalia', 'Bruno', 'Celeste', 'Leandro', 'Romina', 'Hernán', 'Belén', 'Pablo', 'Mariana', 'Julián', 'Abril', 'Ramiro', 'Ailén', 'Sebastián', 'Gisela', 'Maximiliano', 'Noelia', 'Alan', 'Yamila', 'Lucas', 'Melina', 'Andrés', 'Pilar', 'Kevin', 'Victoria', 'Rodrigo', 'Lorena', 'Cristian', 'Jazmín', 'Gastón', 'Tamara', 'Ariel'];
const LAST = ['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'Pérez', 'Gómez', 'Sánchez', 'Romero', 'Díaz', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Molina', 'Castro', 'Ortiz', 'Silva', 'Núñez', 'Luna', 'Juárez', 'Cabrera', 'Ríos', 'Ferreyra', 'Godoy', 'Morales', 'Domínguez', 'Moreno', 'Peralta', 'Vega', 'Carrizo', 'Quiroga'];

const h = (open: string, close: string): DayHours => ({ closed: false, open, close });
const closedDay: DayHours = { closed: true, open: '00:00', close: '00:00' };

interface StoreSpec {
  code: string;
  name: string;
  region: string;
  address: string;
  hours: DayHours[];
  staff: Partial<Record<PositionId, number>>;
  settings: Partial<StoreSettings>;
  gerenteEmail: string;
}

const SPECS: StoreSpec[] = [
  {
    code: 'DEMO-001', name: 'Farmacia Demo Centro (24 h)', region: 'AMBA', address: 'Av. Ficticia 1234, CABA',
    hours: Array.from({ length: 7 }, () => h('00:00', '00:00')),
    staff: { DT: 1, APV_SR: 3, APV_ASIST: 4, APV_FARM: 4, FARMACEUTICO: 4, MAESTRANZA: 2 },
    settings: { min_staff: 3, key_positions: ['FARMACEUTICO'], target_by_hour: [3, 3, 3, 3, 3, 3, 4, 4, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 5, 4, 3, 3] },
    gerenteEmail: 'gerente.centro@demo.farmaplan',
  },
  {
    code: 'DEMO-002', name: 'Farmacia Demo Palermo', region: 'AMBA', address: 'Calle Ejemplo 455, CABA',
    hours: [h('09:00', '21:00'), h('08:00', '22:00'), h('08:00', '22:00'), h('08:00', '22:00'), h('08:00', '22:00'), h('08:00', '22:00'), h('08:00', '22:00')],
    staff: { DT: 1, APV_SR: 2, APV_ASIST: 4, APV_FARM: 3, FARMACEUTICO: 3, MAESTRANZA: 1 },
    settings: { min_staff: 3, key_positions: ['FARMACEUTICO', 'APV_FARM'], target_by_hour: [0, 0, 0, 0, 0, 0, 0, 0, 4, 4, 5, 5, 5, 6, 6, 6, 5, 5, 5, 5, 4, 4, 0, 0] },
    gerenteEmail: 'gerente.palermo@demo.farmaplan',
  },
  {
    code: 'DEMO-003', name: 'Farmacia Demo Nueva Córdoba', region: 'Centro', address: 'Bv. Prueba 890, Córdoba',
    hours: [closedDay, h('08:30', '21:30'), h('08:30', '21:30'), h('08:30', '21:30'), h('08:30', '21:30'), h('08:30', '21:30'), h('09:00', '14:00')],
    staff: { DT: 1, APV_SR: 1, APV_ASIST: 3, APV_FARM: 2, FARMACEUTICO: 3, MAESTRANZA: 1 },
    settings: { min_staff: 2, key_positions: ['FARMACEUTICO'], target_by_hour: null },
    gerenteEmail: 'gerente.cordoba@demo.farmaplan',
  },
  {
    code: 'DEMO-004', name: 'Farmacia Demo Rosario Centro', region: 'Litoral', address: 'Calle Modelo 77, Rosario',
    hours: Array.from({ length: 7 }, () => h('08:00', '23:00')),
    staff: { DT: 1, APV_SR: 2, APV_ASIST: 3, APV_FARM: 3, FARMACEUTICO: 3, MAESTRANZA: 1 },
    settings: { min_staff: 2, key_positions: ['FARMACEUTICO'], target_by_hour: null },
    gerenteEmail: 'gerente.rosario@demo.farmaplan',
  },
];

export function defaultSettings(store_id: string): StoreSettings {
  return {
    store_id, min_staff: 2, key_positions: ['FARMACEUTICO'], key_positions_blocking: true, target_by_hour: null,
    max_daily_hours: 9, min_daily_hours: 4, max_weekly_hours: 48, min_rest_hours: 12, max_consecutive_days: 6,
    contract_tolerance_pct: 10, updated_at: nowIso(), updated_by: null,
  };
}

export function defaultHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, i) => (i === 0 ? h('09:00', '21:00') : h('08:00', '22:00')));
}

/** Turnos posibles de un día según el horario de apertura. */
function dayTemplates(hours: DayHours, pos: PositionId): [string, string][] {
  if (hours.closed) return [];
  const o = toMin(hours.open);
  let c = toMin(hours.close);
  if (c <= o) c += 1440;
  const len = c - o;
  if (len >= 1440) {
    if (pos === 'DT') return [['09:00', '17:00']];
    if (pos === 'MAESTRANZA') return [['06:00', '14:00'], ['14:00', '22:00']];
    return [['06:00', '14:00'], ['14:00', '22:00'], ['22:00', '06:00']];
  }
  const shift = Math.min(len, 480);
  if (pos === 'DT') {
    const s = Math.min(o + 60, c - shift);
    return [[fromMin(s), fromMin(s + shift)]];
  }
  const early: [string, string] = [fromMin(o), fromMin(o + shift)];
  const late: [string, string] = [fromMin(c - shift), fromMin(c)];
  if (len <= 480) return [early];
  if (pos === 'MAESTRANZA') return [early, late];
  if (len > 960) return [early, [fromMin(o + Math.round((len - shift) / 2 / 30) * 30), fromMin(o + Math.round((len - shift) / 2 / 30) * 30 + shift)], late];
  return [early, late];
}

function genEntries(
  store: Store, emps: Employee[], plan: Plan, year: number, month: number, user: string, upToDay: number, seed: number,
): Entry[] {
  const out: Entry[] = [];
  const dates = monthDates(year, month).slice(0, upToDay);
  const byPos = new Map<PositionId, Employee[]>();
  emps.forEach((e) => byPos.set(e.position_id, [...(byPos.get(e.position_id) ?? []), e]));
  const mk = (e: Employee, d: string, kind: Entry['kind'], start: string | null = null, end: string | null = null): Entry => ({
    id: uid(), plan_id: plan.id, store_id: store.id, employee_id: e.id, date: d, kind, start, end,
    position_id: null, notes: null, updated_at: nowIso(), updated_by: user,
  });
  for (const [pos, list] of byPos) {
    const offs = list.map((e, k) => {
      const first = (k * 2 + seed + (pos === 'DT' ? 0 : 1)) % 7;
      const days = [pos === 'DT' ? 0 : first];
      if ((e.contract_weekly_hours ?? 48) <= 40) days.push((days[0] + 3) % 7);
      return days;
    });
    const lastEnd = new Map<string, number>();
    for (const d of dates) {
      const wd = weekday(d);
      const tpl = dayTemplates(store.hours[wd], pos);
      const uncovered = new Set(tpl.map((_, i) => i));
      const working: { e: Employee; k: number }[] = [];
      list.forEach((e, k) => {
        if (!tpl.length || offs[k].includes(wd)) out.push(mk(e, d, 'franco'));
        else working.push({ e, k });
      });
      const regulars = working.filter((w) => w.k < tpl.length || tpl.length === 0);
      const relievers = working.filter((w) => w.k >= tpl.length);
      for (const w of regulars) {
        const t = tpl[w.k % tpl.length];
        uncovered.delete(w.k % tpl.length);
        out.push(mk(w.e, d, 'turno', t[0], t[1]));
      }
      for (const w of relievers) {
        // Elegir el turno que respete el descanso mínimo de 12 h; priorizar los no cubiertos.
        const dayStart = (Number(d.slice(8)) - 1) * 1440;
        const order = [...uncovered, ...tpl.map((_, i) => i).filter((i) => !uncovered.has(i))];
        const ok = order.find((i) => dayStart + toMin(tpl[i][0]) - (lastEnd.get(w.e.id) ?? -1e9) >= 720);
        const idx = ok ?? order[order.length - 1];
        uncovered.delete(idx);
        out.push(mk(w.e, d, 'turno', tpl[idx][0], tpl[idx][1]));
      }
      for (const w of working) {
        const en = out.filter((x) => x.employee_id === w.e.id && x.date === d && x.kind === 'turno').pop();
        if (en) {
          const s0 = (Number(d.slice(8)) - 1) * 1440 + toMin(en.start!);
          let e0 = (Number(d.slice(8)) - 1) * 1440 + toMin(en.end!);
          if (e0 <= s0) e0 += 1440;
          lastEnd.set(w.e.id, e0);
        }
      }
    }
  }
  return out;
}

export interface DemoBundle {
  stores: Store[];
  store_settings: StoreSettings[];
  employees: Employee[];
  profiles: Profile[];
  plans: Plan[];
  entries: Entry[];
  plan_history: HistoryItem[];
  passwords: Record<string, string>;
}

export function buildDemoData(today = new Date(), includeProfiles = true): DemoBundle {
  const r = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const usedNames = new Set<string>();
  const name = () => {
    for (;;) {
      const n = `${pick(FIRST)} ${pick(LAST)}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
  };
  const bundle: DemoBundle = { stores: [], store_settings: [], employees: [], profiles: [], plans: [], entries: [], plan_history: [], passwords: {} };
  const adminId = uid();
  const admin: Profile = { id: adminId, email: 'rrhh@demo.farmaplan', name: 'Coordinación RR. HH. (demo)', role: 'admin', store_id: null, is_demo: true };
  if (includeProfiles) {
    bundle.profiles.push(admin);
    bundle.passwords[adminId] = DEMO_PASSWORD;
  }

  const cy = today.getFullYear();
  const cm = today.getMonth() + 1;
  const [py, pm] = prevMonth(cy, cm);
  const ts = nowIso();

  SPECS.forEach((spec, si) => {
    const store: Store = { id: uid(), code: spec.code, name: spec.name, region: spec.region, address: spec.address, is_demo: true, hours: spec.hours, created_at: ts };
    const settings: StoreSettings = { ...defaultSettings(store.id), ...spec.settings };
    bundle.stores.push(store);
    bundle.store_settings.push(settings);
    const emps: Employee[] = [];
    for (const [pos, n] of Object.entries(spec.staff) as [PositionId, number][]) {
      for (let k = 0; k < n; k++) {
        emps.push({
          id: uid(), store_id: store.id, name: name(), position_id: pos, active: true,
          contract_weekly_hours: pos === 'MAESTRANZA' && k > 0 ? 40 : 48, is_demo: true, created_at: ts,
        });
      }
    }
    // un empleado inactivo por tienda (no se planifica)
    emps.push({ id: uid(), store_id: store.id, name: name(), position_id: 'APV_ASIST', active: false, contract_weekly_hours: 48, is_demo: true, created_at: ts });
    bundle.employees.push(...emps);
    const active = emps.filter((e) => e.active);

    const gid = uid();
    const gName = `${name()} (Gerente demo)`;
    if (includeProfiles) {
      bundle.profiles.push({ id: gid, email: spec.gerenteEmail, name: gName, role: 'gerente', store_id: store.id, is_demo: true });
      bundle.passwords[gid] = DEMO_PASSWORD;
    }
    const gUser = includeProfiles ? gid : null;

    const hist = (plan: Plan, action: HistoryItem['action'], from: PlanStatus | null, to: PlanStatus | null, by: Profile | null, comment: string | null = null) => {
      // fechas escalonadas: el mes anterior se cargó durante ese mes; el actual, en los últimos días
      const base = plan.month === cm ? today.getTime() - 3 * 86400000 : new Date(py, pm - 2, 20).getTime();
      const step = { creacion: 0, edicion: 1, envio: 2, observacion: 3, aprobacion: 3, reapertura: 4, edicion_post_envio: 4 }[action];
      const at = new Date(base + step * 86400000 + si * 3600000).toISOString();
      bundle.plan_history.push({ id: uid(), plan_id: plan.id, store_id: store.id, action, from_status: from, to_status: to, comment, user_id: by?.id ?? null, user_name: by?.name ?? 'Sistema (demo)', at });
    };
    const gProfile: Profile = { id: gid, email: spec.gerenteEmail, name: gName, role: 'gerente', store_id: store.id, is_demo: true };

    // Mes anterior: completo
    const prev: Plan = { id: uid(), store_id: store.id, year: py, month: pm, status: 'en_preparacion', changed_after_submit: false, submitted_at: ts, approved_at: null, last_comment: null, updated_at: ts, updated_by: gUser, updated_by_name: gName };
    const prevEntries = genEntries(store, active, prev, py, pm, gid, 31, si);
    const prevA = analyzePlan({ year: py, month: pm, store, settings, employees: emps, entries: prevEntries, plan: prev });
    hist(prev, 'creacion', 'pendiente', 'en_preparacion', gProfile);
    hist(prev, 'envio', 'en_preparacion', 'enviada', gProfile);
    if (prevA.errors === 0) {
      prev.status = 'aprobada';
      prev.approved_at = ts;
      hist(prev, 'aprobacion', 'enviada', 'aprobada', admin, 'Aprobada sin observaciones.');
    } else {
      prev.status = 'observada';
      prev.last_comment = `Revisar ${prevA.errors} error(es) de cobertura antes de aprobar.`;
      hist(prev, 'observacion', 'enviada', 'observada', admin, prev.last_comment);
    }
    bundle.plans.push(prev);
    bundle.entries.push(...prevEntries);

    // Mes actual: distintos grados de avance para probar el flujo
    const scenario: { status: PlanStatus; upTo: number }[] = [
      { status: 'enviada', upTo: 31 },
      { status: 'en_preparacion', upTo: 31 },
      { status: 'en_preparacion', upTo: 12 },
      { status: 'pendiente', upTo: 0 },
    ];
    const sc = scenario[si];
    const cur: Plan = { id: uid(), store_id: store.id, year: cy, month: cm, status: sc.status, changed_after_submit: false, submitted_at: sc.status === 'enviada' ? ts : null, approved_at: null, last_comment: null, updated_at: ts, updated_by: sc.upTo ? gUser : null, updated_by_name: sc.upTo ? gName : null };
    if (sc.upTo) {
      const curEntries = genEntries(store, active, cur, cy, cm, gid, sc.upTo, si + 3);
      if (si === 1) {
        // Escenarios con problemas para ver las alertas
        const asist = active.find((e) => e.position_id === 'APV_ASIST')!;
        const d10 = monthDates(cy, cm)[9];
        const e10 = curEntries.find((e) => e.employee_id === asist.id && e.date === d10);
        if (e10) Object.assign(e10, { kind: 'turno', start: '12:00', end: '20:00' });
        curEntries.push({ ...curEntries[0], id: uid(), employee_id: asist.id, date: d10, kind: 'turno', start: '16:00', end: '22:00', notes: 'Refuerzo (superpuesto, demo)' });
        const d15 = monthDates(cy, cm)[14];
        for (const e of curEntries) {
          const emp = active.find((x) => x.id === e.employee_id)!;
          if (e.date === d15 && emp.position_id === 'FARMACEUTICO' && e.kind === 'turno' && e.start! >= '12:00') {
            Object.assign(e, { kind: 'licencia', start: null, end: null, notes: 'Licencia médica (demo)' });
          }
        }
        const apvFarm = active.find((e) => e.position_id === 'APV_FARM')!;
        const start = monthDates(cy, cm)[19];
        for (let i = 0; i < 7; i++) {
          const d = addDays(start, i);
          const en = curEntries.find((e) => e.employee_id === apvFarm.id && e.date === d);
          if (en) Object.assign(en, { kind: 'vacaciones', start: null, end: null, notes: null });
        }
      }
      bundle.entries.push(...curEntries);
      hist(cur, 'creacion', 'pendiente', 'en_preparacion', gProfile);
      if (sc.status === 'enviada') hist(cur, 'envio', 'en_preparacion', 'enviada', gProfile);
    }
    bundle.plans.push(cur);
  });
  return bundle;
}

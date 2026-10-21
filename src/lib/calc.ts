import { POSITIONS, POSITION_BY_ID } from './constants';
import { daysInMonth, fmtHours, isoDate, monthWeeks, pad, toMin, weekday } from './dates';
import type { Employee, Entry, Plan, PositionId, Severity, Store, StoreSettings } from './types';

/**
 * Motor de cálculo. Todas las métricas se derivan exclusivamente de los turnos cargados.
 * Unidad interna: minutos absolutos desde el día 1 del mes a las 00:00.
 * Un turno cuyo horario de salida es menor o igual al de entrada termina al día siguiente.
 * Una persona cuenta como presente en una franja horaria si trabaja al menos 30 minutos en ella.
 */

export const SLOT_PRESENCE_MIN = 30;

export interface Interval {
  entry: Entry;
  employee_id: string;
  position_id: PositionId;
  dayIdx: number;
  start: number;
  end: number;
}

export interface AnalysisAlert {
  severity: Severity;
  code: string;
  message: string;
  date: string | null;
  employee_id: string | null;
}

export interface PlanAnalysis {
  year: number;
  month: number;
  days: number;
  dates: string[];
  intervals: Interval[];
  /** cobertura por franja: índice = dayIdx*24 + hora (incluye 24 h extra de arrastre al mes siguiente) */
  coverage: number[];
  coverageByPos: Record<PositionId, number[]>;
  /** franjas en las que la tienda está abierta (mismo índice que coverage) */
  openSlots: boolean[];
  workingByDay: number[];
  hoursByDay: number[];
  posByDay: Record<PositionId, number[]>;
  hoursByEmployee: Record<string, number>;
  daysWorkedByEmployee: Record<string, number>;
  hoursByPosition: Record<PositionId, number>;
  hoursByWeek: { label: string; dates: string[]; hours: number }[];
  totalHours: number;
  contractByEmployee: Record<string, number | null>;
  /** celdas empleado-día con algún registro / total esperado (empleados activos × días) */
  filledCells: number;
  expectedCells: number;
  completeness: number;
  alerts: AnalysisAlert[];
  errors: number;
  warnings: number;
  /** días con al menos una alerta de cobertura */
  problemDays: string[];
  /** franjas abiertas por debajo del mínimo */
  slotsBelowMin: number;
  /** franjas abiertas por debajo del objetivo */
  slotsBelowTarget: number;
  targetDeficitHours: number;
  firstStart: (number | null)[];
  lastEnd: (number | null)[];
}

const emptyPosRecord = <T,>(f: () => T) =>
  Object.fromEntries(POSITIONS.map((p) => [p.id, f()])) as Record<PositionId, T>;

export function shiftMinutes(start: string, end: string): number {
  const s = toMin(start);
  let e = toMin(end);
  if (e <= s) e += 1440;
  return e - s;
}

export function entryHours(e: Entry): number {
  if (e.kind !== 'turno' || !e.start || !e.end) return 0;
  return shiftMinutes(e.start, e.end) / 60;
}

function overlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

function slotLabel(h: number) {
  return `${pad(h % 24)}–${pad((h + 1) % 24 === 0 ? 24 : (h + 1) % 24)} h`;
}

function compressHours(hours: number[]): string {
  if (!hours.length) return '';
  const ranges: [number, number][] = [];
  for (const h of hours) {
    const last = ranges[ranges.length - 1];
    if (last && last[1] === h - 1) last[1] = h;
    else ranges.push([h, h]);
  }
  return ranges.map(([a, b]) => `${pad(a)}–${pad(b + 1)} h`).join(', ');
}

function dayNum(d: string) {
  return Number(d.slice(8, 10));
}

export interface AnalyzeInput {
  year: number;
  month: number;
  store: Store;
  settings: StoreSettings;
  employees: Employee[];
  entries: Entry[];
  plan: Plan | null;
  /** registros del último día del mes anterior (turnos nocturnos que continúan en el día 1) */
  carryIn?: Entry[];
  /** filtra métricas a una posición (las alertas siguen calculándose con todos) */
  positionFilter?: PositionId | null;
}

export function analyzePlan(input: AnalyzeInput): PlanAnalysis {
  const { year, month, store, settings, plan } = input;
  const days = daysInMonth(year, month);
  const dates = Array.from({ length: days }, (_, i) => isoDate(year, month, i + 1));
  const empById = new Map(input.employees.map((e) => [e.id, e]));
  const entries = input.entries.filter((e) => empById.has(e.employee_id) && e.date.startsWith(`${year}-${pad(month)}-`));
  const slots = (days + 1) * 24;

  const monthPrefix = `${year}-${pad(month)}-`;
  // Turnos del último día del mes anterior que terminan después de la medianoche (sólo aportan cobertura)
  const carryIn: { start: number; end: number; position_id: PositionId }[] = [];
  for (const en of input.carryIn ?? []) {
    if (en.kind !== 'turno' || !en.start || !en.end || !empById.has(en.employee_id)) continue;
    const st = toMin(en.start) - 1440;
    const end = st + shiftMinutes(en.start, en.end);
    if (end > 0) carryIn.push({ start: 0, end, position_id: en.position_id ?? empById.get(en.employee_id)!.position_id });
  }
  const intervals: Interval[] = [];
  const turnoErrors: AnalysisAlert[] = [];
  for (const en of entries) {
    if (en.kind !== 'turno' || !en.date.startsWith(monthPrefix)) continue;
    const dayIdx = dayNum(en.date) - 1;
    if (dayIdx < 0 || dayIdx >= days) continue;
    if (!en.start || !en.end) {
      turnoErrors.push({
        severity: 'error', code: 'TURNO_INCOMPLETO', date: en.date, employee_id: en.employee_id,
        message: `${empById.get(en.employee_id)?.name}: turno sin horario de entrada o salida el día ${dayNum(en.date)}.`,
      });
      continue;
    }
    const start = dayIdx * 1440 + toMin(en.start);
    const end = start + shiftMinutes(en.start, en.end);
    intervals.push({
      entry: en, employee_id: en.employee_id,
      position_id: en.position_id ?? empById.get(en.employee_id)!.position_id,
      dayIdx, start, end,
    });
  }

  const pf = input.positionFilter ?? null;
  const metricIntervals = pf ? intervals.filter((i) => i.position_id === pf) : intervals;

  // --- Cobertura por franja horaria
  const coverage = new Array(slots).fill(0);
  const coverageByPos = emptyPosRecord(() => new Array(slots).fill(0));
  for (const iv of intervals) {
    const s0 = Math.floor(iv.start / 60);
    const s1 = Math.min(slots - 1, Math.floor((iv.end - 1) / 60));
    for (let s = s0; s <= s1; s++) {
      if (overlap(iv.start, iv.end, s * 60, s * 60 + 60) >= SLOT_PRESENCE_MIN) {
        if (!pf || iv.position_id === pf) coverage[s]++;
        coverageByPos[iv.position_id][s]++;
      }
    }
  }

  for (const iv of carryIn) {
    for (let s = 0; s <= Math.floor((iv.end - 1) / 60); s++) {
      if (overlap(iv.start, iv.end, s * 60, s * 60 + 60) >= SLOT_PRESENCE_MIN) {
        if (!pf || iv.position_id === pf) coverage[s]++;
        coverageByPos[iv.position_id][s]++;
      }
    }
  }

  // --- Franjas de apertura (según horario configurado por día de la semana)
  const openSlots = new Array(slots).fill(false);
  dates.forEach((d, di) => {
    const h = store.hours[weekday(d)];
    if (!h || h.closed) return;
    const o = di * 1440 + toMin(h.open);
    let c = di * 1440 + toMin(h.close);
    if (c <= o) c += 1440;
    for (let s = Math.floor(o / 60); s < Math.ceil(c / 60) && s < slots; s++) {
      if (overlap(o, c, s * 60, s * 60 + 60) >= SLOT_PRESENCE_MIN) openSlots[s] = true;
    }
  });

  // --- Por día
  const workingByDay = new Array(days).fill(0);
  const hoursByDay = new Array(days).fill(0);
  const posByDay = emptyPosRecord(() => new Array(days).fill(0));
  const firstStart: (number | null)[] = new Array(days).fill(null);
  const lastEnd: (number | null)[] = new Array(days).fill(null);
  const seenDayEmp = new Set<string>();
  const seenDayEmpPos = new Set<string>();
  for (const iv of metricIntervals) {
    const k = `${iv.dayIdx}|${iv.employee_id}`;
    if (!seenDayEmp.has(k)) {
      seenDayEmp.add(k);
      workingByDay[iv.dayIdx]++;
    }
    const kp = `${k}|${iv.position_id}`;
    if (!seenDayEmpPos.has(kp)) {
      seenDayEmpPos.add(kp);
      posByDay[iv.position_id][iv.dayIdx]++;
    }
    hoursByDay[iv.dayIdx] += (iv.end - iv.start) / 60;
    const rs = iv.start - iv.dayIdx * 1440;
    const re = iv.end - iv.dayIdx * 1440;
    firstStart[iv.dayIdx] = firstStart[iv.dayIdx] === null ? rs : Math.min(firstStart[iv.dayIdx]!, rs);
    lastEnd[iv.dayIdx] = lastEnd[iv.dayIdx] === null ? re : Math.max(lastEnd[iv.dayIdx]!, re);
  }

  // --- Horas
  const hoursByEmployee: Record<string, number> = {};
  const daysWorkedByEmployee: Record<string, number> = {};
  const hoursByPosition = emptyPosRecord(() => 0);
  for (const e of input.employees) {
    hoursByEmployee[e.id] = 0;
    daysWorkedByEmployee[e.id] = 0;
  }
  const workedDaySet = new Set<string>();
  for (const iv of metricIntervals) {
    const h = (iv.end - iv.start) / 60;
    hoursByEmployee[iv.employee_id] += h;
    hoursByPosition[iv.position_id] += h;
    const k = `${iv.employee_id}|${iv.dayIdx}`;
    if (!workedDaySet.has(k)) {
      workedDaySet.add(k);
      daysWorkedByEmployee[iv.employee_id]++;
    }
  }
  const totalHours = Object.values(hoursByPosition).reduce((a, b) => a + b, 0);
  const weeks = monthWeeks(year, month);
  const hoursByWeek = weeks.map((w, i) => {
    const idx = w.map((d) => dayNum(d) - 1);
    return {
      label: `Sem ${i + 1} (${dayNum(w[0])}–${dayNum(w[w.length - 1])})`,
      dates: w,
      hours: idx.reduce((a, di) => a + hoursByDay[di], 0),
    };
  });
  const contractByEmployee: Record<string, number | null> = {};
  for (const e of input.employees) {
    contractByEmployee[e.id] = e.contract_weekly_hours ? (e.contract_weekly_hours * days) / 7 : null;
  }

  // --- Completitud
  const activeEmps = input.employees.filter((e) => e.active);
  const cellSet = new Set(entries.map((e) => `${e.employee_id}|${e.date}`));
  const expectedCells = activeEmps.length * days;
  let filledCells = 0;
  for (const e of activeEmps) for (const d of dates) if (cellSet.has(`${e.id}|${d}`)) filledCells++;
  const completeness = expectedCells ? filledCells / expectedCells : 0;

  // --- Alertas
  const alerts: AnalysisAlert[] = [...turnoErrors];
  const problemDaySet = new Set<string>();
  const push = (a: AnalysisAlert) => alerts.push(a);

  if (!entries.length) {
    push({ severity: 'error', code: 'PLAN_SIN_CARGAR', date: null, employee_id: null, message: 'La planificación del mes no tiene horarios cargados.' });
  } else {
    for (const e of activeEmps) {
      const missing = dates.filter((d) => !cellSet.has(`${e.id}|${d}`));
      if (missing.length) {
        const list = missing.slice(0, 8).map(dayNum).join(', ') + (missing.length > 8 ? '…' : '');
        push({
          severity: 'error', code: 'HORARIO_SIN_CARGAR', date: null, employee_id: e.id,
          message: `${e.name}: ${missing.length} día(s) sin horario ni franco cargado (${list}).`,
        });
      }
    }
  }

  for (const en of entries) {
    const emp = empById.get(en.employee_id)!;
    if (!emp.active) {
      push({ severity: 'advertencia', code: 'EMPLEADO_INACTIVO', date: en.date, employee_id: emp.id, message: `${emp.name} está inactivo pero tiene registros el día ${dayNum(en.date)}.` });
      break;
    }
  }

  // Superposición, descanso, horas diarias
  const byEmp = new Map<string, Interval[]>();
  for (const iv of intervals) {
    if (!byEmp.has(iv.employee_id)) byEmp.set(iv.employee_id, []);
    byEmp.get(iv.employee_id)!.push(iv);
  }
  for (const [empId, list] of byEmp) {
    const emp = empById.get(empId)!;
    list.sort((a, b) => a.start - b.start);
    const dailyMin = new Map<number, number>();
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      dailyMin.set(cur.dayIdx, (dailyMin.get(cur.dayIdx) ?? 0) + (cur.end - cur.start));
      if (i > 0) {
        const prev = list[i - 1];
        if (cur.start < prev.end) {
          push({
            severity: 'error', code: 'TURNO_SUPERPUESTO', date: dates[cur.dayIdx], employee_id: empId,
            message: `${emp.name}: turnos superpuestos el día ${cur.dayIdx + 1} (${prev.entry.start}–${prev.entry.end} y ${cur.entry.start}–${cur.entry.end}).`,
          });
        } else if (cur.dayIdx !== prev.dayIdx && cur.start - prev.end < settings.min_rest_hours * 60) {
          push({
            severity: 'advertencia', code: 'DESCANSO_INSUFICIENTE', date: dates[cur.dayIdx], employee_id: empId,
            message: `${emp.name}: solo ${fmtHours((cur.start - prev.end) / 60)} h de descanso antes del turno del día ${cur.dayIdx + 1} (mínimo ${settings.min_rest_hours} h).`,
          });
        }
      }
    }
    for (const [di, m] of dailyMin) {
      const h = m / 60;
      if (h > settings.max_daily_hours) {
        push({ severity: 'advertencia', code: 'EXCESO_DIARIO', date: dates[di], employee_id: empId, message: `${emp.name}: ${fmtHours(h)} h planificadas el día ${di + 1} (máximo ${settings.max_daily_hours} h).` });
      } else if (h < settings.min_daily_hours) {
        push({ severity: 'advertencia', code: 'JORNADA_CORTA', date: dates[di], employee_id: empId, message: `${emp.name}: jornada de ${fmtHours(h)} h el día ${di + 1} (mínimo ${settings.min_daily_hours} h).` });
      }
    }
    // horas semanales
    for (const w of weeks) {
      const idx = new Set(w.map((d) => dayNum(d) - 1));
      const wh = list.filter((iv) => idx.has(iv.dayIdx)).reduce((a, iv) => a + (iv.end - iv.start) / 60, 0);
      if (wh > settings.max_weekly_hours) {
        push({ severity: 'advertencia', code: 'EXCESO_SEMANAL', date: w[0], employee_id: empId, message: `${emp.name}: ${fmtHours(wh)} h en la semana del ${dayNum(w[0])} al ${dayNum(w[w.length - 1])} (máximo ${settings.max_weekly_hours} h).` });
      }
    }
    // días consecutivos
    const worked = [...new Set(list.map((l) => l.dayIdx))].sort((a, b) => a - b);
    let run = 1;
    for (let i = 1; i <= worked.length; i++) {
      if (i < worked.length && worked[i] === worked[i - 1] + 1) run++;
      else {
        if (run > settings.max_consecutive_days) {
          push({ severity: 'advertencia', code: 'DIAS_CONSECUTIVOS', date: dates[worked[i - 1]], employee_id: empId, message: `${emp.name}: ${run} días consecutivos de trabajo hasta el día ${worked[i - 1] + 1} (máximo ${settings.max_consecutive_days}).` });
        }
        run = 1;
      }
    }
  }

  // Horas contractuales
  for (const e of activeEmps) {
    const c = contractByEmployee[e.id];
    // Sólo se compara con el contrato cuando el mes del empleado está completo
    if (!c || dates.some((d) => !cellSet.has(`${e.id}|${d}`))) continue;
    const planned = intervals.filter((i) => i.employee_id === e.id).reduce((a, i) => a + (i.end - i.start) / 60, 0);
    const absences = entries.filter((x) => x.employee_id === e.id && ['vacaciones', 'licencia', 'ausencia'].includes(x.kind)).length;
    // Las ausencias justificadas (vacaciones, licencias, ausencias) descuentan la parte proporcional del contrato.
    const expected = ((e.contract_weekly_hours ?? 0) * (days - absences)) / 7;
    const diff = planned - expected;
    if (Math.abs(diff) > (expected * settings.contract_tolerance_pct) / 100) {
      push({
        severity: 'advertencia', code: diff > 0 ? 'HORAS_SOBRE_CONTRATO' : 'HORAS_BAJO_CONTRATO', date: null, employee_id: e.id,
        message: `${e.name}: ${fmtHours(planned)} h planificadas vs ${fmtHours(expected)} h esperadas según contrato (${diff > 0 ? '+' : ''}${fmtHours(diff)} h).`,
      });
    }
  }

  // Cobertura mínima, posiciones clave y objetivo
  let slotsBelowMin = 0;
  let slotsBelowTarget = 0;
  let targetDeficitHours = 0;
  const loadedDates = new Set(entries.map((e) => e.date));
  if (entries.length) {
    dates.forEach((d, di) => {
      // Los días sin ningún registro ya se informan como "sin cargar"
      if (!loadedDates.has(d)) return;
      const below: number[] = [];
      const missingKey: Record<string, number[]> = {};
      const belowTarget: number[] = [];
      for (let h = 0; h < 24; h++) {
        const s = di * 24 + h;
        if (!openSlots[s]) continue;
        const total = intervalsCoverageAll(coverageByPos, s);
        if (total < settings.min_staff) below.push(h);
        for (const kp of settings.key_positions) {
          if (coverageByPos[kp][s] === 0) (missingKey[kp] ??= []).push(h);
        }
        const tgt = settings.target_by_hour?.[h] ?? 0;
        if (tgt > 0 && total < tgt) {
          belowTarget.push(h);
          targetDeficitHours += tgt - total;
        }
      }
      if (below.length) {
        slotsBelowMin += below.length;
        problemDaySet.add(d);
        push({ severity: 'error', code: 'COBERTURA_MINIMA', date: d, employee_id: null, message: `Día ${di + 1}: dotación inferior al mínimo (${settings.min_staff}) en ${compressHours(below)}.` });
      }
      for (const [kp, hrs] of Object.entries(missingKey)) {
        problemDaySet.add(d);
        push({
          severity: settings.key_positions_blocking ? 'error' : 'advertencia', code: 'POSICION_CLAVE', date: d, employee_id: null,
          message: `Día ${di + 1}: sin ${POSITION_BY_ID[kp as PositionId].name} en ${compressHours(hrs)}.`,
        });
      }
      if (belowTarget.length) {
        slotsBelowTarget += belowTarget.length;
        push({ severity: 'advertencia', code: 'BAJO_OBJETIVO', date: d, employee_id: null, message: `Día ${di + 1}: dotación por debajo del objetivo en ${compressHours(belowTarget)}.` });
      }
    });
  }

  // Turnos fuera del horario de apertura
  for (const iv of intervals) {
    const s0 = Math.floor(iv.start / 60);
    const s1 = Math.floor((iv.end - 1) / 60);
    let outside = 0;
    for (let s = s0; s <= s1 && s < days * 24; s++) if (!openSlots[s]) outside++;
    if (outside >= 2) {
      const emp = empById.get(iv.employee_id)!;
      push({ severity: 'advertencia', code: 'FUERA_DE_HORARIO', date: dates[iv.dayIdx], employee_id: emp.id, message: `${emp.name}: turno ${iv.entry.start}–${iv.entry.end} del día ${iv.dayIdx + 1} excede ${outside} h el horario de apertura.` });
    }
  }

  if (plan?.changed_after_submit) {
    push({ severity: 'advertencia', code: 'CAMBIO_POST_ENVIO', date: null, employee_id: null, message: 'Se realizaron cambios después de enviar la planificación para revisión.' });
  }

  alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));

  return {
    year, month, days, dates, intervals, coverage, coverageByPos, openSlots,
    workingByDay, hoursByDay, posByDay, hoursByEmployee, daysWorkedByEmployee, hoursByPosition,
    hoursByWeek, totalHours, contractByEmployee, filledCells, expectedCells, completeness,
    alerts, errors: alerts.filter((a) => a.severity === 'error').length,
    warnings: alerts.filter((a) => a.severity === 'advertencia').length,
    problemDays: [...problemDaySet].sort(), slotsBelowMin, slotsBelowTarget, targetDeficitHours,
    firstStart, lastEnd,
  };
}

function intervalsCoverageAll(byPos: Record<PositionId, number[]>, s: number) {
  let t = 0;
  for (const p of POSITIONS) t += byPos[p.id][s];
  return t;
}

/** Perfil horario promedio del mes (sólo días abiertos) — 24 valores. */
export function hourlyProfile(a: PlanAnalysis, pos?: PositionId | null): { hour: number; avg: number; min: number; max: number }[] {
  return Array.from({ length: 24 }, (_, h) => {
    const vals: number[] = [];
    for (let di = 0; di < a.days; di++) {
      const s = di * 24 + h;
      if (!a.openSlots[s] && a.coverage[s] === 0) continue;
      vals.push(pos ? a.coverageByPos[pos][s] : a.coverage[s]);
    }
    if (!vals.length) return { hour: h, avg: 0, min: 0, max: 0 };
    return { hour: h, avg: vals.reduce((x, y) => x + y, 0) / vals.length, min: Math.min(...vals), max: Math.max(...vals) };
  });
}

export function fmtClock(min: number | null): string {
  if (min === null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad(h % 24)}:${pad(m)}${h >= 24 ? ' (+1)' : ''}`;
}

export { slotLabel };

import * as XLSX from 'xlsx';
import type { PlanAnalysis } from './calc';
import { KIND_LABEL, MONTHS, POSITIONS, POSITION_BY_ID, STATUS_LABEL, WEEKDAYS_SHORT } from './constants';
import { pad, weekday } from './dates';
import { entryLabel } from './parse';
import type { Employee, Entry, Plan, Store, StoreSettings } from './types';

export interface StoreBundle {
  store: Store;
  settings: StoreSettings;
  employees: Employee[];
  entries: Entry[];
  plan: Plan | null;
  a: PlanAnalysis;
}

type Row = (string | number | null)[];

const r1 = (n: number) => Math.round(n * 10) / 10;

function sheet(rows: Row[], widths?: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
  return ws;
}

function safeName(n: string, used: Set<string>) {
  let s = n.replace(/[\\/?*[\]:]/g, ' ').slice(0, 28);
  let i = 2;
  while (used.has(s)) s = `${s.slice(0, 25)} ${i++}`;
  used.add(s);
  return s;
}

const dateEs = (d: string) => d.split('-').reverse().join('/');

export function scheduleSheets(b: StoreBundle): Row[] {
  const { a } = b;
  const header: Row = ['Empleado', 'Posición', 'Estado', ...a.dates.map((d) => `${WEEKDAYS_SHORT[weekday(d)]} ${Number(d.slice(8))}`), 'Horas', 'Horas contrato'];
  const rows: Row[] = [[`${b.store.code} · ${b.store.name}${b.store.is_demo ? ' (DEMO)' : ''} — ${MONTHS[a.month - 1]} ${a.year}`], [`Estado: ${STATUS_LABEL[b.plan?.status ?? 'pendiente']}`], [], header];
  const emps = b.employees.filter((e) => e.active || b.entries.some((x) => x.employee_id === e.id))
    .sort((x, y) => POSITION_BY_ID[x.position_id].sort - POSITION_BY_ID[y.position_id].sort || x.name.localeCompare(y.name));
  for (const e of emps) {
    rows.push([
      e.name, POSITION_BY_ID[e.position_id].name, e.active ? 'Activo' : 'Inactivo',
      ...a.dates.map((d) => b.entries.filter((x) => x.employee_id === e.id && x.date === d).sort((x, y) => (x.start ?? '').localeCompare(y.start ?? '')).map((x) => (x.kind === 'turno' ? `${x.start}-${x.end}` : entryLabel(x))).join(' / ')),
      r1(a.hoursByEmployee[e.id] ?? 0), a.contractByEmployee[e.id] !== null ? r1(a.contractByEmployee[e.id]!) : null,
    ]);
  }
  rows.push([], ['Personas trabajando', '', '', ...a.workingByDay, r1(a.totalHours)]);
  rows.push(['Horas del día', '', '', ...a.hoursByDay.map(r1)]);
  for (const p of POSITIONS) rows.push([p.name, '', '', ...a.posByDay[p.id]]);
  return rows;
}

export function exportSchedules(bundles: StoreBundle[], fileName: string) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const b of bundles) XLSX.utils.book_append_sheet(wb, sheet(scheduleSheets(b), [26, 26, 9, ...b.a.dates.map(() => 11), 8, 10]), safeName(b.store.code, used));
  XLSX.writeFile(wb, fileName);
}

export function employeeRows(bundles: StoreBundle[]): Row[] {
  const rows: Row[] = [['Tienda', 'Empleado', 'Posición habitual', 'Fecha', 'Día', 'Tipo', 'Entrada', 'Salida', 'Horas', 'Posición cubierta', 'Observaciones', 'Última modificación']];
  for (const b of bundles) {
    const emp = new Map(b.employees.map((e) => [e.id, e]));
    const ivs = new Map(b.a.intervals.map((i) => [i.entry.id, i]));
    for (const x of [...b.entries].sort((p, q) => (emp.get(p.employee_id)?.name ?? '').localeCompare(emp.get(q.employee_id)?.name ?? '') || p.date.localeCompare(q.date))) {
      const e = emp.get(x.employee_id);
      if (!e) continue;
      const iv = ivs.get(x.id);
      rows.push([
        b.store.name, e.name, POSITION_BY_ID[e.position_id].name, dateEs(x.date), WEEKDAYS_SHORT[weekday(x.date)], KIND_LABEL[x.kind],
        x.start, x.end, iv ? r1((iv.end - iv.start) / 60) : 0, x.position_id ? POSITION_BY_ID[x.position_id].name : '', x.notes ?? '', x.updated_at?.slice(0, 16).replace('T', ' ') ?? '',
      ]);
    }
  }
  return rows;
}

export function employeeSummaryRows(bundles: StoreBundle[]): Row[] {
  const rows: Row[] = [['Tienda', 'Empleado', 'Posición', 'Estado', 'Días trabajados', 'Horas planificadas', 'Promedio h/día trabajado', 'Promedio h/semana', 'Horas contrato (mes)', 'Diferencia vs contrato']];
  for (const b of bundles) {
    for (const e of b.employees) {
      const h = b.a.hoursByEmployee[e.id] ?? 0;
      const dw = b.a.daysWorkedByEmployee[e.id] ?? 0;
      const c = b.a.contractByEmployee[e.id];
      rows.push([b.store.name, e.name, POSITION_BY_ID[e.position_id].name, e.active ? 'Activo' : 'Inactivo', dw, r1(h), dw ? r1(h / dw) : 0, r1((h / b.a.days) * 7), c !== null ? r1(c) : null, c !== null ? r1(h - c) : null]);
    }
  }
  return rows;
}

export function exportEmployees(bundles: StoreBundle[], fileName: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet(employeeSummaryRows(bundles), [28, 28, 28, 9, 10, 12, 12, 12, 12, 12]), 'Resumen por empleado');
  XLSX.utils.book_append_sheet(wb, sheet(employeeRows(bundles), [28, 28, 26, 11, 6, 11, 8, 8, 7, 24, 30, 17]), 'Detalle de turnos');
  XLSX.writeFile(wb, fileName);
}

export function positionRows(bundles: StoreBundle[]): Row[] {
  const rows: Row[] = [['Tienda', ...POSITIONS.map((p) => p.name), 'Total']];
  for (const b of bundles) rows.push([b.store.name, ...POSITIONS.map((p) => r1(b.a.hoursByPosition[p.id])), r1(b.a.totalHours)]);
  rows.push(['TOTAL', ...POSITIONS.map((p) => r1(bundles.reduce((s, b) => s + b.a.hoursByPosition[p.id], 0))), r1(bundles.reduce((s, b) => s + b.a.totalHours, 0))]);
  rows.push([], ['Dotación activa (empleados)'], ['Tienda', ...POSITIONS.map((p) => p.name), 'Total']);
  for (const b of bundles) {
    const act = b.employees.filter((e) => e.active);
    rows.push([b.store.name, ...POSITIONS.map((p) => act.filter((e) => e.position_id === p.id).length), act.length]);
  }
  return rows;
}

export function coverageRows(b: StoreBundle): Row[] {
  const { a } = b;
  const rows: Row[] = [[`Cobertura ${b.store.name} — ${MONTHS[a.month - 1]} ${a.year}`], [], ['Fecha', 'Día', 'Personas', 'Horas', 'Primer ingreso', 'Último egreso', ...POSITIONS.map((p) => p.short), ...Array.from({ length: 24 }, (_, h) => `${pad(h)}-${pad(h + 1)}`)]];
  a.dates.forEach((d, i) => {
    rows.push([
      dateEs(d), WEEKDAYS_SHORT[weekday(d)], a.workingByDay[i], r1(a.hoursByDay[i]),
      a.firstStart[i] !== null ? `${pad(Math.floor(a.firstStart[i]! / 60) % 24)}:${pad(a.firstStart[i]! % 60)}` : '',
      a.lastEnd[i] !== null ? `${pad(Math.floor(a.lastEnd[i]! / 60) % 24)}:${pad(a.lastEnd[i]! % 60)}${a.lastEnd[i]! >= 1440 ? ' (+1)' : ''}` : '',
      ...POSITIONS.map((p) => a.posByDay[p.id][i]),
      ...Array.from({ length: 24 }, (_, h) => (a.openSlots[i * 24 + h] || a.coverage[i * 24 + h] ? a.coverage[i * 24 + h] : null)),
    ]);
  });
  return rows;
}

export function exportCoverage(bundles: StoreBundle[], fileName: string) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const b of bundles) XLSX.utils.book_append_sheet(wb, sheet(coverageRows(b), [11, 5, 9, 8, 10, 12, ...POSITIONS.map(() => 8), ...Array(24).fill(6)]), safeName(b.store.code, used));
  XLSX.writeFile(wb, fileName);
}

export function comparisonRows(bundles: StoreBundle[]): Row[] {
  const rows: Row[] = [['Código', 'Tienda', 'Región', 'Datos', 'Estado', '% carga', 'Planificación', 'Empleados planificados', 'Horas totales', 'Personas/día', 'Días con problemas', 'Franjas bajo mínimo', 'Déficit vs objetivo (h·pers.)', 'Errores', 'Advertencias']];
  for (const b of bundles) {
    const emp = Object.values(b.a.daysWorkedByEmployee).filter((v) => v > 0).length;
    rows.push([
      b.store.code, b.store.name, b.store.region, b.store.is_demo ? 'Demo' : 'Real', STATUS_LABEL[b.plan?.status ?? 'pendiente'], Math.round(b.a.completeness * 100),
      b.a.completeness >= 1 ? 'Completa' : 'Incompleta', emp, r1(b.a.totalHours), r1(b.a.workingByDay.reduce((x, y) => x + y, 0) / b.a.days),
      b.a.problemDays.length, b.a.slotsBelowMin, b.settings.target_by_hour ? r1(b.a.targetDeficitHours) : 'Sin objetivo', b.a.errors, b.a.warnings,
    ]);
  }
  return rows;
}

export function alertRows(bundles: StoreBundle[]): Row[] {
  const rows: Row[] = [['Tienda', 'Estado planificación', 'Nivel', 'Código', 'Fecha', 'Detalle']];
  for (const b of bundles) for (const x of b.a.alerts) rows.push([b.store.name, STATUS_LABEL[b.plan?.status ?? 'pendiente'], x.severity === 'error' ? 'Error' : 'Advertencia', x.code, x.date ? dateEs(x.date) : '', x.message]);
  return rows;
}

export function statusRows(bundles: StoreBundle[]): Row[] {
  const rows: Row[] = [['Tienda', 'Estado', 'Enviada', 'Aprobada', 'Cambios post-envío', 'Último cambio', 'Responsable', 'Observaciones']];
  for (const b of bundles) {
    const p = b.plan;
    rows.push([b.store.name, STATUS_LABEL[p?.status ?? 'pendiente'], p?.submitted_at?.slice(0, 16).replace('T', ' ') ?? '', p?.approved_at?.slice(0, 16).replace('T', ' ') ?? '', p?.changed_after_submit ? 'Sí' : 'No', p?.updated_at?.slice(0, 16).replace('T', ' ') ?? '', p?.updated_by_name ?? '', p?.last_comment ?? '']);
  }
  return rows;
}

export function exportSimple(sheets: { name: string; rows: Row[]; widths?: number[] }[], fileName: string) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const s of sheets) XLSX.utils.book_append_sheet(wb, sheet(s.rows, s.widths), safeName(s.name, used));
  XLSX.writeFile(wb, fileName);
}

export function exportFull(bundles: StoreBundle[], fileName: string) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  XLSX.utils.book_append_sheet(wb, sheet(comparisonRows(bundles), [10, 30, 12, 7, 20, 8, 11, 12, 10, 10, 10, 10, 14, 8, 10]), safeName('Comparación', used));
  XLSX.utils.book_append_sheet(wb, sheet(statusRows(bundles), [30, 20, 17, 17, 10, 17, 26, 40]), safeName('Estado aprobación', used));
  XLSX.utils.book_append_sheet(wb, sheet(alertRows(bundles), [30, 20, 11, 22, 11, 90]), safeName('Alertas', used));
  XLSX.utils.book_append_sheet(wb, sheet(positionRows(bundles), [30, ...POSITIONS.map(() => 14), 10]), safeName('Horas por posición', used));
  XLSX.utils.book_append_sheet(wb, sheet(employeeSummaryRows(bundles)), safeName('Horas por empleado', used));
  for (const b of bundles) XLSX.utils.book_append_sheet(wb, sheet(scheduleSheets(b), [26, 26, 9, ...b.a.dates.map(() => 11), 8, 10]), safeName(`Horario ${b.store.code}`, used));
  for (const b of bundles) XLSX.utils.book_append_sheet(wb, sheet(coverageRows(b)), safeName(`Cobertura ${b.store.code}`, used));
  XLSX.writeFile(wb, fileName);
}

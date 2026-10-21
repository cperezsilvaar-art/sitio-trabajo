import type { EntryKind, PlanStatus, Position, PositionId } from './types';

export const POSITIONS: Position[] = [
  { id: 'DT', name: 'Gerente de Tienda (DT)', short: 'DT', sort: 1 },
  { id: 'APV_SR', name: 'APV Senior', short: 'APV Sr', sort: 2 },
  { id: 'APV_ASIST', name: 'APV Asistente de Piso de Venta', short: 'APV Asist.', sort: 3 },
  { id: 'APV_FARM', name: 'APV Farmacias', short: 'APV Farm.', sort: 4 },
  { id: 'FARMACEUTICO', name: 'Farmacéutico', short: 'Farmac.', sort: 5 },
  { id: 'MAESTRANZA', name: 'Maestranza', short: 'Maestr.', sort: 6 },
];

export const POSITION_BY_ID: Record<PositionId, Position> = Object.fromEntries(
  POSITIONS.map((p) => [p.id, p]),
) as Record<PositionId, Position>;

/** Paleta categórica validada (orden fijo, una por posición). */
export const POSITION_COLORS: Record<PositionId, string> = {
  DT: '#2a78d6',
  APV_SR: '#eb6834',
  APV_ASIST: '#1baf7a',
  APV_FARM: '#eda100',
  FARMACEUTICO: '#e87ba4',
  MAESTRANZA: '#008300',
};

export const STATUS_LABEL: Record<PlanStatus, string> = {
  pendiente: 'Pendiente de carga',
  en_preparacion: 'En preparación',
  enviada: 'Enviada para revisión',
  observada: 'Observada',
  aprobada: 'Aprobada',
};

export const STATUS_STYLE: Record<PlanStatus, string> = {
  pendiente: 'bg-slate-100 text-slate-700 ring-slate-300',
  en_preparacion: 'bg-sky-50 text-sky-800 ring-sky-200',
  enviada: 'bg-violet-50 text-violet-800 ring-violet-200',
  observada: 'bg-amber-50 text-amber-800 ring-amber-300',
  aprobada: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export const KIND_LABEL: Record<EntryKind, string> = {
  turno: 'Turno',
  franco: 'Franco',
  vacaciones: 'Vacaciones',
  licencia: 'Licencia',
  ausencia: 'Ausencia',
};

export const KIND_SHORT: Record<EntryKind, string> = {
  turno: '',
  franco: 'F',
  vacaciones: 'VAC',
  licencia: 'LIC',
  ausencia: 'AUS',
};

export const KIND_CELL_STYLE: Record<EntryKind, string> = {
  turno: 'bg-teal-50 text-navy-900',
  franco: 'bg-slate-200 text-slate-600',
  vacaciones: 'bg-sky-100 text-sky-800',
  licencia: 'bg-violet-100 text-violet-800',
  ausencia: 'bg-rose-100 text-rose-700',
};

export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/** Escala secuencial (un solo tono, claro → oscuro) para mapas de calor. */
export const SEQ_BLUE = ['#eef5fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

export const STATUS_COLORS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' };

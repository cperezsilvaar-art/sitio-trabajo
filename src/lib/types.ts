export type Role = 'admin' | 'gerente';

export type PositionId = 'DT' | 'APV_SR' | 'APV_ASIST' | 'APV_FARM' | 'FARMACEUTICO' | 'MAESTRANZA';

export interface Position {
  id: PositionId;
  name: string;
  short: string;
  sort: number;
}

export interface DayHours {
  closed: boolean;
  open: string; // HH:MM
  close: string; // HH:MM (si es <= open, cierra al día siguiente)
}

export interface Store {
  id: string;
  code: string;
  name: string;
  region: string;
  address: string;
  is_demo: boolean;
  /** índice 0 = domingo … 6 = sábado */
  hours: DayHours[];
  created_at: string;
}

export interface StoreSettings {
  store_id: string;
  /** Dotación mínima por hora mientras la tienda está abierta */
  min_staff: number;
  /** Posiciones que deben estar presentes durante todo el horario de apertura */
  key_positions: PositionId[];
  /** Si true, la falta de una posición clave es un error que impide aprobar; si no, advertencia */
  key_positions_blocking: boolean;
  /** Objetivo de dotación por hora (24 valores). null = sin objetivo */
  target_by_hour: number[] | null;
  max_daily_hours: number;
  min_daily_hours: number;
  max_weekly_hours: number;
  min_rest_hours: number;
  max_consecutive_days: number;
  /** Tolerancia (%) respecto de las horas contractuales mensuales */
  contract_tolerance_pct: number;
  updated_at: string;
  updated_by: string | null;
}

export interface Employee {
  id: string;
  store_id: string;
  name: string;
  position_id: PositionId;
  active: boolean;
  /** Horas contractuales semanales (opcional) */
  contract_weekly_hours: number | null;
  is_demo: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  store_id: string | null;
  is_demo: boolean;
}

export type PlanStatus = 'pendiente' | 'en_preparacion' | 'enviada' | 'observada' | 'aprobada';

export interface Plan {
  id: string;
  store_id: string;
  year: number;
  month: number; // 1-12
  status: PlanStatus;
  changed_after_submit: boolean;
  submitted_at: string | null;
  approved_at: string | null;
  last_comment: string | null;
  updated_at: string;
  updated_by: string | null;
  updated_by_name: string | null;
}

export type EntryKind = 'turno' | 'franco' | 'vacaciones' | 'licencia' | 'ausencia';

export interface Entry {
  id: string;
  plan_id: string;
  store_id: string;
  employee_id: string;
  date: string; // YYYY-MM-DD
  kind: EntryKind;
  start: string | null; // HH:MM
  end: string | null; // HH:MM
  /** Posición cubierta en este turno, si difiere de la habitual del empleado */
  position_id: PositionId | null;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface HistoryItem {
  id: string;
  plan_id: string;
  store_id: string;
  action: 'creacion' | 'edicion' | 'envio' | 'observacion' | 'aprobacion' | 'reapertura' | 'edicion_post_envio';
  from_status: PlanStatus | null;
  to_status: PlanStatus | null;
  comment: string | null;
  user_id: string | null;
  user_name: string | null;
  at: string;
}

export type Severity = 'error' | 'advertencia';

export interface AlertRecord {
  id: string;
  plan_id: string;
  store_id: string;
  severity: Severity;
  code: string;
  message: string;
  date: string | null;
  employee_id: string | null;
  created_at: string;
}

export type TableName =
  | 'stores'
  | 'store_settings'
  | 'employees'
  | 'profiles'
  | 'plans'
  | 'entries'
  | 'plan_history'
  | 'alerts';

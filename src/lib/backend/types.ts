import type { Profile, TableName } from '../types';

export type Filter =
  | { col: string; op: 'eq'; value: string | number | boolean }
  | { col: string; op: 'gte' | 'lte'; value: string | number }
  | { col: string; op: 'in'; value: (string | number)[] };

export interface Backend {
  mode: 'local' | 'supabase';
  restoreSession(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  select<T>(table: TableName, filters?: Filter[]): Promise<T[]>;
  upsert<T extends object>(table: TableName, rows: T[]): Promise<void>;
  remove(table: TableName, keyCol: string, values: string[]): Promise<void>;
  /** Notifica cuando otra pestaña / usuario modificó datos. */
  subscribe(onChange: (table: TableName) => void): () => void;
  /** Sólo modo local: crea un usuario con contraseña. */
  createLocalUser?(profile: Profile, password: string): Promise<void>;
}

/** Clave primaria de cada tabla. */
export const PK: Record<TableName, string> = {
  stores: 'id',
  store_settings: 'store_id',
  employees: 'id',
  profiles: 'id',
  plans: 'id',
  entries: 'id',
  plan_history: 'id',
  alerts: 'id',
};

export class PermissionError extends Error {}

import type { Profile, TableName } from '../types';

export interface Backend {
  mode: 'local' | 'supabase';
  restoreSession(): Promise<Profile | null>;
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  /** Devuelve las filas visibles para el usuario actual. */
  all<T>(table: TableName): Promise<T[]>;
  insert<T extends object>(table: TableName, rows: T[]): Promise<void>;
  update<T extends object>(table: TableName, id: string, patch: Partial<T>): Promise<void>;
  /** Notifica cambios hechos en otra pestaña / por otro usuario. */
  subscribe(onChange: () => void): () => void;
}

/** Tablas en las que sólo se agregan filas: no se editan ni se borran (auditoría y versiones). */
export const APPEND_ONLY: TableName[] = ['template_versions', 'request_revisions', 'final_documents', 'audit_events', 'files'];

export const TABLES: TableName[] = [
  'profiles', 'stores', 'employees', 'templates', 'template_versions', 'measure_types', 'situation_types',
  'requests', 'request_revisions', 'final_documents', 'audit_events', 'notifications', 'policy', 'files',
];

export class PermissionError extends Error {}

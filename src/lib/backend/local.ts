import type { Profile, TableName } from '../types';
import { PK, PermissionError, type Backend, type Filter } from './types';

/**
 * Backend de MODO DEMOSTRACIÓN: los datos se guardan en el almacenamiento local del navegador.
 * Persisten entre recargas, pero no se comparten con otros dispositivos ni usuarios.
 * Reproduce las mismas reglas de acceso que las políticas RLS de Supabase (ver supabase/schema.sql).
 */

const DB_KEY = 'farmaplan:db:v1';
const SESSION_KEY = 'farmaplan:session:v1';

type DB = Record<TableName, Record<string, unknown>[]> & { _passwords: Record<string, string> };

const TABLES: TableName[] = ['stores', 'store_settings', 'employees', 'profiles', 'plans', 'entries', 'plan_history', 'alerts'];
const SCOPED_BY_STORE: TableName[] = ['store_settings', 'employees', 'plans', 'entries', 'plan_history', 'alerts'];

function emptyDb(): DB {
  const db = { _passwords: {} } as DB;
  for (const t of TABLES) db[t] = [];
  return db;
}

export class LocalBackend implements Backend {
  mode = 'local' as const;
  private user: Profile | null = null;
  private channel: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('farmaplan') : null;

  private load(): DB {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return emptyDb();
      return { ...emptyDb(), ...JSON.parse(raw) };
    } catch {
      return emptyDb();
    }
  }

  private save(db: DB, table: TableName) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      throw new Error('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.');
    }
    this.channel?.postMessage({ table });
  }

  isEmpty() {
    return this.load().stores.length === 0;
  }

  /** Inserta datos sin aplicar permisos (sólo para cargar la demostración). */
  seed(data: Partial<Record<TableName, object[]>>, passwords: Record<string, string>) {
    const db = this.load();
    for (const [t, rows] of Object.entries(data) as [TableName, Record<string, unknown>[]][]) {
      const pk = PK[t];
      const ids = new Set(rows.map((r) => r[pk]));
      db[t] = [...db[t].filter((r) => !ids.has(r[pk])), ...rows];
    }
    Object.assign(db._passwords, passwords);
    this.save(db, 'stores');
  }

  resetAll() {
    localStorage.removeItem(DB_KEY);
    this.channel?.postMessage({ table: 'stores' });
  }

  async restoreSession() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const p = (this.load().profiles as unknown as Profile[]).find((x) => x.id === id) ?? null;
    this.user = p;
    return p;
  }

  async signIn(email: string, password: string) {
    const db = this.load();
    const p = (db.profiles as unknown as Profile[]).find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!p || db._passwords[p.id] !== password) throw new Error('Usuario o contraseña incorrectos.');
    this.user = p;
    localStorage.setItem(SESSION_KEY, p.id);
    return p;
  }

  async signOut() {
    this.user = null;
    localStorage.removeItem(SESSION_KEY);
  }

  private visible(table: TableName, row: Record<string, unknown>): boolean {
    const u = this.user;
    if (!u) return false;
    if (u.role === 'admin') return true;
    if (table === 'stores') return row.id === u.store_id;
    if (table === 'profiles') return row.id === u.id;
    if (SCOPED_BY_STORE.includes(table)) return row.store_id === u.store_id;
    return false;
  }

  private canWrite(table: TableName, row: Record<string, unknown>): boolean {
    const u = this.user;
    if (!u) return false;
    if (u.role === 'admin') return true;
    if (['stores', 'store_settings', 'profiles'].includes(table)) return false;
    return row.store_id === u.store_id;
  }

  async select<T>(table: TableName, filters: Filter[] = []): Promise<T[]> {
    const rows = this.load()[table].filter((r) => this.visible(table, r));
    return rows.filter((r) =>
      filters.every((f) => {
        const v = r[f.col] as string | number;
        if (f.op === 'eq') return v === f.value;
        if (f.op === 'gte') return v >= f.value;
        if (f.op === 'lte') return v <= f.value;
        return (f.value as (string | number)[]).includes(v);
      }),
    ) as T[];
  }

  async upsert<T extends object>(table: TableName, rows: T[]) {
    if (!rows.length) return;
    const db = this.load();
    const pk = PK[table];
    const index = new Map(db[table].map((r, i) => [r[pk], i]));
    for (const row of rows as Record<string, unknown>[]) {
      const existing = index.has(row[pk]) ? db[table][index.get(row[pk])!] : null;
      if (!this.canWrite(table, row) || (existing && !this.canWrite(table, existing))) {
        throw new PermissionError('No tiene permisos para modificar estos datos.');
      }
      if (existing) db[table][index.get(row[pk])!] = { ...existing, ...row };
      else {
        index.set(row[pk], db[table].length);
        db[table].push(row);
      }
    }
    this.save(db, table);
  }

  async remove(table: TableName, keyCol: string, values: string[]) {
    if (!values.length) return;
    const db = this.load();
    const set = new Set(values);
    for (const r of db[table]) {
      if (set.has(r[keyCol] as string) && !this.canWrite(table, r)) {
        throw new PermissionError('No tiene permisos para eliminar estos datos.');
      }
    }
    db[table] = db[table].filter((r) => !set.has(r[keyCol] as string));
    this.save(db, table);
  }

  async createLocalUser(profile: Profile, password: string) {
    if (this.user?.role !== 'admin') throw new PermissionError('Sólo un administrador puede crear usuarios.');
    const db = this.load();
    if ((db.profiles as unknown as Profile[]).some((p) => p.email.toLowerCase() === profile.email.toLowerCase() && p.id !== profile.id)) {
      throw new Error('Ya existe un usuario con ese correo.');
    }
    db._passwords[profile.id] = password;
    this.save(db, 'profiles');
    await this.upsert('profiles', [profile]);
  }

  subscribe(onChange: (table: TableName) => void) {
    const onMsg = (e: MessageEvent) => onChange(e.data.table);
    const onStorage = (e: StorageEvent) => {
      if (e.key === DB_KEY) onChange('entries');
    };
    this.channel?.addEventListener('message', onMsg);
    window.addEventListener('storage', onStorage);
    return () => {
      this.channel?.removeEventListener('message', onMsg);
      window.removeEventListener('storage', onStorage);
    };
  }
}

import type { DisciplinaryRequest, Profile, TableName } from '../types';
import { APPEND_ONLY, PermissionError, TABLES, type Backend } from './types';

/**
 * MODO DEMOSTRACIÓN: los datos se guardan en IndexedDB, en el navegador.
 * Persisten entre recargas pero no se comparten entre equipos. Reproduce las reglas
 * de supabase/schema.sql: tablas de sólo agregado, visibilidad por rol y bloqueo de lo aprobado.
 */

const DB_NAME = 'portal-rh';
const SESSION_KEY = 'portal-rh:session';

type Row = Record<string, unknown> & { id: string };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      for (const t of [...TABLES, '_passwords']) if (!r.result.objectStoreNames.contains(t)) r.result.createObjectStore(t, { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function req<T>(r: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class LocalBackend implements Backend {
  mode = 'local' as const;
  private user: Profile | null = null;
  private db: Promise<IDBDatabase> = openDb();
  private channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('portal-rh') : null;

  private async store(name: string, mode: IDBTransactionMode) {
    return (await this.db).transaction(name, mode).objectStore(name);
  }

  private async raw<T>(table: string): Promise<T[]> {
    return req((await this.store(table, 'readonly')).getAll()) as Promise<T[]>;
  }

  async isEmpty() {
    return (await this.raw('profiles')).length === 0;
  }

  /** Carga datos iniciales sin aplicar permisos (sólo demostración). */
  async seed(data: Partial<Record<TableName, object[]>>, passwords: Record<string, string>) {
    const db = await this.db;
    const names = [...Object.keys(data), '_passwords'];
    const tx = db.transaction(names, 'readwrite');
    for (const [t, rows] of Object.entries(data)) for (const r of rows) tx.objectStore(t).put(r);
    for (const [id, pw] of Object.entries(passwords)) tx.objectStore('_passwords').put({ id, pw });
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  }

  async resetAll() {
    const db = await this.db;
    const tx = db.transaction([...TABLES, '_passwords'], 'readwrite');
    for (const t of [...TABLES, '_passwords']) tx.objectStore(t).clear();
    await new Promise((res) => { tx.oncomplete = res; });
    localStorage.removeItem(SESSION_KEY);
    this.user = null;
  }

  async restoreSession() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const p = (await this.raw<Profile>('profiles')).find((x) => x.id === id && x.active) ?? null;
    this.user = p;
    return p;
  }

  async signIn(email: string, password: string) {
    const p = (await this.raw<Profile>('profiles')).find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    const pw = p ? await req((await this.store('_passwords', 'readonly')).get(p.id)) as { pw: string } | undefined : undefined;
    if (!p || !pw || pw.pw !== password) throw new Error('Usuario o contraseña incorrectos.');
    if (!p.active) throw new Error('El usuario está desactivado. Consulte a RH.');
    this.user = p;
    localStorage.setItem(SESSION_KEY, p.id);
    return p;
  }

  async signOut() {
    this.user = null;
    localStorage.removeItem(SESSION_KEY);
  }

  /** Mismas reglas de lectura que las políticas RLS. */
  private visible(table: TableName, row: Row, ctx: { requests: Map<string, DisciplinaryRequest> }): boolean {
    const u = this.user!;
    if (u.role === 'admin_rh') return true;
    const reqOk = (id: unknown) => {
      const r = ctx.requests.get(id as string);
      if (!r) return false;
      if (u.role === 'coordinador') return u.areas.includes(r.area) || r.coordinator_id === u.id;
      return r.manager_id === u.id;
    };
    switch (table) {
      case 'requests': return reqOk(row.id);
      case 'request_revisions':
      case 'final_documents': return reqOk(row.request_id);
      case 'audit_events':
        if (row.entity !== 'request') return u.role !== 'gerente';
        if (u.role === 'gerente' && row.internal) return false;
        return reqOk(row.entity_id);
      case 'notifications': return row.user_id === u.id;
      case 'employees':
        return u.role === 'gerente' ? u.store_ids.includes(row.store_id as string) : true;
      case 'templates': return u.role === 'gerente' ? row.active === true : true;
      default: return true;
    }
  }

  async all<T>(table: TableName): Promise<T[]> {
    if (!this.user) return [];
    const rows = await this.raw<Row>(table);
    const requests = new Map((await this.raw<DisciplinaryRequest>('requests')).map((r) => [r.id, r]));
    return rows.filter((r) => this.visible(table, r, { requests })) as unknown as T[];
  }

  private canInsert(table: TableName, row: Row) {
    const u = this.user!;
    if (['profiles', 'stores', 'employees', 'templates', 'template_versions', 'measure_types', 'situation_types', 'policy'].includes(table)) {
      return u.role === 'admin_rh';
    }
    if (table === 'requests') return u.role === 'gerente' && row.manager_id === u.id;
    if (table === 'audit_events') return row.actor_id === u.id;
    return true;
  }

  async insert<T extends object>(table: TableName, rows: T[]) {
    if (!this.user) throw new PermissionError('Sesión vencida.');
    const s = await this.store(table, 'readwrite');
    for (const row of rows as unknown as Row[]) {
      if (!this.canInsert(table, row)) throw new PermissionError('No tiene permisos para registrar estos datos.');
      const exists = await req(s.get(row.id));
      if (exists) throw new PermissionError('El registro ya existe.');
      await req(s.add(row));
    }
    this.channel?.postMessage(table);
  }

  async update<T extends object>(table: TableName, id: string, patch: Partial<T>) {
    if (!this.user) throw new PermissionError('Sesión vencida.');
    if (APPEND_ONLY.includes(table)) throw new PermissionError('Este registro es parte del historial y no puede modificarse.');
    const u = this.user;
    const s = await this.store(table, 'readwrite');
    const current = (await req(s.get(id))) as Row | undefined;
    if (!current) throw new Error('Registro inexistente.');
    if (table === 'requests') {
      const r = current as unknown as DisciplinaryRequest;
      const p = patch as Partial<DisciplinaryRequest>;
      const vis = u.role === 'admin_rh' || (u.role === 'coordinador' ? u.areas.includes(r.area) || r.coordinator_id === u.id : r.manager_id === u.id);
      if (!vis) throw new PermissionError('No tiene acceso a esta solicitud.');
      // Aprobación: nunca por quien inició la solicitud, siempre por RH.
      if (p.status === 'aprobada' && (u.role === 'gerente' || r.manager_id === u.id)) {
        throw new PermissionError('No puede aprobar esta solicitud.');
      }
      // Datos bloqueados después de la decisión: sólo se admiten cambios de estado y de cierre.
      if (['aprobada', 'rechazada', 'cerrada'].includes(r.status)) {
        const allowed = new Set(['status', 'updated_at', 'closed_at', 'notified_at', 'revision', 'approved_by', 'approved_by_name', 'approved_at', 'approved_revision', 'final_document_id', 'decided_at']);
        if (Object.keys(p).some((k) => !allowed.has(k))) throw new PermissionError('La solicitud está decidida: sus datos no pueden modificarse. Inicie una rectificación.');
      }
    } else if (table === 'notifications') {
      if (current.user_id !== u.id) throw new PermissionError('No puede modificar avisos ajenos.');
    } else if (u.role !== 'admin_rh') {
      throw new PermissionError('Sólo administradores de RH pueden modificar la configuración.');
    }
    await req(s.put({ ...current, ...patch, id }));
    this.channel?.postMessage(table);
  }

  subscribe(onChange: () => void) {
    if (!this.channel) return () => {};
    const h = () => onChange();
    this.channel.addEventListener('message', h);
    return () => this.channel?.removeEventListener('message', h);
  }
}

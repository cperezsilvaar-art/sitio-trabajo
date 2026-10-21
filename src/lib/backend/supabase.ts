import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Profile, TableName } from '../types';
import type { Backend, Filter } from './types';

/**
 * Backend persistente en Supabase (PostgreSQL + Auth). Los permisos se aplican en la base
 * mediante Row Level Security (ver supabase/schema.sql); la aplicación nunca usa la service key.
 */
export class SupabaseBackend implements Backend {
  mode = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey);
  }

  private async profileFor(userId: string): Promise<Profile> {
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      throw new Error('El usuario existe pero no tiene un perfil asignado. Un administrador debe crear su registro en la tabla "profiles".');
    }
    return data as Profile;
  }

  async restoreSession() {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return null;
    try {
      return await this.profileFor(data.session.user.id);
    } catch {
      return null;
    }
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Usuario o contraseña incorrectos.' : error.message);
    return this.profileFor(data.user.id);
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async select<T>(table: TableName, filters: Filter[] = []): Promise<T[]> {
    const out: T[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      let q = this.sb.from(table).select('*');
      for (const f of filters) {
        if (f.op === 'eq') q = q.eq(f.col, f.value);
        else if (f.op === 'gte') q = q.gte(f.col, f.value);
        else if (f.op === 'lte') q = q.lte(f.col, f.value);
        else q = q.in(f.col, f.value as (string | number)[]);
      }
      const { data, error } = await q.range(from, from + page - 1);
      if (error) throw new Error(error.message);
      out.push(...(data as T[]));
      if (!data || data.length < page) break;
    }
    return out;
  }

  async upsert<T extends object>(table: TableName, rows: T[]) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await this.sb.from(table).upsert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
  }

  async remove(table: TableName, keyCol: string, values: string[]) {
    for (let i = 0; i < values.length; i += 200) {
      const { error } = await this.sb.from(table).delete().in(keyCol, values.slice(i, i + 200));
      if (error) throw new Error(error.message);
    }
  }

  subscribe(onChange: (table: TableName) => void) {
    const ch = this.sb
      .channel('farmaplan-cambios')
      .on('postgres_changes', { event: '*', schema: 'public' }, (p) => onChange(p.table as TableName))
      .subscribe();
    return () => {
      this.sb.removeChannel(ch);
    };
  }
}

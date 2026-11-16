import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Profile, TableName } from '../types';
import { type Backend } from './types';

/** Backend compartido: PostgreSQL de Supabase. Los permisos los aplica la base (RLS + triggers). */
export class SupabaseBackend implements Backend {
  mode = 'supabase' as const;
  private sb: SupabaseClient;

  constructor(url: string, key: string) {
    this.sb = createClient(url, key);
  }

  private async profile(): Promise<Profile | null> {
    const { data: { user } } = await this.sb.auth.getUser();
    if (!user) return null;
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', user.id).single();
    if (error) throw new Error('El usuario no tiene perfil en el portal. Consulte a RH.');
    if (!data.active) throw new Error('El usuario está desactivado.');
    return data as Profile;
  }

  restoreSession() {
    return this.profile().catch(() => null);
  }

  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Usuario o contraseña incorrectos.');
    const p = await this.profile();
    if (!p) throw new Error('No se pudo iniciar sesión.');
    return p;
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async all<T>(table: TableName): Promise<T[]> {
    const { data, error } = await this.sb.from(table).select('*');
    if (error) throw new Error(error.message);
    return data as T[];
  }

  async insert<T extends object>(table: TableName, rows: T[]) {
    const { error } = await this.sb.from(table).insert(rows);
    if (error) throw new Error(error.message);
  }

  async update<T extends object>(table: TableName, id: string, patch: Partial<T>) {
    const { error } = await this.sb.from(table).update(patch as never).eq('id', id);
    if (error) throw new Error(error.message);
  }

  subscribe(onChange: () => void) {
    const ch = this.sb
      .channel('portal-rh')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => onChange())
      .subscribe();
    return () => {
      this.sb.removeChannel(ch);
    };
  }
}

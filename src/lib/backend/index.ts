import { LocalBackend } from './local';
import { SupabaseBackend } from './supabase';
import type { Backend } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const backend: Backend = url && key ? new SupabaseBackend(url, key) : new LocalBackend();
export const isDemo = backend.mode === 'local';
export { LocalBackend };

import { LocalBackend } from './local';
import { SupabaseBackend } from './supabase';
import type { Backend } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key && !url.includes('xxxxxxxx'));

export const backend: Backend = supabaseConfigured ? new SupabaseBackend(url!, key!) : new LocalBackend();

export const localBackend = backend instanceof LocalBackend ? backend : null;

export type { Backend };

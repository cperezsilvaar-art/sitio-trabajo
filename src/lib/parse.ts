import type { CellChange } from './store';
import type { Entry, EntryKind } from './types';
import { pad } from './dates';

type CellEntries = CellChange['entries'];

function normTime(t: string): string | null {
  const s = t.trim().replace('.', ':').replace('h', '');
  let h: number, m = 0;
  if (/^\d{1,2}$/.test(s)) h = Number(s);
  else if (/^\d{1,2}:\d{2}$/.test(s)) [h, m] = s.split(':').map(Number);
  else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2));
    m = Number(s.slice(-2));
  } else return null;
  if (h === 24 && m === 0) h = 0;
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

const KIND_WORDS: Record<string, EntryKind> = {
  f: 'franco', franco: 'franco', libre: 'franco', fr: 'franco',
  v: 'vacaciones', vac: 'vacaciones', vacaciones: 'vacaciones',
  l: 'licencia', lic: 'licencia', licencia: 'licencia',
  a: 'ausencia', aus: 'ausencia', ausencia: 'ausencia',
};

/**
 * Interpreta la escritura rápida en una celda:
 *  "8-16", "08:30-16:30", "0830-1630", "22-6" (nocturno), "8-12 15-19" (turno cortado),
 *  "f" franco, "v" vacaciones, "l" licencia, "a" ausencia, vacío = borrar.
 * Devuelve null si el texto no es válido.
 */
export function parseCellInput(text: string): CellEntries | null {
  const t = text.trim().toLowerCase();
  if (!t) return [];
  if (KIND_WORDS[t]) return [{ kind: KIND_WORDS[t], start: null, end: null, position_id: null, notes: null }];
  const parts = t.split(/[\s,;/]+/).filter(Boolean);
  const out: CellEntries = [];
  for (const p of parts) {
    const m = p.split(/[-–a]/);
    if (m.length !== 2) return null;
    const s = normTime(m[0]);
    const e = normTime(m[1]);
    if (!s || !e || s === e) return null;
    out.push({ kind: 'turno', start: s, end: e, position_id: null, notes: null });
  }
  return out.length ? out : null;
}

export function shortTime(t: string | null) {
  if (!t) return '';
  return t.endsWith(':00') ? String(Number(t.slice(0, 2))) : `${Number(t.slice(0, 2))}:${t.slice(3)}`;
}

export function entryLabel(e: Pick<Entry, 'kind' | 'start' | 'end'>): string {
  if (e.kind === 'turno') return `${shortTime(e.start)}–${shortTime(e.end)}`;
  return { franco: 'F', vacaciones: 'VAC', licencia: 'LIC', ausencia: 'AUS' }[e.kind];
}

export function cellText(list: Pick<Entry, 'kind' | 'start' | 'end'>[]): string {
  return list.map((e) => (e.kind === 'turno' ? `${e.start}-${e.end}` : entryLabel(e).toLowerCase())).join(' ');
}

export function stripEntry(e: Entry): CellEntries[number] {
  return { kind: e.kind, start: e.start, end: e.end, position_id: e.position_id, notes: e.notes };
}

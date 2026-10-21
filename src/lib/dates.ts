export const pad = (n: number) => String(n).padStart(2, '0');

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function monthDates(year: number, month: number): string[] {
  const n = daysInMonth(year, month);
  return Array.from({ length: n }, (_, i) => isoDate(year, month, i + 1));
}

export function parseIso(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export function weekday(d: string): number {
  return parseIso(d).getDay();
}

export function addDays(d: string, n: number): string {
  const dt = parseIso(d);
  dt.setDate(dt.getDate() + n);
  return isoDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function monthKey(year: number, month: number) {
  return `${year}-${pad(month)}`;
}

export function prevMonth(year: number, month: number): [number, number] {
  return month === 1 ? [year - 1, 12] : [year, month - 1];
}

/** Semanas (lunes a domingo) que intersectan el mes; cada una con sus fechas dentro del mes. */
export function monthWeeks(year: number, month: number): string[][] {
  const weeks: string[][] = [];
  let current: string[] = [];
  for (const d of monthDates(year, month)) {
    if (weekday(d) === 1 && current.length) {
      weeks.push(current);
      current = [];
    }
    current.push(d);
  }
  if (current.length) weeks.push(current);
  return weeks;
}

/** "HH:MM" → minutos desde 00:00. */
export function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function fromMin(m: number): string {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${pad(Math.floor(mm / 60))}:${pad(mm % 60)}`;
}

export function fmtHours(h: number, digits = 1): string {
  return h.toLocaleString('es-AR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function fmtDayLabel(d: string): string {
  return parseIso(d).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function nowIso() {
  return new Date().toISOString();
}

export function uid(): string {
  return crypto.randomUUID();
}

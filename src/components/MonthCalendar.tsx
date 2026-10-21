import { POSITION_BY_ID, POSITION_COLORS, WEEKDAYS_SHORT } from '../lib/constants';
import { weekday } from '../lib/dates';
import { entryLabel } from '../lib/parse';
import type { Employee, Entry, PositionId } from '../lib/types';
import { cx } from './ui';

/** Calendario mensual con todos los turnos del día. */
export function MonthCalendar({ dates, entries, employees, pos, selected, onPick, problemDays = [] }: {
  dates: string[]; entries: Entry[]; employees: Employee[]; pos?: PositionId | null; selected?: string | null;
  onPick?: (d: string) => void; problemDays?: string[];
}) {
  const emp = new Map(employees.map((e) => [e.id, e]));
  const lead = (weekday(dates[0]) + 6) % 7; // semana empieza el lunes
  const byDate = new Map<string, Entry[]>();
  for (const e of entries) {
    const em = emp.get(e.employee_id);
    if (!em) continue;
    const p = e.position_id ?? em.position_id;
    if (pos && p !== pos) continue;
    byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  }
  const order = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-7 gap-1.5">
        {order.map((d) => <div key={d} className="pb-1 text-center text-xs font-medium text-slate-500">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`l${i}`} />)}
        {dates.map((d) => {
          const list = (byDate.get(d) ?? []).sort((a, b) => (a.start ?? 'z').localeCompare(b.start ?? 'z'));
          const shifts = list.filter((x) => x.kind === 'turno');
          const off = list.filter((x) => x.kind !== 'turno');
          return (
            <button
              key={d}
              onClick={() => onPick?.(d)}
              className={cx(
                'flex min-h-[7.5rem] flex-col rounded-lg border bg-white p-1.5 text-left transition hover:border-teal-500',
                selected === d ? 'border-teal-600 ring-2 ring-teal-500/30' : problemDays.includes(d) ? 'border-rose-300' : 'border-slate-200',
              )}
            >
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={cx('font-semibold', problemDays.includes(d) ? 'text-rose-700' : 'text-navy-900')}>{Number(d.slice(8))} <span className="font-normal text-slate-400">{WEEKDAYS_SHORT[weekday(d)]}</span></span>
                <span className="rounded bg-slate-100 px-1 text-[10px] text-slate-600">{new Set(shifts.map((s) => s.employee_id)).size} pers.</span>
              </div>
              <ul className="space-y-0.5 overflow-hidden">
                {shifts.slice(0, 7).map((s) => {
                  const em = emp.get(s.employee_id)!;
                  const p = s.position_id ?? em.position_id;
                  return (
                    <li key={s.id} className="flex items-center gap-1 truncate text-[10px] leading-tight text-slate-700" title={`${em.name} · ${POSITION_BY_ID[p].name} · ${s.start}–${s.end}`}>
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: POSITION_COLORS[p] }} />
                      <span className="tabular-nums text-slate-500">{entryLabel(s)}</span>
                      <span className="truncate">{em.name.split(' ')[0]}</span>
                    </li>
                  );
                })}
                {shifts.length > 7 && <li className="text-[10px] text-slate-400">+{shifts.length - 7} más</li>}
              </ul>
              {off.length > 0 && <div className="mt-auto pt-1 text-[10px] text-slate-400">{off.length} franco/ausencia</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

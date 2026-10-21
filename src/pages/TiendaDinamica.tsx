import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DailyCoverageChart, Heatmap, HourlyChart, HoursByPositionChart, PositionByDayChart, PositionPresence } from '../components/charts';
import { MonthCalendar } from '../components/MonthCalendar';
import { AlertList, Card, Empty, Kpi, MonthPicker, PageHeader, Select, StatusBadge } from '../components/ui';
import { fmtClock, hourlyProfile } from '../lib/calc';
import { MONTHS, POSITIONS, POSITION_BY_ID, WEEKDAYS_SHORT } from '../lib/constants';
import { fmtDayLabel, fmtHours, pad, weekday } from '../lib/dates';
import { entryLabel } from '../lib/parse';
import { useSelection } from '../lib/selection';
import { useAnalysis, useData } from '../lib/store';
import type { PositionId } from '../lib/types';

export function TiendaDinamica() {
  const { user, stores, settings, employees, entriesFor, planFor, monthLoaded } = useData();
  const { year, month, storeId, setMonth, setStoreId } = useSelection();
  const [params] = useSearchParams();
  useEffect(() => {
    const t = params.get('tienda');
    if (t) setStoreId(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const [date, setDate] = useState<string | null>(null);
  const [pos, setPos] = useState<PositionId | ''>('');
  const store = stores.find((s) => s.id === storeId);
  const a = useAnalysis(storeId, year, month, pos || null);
  const full = useAnalysis(storeId, year, month);
  useEffect(() => setDate(null), [year, month, storeId]);

  const staff = useMemo(() => employees.filter((e) => e.store_id === storeId), [employees, storeId]);
  if (!store) return <Empty>Seleccioná una tienda.</Empty>;
  if (!a || !full || !monthLoaded(year, month)) return <Empty>Cargando…</Empty>;
  const st = settings[store.id];
  const entries = entriesFor(store.id, year, month).filter((e) => e.date.startsWith(`${year}-${pad(month)}`));
  const plan = planFor(store.id, year, month);
  const prof = hourlyProfile(a);
  const openHours = prof.filter((_, h) => a.openSlots.some((o, i) => o && i % 24 === h));
  const peak = openHours.length ? openHours.reduce((b, x) => (x.avg > b.avg ? x : b)) : null;
  const low = openHours.length ? openHours.reduce((b, x) => (x.avg < b.avg ? x : b)) : null;
  const di = date ? a.dates.indexOf(date) : -1;
  const dayAlerts = date ? full.alerts.filter((x) => x.date === date) : full.alerts;
  const missingPos = POSITIONS.map((p) => ({ p, days: a.dates.filter((_, i) => full.posByDay[p.id][i] === 0 && !store.hours[weekday(a.dates[i])]?.closed) }));
  const dayEntries = date ? entries.filter((e) => e.date === date) : [];
  const empById = new Map(staff.map((e) => [e.id, e]));
  const hoursPerDay = a.dates.map((d, i) => ({ dia: `${Number(d.slice(8))}`, horas: Math.round(a.hoursByDay[i] * 10) / 10 }));
  const target = st.target_by_hour;
  const targetHours = target ? a.dates.reduce((sum, _, d) => sum + Array.from({ length: 24 }, (_, h) => (a.openSlots[d * 24 + h] ? target[h] ?? 0 : 0)).reduce((x, y) => x + y, 0), 0) : 0;
  const coveredTarget = target ? a.dates.reduce((sum, _, d) => sum + Array.from({ length: 24 }, (_, h) => (a.openSlots[d * 24 + h] ? Math.min(full.coverage[d * 24 + h], target[h] ?? 0) : 0)).reduce((x, y) => x + y, 0), 0) : 0;

  return (
    <div>
      <PageHeader title="Dinámica por tienda" subtitle={<>{store.name} · {MONTHS[month - 1]} {year} · <StatusBadge status={plan?.status ?? 'pendiente'} /></>}>
        {user?.role === 'admin' && (
          <Select label="Tienda" value={storeId ?? ''} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_demo ? ' (demo)' : ''}</option>)}
          </Select>
        )}
        <MonthPicker year={year} month={month} onChange={setMonth} />
        <Select label="Fecha" value={date ?? ''} onChange={(e) => setDate(e.target.value || null)}>
          <option value="">Todo el mes</option>
          {a.dates.map((d) => <option key={d} value={d}>{WEEKDAYS_SHORT[weekday(d)]} {Number(d.slice(8))}</option>)}
        </Select>
        <Select label="Posición" value={pos} onChange={(e) => setPos(e.target.value as PositionId | '')}>
          <option value="">Todas</option>
          {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label={date ? 'Personas en el día' : 'Personas por día'} value={date ? a.workingByDay[di] : fmtHours(a.workingByDay.reduce((x, y) => x + y, 0) / a.days)} hint={date ? fmtDayLabel(date) : 'promedio'} />
        <Kpi label="Horas planificadas" value={fmtHours(date ? a.hoursByDay[di] : a.totalHours, 0)} hint={date ? 'en el día' : `${fmtHours(a.totalHours / a.days)} h/día · ${fmtHours((a.totalHours / a.days) * 7, 0)} h/semana`} />
        <Kpi label="Apertura / cierre" value={date ? `${fmtClock(a.firstStart[di])} – ${fmtClock(a.lastEnd[di])}` : (store.hours[1]?.closed ? 'Cerrado' : store.hours[1]?.open === store.hours[1]?.close ? '24 h' : `${store.hours[1]?.open} – ${store.hours[1]?.close}`)} hint={date ? 'primer ingreso y último egreso planificados' : 'horario configurado (lunes)'} />
        <Kpi label="Mayor dotación" value={peak && a.totalHours ? `${pad(peak.hour)}–${pad(peak.hour + 1)} h` : '—'} hint={peak ? `${fmtHours(peak.avg)} personas promedio` : ''} />
        <Kpi label="Menor dotación" value={low && a.totalHours ? `${pad(low.hour)}–${pad(low.hour + 1)} h` : '—'} hint={low ? `${fmtHours(low.avg)} personas promedio (abierto)` : ''} tone={low && low.avg < st.min_staff ? 'bad' : 'default'} />
        <Kpi label="Objetivo de cobertura" value={target ? `${Math.round((coveredTarget / Math.max(1, targetHours)) * 100)}%` : 'Sin objetivo'} hint={target ? `${fmtHours(full.targetDeficitHours, 0)} horas-persona faltantes` : 'configurable en Tiendas y parámetros'} tone={!target ? 'default' : coveredTarget >= targetHours ? 'good' : 'warn'} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title={date ? `Cobertura por hora · ${fmtDayLabel(date)}` : 'Cobertura por hora (promedio del mes)'} subtitle="Prevista vs. mínima y objetivo configurados">
          <HourlyChart a={a} settings={st} date={date} pos={pos || null} />
        </Card>
        <Card title="Mapa de calor día × franja" subtitle="Hacé clic en un día para ver su detalle">
          <Heatmap a={a} pos={pos || null} onPick={setDate} selected={date} />
        </Card>
        <Card title="Presencia de posiciones por franja" subtitle={date ? fmtDayLabel(date) : 'Todo el mes'}>
          <PositionPresence a={full} date={date} />
        </Card>
        <Card title="Distribución por posición" subtitle="Personas de cada posición con turno por día">
          <PositionByDayChart a={full} />
        </Card>
        <Card title="Horas planificadas por día">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={hoursPerDay} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} onClick={(e) => e?.activeLabel && setDate(a.dates[Number(e.activeLabel) - 1])}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} labelFormatter={(l) => `Día ${l}`} formatter={(v: number) => [`${v} h`, 'Horas']} />
              <Bar isAnimationActive={false} dataKey="horas" fill="#14b8a6" radius={[4, 4, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Horas por posición"><HoursByPositionChart a={a} /></Card>
        <Card title="Personas trabajando por día"><DailyCoverageChart a={a} onPick={setDate} /></Card>
        <Card title="Días sin determinadas posiciones" subtitle="Días abiertos en que la posición no tiene ningún turno">
          <ul className="space-y-2 text-sm">
            {missingPos.map(({ p, days }) => (
              <li key={p.id} className="flex items-start justify-between gap-3">
                <span className="text-slate-700">{p.name}</span>
                <span className={days.length ? 'text-right text-rose-700' : 'text-emerald-700'}>
                  {days.length ? `${days.length} día(s): ${days.slice(0, 10).map((d) => Number(d.slice(8))).join(', ')}${days.length > 10 ? '…' : ''}` : 'Presente todos los días'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {date && (
        <Card title={`Turnos del ${fmtDayLabel(date)}`} className="mt-4" bodyClass="p-0 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Empleado</th><th>Posición</th><th>Registro</th><th>Horas</th><th>Observaciones</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {dayEntries.sort((x, y) => (x.start ?? 'z').localeCompare(y.start ?? 'z')).map((e) => {
                const em = empById.get(e.employee_id);
                const p = e.position_id ?? em?.position_id;
                const iv = full.intervals.find((i) => i.entry.id === e.id);
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-2 font-medium text-navy-900">{em?.name}</td>
                    <td>{p && POSITION_BY_ID[p].name}</td>
                    <td className="tabular-nums">{e.kind === 'turno' ? `${e.start} – ${e.end}` : entryLabel(e)}</td>
                    <td className="tabular-nums">{iv ? fmtHours((iv.end - iv.start) / 60) : '—'}</td>
                    <td className="text-slate-500">{e.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card title="Calendario mensual de turnos" className="xl:col-span-2">
          <MonthCalendar dates={a.dates} entries={entries} employees={staff} pos={pos || null} selected={date} onPick={setDate} problemDays={full.problemDays} />
        </Card>
        <Card title={`Alertas operativas${date ? ' del día' : ''} (${dayAlerts.length})`} bodyClass="max-h-[40rem] overflow-auto p-4">
          <AlertList alerts={dayAlerts} />
        </Card>
      </div>
    </div>
  );
}

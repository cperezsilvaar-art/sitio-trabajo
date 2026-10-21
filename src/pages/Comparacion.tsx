import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, Empty, MonthPicker, PageHeader, Progress, Select, StatusBadge, StoreName, cx } from '../components/ui';
import { MONTHS, POSITIONS, POSITION_COLORS, SEQ_BLUE } from '../lib/constants';
import { fmtHours, pad } from '../lib/dates';
import { useSelection } from '../lib/selection';
import { useData } from '../lib/store';
import type { PositionId } from '../lib/types';
import { STORE_COLORS, useAllAnalyses } from './Dashboard';

const BANDS = [
  { label: '00–06', from: 0, to: 6 }, { label: '06–09', from: 6, to: 9 }, { label: '09–12', from: 9, to: 12 }, { label: '12–15', from: 12, to: 15 },
  { label: '15–18', from: 15, to: 18 }, { label: '18–21', from: 18, to: 21 }, { label: '21–24', from: 21, to: 24 },
];

export function Comparacion() {
  const { stores, settings, planFor, monthLoaded } = useData();
  const { year, month, setMonth } = useSelection();
  const [region, setRegion] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [pos, setPos] = useState<PositionId | ''>('');
  const regions = [...new Set(stores.map((s) => s.region))].sort();
  const list = useMemo(() => stores.filter((s) => (!region || s.region === region) && (!storeFilter || s.id === storeFilter)), [stores, region, storeFilter]);
  const rows = useAllAnalyses(year, month, list);
  const { analysis } = useData();
  const posRows = useMemo(() => (pos ? list.map((s) => ({ store: s, a: analysis(s.id, year, month, pos)! })).filter((x) => x.a) : rows), [pos, list, analysis, year, month, rows]);

  if (!monthLoaded(year, month)) return <Empty>Cargando…</Empty>;
  const colorOf = (id: string) => STORE_COLORS[stores.findIndex((s) => s.id === id) % STORE_COLORS.length];

  // cobertura promedio por banda horaria (sólo franjas abiertas)
  const band = posRows.map((r) => ({
    store: r.store,
    vals: BANDS.map((b) => {
      let sum = 0, n = 0;
      for (let d = 0; d < r.a.days; d++) for (let h = b.from; h < b.to; h++) {
        const s = d * 24 + h;
        if (r.a.openSlots[s]) { sum += r.a.coverage[s]; n++; }
      }
      return n ? sum / n : null;
    }),
  }));
  const bandMax = Math.max(1, ...band.flatMap((b) => b.vals.map((v) => v ?? 0)));

  const posDist = rows.map((r) => ({
    tienda: r.store.code,
    ...Object.fromEntries(POSITIONS.map((p) => [p.id, r.a.totalHours ? Math.round((r.a.hoursByPosition[p.id] / r.a.totalHours) * 1000) / 10 : 0])),
  }));

  const weekday = (r: (typeof rows)[number]) => {
    const out = Array(7).fill(0), cnt = Array(7).fill(0);
    r.a.dates.forEach((d, i) => { const w = new Date(d + 'T00:00').getDay(); out[w] += r.a.workingByDay[i]; cnt[w]++; });
    return out.map((v, i) => (cnt[i] ? v / cnt[i] : 0));
  };
  const daysData = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((l, i) => {
    const w = (i + 1) % 7;
    const row: Record<string, number | string> = { dia: l };
    for (const r of posRows) row[r.store.code] = Math.round(weekday(r)[w] * 10) / 10;
    return row;
  });

  return (
    <div>
      <PageHeader title="Comparación entre tiendas" subtitle={`Diferencias de planificación en ${MONTHS[month - 1]} ${year}`}>
        <Select label="Región" value={region} onChange={(e) => { setRegion(e.target.value); setStoreFilter(''); }}>
          <option value="">Todas</option>{regions.map((r) => <option key={r}>{r}</option>)}
        </Select>
        <Select label="Tienda" value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
          <option value="">Todas</option>{stores.filter((s) => !region || s.region === region).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <MonthPicker year={year} month={month} onChange={setMonth} />
        <Select label="Posición" value={pos} onChange={(e) => setPos(e.target.value as PositionId | '')}>
          <option value="">Todas</option>{POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </PageHeader>

      <Card title="Resumen comparativo" subtitle={pos ? `Métricas de horas y dotación filtradas por ${POSITIONS.find((p) => p.id === pos)?.name}` : undefined} bodyClass="p-0 overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Tienda</th><th className="px-2">Estado</th><th className="w-36 px-2">Planificación</th>
              <th className="px-2 text-right">Empleados plan.</th><th className="px-2 text-right">Horas</th><th className="px-2 text-right">Horas/empleado</th>
              <th className="px-2 text-right">Pers./día</th><th className="px-2 text-right">Días con problemas</th>
              <th className="px-2 text-right">Franjas bajo mínimo</th><th className="px-2 text-right">Dif. vs objetivo</th><th className="px-4 text-right">Errores</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {posRows.map((r) => {
              const full = rows.find((x) => x.store.id === r.store.id)!.a;
              const emp = Object.values(r.a.daysWorkedByEmployee).filter((v) => v > 0).length;
              const t = settings[r.store.id].target_by_hour;
              const needsReview = full.errors > 0 || full.completeness < 1;
              return (
                <tr key={r.store.id} className={cx(needsReview && 'bg-rose-50/40')}>
                  <td className="px-4 py-2.5 font-medium text-navy-900"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorOf(r.store.id) }} /><StoreName store={r.store} /><div className="text-xs font-normal text-slate-500">{r.store.region}</div></td>
                  <td className="px-2"><StatusBadge status={planFor(r.store.id, year, month)?.status ?? 'pendiente'} /></td>
                  <td className="px-2">
                    <div className="flex items-center gap-2"><Progress value={full.completeness} /><span className="text-xs tabular-nums">{Math.round(full.completeness * 100)}%</span></div>
                    <div className={cx('text-[11px]', full.completeness >= 1 ? 'text-emerald-700' : 'text-rose-700')}>{full.completeness >= 1 ? 'Completa' : 'Incompleta'}</div>
                  </td>
                  <td className="px-2 text-right tabular-nums">{emp}</td>
                  <td className="px-2 text-right tabular-nums">{fmtHours(r.a.totalHours, 0)}</td>
                  <td className="px-2 text-right tabular-nums">{emp ? fmtHours(r.a.totalHours / emp) : '—'}</td>
                  <td className="px-2 text-right tabular-nums">{fmtHours(r.a.workingByDay.reduce((x, y) => x + y, 0) / r.a.days)}</td>
                  <td className="px-2 text-right tabular-nums">{full.problemDays.length}</td>
                  <td className="px-2 text-right tabular-nums">{full.slotsBelowMin}</td>
                  <td className="px-2 text-right tabular-nums">{t ? (full.targetDeficitHours ? `−${fmtHours(full.targetDeficitHours, 0)} h·pers.` : 'Cumple') : <span className="text-slate-400">sin objetivo</span>}</td>
                  <td className="px-4 text-right font-semibold tabular-nums text-rose-700">{full.errors}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Cobertura por franja horaria" subtitle="Personas promedio en franjas abiertas (vacío: tienda cerrada)">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-xs">
              <thead><tr><th className="text-left font-medium text-slate-500">Tienda</th>{BANDS.map((b) => <th key={b.label} className="font-medium text-slate-500">{b.label} h</th>)}</tr></thead>
              <tbody>
                {band.map((b) => (
                  <tr key={b.store.id}>
                    <td className="whitespace-nowrap pr-2 font-medium text-navy-900">{b.store.code}</td>
                    {b.vals.map((v, i) => {
                      const min = settings[b.store.id].min_staff;
                      const bg = v === null ? '#f8fafc' : SEQ_BLUE[Math.min(7, Math.ceil((v / bandMax) * 7))];
                      return (
                        <td key={i} title={v === null ? 'Cerrado' : `${fmtHours(v)} personas promedio`} className={cx('h-9 rounded text-center tabular-nums', v !== null && !pos && v < min && 'ring-2 ring-inset ring-rose-500')} style={{ background: bg, color: v !== null && v / bandMax > 0.55 ? '#fff' : '#334155' }}>
                          {v === null ? '' : fmtHours(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {!pos && <p className="mt-2 text-[11px] text-slate-500">Borde rojo: promedio por debajo de la dotación mínima de la tienda.</p>}
          </div>
        </Card>
        <Card title="Distribución de horas por posición" subtitle="% de las horas planificadas de cada tienda">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={posDist} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#6b7280' }} />
              <YAxis type="category" dataKey="tienda" tick={{ fontSize: 11, fill: '#6b7280' }} width={70} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number, n: string) => [`${v}%`, POSITIONS.find((p) => p.id === n)?.name ?? n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => POSITIONS.find((p) => p.id === v)?.short ?? v} />
              {POSITIONS.map((p) => <Bar isAnimationActive={false} key={p.id} dataKey={p.id} stackId="d" fill={POSITION_COLORS[p.id]} stroke="#fff" strokeWidth={1} maxBarSize={22} />)}
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Personas por día de la semana" subtitle="Promedio de personas con turno">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={daysData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="dia" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number, n: string) => [v, stores.find((s) => s.code === n)?.name ?? n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => stores.find((s) => s.code === v)?.name ?? v} />
              {posRows.map((r) => <Bar isAnimationActive={false} key={r.store.id} dataKey={r.store.code} fill={colorOf(r.store.id)} radius={[3, 3, 0, 0]} maxBarSize={14} />)}
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Días con posibles problemas de cobertura">
          <ul className="space-y-3 text-sm">
            {rows.map((r) => (
              <li key={r.store.id}>
                <div className="font-medium text-navy-900">{r.store.name}</div>
                {r.a.problemDays.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {r.a.problemDays.map((d) => <span key={d} className="rounded bg-rose-100 px-1.5 py-0.5 text-xs text-rose-800">{Number(d.slice(8))}/{pad(month)}</span>)}
                  </div>
                ) : <div className="text-xs text-emerald-700">{r.a.completeness > 0 ? 'Sin días con faltantes de cobertura' : 'Sin horarios cargados'}</div>}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

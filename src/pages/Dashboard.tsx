import { AlertOctagon, CalendarCheck, Clock, Store as StoreIcon, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DailyCoverageChart, HourlyChart, HoursByPositionChart, PositionByDayChart } from '../components/charts';
import { PlanWorkflow } from '../components/PlanWorkflow';
import { AlertList, Card, Empty, Kpi, MonthPicker, PageHeader, Progress, Select, StatusBadge, StoreName } from '../components/ui';
import type { PlanAnalysis } from '../lib/calc';
import { hourlyProfile } from '../lib/calc';
import { MONTHS, POSITIONS, POSITION_COLORS } from '../lib/constants';
import { fmtHours, pad } from '../lib/dates';
import { useSelection } from '../lib/selection';
import { useAnalysis, useData } from '../lib/store';
import type { Store } from '../lib/types';

/** Paleta categórica fija para tiendas (orden estable según el código de tienda). */
export const STORE_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];

export function useAllAnalyses(year: number, month: number, list: Store[]) {
  const { ensureMonth, analysis } = useData();
  useEffect(() => ensureMonth(year, month), [ensureMonth, year, month]);
  return useMemo(() => list.map((s) => ({ store: s, a: analysis(s.id, year, month) as PlanAnalysis })).filter((x) => x.a), [list, analysis, year, month]);
}

export function Dashboard() {
  const { user } = useData();
  return user?.role === 'admin' ? <AdminDashboard /> : <ManagerDashboard />;
}

function ManagerDashboard() {
  const { stores, settings, employees, monthLoaded } = useData();
  const { year, month, storeId, setMonth } = useSelection();
  const store = stores.find((s) => s.id === storeId);
  const a = useAnalysis(storeId, year, month);
  if (!store) return <Empty>Tu usuario no tiene una tienda asignada. Contactá al administrador.</Empty>;
  if (!a || !monthLoaded(year, month)) return <Empty>Cargando…</Empty>;
  const staff = employees.filter((e) => e.store_id === store.id && e.active).length;
  const avgDay = a.workingByDay.reduce((x, y) => x + y, 0) / a.days;
  const prof = hourlyProfile(a);
  const peak = prof.reduce((b, x) => (x.avg > b.avg ? x : b), prof[0]);
  const open = prof.filter((_, h) => a.openSlots.some((o, i) => o && i % 24 === h));
  const low = open.length ? open.reduce((b, x) => (x.avg < b.avg ? x : b), open[0]) : null;
  return (
    <div>
      <PageHeader title={`Dashboard · ${store.name}`} subtitle={<>Dinámica de tu tienda en {MONTHS[month - 1]} {year}. Se actualiza con cada horario guardado.</>}>
        <MonthPicker year={year} month={month} onChange={setMonth} />
      </PageHeader>
      <PlanWorkflow storeId={store.id} year={year} month={month} a={a} />
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Carga completa" value={`${Math.round(a.completeness * 100)}%`} hint={`${a.filledCells} de ${a.expectedCells} celdas`} tone={a.completeness >= 1 ? 'good' : 'warn'} icon={<CalendarCheck size={16} />} />
        <Kpi label="Horas planificadas" value={fmtHours(a.totalHours, 0)} hint={`${staff} empleados activos`} icon={<Clock size={16} />} />
        <Kpi label="Personas por día" value={fmtHours(avgDay)} hint="promedio del mes" icon={<Users size={16} />} />
        <Kpi label="Franja de mayor dotación" value={a.totalHours ? `${pad(peak.hour)}–${pad(peak.hour + 1)} h` : '—'} hint={a.totalHours ? `${fmtHours(peak.avg)} personas promedio` : 'sin datos'} />
        <Kpi label="Alertas" value={<span><span className="text-rose-700">{a.errors}</span> / <span className="text-amber-600">{a.warnings}</span></span>} hint={low && a.totalHours ? `Menor dotación: ${pad(low.hour)}–${pad(low.hour + 1)} h` : 'errores / advertencias'} tone={a.errors ? 'bad' : a.warnings ? 'warn' : 'good'} icon={<AlertOctagon size={16} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Cobertura diaria" subtitle="Personas con turno por día (rojo: días con faltantes)"><DailyCoverageChart a={a} /></Card>
        <Card title="Dotación por franja horaria" subtitle="Promedio del mes, rango mínimo–máximo, mínimo y objetivo configurados"><HourlyChart a={a} settings={settings[store.id]} /></Card>
        <Card title="Posiciones trabajando por día"><PositionByDayChart a={a} /></Card>
        <Card title="Alertas operativas" bodyClass="max-h-[17rem] overflow-auto p-4"><AlertList alerts={a.alerts} max={30} /></Card>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const { stores, employees, monthLoaded } = useData();
  const { year, month, setMonth } = useSelection();
  const [region, setRegion] = useState('');
  const regions = [...new Set(stores.map((s) => s.region))].sort();
  const list = stores.filter((s) => !region || s.region === region);
  const rows = useAllAnalyses(year, month, list);
  const { planFor } = useData();
  if (!monthLoaded(year, month)) return <Empty>Cargando…</Empty>;
  if (!stores.length) return <Empty>No hay tiendas cargadas. <Link to="/configuracion" className="text-teal-700 underline">Crear tiendas o cargar la demostración</Link>.</Empty>;

  const complete = rows.filter((r) => r.a.completeness >= 1).length;
  const totalHours = rows.reduce((x, r) => x + r.a.totalHours, 0);
  const planned = rows.reduce((x, r) => x + Object.values(r.a.daysWorkedByEmployee).filter((v) => v > 0).length, 0);
  const errors = rows.reduce((x, r) => x + r.a.errors, 0);
  const warnings = rows.reduce((x, r) => x + r.a.warnings, 0);
  const statuses = rows.map((r) => planFor(r.store.id, year, month)?.status ?? 'pendiente');
  const toReview = statuses.filter((s) => s === 'enviada').length;
  const colorOf = (s: Store) => STORE_COLORS[stores.indexOf(s) % STORE_COLORS.length];

  const hoursData = rows.map((r) => ({ tienda: r.store.code, nombre: r.store.name, horas: Math.round(r.a.totalHours), ...Object.fromEntries(POSITIONS.map((p) => [p.id, Math.round(r.a.hoursByPosition[p.id])])) }));
  const hourly = Array.from({ length: 24 }, (_, h) => {
    const row: Record<string, number | string> = { hora: `${pad(h)}h` };
    for (const r of rows) row[r.store.code] = Math.round(hourlyProfile(r.a)[h].avg * 10) / 10;
    return row;
  });
  const staffPos = rows.map((r) => ({
    tienda: r.store.code,
    ...Object.fromEntries(POSITIONS.map((p) => [p.id, employees.filter((e) => e.store_id === r.store.id && e.active && e.position_id === p.id).length])),
  }));
  const topAlerts = rows.flatMap((r) => r.a.alerts.filter((x) => x.severity === 'error').map((x) => ({ ...x, message: `${r.store.name}: ${x.message}` })));

  return (
    <div>
      <PageHeader title="Dashboard de dinámica de tiendas" subtitle={`Vista consolidada de ${MONTHS[month - 1]} ${year}. Se actualiza a medida que los gerentes guardan horarios.`}>
        <Select label="Región" value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="">Todas</option>
          {regions.map((r) => <option key={r}>{r}</option>)}
        </Select>
        <MonthPicker year={year} month={month} onChange={setMonth} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Planificación completa" value={`${complete} / ${rows.length}`} hint="tiendas con todos los días cargados" tone={complete === rows.length ? 'good' : 'warn'} icon={<StoreIcon size={16} />} />
        <Kpi label="Empleados planificados" value={planned} hint={`de ${employees.filter((e) => e.active && list.some((s) => s.id === e.store_id)).length} activos`} icon={<Users size={16} />} />
        <Kpi label="Horas planificadas" value={fmtHours(totalHours, 0)} hint="total de las tiendas filtradas" icon={<Clock size={16} />} />
        <Kpi label="Pendientes de revisión" value={toReview} hint={`${statuses.filter((s) => s === 'aprobada').length} aprobadas · ${statuses.filter((s) => s === 'pendiente').length} sin cargar`} tone={toReview ? 'warn' : 'default'} icon={<CalendarCheck size={16} />} />
        <Kpi label="Alertas" value={<span><span className="text-rose-700">{errors}</span> / <span className="text-amber-600">{warnings}</span></span>} hint="errores / advertencias" tone={errors ? 'bad' : 'good'} icon={<AlertOctagon size={16} />} />
      </div>

      <Card title="Estado de carga por tienda" className="mt-4" bodyClass="p-0 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Tienda</th><th className="px-2">Región</th><th className="px-2">Estado</th><th className="w-40 px-2">Carga</th>
              <th className="px-2 text-right">Empleados</th><th className="px-2 text-right">Horas</th><th className="px-2 text-right">Días con problemas</th>
              <th className="px-2 text-right">Errores</th><th className="px-2 text-right">Advert.</th><th className="px-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={r.store.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-navy-900"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: colorOf(r.store) }} /><StoreName store={r.store} /></td>
                <td className="px-2 text-slate-600">{r.store.region}</td>
                <td className="px-2"><StatusBadge status={statuses[i]} /></td>
                <td className="px-2"><div className="flex items-center gap-2"><Progress value={r.a.completeness} /><span className="w-9 text-right text-xs tabular-nums">{Math.round(r.a.completeness * 100)}%</span></div></td>
                <td className="px-2 text-right tabular-nums">{Object.values(r.a.daysWorkedByEmployee).filter((v) => v > 0).length}</td>
                <td className="px-2 text-right tabular-nums">{fmtHours(r.a.totalHours, 0)}</td>
                <td className="px-2 text-right tabular-nums">{r.a.problemDays.length}</td>
                <td className="px-2 text-right font-semibold tabular-nums text-rose-700">{r.a.errors}</td>
                <td className="px-2 text-right tabular-nums text-amber-700">{r.a.warnings}</td>
                <td className="px-4 text-right"><Link to={`/tienda?tienda=${r.store.id}`} className="text-xs font-medium text-teal-700 hover:underline">Ver dinámica →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card title="Cobertura promedio por franja horaria" subtitle="Personas presentes por hora, promedio del mes por tienda">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hourly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="hora" tick={{ fontSize: 11, fill: '#6b7280' }} interval={1} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number, n: string) => [v, stores.find((s) => s.code === n)?.name ?? n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => stores.find((s) => s.code === v)?.name ?? v} />
              {rows.map((r) => <Line key={r.store.id} dataKey={r.store.code} stroke={colorOf(r.store)} strokeWidth={2} dot={false} isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Horas planificadas por tienda y posición">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={hoursData} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="tienda" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} labelFormatter={(l, p) => p?.[0]?.payload.nombre ?? l} formatter={(v: number, n: string) => [`${v} h`, POSITIONS.find((p) => p.id === n)?.name ?? n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => POSITIONS.find((p) => p.id === v)?.short ?? v} />
              {POSITIONS.map((p, i) => <Bar isAnimationActive={false} key={p.id} dataKey={p.id} stackId="h" fill={POSITION_COLORS[p.id]} stroke="#fff" strokeWidth={1} radius={i === POSITIONS.length - 1 ? [4, 4, 0, 0] : undefined} maxBarSize={48} />)}
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Dotación activa por posición y tienda" subtitle="Cantidad de empleados activos asignados">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={staffPos} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="tienda" tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number, n: string) => [v, POSITIONS.find((p) => p.id === n)?.name ?? n]} />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => POSITIONS.find((p) => p.id === v)?.short ?? v} />
              {POSITIONS.map((p) => <Bar isAnimationActive={false} key={p.id} dataKey={p.id} fill={POSITION_COLORS[p.id]} radius={[3, 3, 0, 0]} maxBarSize={14} />)}
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title={`Errores que requieren revisión (${topAlerts.length})`} bodyClass="max-h-[15.5rem] overflow-auto p-4">
          <AlertList alerts={topAlerts} max={40} empty="No hay errores en las planificaciones del mes." />
        </Card>
      </div>
      {rows.length === 1 && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card title="Horas por posición"><HoursByPositionChart a={rows[0].a} /></Card>
        </div>
      )}
    </div>
  );
}

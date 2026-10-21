import { FileSpreadsheet, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button, Card, Empty, MonthPicker, PageHeader, Select, StatusBadge } from '../components/ui';
import { hourlyProfile } from '../lib/calc';
import { MONTHS, POSITIONS } from '../lib/constants';
import { fmtDateTime, fmtHours, pad } from '../lib/dates';
import {
  alertRows, comparisonRows, exportCoverage, exportEmployees, exportFull, exportSchedules, exportSimple, positionRows, statusRows, type StoreBundle,
} from '../lib/export';
import { useSelection } from '../lib/selection';
import { useData } from '../lib/store';
import { useAllAnalyses } from './Dashboard';

export function Reportes() {
  const { user, stores, employees, entriesFor, planFor, settings, monthLoaded } = useData();
  const { year, month, setMonth } = useSelection();
  const isAdmin = user?.role === 'admin';
  const [storeId, setStoreId] = useState('');
  const visible = useMemo(() => (isAdmin ? stores.filter((s) => !storeId || s.id === storeId) : stores.filter((s) => s.id === user?.store_id)), [isAdmin, stores, storeId, user]);
  const rows = useAllAnalyses(year, month, visible);
  const bundles: StoreBundle[] = rows.map((r) => ({
    store: r.store, a: r.a, settings: settings[r.store.id], plan: planFor(r.store.id, year, month),
    employees: employees.filter((e) => e.store_id === r.store.id),
    entries: entriesFor(r.store.id, year, month).filter((e) => e.date.startsWith(`${year}-${pad(month)}`)),
  }));
  const tag = `${year}-${pad(month)}`;
  const suffix = visible.length === 1 ? `_${visible[0].code}` : '';
  if (!monthLoaded(year, month)) return <Empty>Cargando…</Empty>;

  const exports = [
    { title: 'Horarios mensuales por tienda', desc: 'Tabla empleados × días, con totales de horas y dotación diaria por posición. Una hoja por tienda.', run: () => exportSchedules(bundles, `horarios_${tag}${suffix}.xlsx`) },
    { title: 'Horarios por empleado', desc: 'Resumen de horas por empleado vs. contrato y detalle de cada turno, franco y ausencia.', run: () => exportEmployees(bundles, `horarios_por_empleado_${tag}${suffix}.xlsx`) },
    { title: 'Horas planificadas por posición', desc: 'Horas por tienda y posición, y dotación activa.', run: () => exportSimple([{ name: 'Horas por posición', rows: positionRows(bundles), widths: [30, ...POSITIONS.map(() => 14), 10] }], `horas_por_posicion_${tag}${suffix}.xlsx`) },
    { title: 'Resumen de cobertura diaria y horaria', desc: 'Por día: personas, horas, apertura/cierre, posiciones y dotación en cada franja de 1 hora.', run: () => exportCoverage(bundles, `cobertura_${tag}${suffix}.xlsx`) },
    ...(isAdmin ? [{ title: 'Comparación entre tiendas', desc: 'Estado, carga, horas, días con problemas y diferencias con los objetivos.', run: () => exportSimple([{ name: 'Comparación', rows: comparisonRows(bundles), widths: [10, 30, 12, 7, 20, 8, 11, 12, 10, 10, 10, 10, 14, 8, 10] }], `comparacion_tiendas_${tag}.xlsx`) }] : []),
    { title: 'Alertas pendientes y estado de aprobación', desc: 'Todas las alertas detectadas y el estado del flujo de cada planificación.', run: () => exportSimple([{ name: 'Estado de aprobación', rows: statusRows(bundles), widths: [30, 20, 17, 17, 10, 17, 26, 40] }, { name: 'Alertas', rows: alertRows(bundles), widths: [30, 20, 11, 22, 11, 90] }], `alertas_estado_${tag}${suffix}.xlsx`) },
    { title: 'Libro completo del mes', desc: 'Todas las hojas anteriores en un único archivo.', run: () => exportFull(bundles, `reporte_completo_${tag}${suffix}.xlsx`) },
  ];

  return (
    <div>
      <PageHeader title="Exportación y reportes" subtitle={`Archivos Excel (.xlsx) generados con los datos guardados de ${MONTHS[month - 1]} ${year}`}>
        {isAdmin && (
          <Select label="Tienda" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Todas</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
        <MonthPicker year={year} month={month} onChange={setMonth} />
      </PageHeader>

      <div className="no-print grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {exports.map((x) => (
          <div key={x.title} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 font-medium text-navy-900"><FileSpreadsheet size={18} className="text-teal-600" /> {x.title}</div>
            <p className="mt-1 flex-1 text-sm text-slate-500">{x.desc}</p>
            <Button className="mt-3 self-start" size="sm" variant="secondary" disabled={!bundles.length} onClick={x.run}>Descargar Excel</Button>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <div className="no-print mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Reporte mensual resumido</h2>
          <Button onClick={() => window.print()}><Printer size={16} /> Imprimir / guardar PDF</Button>
        </div>
        <Card className="print-area">
          <div className="mb-4 border-b border-slate-200 pb-3">
            <div className="text-xs uppercase tracking-wide text-teal-700">FarmaPlan · Reporte mensual</div>
            <h3 className="text-xl font-semibold text-navy-900">{MONTHS[month - 1]} {year}</h3>
            <div className="text-xs text-slate-500">Generado el {fmtDateTime(new Date().toISOString())} por {user?.name}{bundles.some((b) => b.store.is_demo) && ' · Incluye datos de DEMOSTRACIÓN'}</div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1.5">Tienda</th><th>Estado</th><th className="text-right">Carga</th><th className="text-right">Empleados</th><th className="text-right">Horas</th><th className="text-right">Pers./día</th><th className="text-right">Pico</th><th className="text-right">Días c/ problemas</th><th className="text-right">Err.</th><th className="text-right">Adv.</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {bundles.map((b) => {
                const prof = hourlyProfile(b.a);
                const peak = prof.reduce((x, y) => (y.avg > x.avg ? y : x));
                return (
                  <tr key={b.store.id}>
                    <td className="py-1.5 font-medium text-navy-900">{b.store.name}{b.store.is_demo && ' (demo)'}</td>
                    <td><StatusBadge status={b.plan?.status ?? 'pendiente'} /></td>
                    <td className="text-right tabular-nums">{Math.round(b.a.completeness * 100)}%</td>
                    <td className="text-right tabular-nums">{Object.values(b.a.daysWorkedByEmployee).filter((v) => v > 0).length}</td>
                    <td className="text-right tabular-nums">{fmtHours(b.a.totalHours, 0)}</td>
                    <td className="text-right tabular-nums">{fmtHours(b.a.workingByDay.reduce((x, y) => x + y, 0) / b.a.days)}</td>
                    <td className="text-right tabular-nums">{b.a.totalHours ? `${pad(peak.hour)} h` : '—'}</td>
                    <td className="text-right tabular-nums">{b.a.problemDays.length}</td>
                    <td className="text-right tabular-nums text-rose-700">{b.a.errors}</td>
                    <td className="text-right tabular-nums text-amber-700">{b.a.warnings}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <h4 className="mt-5 text-sm font-semibold text-navy-900">Horas planificadas por posición</h4>
          <table className="mt-1 w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500"><tr><th className="py-1.5">Tienda</th>{POSITIONS.map((p) => <th key={p.id} className="text-right">{p.short}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {bundles.map((b) => <tr key={b.store.id}><td className="py-1.5">{b.store.code}</td>{POSITIONS.map((p) => <td key={p.id} className="text-right tabular-nums">{fmtHours(b.a.hoursByPosition[p.id], 0)}</td>)}</tr>)}
            </tbody>
          </table>
          <h4 className="mt-5 text-sm font-semibold text-navy-900">Principales errores a resolver</h4>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-slate-700">
            {bundles.flatMap((b) => b.a.alerts.filter((x) => x.severity === 'error').slice(0, 5).map((x, i) => <li key={`${b.store.id}${i}`}><b>{b.store.code}:</b> {x.message}</li>))}
            {!bundles.some((b) => b.a.errors) && <li>Sin errores.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

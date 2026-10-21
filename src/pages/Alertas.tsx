import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Empty, Kpi, MonthPicker, PageHeader, Select, SeverityIcon, StoreName } from '../components/ui';
import { MONTHS } from '../lib/constants';
import { useSelection } from '../lib/selection';
import { useData } from '../lib/store';
import { useAllAnalyses } from './Dashboard';

export const ALERT_TYPES: Record<string, string> = {
  PLAN_SIN_CARGAR: 'Planificación sin cargar',
  HORARIO_SIN_CARGAR: 'Horarios sin cargar',
  TURNO_INCOMPLETO: 'Turno incompleto',
  TURNO_SUPERPUESTO: 'Turnos superpuestos',
  COBERTURA_MINIMA: 'Cobertura mínima no alcanzada',
  POSICION_CLAVE: 'Posición clave sin cobertura',
  BAJO_OBJETIVO: 'Dotación bajo el objetivo',
  EXCESO_DIARIO: 'Exceso de horas diarias',
  JORNADA_CORTA: 'Jornada por debajo del mínimo',
  EXCESO_SEMANAL: 'Exceso de horas semanales',
  DESCANSO_INSUFICIENTE: 'Descanso insuficiente',
  DIAS_CONSECUTIVOS: 'Días consecutivos',
  HORAS_SOBRE_CONTRATO: 'Horas sobre contrato',
  HORAS_BAJO_CONTRATO: 'Horas bajo contrato',
  FUERA_DE_HORARIO: 'Turno fuera del horario de apertura',
  CAMBIO_POST_ENVIO: 'Cambios después del envío',
  EMPLEADO_INACTIVO: 'Empleado inactivo con turnos',
  PENDIENTE_REVISION: 'Planificación pendiente de completar',
};

export function Alertas() {
  const { user, stores, planFor, monthLoaded } = useData();
  const { year, month, setMonth } = useSelection();
  const [storeId, setStoreId] = useState('');
  const [sev, setSev] = useState('');
  const [type, setType] = useState('');
  const visible = useMemo(() => (user?.role === 'admin' ? stores : stores.filter((s) => s.id === user?.store_id)), [stores, user]);
  const rows = useAllAnalyses(year, month, visible);

  const all = rows.flatMap((r) => {
    const plan = planFor(r.store.id, year, month);
    const extra = plan && plan.status !== 'aprobada' && plan.status !== 'pendiente' && r.a.completeness < 1
      ? [{ severity: 'advertencia' as const, code: 'PENDIENTE_REVISION', message: `Planificación ${Math.round(r.a.completeness * 100)}% completa, pendiente de completar.`, date: null, employee_id: null }]
      : [];
    return [...r.a.alerts, ...extra].map((a) => ({ ...a, store: r.store }));
  });
  const list = all.filter((a) => (!storeId || a.store.id === storeId) && (!sev || a.severity === sev) && (!type || a.code === type));
  const byType = Object.entries(all.reduce<Record<string, number>>((acc, a) => ({ ...acc, [a.code]: (acc[a.code] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);

  if (!monthLoaded(year, month)) return <Empty>Cargando…</Empty>;
  return (
    <div>
      <PageHeader title="Alertas automáticas" subtitle={`Detectadas a partir de los horarios guardados · ${MONTHS[month - 1]} ${year}`}>
        {user?.role === 'admin' && (
          <Select label="Tienda" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Todas</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
        <MonthPicker year={year} month={month} onChange={setMonth} />
        <Select label="Tipo" value={sev} onChange={(e) => setSev(e.target.value)}>
          <option value="">Errores y advertencias</option><option value="error">Sólo errores</option><option value="advertencia">Sólo advertencias</option>
        </Select>
        <Select label="Categoría" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Todas</option>{Object.entries(ALERT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Errores" value={all.filter((a) => a.severity === 'error').length} hint="impiden aprobar" tone="bad" />
        <Kpi label="Advertencias" value={all.filter((a) => a.severity === 'advertencia').length} hint="no bloquean la aprobación" tone="warn" />
        <Kpi label="Tiendas con errores" value={rows.filter((r) => r.a.errors > 0).length} hint={`de ${rows.length}`} />
        <Kpi label="Categoría más frecuente" value={<span className="text-base">{byType[0] ? ALERT_TYPES[byType[0][0]] : '—'}</span>} hint={byType[0] ? `${byType[0][1]} alerta(s)` : ''} />
      </div>
      <Card title={`${list.length} alerta(s)`} className="mt-4" bodyClass="p-0 overflow-x-auto">
        {list.length ? (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Nivel</th><th>Tienda</th><th>Categoría</th><th>Fecha</th><th>Detalle</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((a, i) => (
                <tr key={i} className="align-top">
                  <td className="px-4 py-2"><span className="flex items-center gap-1.5"><SeverityIcon severity={a.severity} /> <span className={a.severity === 'error' ? 'font-medium text-rose-700' : 'text-amber-700'}>{a.severity === 'error' ? 'Error' : 'Advertencia'}</span></span></td>
                  <td className="py-2 pr-2"><Link to="/planificacion" className="hover:underline"><StoreName store={a.store} /></Link></td>
                  <td className="py-2 pr-2 text-slate-600">{ALERT_TYPES[a.code] ?? a.code}</td>
                  <td className="whitespace-nowrap py-2 pr-2 tabular-nums">{a.date ? a.date.split('-').reverse().join('/') : '—'}</td>
                  <td className="py-2 pr-4 text-slate-700">{a.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-6"><Empty>Sin alertas para los filtros seleccionados.</Empty></div>}
      </Card>
    </div>
  );
}

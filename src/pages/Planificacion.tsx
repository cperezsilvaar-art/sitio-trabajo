import { CalendarDays, CopyPlus, Save, Table2, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DailyCoverageChart } from '../components/charts';
import { MonthCalendar } from '../components/MonthCalendar';
import { PlanWorkflow } from '../components/PlanWorkflow';
import { PrintScheduleButton } from '../components/PrintSchedule';
import { ScheduleGrid, frequentShifts } from '../components/ScheduleGrid';
import { AlertList, Button, Card, Empty, Modal, MonthPicker, PageHeader, Select, StoreName, cx } from '../components/ui';
import { POSITIONS, WEEKDAYS_SHORT } from '../lib/constants';
import { addDays, monthDates, monthWeeks, prevMonth, weekday } from '../lib/dates';
import { stripEntry } from '../lib/parse';
import { useSelection } from '../lib/selection';
import { useAnalysis, useData, type CellChange } from '../lib/store';
import type { Entry, PositionId } from '../lib/types';

export function Planificacion() {
  const { user, stores, employees, entriesFor, replaceCells, planFor, canEditStore, ensureMonth, monthLoaded, flushNow } = useData();
  const { year, month, storeId, setMonth, setStoreId } = useSelection();
  const [view, setView] = useState<'tabla' | 'calendario'>('tabla');
  const [posFilter, setPosFilter] = useState<PositionId | ''>('');
  const [tools, setTools] = useState(false);
  const store = stores.find((s) => s.id === storeId);
  const a = useAnalysis(storeId, year, month);
  const [py, pm] = prevMonth(year, month);
  useEffect(() => ensureMonth(py, pm), [ensureMonth, py, pm]);

  const dates = useMemo(() => monthDates(year, month), [year, month]);
  const entries = storeId ? entriesFor(storeId, year, month).filter((e) => e.date.startsWith(dates[0].slice(0, 7))) : [];
  const plan = storeId ? planFor(storeId, year, month) : null;
  const readOnly = !storeId || !canEditStore(storeId) || plan?.status === 'aprobada';

  const staff = useMemo(() => {
    const withEntries = new Set(entries.map((e) => e.employee_id));
    return employees
      .filter((e) => e.store_id === storeId && (e.active || withEntries.has(e.id)))
      .filter((e) => !posFilter || e.position_id === posFilter)
      .sort((x, y) => POSITIONS.findIndex((p) => p.id === x.position_id) - POSITIONS.findIndex((p) => p.id === y.position_id) || x.name.localeCompare(y.name));
  }, [employees, storeId, entries, posFilter]);

  const presets = useMemo(() => (store ? frequentShifts([...entries, ...(storeId ? entriesFor(storeId, py, pm) : [])], store) : []), [store, entries, storeId, entriesFor, py, pm]);

  if (!store) return <Empty>No hay tiendas disponibles. {user?.role === 'admin' && <Link className="text-teal-700 underline" to="/configuracion">Crear una tienda</Link>}</Empty>;

  return (
    <div>
      <PageHeader title="Carga mensual de horarios" subtitle={<span>Planificación de <StoreName store={store} /></span>}>
        {user?.role === 'admin' && (
          <Select label="Tienda" value={storeId ?? ''} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}{s.is_demo ? ' (demo)' : ''}</option>)}
          </Select>
        )}
        <MonthPicker year={year} month={month} onChange={setMonth} />
        <Select label="Posición" value={posFilter} onChange={(e) => setPosFilter(e.target.value as PositionId | '')}>
          <option value="">Todas</option>
          {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </PageHeader>

      <PlanWorkflow storeId={store.id} year={year} month={month} a={a} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg bg-white p-0.5 ring-1 ring-slate-200">
          <button onClick={() => setView('tabla')} className={cx('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm', view === 'tabla' ? 'bg-navy-800 text-white' : 'text-slate-600')}><Table2 size={15} /> Tabla</button>
          <button onClick={() => setView('calendario')} className={cx('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm', view === 'calendario' ? 'bg-navy-800 text-white' : 'text-slate-600')}><CalendarDays size={15} /> Calendario</button>
        </div>
        {!readOnly && <Button variant="secondary" size="sm" onClick={() => setTools(true)}><CopyPlus size={15} /> Copiar día / duplicar semana</Button>}
        <PrintScheduleButton storeId={store.id} year={year} month={month} />
        <Link to="/empleados"><Button variant="ghost" size="sm"><UserPlus size={15} /> Gestionar empleados</Button></Link>
        {!readOnly && (
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void flushNow()} title="Los cambios se guardan automáticamente como borrador; este botón fuerza el guardado inmediato.">
            <Save size={15} /> Guardar borrador ahora
          </Button>
        )}
      </div>
      {readOnly && plan?.status !== 'aprobada' && <p className="mt-2 text-sm text-slate-500">Vista de sólo lectura.</p>}

      <div className="mt-3">
        {!monthLoaded(year, month) ? (
          <Empty>Cargando horarios…</Empty>
        ) : !staff.length ? (
          <Empty>No hay empleados activos {posFilter && 'de esta posición '}en la tienda. <Link className="text-teal-700 underline" to="/empleados">Agregar empleados</Link></Empty>
        ) : view === 'tabla' ? (
          <ScheduleGrid
            store={store}
            employees={staff}
            dates={dates}
            entries={entries}
            analysis={a}
            readOnly={readOnly}
            presets={presets}
            onChange={(ch) => replaceCells(store.id, year, month, ch)}
          />
        ) : (
          <Card><MonthCalendar dates={dates} entries={entries} employees={staff} problemDays={a?.problemDays} /></Card>
        )}
      </div>

      {a && (
        <div className="mt-4 grid gap-4 xl:grid-cols-5">
          <Card title="Cobertura diaria" subtitle="Personas con turno cada día. En rojo, días con faltantes de cobertura." className="xl:col-span-3">
            <DailyCoverageChart a={a} minStaff={undefined} />
          </Card>
          <Card title={`Alertas (${a.alerts.length})`} subtitle="Los errores impiden aprobar la planificación." className="xl:col-span-2" bodyClass="max-h-72 overflow-auto p-4">
            <AlertList alerts={a.alerts} max={40} />
          </Card>
        </div>
      )}

      {tools && (
        <CopyTools
          dates={dates}
          staffIds={staff.map((s) => s.id)}
          getEntries={(d) => {
            const [y, m] = [Number(d.slice(0, 4)), Number(d.slice(5, 7))];
            return entriesFor(store.id, y, m).filter((e) => e.date === d);
          }}
          onApply={(ch) => { replaceCells(store.id, year, month, ch); setTools(false); }}
          onClose={() => setTools(false)}
          year={year}
          month={month}
        />
      )}
    </div>
  );
}

function CopyTools({ dates, staffIds, getEntries, onApply, onClose, year, month }: {
  dates: string[]; staffIds: string[]; getEntries: (d: string) => Entry[]; onApply: (c: CellChange[]) => void; onClose: () => void; year: number; month: number;
}) {
  const [mode, setMode] = useState<'dia' | 'semana' | 'anterior'>('dia');
  const [src, setSrc] = useState(dates[0]);
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const weeks = monthWeeks(year, month);
  const [srcWeek, setSrcWeek] = useState(0);
  const [tgtWeeks, setTgtWeeks] = useState<Set<number>>(new Set());
  const [onlyEmpty, setOnlyEmpty] = useState(true);

  const cellsOf = (d: string) => {
    const m = new Map<string, Entry[]>();
    for (const e of getEntries(d)) m.set(e.employee_id, [...(m.get(e.employee_id) ?? []), e]);
    return m;
  };

  const build = (): CellChange[] => {
    const pairs: [string, string][] = [];
    if (mode === 'dia') targets.forEach((t) => pairs.push([src, t]));
    else if (mode === 'semana') {
      const sw = weeks[srcWeek];
      tgtWeeks.forEach((wi) => {
        for (const t of weeks[wi]) {
          const s = sw.find((x) => weekday(x) === weekday(t));
          if (s) pairs.push([s, t]);
        }
      });
    } else for (const t of dates) pairs.push([addDays(t, -28), t]);
    const out: CellChange[] = [];
    for (const [s, t] of pairs) {
      const sc = cellsOf(s);
      const tc = cellsOf(t);
      for (const id of staffIds) {
        const list = sc.get(id);
        if (!list?.length) continue;
        if (onlyEmpty && tc.get(id)?.length) continue;
        out.push({ employee_id: id, date: t, entries: list.map(stripEntry) });
      }
    }
    return out;
  };
  const changes = build();

  const toggle = (d: string) => setTargets((s) => { const n = new Set(s); if (n.has(d)) n.delete(d); else n.add(d); return n; });

  return (
    <Modal open title="Copiar horarios" onClose={onClose} wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button disabled={!changes.length} onClick={() => onApply(changes)}>Aplicar a {changes.length} celda(s)</Button></>}
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {([['dia', 'Copiar un día a otros días'], ['semana', 'Duplicar una semana'], ['anterior', 'Repetir desde 4 semanas antes']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={cx('rounded-lg px-3 py-1.5 ring-1', mode === k ? 'bg-navy-800 text-white ring-navy-800' : 'ring-slate-300')}>{l}</button>
          ))}
        </div>
        {mode === 'dia' && (
          <>
            <Select label="Día de origen" value={src} onChange={(e) => setSrc(e.target.value)}>
              {dates.map((d) => <option key={d} value={d}>{WEEKDAYS_SHORT[weekday(d)]} {Number(d.slice(8))}</option>)}
            </Select>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                Días de destino:
                <button className="text-teal-700 underline" onClick={() => setTargets(new Set(dates.filter((d) => d !== src && weekday(d) === weekday(src))))}>mismo día de la semana</button>
                <button className="text-teal-700 underline" onClick={() => setTargets(new Set(dates.filter((d) => d !== src && weekday(d) >= 1 && weekday(d) <= 5)))}>lunes a viernes</button>
                <button className="text-teal-700 underline" onClick={() => setTargets(new Set(dates.filter((d) => d !== src)))}>todos</button>
                <button className="text-teal-700 underline" onClick={() => setTargets(new Set())}>ninguno</button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dates.map((d) => (
                  <button key={d} disabled={d === src} onClick={() => toggle(d)}
                    className={cx('rounded-md px-1 py-1.5 text-xs ring-1', d === src ? 'bg-slate-100 text-slate-400 ring-slate-200' : targets.has(d) ? 'bg-teal-600 text-white ring-teal-600' : 'ring-slate-300 hover:ring-teal-500')}>
                    {WEEKDAYS_SHORT[weekday(d)]} {Number(d.slice(8))}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {mode === 'semana' && (
          <>
            <Select label="Semana de origen" value={srcWeek} onChange={(e) => setSrcWeek(Number(e.target.value))}>
              {weeks.map((w, i) => <option key={i} value={i}>Semana {i + 1}: {Number(w[0].slice(8))} al {Number(w[w.length - 1].slice(8))}</option>)}
            </Select>
            <div className="flex flex-wrap gap-1.5">
              {weeks.map((w, i) => i !== srcWeek && (
                <button key={i} onClick={() => setTgtWeeks((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })}
                  className={cx('rounded-lg px-3 py-1.5 text-xs ring-1', tgtWeeks.has(i) ? 'bg-teal-600 text-white ring-teal-600' : 'ring-slate-300')}>
                  Semana {i + 1} ({Number(w[0].slice(8))}–{Number(w[w.length - 1].slice(8))})
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500">Cada día se copia del mismo día de la semana de la semana de origen.</p>
          </>
        )}
        {mode === 'anterior' && <p className="text-slate-600">Cada día del mes toma los horarios del mismo día de la semana, cuatro semanas antes (incluye días del mes anterior). Útil para iniciar un mes a partir del patrón vigente.</p>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} /> Completar sólo celdas vacías (no sobrescribir)</label>
        <p className="text-xs text-slate-500">Se aplica a los {staffIds.length} empleados visibles en la tabla (según el filtro de posición).</p>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { ACTION_LABEL, PlanWorkflow } from '../components/PlanWorkflow';
import { Card, Empty, MonthPicker, PageHeader, Progress, StatusBadge, StoreName, cx } from '../components/ui';
import { MONTHS } from '../lib/constants';
import { fmtDateTime } from '../lib/dates';
import { useSelection } from '../lib/selection';
import { useData } from '../lib/store';
import type { PlanStatus } from '../lib/types';
import { useAllAnalyses } from './Dashboard';

const ORDER: PlanStatus[] = ['pendiente', 'en_preparacion', 'enviada', 'observada', 'aprobada'];

export function Aprobaciones() {
  const { user, stores, planFor, profiles, history, monthLoaded, plans } = useData();
  const { year, month, setMonth } = useSelection();
  const visible = user?.role === 'admin' ? stores : stores.filter((s) => s.id === user?.store_id);
  const rows = useAllAnalyses(year, month, visible);
  const [sel, setSel] = useState<string | null>(null);
  if (!monthLoaded(year, month)) return <Empty>Cargando…</Empty>;
  const selected = rows.find((r) => r.store.id === (sel ?? rows[0]?.store.id));
  const counts = ORDER.map((s) => ({ s, n: rows.filter((r) => (planFor(r.store.id, year, month)?.status ?? 'pendiente') === s).length }));
  const planPeriod = (id: string) => { const p = plans.find((x) => x.id === id); return p ? `${MONTHS[p.month - 1].slice(0, 3)} ${p.year}` : ''; };
  const recent = history.filter((h) => visible.some((s) => s.id === h.store_id)).slice(0, 15);

  return (
    <div>
      <PageHeader title="Estado de carga y aprobaciones" subtitle={`Flujo de planificación de ${MONTHS[month - 1]} ${year}`}>
        <MonthPicker year={year} month={month} onChange={setMonth} />
      </PageHeader>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {counts.map(({ s, n }, i) => (
          <div key={s} className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-[11px] font-medium uppercase text-slate-400">Paso {i + 1}</div>
            <div className="mt-1"><StatusBadge status={s} /></div>
            <div className="mt-2 text-2xl font-semibold text-navy-900">{n}</div>
            <div className="text-xs text-slate-500">tienda(s)</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-5">
        <Card title="Tiendas" className="xl:col-span-2" bodyClass="p-0">
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => {
              const plan = planFor(r.store.id, year, month);
              const gerentes = profiles.filter((p) => p.role === 'gerente' && p.store_id === r.store.id).map((p) => p.name).join(', ');
              const active = selected?.store.id === r.store.id;
              return (
                <li key={r.store.id}>
                  <button onClick={() => setSel(r.store.id)} className={cx('w-full px-4 py-3 text-left hover:bg-slate-50', active && 'bg-teal-50/60')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-navy-900"><StoreName store={r.store} /></span>
                      <StatusBadge status={plan?.status ?? 'pendiente'} />
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{gerentes || 'Sin gerente asignado'} · actualizado {fmtDateTime(plan?.updated_at)}</div>
                    <div className="mt-2 flex items-center gap-2"><Progress value={r.a.completeness} /><span className="text-xs tabular-nums">{Math.round(r.a.completeness * 100)}%</span>
                      <span className="whitespace-nowrap text-xs text-rose-700">{r.a.errors} err.</span><span className="whitespace-nowrap text-xs text-amber-700">{r.a.warnings} adv.</span></div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="space-y-4 xl:col-span-3">
          {selected && (
            <>
              <PlanWorkflow storeId={selected.store.id} year={year} month={month} a={selected.a} />
              <Card title="Errores que impiden aprobar">
                {selected.a.errors ? (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-rose-800">
                    {selected.a.alerts.filter((a) => a.severity === 'error').slice(0, 25).map((a, i) => <li key={i}>{a.message}</li>)}
                  </ul>
                ) : <p className="text-sm text-emerald-700">No hay errores bloqueantes.</p>}
              </Card>
            </>
          )}
          <Card title="Últimos movimientos">
            <ul className="space-y-2 text-sm">
              {recent.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
                  <span><b className="text-navy-900">{stores.find((s) => s.id === h.store_id)?.code}</b> · {planPeriod(h.plan_id)} · {ACTION_LABEL[h.action]} {h.comment && <span className="text-slate-500">— {h.comment}</span>}</span>
                  <span className="text-xs text-slate-500">{fmtDateTime(h.at)} · {h.user_name}</span>
                </li>
              ))}
              {!recent.length && <li className="text-slate-500">Sin movimientos.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

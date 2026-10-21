import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Card, DemoBadge, Empty, Input, Modal, PageHeader, Select, cx } from '../components/ui';
import { POSITIONS, POSITION_BY_ID, POSITION_COLORS } from '../lib/constants';
import { nowIso, uid } from '../lib/dates';
import { useData } from '../lib/store';
import type { Employee, PositionId } from '../lib/types';

export function Empleados() {
  const { user, stores, employees, saveEmployee, deleteEmployee, canEditStore } = useData();
  const isAdmin = user?.role === 'admin';
  const [storeId, setStoreId] = useState(isAdmin ? '' : user?.store_id ?? '');
  const [pos, setPos] = useState<PositionId | ''>('');
  const [state, setState] = useState<'activos' | 'inactivos' | ''>('activos');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Employee | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const list = employees.filter((e) =>
    (!storeId || e.store_id === storeId) && (!pos || e.position_id === pos) &&
    (!state || (state === 'activos' ? e.active : !e.active)) && (!q || e.name.toLowerCase().includes(q.toLowerCase())),
  );
  const visibleStores = isAdmin ? stores : stores.filter((s) => s.id === user?.store_id);

  const newEmp = (): Employee => ({
    id: uid(), store_id: storeId || visibleStores[0]?.id || '', name: '', position_id: pos || 'APV_ASIST', active: true,
    contract_weekly_hours: 48, is_demo: false, created_at: nowIso(),
  });

  const save = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return setErr('Ingresá el nombre.');
    if (!edit.store_id) return setErr('Seleccioná la tienda.');
    try {
      await saveEmployee({ ...edit, name: edit.name.trim() });
      setEdit(null);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div>
      <PageHeader title="Empleados" subtitle="Nombre, posición, tienda asignada, estado laboral y horas contractuales">
        {isAdmin && (
          <Select label="Tienda" value={storeId} onChange={(e) => setStoreId(e.target.value)}>
            <option value="">Todas</option>{stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        )}
        <Select label="Posición" value={pos} onChange={(e) => setPos(e.target.value as PositionId | '')}>
          <option value="">Todas</option>{POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select label="Estado" value={state} onChange={(e) => setState(e.target.value as typeof state)}>
          <option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="">Todos</option>
        </Select>
        <Input label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre" />
        <Button onClick={() => { setErr(null); setEdit(newEmp()); }} disabled={!visibleStores.length}><Plus size={16} /> Nuevo empleado</Button>
      </PageHeader>

      {isAdmin && (
        <Card title="Dotación por posición y tienda" subtitle="Empleados activos" className="mb-4" bodyClass="p-0 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2 text-left">Tienda</th>{POSITIONS.map((p) => <th key={p.id} className="px-2 text-right">{p.short}</th>)}<th className="px-4 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stores.map((s) => {
                const act = employees.filter((e) => e.store_id === s.id && e.active);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium text-navy-900">{s.name}<DemoBadge show={s.is_demo} /></td>
                    {POSITIONS.map((p) => { const n = act.filter((e) => e.position_id === p.id).length; return <td key={p.id} className={cx('px-2 text-right tabular-nums', !n && 'text-rose-600')}>{n}</td>; })}
                    <td className="px-4 text-right font-semibold tabular-nums">{act.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <Card title={`${list.length} empleado(s)`} bodyClass="p-0 overflow-x-auto">
        {list.length ? (
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Nombre</th><th>Posición</th><th>Tienda</th><th>Estado</th><th className="text-right">Contrato (h/sem.)</th><th className="px-4" /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-navy-900">{e.name}<DemoBadge show={e.is_demo} /></td>
                  <td><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: POSITION_COLORS[e.position_id] }} />{POSITION_BY_ID[e.position_id].name}</td>
                  <td className="text-slate-600">{stores.find((s) => s.id === e.store_id)?.name}</td>
                  <td>{e.active ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-200">Activo</span> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-300">Inactivo</span>}</td>
                  <td className="text-right tabular-nums">{e.contract_weekly_hours ?? '—'}</td>
                  <td className="px-4 text-right">
                    {canEditStore(e.store_id) && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setErr(null); setEdit({ ...e }); }}><Pencil size={14} /> Editar</Button>
                        <Button size="sm" variant="ghost" onClick={async () => {
                          if (!confirm(`¿Eliminar a ${e.name}?`)) return;
                          try { await deleteEmployee(e); } catch (x) { alert((x as Error).message); }
                        }}><Trash2 size={14} /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <div className="p-6"><Empty>No hay empleados para los filtros seleccionados.</Empty></div>}
      </Card>

      <Modal open={!!edit} title={edit && employees.some((x) => x.id === edit.id) ? 'Editar empleado' : 'Nuevo empleado'} onClose={() => setEdit(null)}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={() => void save()}>Guardar</Button></>}>
        {edit && (
          <div className="space-y-3">
            <Input label="Nombre y apellido" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} autoFocus />
            <Select label="Posición" value={edit.position_id} onChange={(e) => setEdit({ ...edit, position_id: e.target.value as PositionId })}>
              {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Select label="Tienda asignada" value={edit.store_id} disabled={!isAdmin} onChange={(e) => setEdit({ ...edit, store_id: e.target.value })}>
              {visibleStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Estado laboral" value={edit.active ? '1' : '0'} onChange={(e) => setEdit({ ...edit, active: e.target.value === '1' })}>
                <option value="1">Activo</option><option value="0">Inactivo</option>
              </Select>
              <Input label="Horas contractuales semanales" type="number" min={0} max={80} value={edit.contract_weekly_hours ?? ''} placeholder="Sin dato"
                onChange={(e) => setEdit({ ...edit, contract_weekly_hours: e.target.value === '' ? null : Number(e.target.value) })} />
            </div>
            {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}

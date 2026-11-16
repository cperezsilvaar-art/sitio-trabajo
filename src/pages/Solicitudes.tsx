import { LayoutGrid, List } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RequestTable } from '../components/RequestTable';
import { Button, cx, Input, PageTitle, Select } from '../components/ui';
import { useData } from '../lib/store';
import { STATUS_LABEL, type RequestStatus } from '../lib/types';

export function Solicitudes() {
  const { user, data } = useData();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'list' | 'grid'>('list');
  if (!user) return null;
  const isManager = user.role === 'gerente';
  const q = params.get('q') ?? '';
  const st = (params.get('estado') ?? '') as RequestStatus | '';
  const area = params.get('area') ?? '';
  const attention = params.get('f') === 'atencion';
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const rows = data.requests
    .filter((r) => !isManager || r.manager_id === user.id)
    .filter((r) => !attention || r.status === 'requiere_modificaciones' || r.status === 'borrador')
    .filter((r) => !st || r.status === st)
    .filter((r) => !area || r.area === area)
    .filter((r) => !q || norm(`${r.number} ${r.employee_name} ${r.legajo} ${r.store_name} ${r.manager_name} ${r.measure_type_name}`).includes(norm(q)))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const areas = [...new Set(data.stores.map((s) => s.area))];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageTitle
        sub={isManager ? 'Seguimiento de las medidas que solicitaste. Sólo las aprobadas por RH pueden comunicarse.' : 'Todas las solicitudes de las áreas que cubrís.'}
        actions={isManager && <Button onClick={() => nav('/solicitudes/nueva')}>Nueva solicitud</Button>}
      >
        {attention ? 'Requieren mi atención' : isManager ? 'Mis solicitudes' : 'Todas las solicitudes'}
      </PageTitle>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input wrapClass="w-72" placeholder="Buscar por número, colaborador, legajo…" value={q} onChange={(e) => set('q', e.target.value)} />
        <Select wrapClass="w-56" value={st} onChange={(e) => set('estado', e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        {!isManager && (
          <Select wrapClass="w-40" value={area} onChange={(e) => set('area', e.target.value)}>
            <option value="">Todas las áreas</option>
            {areas.map((a) => <option key={a}>{a}</option>)}
          </Select>
        )}
        {attention && <Button variant="link" onClick={() => set('f', '')}>Ver todas</Button>}
        <div className="ml-auto flex gap-1">
          <button className={cx('rounded-md p-2', view === 'list' ? 'bg-ink-700 text-white' : 'hover:bg-chrome-100')} onClick={() => setView('list')} aria-label="Lista"><List size={18} /></button>
          <button className={cx('rounded-md p-2', view === 'grid' ? 'bg-ink-700 text-white' : 'hover:bg-chrome-100')} onClick={() => setView('grid')} aria-label="Cuadrícula"><LayoutGrid size={18} /></button>
        </div>
      </div>
      <RequestTable rows={rows} view={view} compact={isManager} empty="No hay solicitudes con estos filtros." />
    </div>
  );
}

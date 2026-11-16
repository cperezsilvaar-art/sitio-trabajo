import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACCENT } from '../components/RequestTable';
import { DocThumb, Empty, PageTitle, Pill, Select, StatusBadge, Td, Th } from '../components/ui';
import { useData } from '../lib/store';
import { fmtDate } from '../lib/template';
import { businessDaysBetween, isOverdue } from '../lib/workflow';

/** Backoffice de RH: solicitudes pendientes de aprobación. */
export function Aprobaciones() {
  const { user, data } = useData();
  const nav = useNavigate();
  const [area, setArea] = useState('');
  const [scope, setScope] = useState<'mias' | 'todas'>('mias');
  if (!user) return null;

  const pending = data.requests
    .filter((r) => r.status === 'enviada' || r.status === 'pendiente_revision')
    .filter((r) => !area || r.area === area)
    .filter((r) => scope === 'todas' || r.coordinator_id === user.id || user.role === 'admin_rh' || user.areas.includes(r.area))
    .sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''));
  const areas = [...new Set(data.requests.map((r) => r.area).filter(Boolean))];

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageTitle sub={`Ordenadas por antigüedad. Plazo de revisión: ${data.policy.review_sla_days} días hábiles desde el envío.`}>
        Solicitudes pendientes de aprobación
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-3">
        <Select wrapClass="w-48" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Todas las áreas</option>
          {areas.map((a) => <option key={a}>{a}</option>)}
        </Select>
        {user.role === 'admin_rh' && (
          <Select wrapClass="w-56" value={scope} onChange={(e) => setScope(e.target.value as 'mias' | 'todas')}>
            <option value="mias">Visibles para mí</option>
            <option value="todas">Todas</option>
          </Select>
        )}
      </div>
      {pending.length === 0 ? <Empty>No hay solicitudes pendientes. 🎉</Empty> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="border-b border-chrome-200">
              <tr>
                <Th className="w-14" /><Th>N° solicitud</Th><Th>Colaborador</Th><Th>Legajo</Th><Th>Tienda</Th><Th>Área</Th>
                <Th>Medida solicitada</Th><Th>Presentada</Th><Th>Gerente solicitante</Th><Th>Estado de aprobación</Th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => {
                const late = isOverdue(r, data.policy);
                const days = r.submitted_at ? businessDaysBetween(r.submitted_at, new Date().toISOString()) : 0;
                return (
                  <tr key={r.id} className="cursor-pointer border-b border-chrome-200 hover:bg-chrome-100" onClick={() => nav(`/solicitudes/${r.id}`)}>
                    <Td><DocThumb small accent={ACCENT[r.status]} /></Td>
                    <Td className="whitespace-nowrap font-mono text-sm text-ink-700">{r.number}{r.revision > 1 && <div className="font-sans text-xs text-ink-400">versión {r.revision}</div>}</Td>
                    <Td className="text-ink-700">{r.employee_name}</Td>
                    <Td>{r.legajo}</Td>
                    <Td>{r.store_name}</Td>
                    <Td className="whitespace-nowrap">{r.area}</Td>
                    <Td>{r.measure_type_name}</Td>
                    <Td>{fmtDate(r.submitted_at)}<div className="text-xs">{late ? <Pill tone="red">{days} días hábiles</Pill> : <span className="text-ink-400">{days} día{days === 1 ? '' : 's'} háb.</span>}</div></Td>
                    <Td>{r.manager_name}</Td>
                    <Td><StatusBadge status={r.status} />{r.coordinator_name && <div className="mt-1 text-xs text-ink-400">{r.coordinator_name}</div>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useData } from '../lib/store';
import type { DisciplinaryRequest, RequestStatus } from '../lib/types';
import { isOverdue } from '../lib/workflow';
import { DocThumb, Empty, Pill, shortDate, StatusBadge, Td, Th } from './ui';

export const ACCENT: Record<RequestStatus, string> = {
  borrador: 'bg-slate-300', enviada: 'bg-sky-400', pendiente_revision: 'bg-amber-400', requiere_modificaciones: 'bg-orange-400',
  aprobada: 'bg-emerald-500', rechazada: 'bg-rose-500', cerrada: 'bg-slate-500',
};

export function RequestTable({ rows, view = 'list', compact, empty }: { rows: DisciplinaryRequest[]; view?: 'list' | 'grid'; compact?: boolean; empty?: string }) {
  const nav = useNavigate();
  const { data } = useData();
  if (!rows.length) return <Empty>{empty ?? 'Sin solicitudes.'}</Empty>;

  if (view === 'grid') {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {rows.map((r) => (
          <button key={r.id} onClick={() => nav(`/solicitudes/${r.id}`)} className="flex gap-4 rounded-xl border border-chrome-300 p-4 text-left hover:bg-chrome-100">
            <DocThumb accent={ACCENT[r.status]} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink-900">{r.measure_type_name || 'Sin tipo'} · {r.employee_name || 'Sin colaborador'}</div>
              <div className="text-xs text-ink-500">{r.number}</div>
              <div className="mt-2"><StatusBadge status={r.status} /></div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead className="border-b border-chrome-200">
          <tr>
            <Th className="w-16" />
            <Th>Nombre</Th>
            <Th>Tienda</Th>
            {!compact && <Th>Gerente</Th>}
            <Th>Estado</Th>
            <Th>Actualizado</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="cursor-pointer border-b border-chrome-200 hover:bg-chrome-100" onClick={() => nav(`/solicitudes/${r.id}`)}>
              <Td><div className="flex justify-center"><DocThumb accent={ACCENT[r.status]} small /></div></Td>
              <Td>
                <div className="text-[16px] text-ink-700">{r.measure_type_name || 'Medida sin definir'} · {r.employee_name || 'Colaborador sin elegir'}</div>
                <div className="text-xs text-ink-500">{r.number}{r.legajo ? ` · Legajo ${r.legajo}` : ''} {isOverdue(r, data.policy) && <Pill tone="red">Fuera de plazo</Pill>}</div>
              </Td>
              <Td>{r.store_name || '—'}</Td>
              {!compact && <Td>{r.manager_name}</Td>}
              <Td><StatusBadge status={r.status} /></Td>
              <Td>{shortDate(r.updated_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

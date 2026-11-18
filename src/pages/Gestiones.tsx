import { CalendarDays, HeartPulse } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GestionBadge } from '../components/GestionBadge';
import { Button, cx, DocThumb, Empty, Input, PageTitle, Pill, Select, shortDate, Td, Th } from '../components/ui';
import { certificateOverdue } from '../lib/gestiones';
import { useData } from '../lib/store';
import { fmtDate } from '../lib/template';
import { GESTION_STATUS_LABEL, type Gestion, type GestionKind, type GestionStatus } from '../lib/types';

const ACCENT: Record<GestionStatus, string> = {
  pendiente_certificado: 'bg-amber-400', pendiente_firma: 'bg-amber-400', enviada: 'bg-sky-400', observada: 'bg-orange-400',
  recibida: 'bg-emerald-500', cerrada: 'bg-slate-500', anulada: 'bg-rose-400',
};

export function GestionTable({ rows, compact }: { rows: Gestion[]; compact?: boolean }) {
  const nav = useNavigate();
  const { data } = useData();
  if (!rows.length) return <Empty>No hay licencias ni vacaciones para mostrar.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px]">
        <thead className="border-b border-chrome-200">
          <tr><Th className="w-16" /><Th>Nombre</Th><Th>Fechas</Th><Th>Tienda</Th>{!compact && <Th>Gerente</Th>}<Th>Estado</Th><Th>Actualizado</Th></tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.id} className="cursor-pointer border-b border-chrome-200 hover:bg-chrome-100" onClick={() => nav(`/gestiones/${g.id}`)}>
              <Td><div className="flex justify-center"><DocThumb small accent={ACCENT[g.status]} /></div></Td>
              <Td>
                <div className="flex items-center gap-2 text-[16px] text-ink-700">
                  {g.kind === 'licencia' ? <HeartPulse size={16} className="text-rose-500" /> : <CalendarDays size={16} className="text-brand-500" />}
                  {g.kind === 'licencia' ? `Licencia · ${g.leave_type_name}` : `Vacaciones ${g.period_year}`} · {g.employee_name}
                </div>
                <div className="text-xs text-ink-500">{g.number} · Legajo {g.legajo} {certificateOverdue(g, data.policy) && <Pill tone="red">Certificado demorado</Pill>}</div>
              </Td>
              <Td className="whitespace-nowrap text-sm">{fmtDate(g.start_date)} → {fmtDate(g.end_date)}<div className="text-xs text-ink-400">{g.days} días</div></Td>
              <Td>{g.store_name}</Td>
              {!compact && <Td>{g.manager_name}</Td>}
              <Td><GestionBadge status={g.status} /></Td>
              <Td>{shortDate(g.updated_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Gestiones() {
  const { user, data } = useData();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  if (!user) return null;
  const isManager = user.role === 'gerente';
  const kind = (params.get('tipo') ?? '') as GestionKind | '';
  const st = (params.get('estado') ?? '') as GestionStatus | '';
  const q = params.get('q') ?? '';
  const pend = params.get('f') === 'pendientes';
  const set = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); setParams(p, { replace: true }); };

  const rows = data.gestiones
    .filter((g) => !isManager || g.manager_id === user.id)
    .filter((g) => !kind || g.kind === kind)
    .filter((g) => !st || g.status === st)
    .filter((g) => !pend || (isManager ? ['pendiente_certificado', 'pendiente_firma', 'observada'].includes(g.status) : g.status === 'enviada' || certificateOverdue(g, data.policy)))
    .filter((g) => !q || `${g.number} ${g.employee_name} ${g.legajo} ${g.store_name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const title = pend ? (isManager ? 'Licencias y vacaciones por completar' : 'Licencias y vacaciones para revisar') : kind === 'licencia' ? 'Licencias' : kind === 'vacaciones' ? 'Vacaciones' : 'Licencias y vacaciones';

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageTitle
        sub={isManager ? 'Avisos de licencia con su certificado y notificaciones de vacaciones firmadas.' : 'Lo que cargan los gerentes de tus áreas. Dalo por recibido u obsérvalo para que lo corrijan.'}
        actions={isManager && <><Button variant="outline" onClick={() => nav('/gestiones/nueva/licencia')}>Avisar licencia</Button><Button onClick={() => nav('/gestiones/nueva/vacaciones')}>Cargar vacaciones</Button></>}
      >{title}</PageTitle>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Input wrapClass="w-72" placeholder="Buscar por número, colaborador, legajo…" value={q} onChange={(e) => set('q', e.target.value)} />
        <Select wrapClass="w-44" value={kind} onChange={(e) => set('tipo', e.target.value)}>
          <option value="">Licencias y vacaciones</option><option value="licencia">Sólo licencias</option><option value="vacaciones">Sólo vacaciones</option>
        </Select>
        <Select wrapClass="w-60" value={st} onChange={(e) => set('estado', e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(GESTION_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <button className={cx('rounded-full px-3 py-1.5 text-sm', pend ? 'bg-ink-700 text-white' : 'bg-chrome-100 hover:bg-chrome-200')} onClick={() => set('f', pend ? '' : 'pendientes')}>
          {isManager ? 'Por completar' : 'Para revisar'}
        </button>
      </div>
      <GestionTable rows={rows} compact={isManager} />
    </div>
  );
}

import { Ban, CheckCircle2, Clock, MessageSquare, Plus, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, cx, Empty, Input, Modal, Notice, PageTitle, Pill, Select, shortDate, Td, Textarea, Th } from '../components/ui';
import { useData } from '../lib/store';
import { fmtDate, fmtDateTime } from '../lib/template';
import {
  LEAVING_REASONS, ROLE_LABEL, SHIFTS, VACANCY_REASONS, VACANCY_STAGE_SHORT, VACANCY_STAGES, VACANCY_STATUS_LABEL, VACANCY_STATUS_STYLE,
  type Vacancy, type VacancyStatus,
} from '../lib/types';
import { canRequest, nextStage, OPEN_STATUSES, slotsForStore, stageIndex, stageTimes, totalDays, vCan, vDenyReason } from '../lib/vacantes';

export function VacancyBadge({ status }: { status: VacancyStatus }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', VACANCY_STATUS_STYLE[status])}>{VACANCY_STATUS_LABEL[status]}</span>;
}

/** Barra de etapas compacta: dónde está la vacante. */
function MiniLineUp({ v }: { v: Vacancy }) {
  const i = stageIndex(v.status);
  const bad = v.status === 'rechazada' || v.status === 'cancelada';
  return (
    <div className="flex gap-0.5" title={VACANCY_STATUS_LABEL[v.status]}>
      {VACANCY_STAGES.map((s, k) => (
        <span key={s} className={cx('h-1.5 w-5 rounded-full', bad ? 'bg-chrome-300' : k < i ? 'bg-emerald-500' : k === i ? 'bg-brand-500' : 'bg-chrome-200', bad && k === 0 && 'bg-rose-400')} />
      ))}
    </div>
  );
}

export function VacancyTable({ rows }: { rows: Vacancy[] }) {
  const nav = useNavigate();
  if (!rows.length) return <Empty>No hay vacantes para mostrar.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1000px]">
        <thead className="border-b border-chrome-200"><tr><Th>Vacante</Th><Th>Tienda</Th><Th>Motivo</Th><Th>Etapa</Th><Th>Días</Th><Th>Solicitó</Th><Th>Actualizado</Th></tr></thead>
        <tbody>
          {rows.map((v) => (
            <tr key={v.id} className="cursor-pointer border-b border-chrome-200 hover:bg-chrome-100" onClick={() => nav(`/vacantes/${v.id}`)}>
              <Td><div className="text-[16px] text-ink-700">{v.position}</div><div className="text-xs">{v.number} · {v.shift} · jornada {v.workday}</div></Td>
              <Td>{v.store_name}<div className="text-xs">{v.area}</div></Td>
              <Td className="text-sm">{v.reason === 'reemplazo' ? `Reemplazo de ${v.replaced_employee_name}` : 'Posición disponible'}</Td>
              <Td><VacancyBadge status={v.status} /><div className="mt-1.5"><MiniLineUp v={v} /></div></Td>
              <Td className="whitespace-nowrap">{totalDays(v)} días</Td>
              <Td className="text-sm">{v.manager_name}</Td>
              <Td>{shortDate(v.updated_at)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Vacantes() {
  const { user, data } = useData();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  if (!user) return null;
  const f = params.get('f') ?? 'abiertas';
  const set = (v: string) => setParams({ f: v }, { replace: true });
  const mine = data.vacancies.filter((v) => user.role !== 'gerente' || v.manager_id === user.id);
  const filters: Record<string, (v: Vacancy) => boolean> = {
    abiertas: (v) => OPEN_STATUSES.includes(v.status),
    accion: (v) => (user.role === 'gerente_area' ? v.status === 'pendiente_area' : user.role === 'gerente' ? false : v.status === 'autorizada'),
    cerradas: (v) => !OPEN_STATUSES.includes(v.status),
    todas: () => true,
  };
  const rows = mine.filter(filters[f] ?? filters.abiertas).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const actionLabel = user.role === 'gerente_area' ? 'Para autorizar' : user.role === 'gerente' ? null : 'Autorizadas sin tomar';
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageTitle
        sub={user.role === 'gerente' ? 'Pedí una vacante cuando tengas lugar en el headcount de tu tienda. Seguí en qué etapa está cada búsqueda.'
          : user.role === 'gerente_area' ? 'Autorizá o rechazá las vacantes de tus tiendas y seguí la búsqueda de RH.'
            : 'Vacantes autorizadas por los gerentes de área: tomalas y cargá las novedades de cada etapa.'}
        actions={<>
          <Link to="/headcount"><Button variant="outline">Headcount</Button></Link>
          {user.role === 'gerente' && <Button onClick={() => nav('/vacantes/nueva')}><Plus size={16} /> Solicitar vacante</Button>}
        </>}>
        Vacantes
      </PageTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        {([['abiertas', 'En curso'], ...(actionLabel ? [['accion', actionLabel]] : []), ['cerradas', 'Cerradas'], ['todas', 'Todas']] as [string, string][]).map(([k, l]) => (
          <button key={k} onClick={() => set(k)} className={cx('rounded-full px-3 py-1.5 text-sm', f === k ? 'bg-ink-700 text-white' : 'bg-chrome-100 hover:bg-chrome-200')}>
            {l} {k === 'accion' && mine.filter(filters.accion).length > 0 && <span className="ml-1 rounded bg-brand-600 px-1.5 text-[11px] font-bold text-white">{mine.filter(filters.accion).length}</span>}
          </button>
        ))}
      </div>
      <VacancyTable rows={rows} />
    </div>
  );
}

export function VacanteForm() {
  const { user, data, run } = useData();
  const nav = useNavigate();
  const [f, setF] = useState({
    store_id: '', position: '', shift: 'Mañana', workday: 'completa' as Vacancy['workday'], reason: 'nueva' as Vacancy['reason'],
    replaced_employee_id: '', leaving_reason: '', leaving_date: '', needed_by: '', profile_notes: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const myStores = data.stores.filter((s) => user?.store_ids.includes(s.id));
  const storeId = f.store_id || (myStores.length === 1 ? myStores[0].id : '');
  const slots = useMemo(() => (storeId ? slotsForStore(storeId, data.headcount, data.employees, data.vacancies) : []), [storeId, data]);
  if (!user) return null;
  if (user.role !== 'gerente') return <Notice tone="warn">Las vacantes las solicita el gerente de la tienda.</Notice>;
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const check = storeId && f.position ? canRequest({ ...f, store_id: storeId }, data.headcount, data.employees, data.vacancies) : null;
  const candidates = data.employees.filter((e) => e.store_id === storeId && e.position === f.position);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const id = await run((s) => s.requestVacancy({ ...f, store_id: storeId }));
      nav(`/vacantes/${id}`, { replace: true });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle sub="Sólo podés pedir puestos con lugar disponible en el headcount que configuró RH. La autoriza tu gerente de área y después RH hace la búsqueda.">Solicitar vacante</PageTitle>
      <div className="space-y-6">
        <Card title="Headcount de la tienda">
          <Select wrapClass="mb-4 max-w-sm" label="Tienda" value={storeId} onChange={(e) => set({ store_id: e.target.value, position: '' })}>
            <option value="">Elegí la tienda…</option>
            {myStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          {storeId && (slots.length === 0 ? <Notice tone="warn">La tienda no tiene headcount configurado. Pedíselo a RH.</Notice> : (
            <table className="w-full">
              <thead className="border-b border-chrome-200"><tr><Th>Puesto</Th><Th>Autorizados</Th><Th>Ocupados</Th><Th>En proceso</Th><Th>Disponibles</Th><Th /></tr></thead>
              <tbody>
                {slots.map((s) => {
                  const canReplace = data.employees.some((e) => e.active && e.store_id === storeId && e.position === s.position);
                  return (
                    <tr key={s.position} className={cx('border-b border-chrome-200', f.position === s.position && 'bg-brand-50')}>
                      <Td className="text-ink-700">{s.position}</Td><Td>{s.authorized}</Td><Td>{s.active - s.leaving}{s.leaving ? <span className="text-xs"> (+{s.leaving} se van)</span> : null}</Td><Td>{s.open}</Td>
                      <Td>{s.available > 0 ? <Pill tone="green">{s.available} disponible{s.available > 1 ? 's' : ''}</Pill> : <Pill tone="gray">Sin lugar</Pill>}</Td>
                      <Td className="whitespace-nowrap text-right">
                        {s.available > 0 && <Button size="sm" variant={f.position === s.position && f.reason === 'nueva' ? 'primary' : 'outline'} onClick={() => set({ position: s.position, reason: 'nueva', replaced_employee_id: '' })}>Pedir</Button>}
                        {canReplace && s.authorized > 0 && <Button size="sm" variant="link" className="ml-2" onClick={() => set({ position: s.position, reason: 'reemplazo' })}>Reemplazo</Button>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </Card>

        {f.position && (
          <Card title={`Vacante: ${f.position}`}>
            <div className="grid gap-4 md:grid-cols-3">
              <Select label="Motivo" value={f.reason} onChange={(e) => set({ reason: e.target.value as Vacancy['reason'] })}>
                {VACANCY_REASONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
              <Select label="Turno" value={f.shift} onChange={(e) => set({ shift: e.target.value })}>{SHIFTS.map((s) => <option key={s}>{s}</option>)}</Select>
              <Select label="Jornada" value={f.workday} onChange={(e) => set({ workday: e.target.value as Vacancy['workday'] })}><option value="completa">Completa</option><option value="parcial">Parcial</option></Select>
              {f.reason === 'reemplazo' && (
                <>
                  <Select label="¿A quién reemplaza?" required value={f.replaced_employee_id} onChange={(e) => set({ replaced_employee_id: e.target.value })}>
                    <option value="">Elegí…</option>
                    {candidates.map((e) => <option key={e.id} value={e.id}>{e.name}{e.active ? '' : ' (ya no está)'}</option>)}
                  </Select>
                  <Select label="Motivo del egreso" required value={f.leaving_reason} onChange={(e) => set({ leaving_reason: e.target.value })}>
                    <option value="">Elegí…</option>{LEAVING_REASONS.map((r) => <option key={r}>{r}</option>)}
                  </Select>
                  <Input label="Último día (o previsto)" type="date" value={f.leaving_date} onChange={(e) => set({ leaving_date: e.target.value })} />
                </>
              )}
              <Input label="¿Para cuándo la necesitás?" type="date" value={f.needed_by} onChange={(e) => set({ needed_by: e.target.value })} />
              <Textarea wrapClass="md:col-span-2" className="min-h-[70px]" label="Perfil y comentarios para RH" value={f.profile_notes} onChange={(e) => set({ profile_notes: e.target.value })} placeholder="Ej.: experiencia en caja, disponibilidad fines de semana…" />
            </div>
            {check && !check.ok && <div className="mt-4"><Notice tone="error" title="No se puede pedir">{check.reason}</Notice></div>}
            {check?.ok && <div className="mt-4"><Notice tone="ok">Hay lugar en el headcount. Al enviarla, le llega a tu gerente de área para autorizar.</Notice></div>}
            {error && <div className="mt-4"><Notice tone="error">{error}</Notice></div>}
            <div className="mt-5"><Button disabled={busy || !check?.ok} onClick={save}>Enviar al gerente de área</Button></div>
          </Card>
        )}
      </div>
    </div>
  );
}

export function VacanteDetalle() {
  const { id } = useParams();
  const { user, data, run } = useData();
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [advance, setAdvance] = useState(false);
  const [cand, setCand] = useState({ candidate_name: '', candidate_legajo: '', hire_date: '' });
  const [cancel, setCancel] = useState(false);
  const v = data.vacancies.find((x) => x.id === id);
  if (!user) return null;
  if (!v) return <Empty>Vacante no encontrada o sin acceso.</Empty>;
  const events = data.audit_events.filter((e) => e.entity === 'vacancy' && e.entity_id === v.id).sort((a, b) => a.at.localeCompare(b.at));
  const times = stageTimes(v, events);
  const idx = stageIndex(v.status);
  const closedBad = v.status === 'rechazada' || v.status === 'cancelada';
  const next = nextStage(v.status);
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await fn(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };
  const reachedAt = (s: VacancyStatus) => times.find((t) => t.status === s);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-1 text-sm"><Link to="/vacantes" className="text-brand-500 hover:underline">← Vacantes</Link></div>
      <div className="mb-5">
        <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-ink-900">{v.position} · {v.store_name} <VacancyBadge status={v.status} /></h1>
        <p className="mt-1 text-sm text-ink-500"><span className="font-mono">{v.number}</span> · {v.area} · Pidió: {v.manager_name} · Autoriza: {v.area_manager_name ?? '—'} · RH: {v.coordinator_name ?? '—'}</p>
      </div>

      {/* Line up */}
      <Card className="mb-6" title={<span className="flex items-center gap-2"><Clock size={18} /> Dónde está la vacante · {totalDays(v)} días desde el pedido</span>}>
        <ol className="grid grid-cols-7 gap-2">
          {VACANCY_STAGES.map((s, i) => {
            const t = reachedAt(s);
            const done = !closedBad && i < idx;
            const current = !closedBad && i === idx;
            return (
              <li key={s} className={cx('rounded-lg border-t-4 bg-chrome-100/60 p-3', done ? 'border-emerald-500' : current ? 'border-brand-500 bg-brand-50' : 'border-chrome-300')}>
                <div className={cx('flex items-center gap-1 text-sm', current ? 'font-bold text-ink-900' : done ? 'text-ink-700' : 'text-ink-400')}>
                  {done && <CheckCircle2 size={14} className="text-emerald-600" />}{VACANCY_STAGE_SHORT[s]}
                </div>
                <div className="mt-1 text-xs text-ink-500">{t ? fmtDate(t.from) : '—'}</div>
                {t && s !== 'cubierta' && <div className={cx('text-xs', current ? 'font-semibold text-brand-700' : 'text-ink-400')}>{t.days} día{t.days === 1 ? '' : 's'}{current ? ' (en curso)' : ''}</div>}
              </li>
            );
          })}
        </ol>
        {closedBad && <div className="mt-4"><Notice tone="error" title={VACANCY_STATUS_LABEL[v.status]}>{[...events].reverse().find((e) => e.to_status === v.status)?.comment}</Notice></div>}
        {v.candidate_name && <p className="mt-4 text-sm text-ink-700"><UserCheck size={15} className="mr-1 inline" /> Ingresante: <b>{v.candidate_name}</b>{v.hire_date && <> · ingreso {fmtDate(v.hire_date)}</>}{v.candidate_legajo && <> · legajo {v.candidate_legajo}</>}</p>}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card title="Novedades">
            <ol className="relative ml-3 border-l-2 border-chrome-200">
              {[...events].reverse().map((e) => (
                <li key={e.id} className="mb-5 ml-5">
                  <span className={cx('absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-white', e.to_status ? 'bg-brand-500' : 'bg-amber-400')} />
                  <div className="text-sm">
                    <span className="font-semibold text-ink-900">{e.to_status ? VACANCY_STATUS_LABEL[e.to_status as unknown as VacancyStatus] : 'Novedad'}</span>
                    <span className="text-ink-400"> · {e.actor_name} ({ROLE_LABEL[e.actor_role]}) · {fmtDateTime(e.at)}</span>
                  </div>
                  {e.comment && <div className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{e.comment}</div>}
                </li>
              ))}
            </ol>
          </Card>
          <Card title="El pedido">
            <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
              <div><dt className="text-ink-500">Motivo</dt><dd>{v.reason === 'reemplazo' ? `Reemplazo de ${v.replaced_employee_name} · ${v.leaving_reason}${v.leaving_date ? ` · último día ${fmtDate(v.leaving_date)}` : ''}` : 'Posición disponible dentro del headcount'}</dd></div>
              <div><dt className="text-ink-500">Turno y jornada</dt><dd>{v.shift} · {v.workday}</dd></div>
              <div><dt className="text-ink-500">La necesita para</dt><dd>{fmtDate(v.needed_by) || '—'}</dd></div>
              <div className="md:col-span-2"><dt className="text-ink-500">Perfil y comentarios</dt><dd className="whitespace-pre-wrap">{v.profile_notes || '—'}</dd></div>
            </dl>
          </Card>
        </div>

        <aside className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          {v.status === 'pendiente_area' && user.role === 'gerente_area' && (
            <Card title="Autorización">
              {vDenyReason('autorizar', user, v) ? <Notice tone="warn">{vDenyReason('autorizar', user, v)}</Notice> : <>
                <Textarea label="Comentario" value={comment} onChange={(e) => setComment(e.target.value)} hint="Obligatorio para rechazar. El gerente lo ve." />
                <div className="mt-4 grid gap-2">
                  <Button variant="success" disabled={busy} onClick={() => act(() => run((s) => s.decideVacancy(v.id, 'autorizar', comment)))}>Autorizar</Button>
                  <Button variant="danger" disabled={busy} onClick={() => act(() => run((s) => s.decideVacancy(v.id, 'rechazar', comment)))}>Rechazar</Button>
                </div>
              </>}
            </Card>
          )}
          {next && (vCan('tomar', user, v) || vCan('avanzar', user, v)) && (
            <Card title="Gestión de RH">
              <p className="mb-3 text-sm text-ink-500">Siguiente etapa: <b>{VACANCY_STATUS_LABEL[next]}</b></p>
              <Button className="w-full" onClick={() => { setAdvance(true); setNote(''); setCand({ candidate_name: v.candidate_name, candidate_legajo: v.candidate_legajo, hire_date: v.hire_date }); }}>
                {v.status === 'autorizada' ? 'Tomar la búsqueda' : `Pasar a "${VACANCY_STAGE_SHORT[next]}"`}
              </Button>
            </Card>
          )}
          {vCan('novedad', user, v) && (
            <Card title="Agregar novedad">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={user.role === 'coordinador' || user.role === 'admin_rh' ? 'Ej.: 20 postulantes, 5 preseleccionados para entrevista…' : 'Consulta o comentario…'} className="min-h-[80px]" />
              <Button className="mt-3" size="sm" disabled={busy || !note.trim()} onClick={() => act(() => run((s) => s.vacancyNote(v.id, note))).then((ok) => ok && setNote(''))}><MessageSquare size={14} /> Publicar novedad</Button>
              <p className="mt-2 text-xs text-ink-400">Les llega a {['gerente', 'gerente de área', 'RH'].join(', ')}.</p>
            </Card>
          )}
          {vCan('cancelar', user, v) && <Button variant="link" onClick={() => setCancel(true)}><Ban size={14} /> Cancelar la vacante</Button>}
        </aside>
      </div>

      {advance && next && (
        <Modal title={v.status === 'autorizada' ? 'Tomar la búsqueda' : `Pasar a "${VACANCY_STATUS_LABEL[next]}"`} onClose={() => setAdvance(false)}
          footer={<><Button variant="ghost" onClick={() => setAdvance(false)}>Cancelar</Button><Button disabled={busy} onClick={async () => {
            const extra = next === 'ingreso' || next === 'cubierta' || next === 'preocupacional' ? cand : {};
            if (await act(() => run((s) => s.advanceVacancy(v.id, note, extra)))) setAdvance(false);
          }}>Confirmar</Button></>}>
          <div className="space-y-4">
            <Textarea label="Novedad para el gerente y el gerente de área" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={next === 'en_busqueda' ? 'Ej.: publicada en Bumeran y Computrabajo.' : next === 'entrevistas' ? 'Ej.: 6 preseleccionados; entrevistas el jueves.' : ''} />
            {(next === 'preocupacional' || next === 'ingreso' || next === 'cubierta') && (
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Persona elegida" required={next !== 'preocupacional'} value={cand.candidate_name} onChange={(e) => setCand({ ...cand, candidate_name: e.target.value })} />
                {next !== 'preocupacional' && <Input label="Fecha de ingreso" type="date" required value={cand.hire_date} onChange={(e) => setCand({ ...cand, hire_date: e.target.value })} />}
                {next === 'cubierta' && <Input label="Legajo (si ya lo tiene)" value={cand.candidate_legajo} onChange={(e) => setCand({ ...cand, candidate_legajo: e.target.value })} />}
              </div>
            )}
            {next === 'cubierta' && <Notice tone="info">Se da de alta al ingresante en el plantel de la tienda{v.reason === 'reemplazo' ? ` y se da de baja a ${v.replaced_employee_name}` : ''}.</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        </Modal>
      )}
      {cancel && (
        <Modal title="Cancelar vacante" onClose={() => setCancel(false)} footer={<><Button variant="ghost" onClick={() => setCancel(false)}>Volver</Button><Button variant="danger" disabled={busy} onClick={async () => { if (await act(() => run((s) => s.cancelVacancy(v.id, note)))) setCancel(false); }}>Cancelar vacante</Button></>}>
          <Textarea label="Motivo" required value={note} onChange={(e) => setNote(e.target.value)} />
          {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
        </Modal>
      )}
    </div>
  );
}

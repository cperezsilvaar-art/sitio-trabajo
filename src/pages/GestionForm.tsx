import { Paperclip, Trash2, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Empty, fmtSize, Input, Notice, PageTitle, Select, Textarea } from '../components/ui';
import { daysInclusive, G_EDITABLE, leaveChecks, leaveRequiresCertificate, vacationChecks, type Check } from '../lib/gestiones';
import { useData } from '../lib/store';
import { buildGestionValues, render } from '../lib/template';
import { LEAVE_TYPES, type Gestion, type GestionKind } from '../lib/types';

type Att = Gestion['attachments'][number];

export function GestionForm() {
  const { kind: kindParam, id } = useParams();
  const { user, data, svc, run } = useData();
  const nav = useNavigate();
  const existing = id ? data.gestiones.find((g) => g.id === id) : undefined;
  const kind = (existing?.kind ?? kindParam) as GestionKind;
  const [f, setF] = useState<Partial<Gestion>>({ attachments: [], notes: '', period_year: new Date().getFullYear() });
  const [loaded, setLoaded] = useState(!id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (id && existing && !loaded) { setF({ ...existing }); setLoaded(true); }
  }, [id, existing, loaded]);

  if (!user || !svc) return null;
  if (kind !== 'licencia' && kind !== 'vacaciones') return <Empty>Gestión desconocida.</Empty>;
  if (user.role !== 'gerente') return <Notice tone="warn">Las licencias y vacaciones las carga el gerente de la tienda.</Notice>;
  if (id && !existing) return <Empty>Gestión no encontrada.</Empty>;
  if (existing && !G_EDITABLE.includes(existing.status)) return <Notice tone="warn">En este estado la gestión ya no se puede modificar.</Notice>;

  const isLic = kind === 'licencia';
  const myStores = data.stores.filter((s) => user.store_ids.includes(s.id));
  const emps = data.employees.filter((e) => e.active && user.store_ids.includes(e.store_id) && (!f.store_id || e.store_id === f.store_id));
  const set = (p: Partial<Gestion>) => setF((x) => ({ ...x, ...p }));
  const g = { ...f, days: daysInclusive(f.start_date ?? '', f.end_date ?? '') } as Gestion;
  const checks: Check[] = isLic ? leaveChecks(g) : vacationChecks(g, data.policy);
  const errorsOf = (field: string) => checks.find((c) => c.field === field && c.level === 'error')?.message;
  const needsCert = isLic && leaveRequiresCertificate(f.leave_type ?? '');
  const leave = LEAVE_TYPES.find((t) => t.id === f.leave_type);
  const tv = !isLic ? (existing ? svc.templateVersion(existing.template_version_id) : null) ?? svc.vacationTemplateVersion() : null;
  const role: Att['role'] = isLic ? 'certificado' : 'firmada';

  const pickEmployee = (eid: string) => {
    const e = data.employees.find((x) => x.id === eid);
    const s = data.stores.find((x) => x.id === e?.store_id);
    set({ employee_id: eid, employee_name: e?.name ?? '', legajo: e?.legajo ?? '', position: e?.position ?? '', hire_date: e?.hire_date ?? '', store_id: s?.id, store_name: s?.name, area: s?.area });
  };

  const upload = async (files: FileList | null, r: Att['role']) => {
    if (!files) return;
    setBusy(true); setError('');
    try {
      const add: Att[] = [];
      for (const file of Array.from(files)) add.push({ ...(await svc.uploadFile(file)), role: r });
      set({ attachments: [...(f.attachments ?? []), ...add] });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true); setError('');
    try {
      if (existing) {
        await run((s) => s.updateGestion(existing.id, f, note));
        nav(`/gestiones/${existing.id}`, { replace: true });
      } else {
        const nid = await run((s) => s.createGestion(kind, f));
        nav(`/gestiones/${nid}`, { replace: true });
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const preview = tv && f.employee_id && f.start_date && f.end_date
    ? render(tv.body, buildGestionValues({ ...(g as Gestion), number: existing?.number ?? '(se asigna al guardar)', manager_name: user.name, notes: f.notes ?? '', period_year: f.period_year ?? 0 }, existing?.created_at ?? new Date().toISOString()))
    : '';
  const hasFile = (f.attachments ?? []).some((a) => a.role === role);
  const willSend = isLic ? !needsCert || hasFile : hasFile;

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle sub={isLic
        ? 'Avisá la licencia apenas te enteres: le llega a RH en el momento. Si todavía no tenés el certificado, cargalo después.'
        : 'Cargá las fechas y descargá la notificación para que el colaborador la firme. Cuando subas la copia firmada, le llega a RH.'}>
        {existing ? `${existing.number}` : isLic ? 'Avisar licencia' : 'Cargar vacaciones'}
      </PageTitle>
      <div className="space-y-6">
        <Card title="Colaborador">
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Tienda" required value={f.store_id ?? ''} disabled={!!existing} onChange={(e) => { const s = data.stores.find((x) => x.id === e.target.value); set({ store_id: s?.id, store_name: s?.name, area: s?.area, employee_id: '', employee_name: '' }); }}>
              <option value="">Elegí la tienda…</option>
              {myStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select label="Colaborador" required value={f.employee_id ?? ''} disabled={!!existing} onChange={(e) => pickEmployee(e.target.value)}>
              <option value="">Elegí al colaborador…</option>
              {emps.map((e) => <option key={e.id} value={e.id}>{e.name} — legajo {e.legajo}</option>)}
            </Select>
          </div>
        </Card>

        <Card title={isLic ? 'La licencia' : 'Las vacaciones'}>
          <div className="grid gap-4 md:grid-cols-3">
            {isLic ? (
              <>
                <Select wrapClass="md:col-span-2" label="Tipo de licencia" required value={f.leave_type ?? ''} onChange={(e) => set({ leave_type: e.target.value })} error={errorsOf('leave_type')} hint={leave?.hint}>
                  <option value="">Elegí el tipo…</option>
                  {LEAVE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
                <Input label="¿Cuándo avisó el colaborador?" type="date" required value={f.notice_date ?? ''} onChange={(e) => set({ notice_date: e.target.value })} error={errorsOf('notice_date')} />
              </>
            ) : (
              <Input label="Período" type="number" required min={2000} value={f.period_year ?? ''} onChange={(e) => set({ period_year: Number(e.target.value) })} hint="Año al que corresponden las vacaciones." />
            )}
            <Input label={isLic ? 'Desde' : 'Primer día de vacaciones'} type="date" required value={f.start_date ?? ''} onChange={(e) => set({ start_date: e.target.value })} error={errorsOf('start_date')} />
            <Input label={isLic ? 'Hasta (según certificado o estimado)' : 'Último día de vacaciones'} type="date" required value={f.end_date ?? ''} onChange={(e) => set({ end_date: e.target.value })} error={errorsOf('end_date')} hint={g.days > 0 ? `${g.days} días corridos` : undefined} />
            <Textarea wrapClass="md:col-span-3" className="min-h-[70px]" label="Observaciones" value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })}
              placeholder={isLic ? 'Ej.: avisó por teléfono a las 7:40; entrega el certificado mañana.' : 'Ej.: las pidió el colaborador; acuerdo para tomarlas fuera de temporada.'} />
          </div>
          {isLic && <p className="mt-3 text-xs text-ink-400">No hace falta indicar el diagnóstico: es información médica reservada. Alcanza con el certificado.</p>}
          {checks.filter((c) => c.level !== 'error').length > 0 && (
            <div className="mt-4 space-y-2">
              {checks.filter((c) => c.level !== 'error').map((c, i) => <Notice key={i} tone={c.level === 'warn' ? 'warn' : 'info'}>{c.message}</Notice>)}
            </div>
          )}
        </Card>

        {!isLic && (
          <Card title="Notificación para firmar">
            {!tv ? <Notice tone="error">RH todavía no cargó el modelo de notificación de vacaciones.</Notice> : preview ? (
              <>
                <div className="doc-paper max-h-[420px] overflow-y-auto rounded-lg border border-chrome-300 bg-white p-8 text-[13px] text-ink-900">{preview}</div>
                <p className="mt-2 text-sm text-ink-500">{existing ? 'Descargala desde la ficha de la gestión para imprimirla.' : 'Al guardar vas a poder descargarla en Word o imprimirla para que el colaborador la firme.'}</p>
              </>
            ) : <Empty>Completá el colaborador y las fechas para ver la notificación.</Empty>}
          </Card>
        )}

        <Card title={isLic ? 'Certificado' : 'Notificación firmada'}>
          <p className="mb-3 text-sm text-ink-500">
            {isLic
              ? needsCert ? 'Este tipo de licencia requiere certificado o constancia. Si todavía no lo tenés, guardá el aviso igual y cargalo después.' : 'Este tipo de licencia no exige certificado; podés adjuntar una constancia si la hay.'
              : 'Cuando el colaborador firme, escaneá o sacá una foto de la notificación y subila acá. Si todavía no la firmó, guardá y subila después.'}
          </p>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-chrome-300 px-4 py-4 text-sm text-ink-500 hover:bg-chrome-100">
            <Upload size={20} /> {isLic ? 'Subir certificado (PDF o foto)' : 'Subir notificación firmada (PDF o foto)'}
            <input type="file" multiple accept=".pdf,image/*" className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files, role); e.target.value = ''; }} />
          </label>
          <ul className="mt-3 divide-y divide-chrome-200">
            {(f.attachments ?? []).map((a) => (
              <li key={a.file_id} className="flex items-center gap-3 py-2 text-sm">
                <Paperclip size={15} className="text-ink-400" /><span className="flex-1">{a.name} <span className="text-xs text-ink-400">· {fmtSize(a.size)}</span></span>
                {!(existing?.attachments ?? []).some((x) => x.file_id === a.file_id) && (
                  <button className="rounded p-1 text-ink-400 hover:text-rose-600" onClick={() => set({ attachments: (f.attachments ?? []).filter((x) => x.file_id !== a.file_id) })} aria-label="Quitar"><Trash2 size={15} /></button>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {existing && <Input label="¿Qué corregiste?" value={note} onChange={(e) => setNote(e.target.value)} hint="Queda en el historial." />}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={busy || checks.some((c) => c.level === 'error') || !f.employee_id}>
            {willSend ? 'Guardar y enviar a RH' : isLic ? 'Avisar a RH (certificado pendiente)' : 'Guardar y descargar notificación'}
          </Button>
          <Button variant="link" onClick={() => nav(-1)}>Cancelar</Button>
        </div>
      </div>
    </div>
  );
}

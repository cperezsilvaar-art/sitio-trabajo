import { Check, Paperclip, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Card, cx, Empty, fmtSize, Input, Notice, PageTitle, Select, StatusBadge, Textarea } from '../components/ui';
import { emptyRequestData, pickData } from '../lib/service';
import { useData } from '../lib/store';
import { fmtDate } from '../lib/template';
import type { FieldDef, RequestData } from '../lib/types';
import { EDITABLE } from '../lib/workflow';

const STEPS = ['Colaborador', 'El hecho', 'Antecedentes y respaldo', 'Medida y modelo', 'Revisión y envío'];
const STEP_FIELDS: string[][] = [
  ['employee_id', 'legajo', 'store_id'],
  ['incident_date', 'situation_type_id', 'description'],
  ['antecedentes', 'attachments'],
  ['measure_type_id', 'template_id', 'extra.'],
  [],
];

export function SolicitudForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { user, data, svc, run } = useData();
  const nav = useNavigate();
  const existing = id ? data.requests.find((r) => r.id === id) : undefined;
  const [form, setForm] = useState<RequestData>(() => emptyRequestData());
  const [loaded, setLoaded] = useState(!id);
  const [step, setStep] = useState(0);
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [createdId, setCreatedId] = useState<string | undefined>();

  useEffect(() => {
    if (id && existing && !loaded) {
      setForm(pickData(existing));
      setLoaded(true);
    }
  }, [id, existing, loaded]);

  // Modelo sugerido desde la biblioteca (?modelo=...)
  useEffect(() => {
    const m = params.get('modelo');
    if (!id && m && data.templates.length) {
      const t = data.templates.find((x) => x.id === m);
      if (t && t.measure_type_ids.length) {
        const mt = data.measure_types.find((x) => x.id === t.measure_type_ids[0]);
        setForm((f) => ({ ...f, template_id: t.id, template_version_id: t.current_version_id ?? '', measure_type_id: mt?.id ?? '', measure_type_name: mt?.name ?? '' }));
      }
    }
  }, [params, id, data.templates, data.measure_types]);

  const issues = useMemo(() => (svc ? svc.validate(form) : []), [svc, form, data]);
  if (!user || !svc) return null;
  if (user.role !== 'gerente') return <Notice tone="warn">Las solicitudes de medidas disciplinarias las inician los gerentes.</Notice>;
  if (id && !existing) return <Empty>Solicitud no encontrada.</Empty>;
  if (existing && !EDITABLE.includes(existing.status)) {
    return <Notice tone="warn" title="La solicitud no admite cambios">Está en estado “{existing.status}”. Sólo pueden modificarse los borradores y las solicitudes devueltas por RH.</Notice>;
  }

  const myStores = data.stores.filter((s) => user.store_ids.includes(s.id));
  const employees = data.employees.filter((e) => e.active && (!form.store_id || e.store_id === form.store_id) && user.store_ids.includes(e.store_id));
  const measures = data.measure_types.filter((m) => m.active).sort((a, b) => a.order - b.order);
  const measure = data.measure_types.find((m) => m.id === form.measure_type_id);
  const templates = data.templates.filter((t) => t.active && (!form.measure_type_id || t.measure_type_ids.includes(form.measure_type_id)) && t.measure_type_ids.length > 0);
  const tv = svc.templateVersion(form.template_version_id);
  const tpl = data.templates.find((t) => t.id === form.template_id);
  const newerVersion = tpl && tv && tpl.current_version_id && tpl.current_version_id !== tv.id;
  const fields: FieldDef[] = tv?.fields ?? [];
  const err = (f: string) => (showErrors ? issues.find((i) => i.field === f)?.message : undefined);
  const stepIssues = (s: number) => issues.filter((i) => STEP_FIELDS[s].some((p) => (p.endsWith('.') ? i.field.startsWith(p) : i.field === p)));
  const feedback = existing ? [...data.audit_events].filter((e) => e.entity_id === existing.id && e.action === 'modificaciones_solicitadas').sort((a, b) => b.at.localeCompare(a.at))[0] : undefined;
  const history = form.employee_id ? data.requests.filter((r) => r.employee_id === form.employee_id && r.id !== id && ['aprobada', 'cerrada'].includes(r.status)) : [];

  const set = (patch: Partial<RequestData>) => setForm((f) => ({ ...f, ...patch }));

  const pickEmployee = (eid: string) => {
    const e = data.employees.find((x) => x.id === eid);
    const s = data.stores.find((x) => x.id === e?.store_id);
    set({ employee_id: eid, employee_name: e?.name ?? '', legajo: e?.legajo ?? '', position: e?.position ?? '', store_id: s?.id ?? form.store_id, store_name: s?.name ?? form.store_name, area: s?.area ?? form.area });
  };
  const pickByLegajo = (legajo: string) => {
    const e = data.employees.find((x) => x.legajo === legajo.trim() && user.store_ids.includes(x.store_id));
    if (e) pickEmployee(e.id); else set({ legajo, employee_id: '', employee_name: '' });
  };
  const pickStore = (sid: string) => {
    const s = data.stores.find((x) => x.id === sid);
    set({ store_id: sid, store_name: s?.name ?? '', area: s?.area ?? '', ...(form.employee_id && data.employees.find((e) => e.id === form.employee_id)?.store_id !== sid ? { employee_id: '', employee_name: '', legajo: '', position: '' } : {}) });
  };
  const pickMeasure = (mid: string) => {
    const m = data.measure_types.find((x) => x.id === mid);
    const ts = data.templates.filter((t) => t.active && t.measure_type_ids.includes(mid));
    const t = ts.length === 1 ? ts[0] : ts.find((x) => x.id === form.template_id);
    set({ measure_type_id: mid, measure_type_name: m?.name ?? '', template_id: t?.id ?? '', template_version_id: t?.current_version_id ?? '' });
  };
  const pickTemplate = (tid: string) => {
    const t = data.templates.find((x) => x.id === tid);
    set({ template_id: tid, template_version_id: t?.current_version_id ?? '' });
  };

  const upload = async (files: FileList | null) => {
    if (!files) return;
    setBusy(true);
    setError('');
    try {
      const added = [];
      for (const f of Array.from(files)) added.push(await svc.uploadFile(f));
      set({ attachments: [...form.attachments, ...added] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const save = async (submit: boolean) => {
    setBusy(true);
    setError('');
    try {
      const known = id ?? createdId;
      const rid = await run(async (s) => {
        if (!known) return s.createDraft(form);
        await s.saveDraft(known, form);
        return known;
      });
      setCreatedId(rid);
      if (submit) await run((s) => s.submit(rid, form, note));
      nav(`/solicitudes/${rid}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setShowErrors(true);
    } finally {
      setBusy(false);
    }
  };

  const next = () => {
    if (stepIssues(step).length) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const preview = svc.renderDraft({ ...form, number: existing?.number ?? 'MD-(se asigna al guardar)', manager_name: user.name });

  return (
    <div className="mx-auto max-w-5xl">
      <PageTitle sub="Completá cada paso. El borrador se genera con el modelo vigente de RH y no tiene validez hasta su aprobación.">
        {existing ? <>Solicitud {existing.number} <StatusBadge status={existing.status} /></> : 'Solicitar medida disciplinaria'}
      </PageTitle>

      {feedback && existing?.status === 'requiere_modificaciones' && (
        <div className="mb-5"><Notice tone="warn" title={`Devolución de ${feedback.actor_name} (${fmtDate(feedback.at)})`}>{feedback.comment}</Notice></div>
      )}

      <ol className="mb-6 grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => {
          const done = i < step && stepIssues(i).length === 0;
          return (
            <li key={s}>
              <button onClick={() => setStep(i)} className={cx('w-full border-t-4 pt-2 text-left text-sm', i === step ? 'border-brand-500 font-bold text-ink-900' : done ? 'border-emerald-500 text-ink-700' : 'border-chrome-300 text-ink-500')}>
                <span className="mr-1 inline-flex items-center">{done ? <Check size={14} className="text-emerald-600" /> : `${i + 1}.`}</span>{s}
              </button>
            </li>
          );
        })}
      </ol>

      <Card bodyClass="pt-6">
        {step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            <Select label="Tienda" required value={form.store_id} onChange={(e) => pickStore(e.target.value)} error={err('store_id')}>
              <option value="">Elegí la tienda…</option>
              {myStores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Input label="Legajo" required value={form.legajo} onChange={(e) => pickByLegajo(e.target.value)} error={err('legajo')} hint="Escribí el legajo o elegí al colaborador de la lista." />
            <Select label="Colaborador" required value={form.employee_id} onChange={(e) => pickEmployee(e.target.value)} error={err('employee_id')} wrapClass="md:col-span-2">
              <option value="">Elegí al colaborador…</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.name} — legajo {e.legajo} — {e.position}</option>)}
            </Select>
            {form.employee_id && (
              <div className="rounded-lg bg-chrome-100 p-4 text-sm md:col-span-2">
                <b>{form.employee_name}</b> · Legajo {form.legajo} · {form.position} · {form.store_name} ({form.area})
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Fecha del incidente" type="date" required max={new Date().toISOString().slice(0, 10)} value={form.incident_date} onChange={(e) => set({ incident_date: e.target.value })} error={err('incident_date')} hint="Pedí la medida dentro de las 48 h hábiles: la demora puede invalidarla." />
            <Select label="Tipo de situación" required value={form.situation_type_id} onChange={(e) => set({ situation_type_id: e.target.value, situation_type_name: data.situation_types.find((s) => s.id === e.target.value)?.name ?? '' })} error={err('situation_type_id')}>
              <option value="">Elegí el tipo de situación…</option>
              {data.situation_types.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Textarea wrapClass="md:col-span-2" className="min-h-[200px]" label="Descripción detallada de los hechos" required value={form.description}
              onChange={(e) => set({ description: e.target.value })} error={err('description')}
              hint={`${form.description.trim().length} caracteres (mínimo 80). Contá qué pasó, cuándo, dónde, quiénes lo presenciaron y qué impacto tuvo. Sin opiniones ni adjetivos.`}
              placeholder="Ej.: El día 10/11, a las 9:15 h, al realizar el arqueo de la caja 2…" />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <Textarea label="Antecedentes relevantes" required={measure?.requires_antecedentes} value={form.antecedentes} onChange={(e) => set({ antecedentes: e.target.value })} error={err('antecedentes')}
              hint={'Medidas anteriores, conversaciones previas, llamados de atención verbales. Si no hay, escribí "Sin antecedentes".'} />
            {history.length > 0 && (
              <Notice tone="info" title="Medidas aprobadas anteriormente para este colaborador">
                {history.map((h) => `${h.number} · ${h.measure_type_name} · ${fmtDate(h.incident_date)}`).join('\n')}
              </Notice>
            )}
            <div>
              <div className="mb-2 text-sm font-semibold text-ink-700">Documentación respaldatoria{measure?.requires_attachment && <span className="text-rose-600"> *</span>}</div>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-chrome-300 px-4 py-6 text-sm text-ink-500 hover:bg-chrome-100">
                <Upload size={22} />
                Arrastrá o elegí archivos: actas, planillas, capturas, declaraciones (máx. 10 MB c/u)
                <input type="file" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} disabled={busy} />
              </label>
              {err('attachments') && <div className="mt-1 text-xs font-medium text-rose-600">{err('attachments')}</div>}
              <ul className="mt-3 divide-y divide-chrome-200">
                {form.attachments.map((a) => (
                  <li key={a.file_id} className="flex items-center gap-3 py-2 text-sm">
                    <Paperclip size={15} className="text-ink-400" /><span className="flex-1 text-ink-700">{a.name}</span><span className="text-ink-400">{fmtSize(a.size)}</span>
                    <button className="rounded p-1 text-ink-400 hover:bg-chrome-100 hover:text-rose-600" onClick={() => set({ attachments: form.attachments.filter((x) => x.file_id !== a.file_id) })} aria-label="Quitar"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-sm font-semibold text-ink-700">Tipo de medida que se solicita <span className="text-rose-600">*</span></div>
              <div className="grid gap-3 md:grid-cols-2">
                {measures.map((m) => (
                  <button key={m.id} onClick={() => pickMeasure(m.id)} className={cx('rounded-lg border-2 p-4 text-left', form.measure_type_id === m.id ? 'border-brand-500 bg-brand-50' : 'border-chrome-300 hover:bg-chrome-100')}>
                    <div className="font-bold text-ink-900">{m.name}</div>
                    <div className="mt-1 text-sm text-ink-500">{m.description}</div>
                    <div className="mt-2 text-xs text-ink-400">{[m.requires_antecedentes && 'Pide antecedentes', m.requires_attachment && 'Pide respaldo documental'].filter(Boolean).join(' · ')}</div>
                  </button>
                ))}
              </div>
              {err('measure_type_id') && <div className="mt-1 text-xs font-medium text-rose-600">{err('measure_type_id')}</div>}
              <p className="mt-2 text-xs text-ink-400">La medida final la define RH: puede aprobarla, rechazarla o pedir que se cambie.</p>
            </div>
            <Select label="Modelo de documento" required value={form.template_id} onChange={(e) => pickTemplate(e.target.value)} error={err('template_id')} disabled={!form.measure_type_id}>
              <option value="">{form.measure_type_id ? 'Elegí el modelo…' : 'Primero elegí el tipo de medida'}</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.title} (v{data.template_versions.find((v) => v.id === t.current_version_id)?.version ?? '?'})</option>)}
            </Select>
            {newerVersion && (
              <Notice tone="warn" title="Hay una versión más nueva del modelo">
                Esta solicitud usa la versión {tv?.version}. <Button variant="link" onClick={() => pickTemplate(form.template_id)}>Usar la versión vigente</Button>
              </Notice>
            )}
            {fields.length > 0 && (
              <div className="grid gap-4 rounded-lg bg-chrome-100 p-4 md:grid-cols-2">
                <div className="text-sm font-bold text-ink-900 md:col-span-2">Datos que pide el modelo</div>
                {fields.map((f) => <ExtraField key={f.key} f={f} value={form.extra[f.key] ?? ''} error={err(`extra.${f.key}`)} onChange={(v) => set({ extra: { ...form.extra, [f.key]: v } })} />)}
              </div>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            {issues.length > 0 ? (
              <Notice tone="error" title="Antes de enviar falta completar:">{issues.map((i) => `• ${i.message}`).join('\n')}</Notice>
            ) : (
              <Notice tone="ok" title="La solicitud está completa">Revisá el borrador. Al enviarla, se asigna a tu coordinador/a de RH del {form.area} y ya no podrás modificarla salvo que te la devuelvan.</Notice>
            )}
            {existing?.status === 'requiere_modificaciones' && (
              <Input label="¿Qué corregiste?" value={note} onChange={(e) => setNote(e.target.value)} hint="Queda registrado en el historial de versiones." />
            )}
            <div>
              <div className="mb-2 text-sm font-semibold text-ink-700">Borrador generado {tv && <span className="font-normal text-ink-400">· modelo “{tpl?.title}” v{tv.version}</span>}</div>
              {tv ? (
                <div className="watermark doc-paper max-h-[560px] overflow-y-auto rounded-lg border border-chrome-300 bg-white p-8 text-[13px] text-ink-900 shadow-inner">{preview}</div>
              ) : <Empty>Elegí un modelo para ver el borrador.</Empty>}
              <p className="mt-2 text-xs text-ink-400">{data.policy.draft_disclaimer}</p>
            </div>
          </div>
        )}

        {error && <div className="mt-5"><Notice tone="error">{error}</Notice></div>}

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-chrome-200 pt-5">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Anterior</Button>}
          <Button variant="link" onClick={() => save(false)} disabled={busy || !form.store_id}>Guardar borrador</Button>
          <div className="ml-auto">
            {step < STEPS.length - 1
              ? <Button onClick={next}>Siguiente</Button>
              : <Button onClick={() => save(true)} disabled={busy || issues.length > 0}>{existing?.status === 'requiere_modificaciones' ? 'Reenviar a RH' : 'Enviar a RH'}</Button>}
          </div>
        </div>
      </Card>
    </div>
  );
}

function ExtraField({ f, value, error, onChange }: { f: FieldDef; value: string; error?: string; onChange: (v: string) => void }) {
  if (f.type === 'textarea') return <Textarea wrapClass="md:col-span-2" label={f.label} required={f.required} hint={f.help} error={error} value={value} onChange={(e) => onChange(e.target.value)} />;
  if (f.type === 'select') {
    return (
      <Select label={f.label} required={f.required} hint={f.help} error={error} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Elegí…</option>
        {(f.options ?? []).map((o) => <option key={o}>{o}</option>)}
      </Select>
    );
  }
  return <Input label={f.label} required={f.required} hint={f.help} error={error} type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} />;
}

import { ArrowDown, ArrowUp, FileDown, Plus, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Checkbox, cx, DocThumb, Empty, Input, Modal, Notice, PageTitle, Pill, Select, shortDate, Td, Textarea, Th } from '../components/ui';
import { downloadStored } from '../lib/documents';
import { useData } from '../lib/store';
import { docxPlaceholders, fmtDateTime, render, STANDARD_FIELDS, unknownPlaceholders, bytesToBase64 } from '../lib/template';
import { CATEGORY_LABEL, type FieldDef, type FieldType, type TemplateCategory, type TemplateVersion } from '../lib/types';

export function AdminModelos() {
  const { data } = useData();
  const nav = useNavigate();
  const rows = [...data.templates].sort((a, b) => Number(b.active) - Number(a.active) || a.title.localeCompare(b.title));
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageTitle sub="Cargá, editá y versioná los modelos sin modificar el código. Cada cambio publica una versión nueva; las anteriores quedan en el historial." actions={<Button onClick={() => nav('/admin/modelos/nuevo')}><Plus size={16} /> Cargar modelo</Button>}>
        Modelos y versiones
      </PageTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="border-b border-chrome-200"><tr><Th className="w-14" /><Th>Modelo</Th><Th>Sección</Th><Th>Tipos de solicitud</Th><Th>Versión</Th><Th>Actualizado</Th><Th>Estado</Th></tr></thead>
          <tbody>
            {rows.map((t) => {
              const v = data.template_versions.find((x) => x.id === t.current_version_id);
              const n = data.template_versions.filter((x) => x.template_id === t.id).length;
              return (
                <tr key={t.id} className={cx('cursor-pointer border-b border-chrome-200 hover:bg-chrome-100', !t.active && 'opacity-60')} onClick={() => nav(`/admin/modelos/${t.id}`)}>
                  <Td><DocThumb small /></Td>
                  <Td><div className="text-ink-700">{t.title}</div><div className="text-xs">{v?.file_name ?? 'Sólo texto'} · {v?.fields.length ?? 0} campo(s) adicionales</div></Td>
                  <Td>{CATEGORY_LABEL[t.category].split(' ')[0]}</Td>
                  <Td className="text-sm">{t.measure_type_ids.map((id) => data.measure_types.find((m) => m.id === id)?.name).filter(Boolean).join(', ') || <span className="text-ink-400">Consulta</span>}</Td>
                  <Td>v{v?.version} <span className="text-xs text-ink-400">({n} en total)</span></Td>
                  <Td>{shortDate(t.updated_at)}</Td>
                  <Td>{t.active ? <Pill tone="green">Activo</Pill> : <Pill tone="gray">Inactivo</Pill>}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const FIELD_TYPES: Record<FieldType, string> = { text: 'Texto corto', textarea: 'Texto largo', date: 'Fecha', number: 'Número', select: 'Lista de opciones' };

export function ModeloEditor() {
  const { id } = useParams();
  const isNew = id === 'nuevo';
  const { user, data, run } = useData();
  const nav = useNavigate();
  const t = data.templates.find((x) => x.id === id);
  const versions = useMemo(() => data.template_versions.filter((v) => v.template_id === id).sort((a, b) => b.version - a.version), [data.template_versions, id]);
  const current = versions.find((v) => v.id === t?.current_version_id);

  const [meta, setMeta] = useState({ title: '', category: 'sancion' as TemplateCategory, description: '', measure_type_ids: [] as string[] });
  const [body, setBody] = useState('');
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileWarn, setFileWarn] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<TemplateVersion | null>(null);
  const [init, setInit] = useState(false);

  useEffect(() => {
    if (init) return;
    if (isNew) { setInit(true); return; }
    if (t) {
      setMeta({ title: t.title, category: t.category, description: t.description, measure_type_ids: t.measure_type_ids });
      setBody(current?.body ?? '');
      setFields(current?.fields ?? []);
      setInit(true);
    }
  }, [t, current, isNew, init]);

  if (user?.role !== 'admin_rh') return <Notice tone="warn">Sección exclusiva de administradores de RH.</Notice>;
  if (!isNew && !t) return <Empty>Modelo no encontrado.</Empty>;

  const unknown = unknownPlaceholders(body, fields);
  const contentChanged = isNew || body !== (current?.body ?? '') || JSON.stringify(fields) !== JSON.stringify(current?.fields ?? []) || !!file;
  const metaChanged = !isNew && t && (meta.title !== t.title || meta.category !== t.category || meta.description !== t.description || JSON.stringify(meta.measure_type_ids) !== JSON.stringify(t.measure_type_ids));
  const sample = Object.fromEntries([
    ...STANDARD_FIELDS.map((f) => [f.key, `«${f.label}»`]),
    ...fields.map((f) => [f.key, `«${f.label}»`]),
  ]);

  const pickFile = async (f: File | null) => {
    setFile(f);
    setFileWarn('');
    if (f && f.name.toLowerCase().endsWith('.docx')) {
      try {
        const ph = await docxPlaceholders(bytesToBase64(new Uint8Array(await f.arrayBuffer())));
        const unk = ph.filter((k) => !STANDARD_FIELDS.some((s) => s.key === k) && !fields.some((x) => x.key === k));
        setFileWarn(ph.length === 0
          ? 'El Word no tiene marcadores {{campo}}: se entregará tal cual, sin completar datos.'
          : unk.length ? `El Word usa marcadores que no existen: ${unk.join(', ')}. Agregalos como campos o corregí el archivo.` : `Marcadores detectados en el Word: ${ph.join(', ')}.`);
      } catch {
        setFileWarn('No se pudo leer el Word. Verificá que sea un .docx válido.');
      }
    }
  };

  const save = async () => {
    setBusy(true); setError(''); setOk('');
    try {
      if (!meta.title.trim()) throw new Error('Falta el nombre del modelo.');
      if (!body.trim()) throw new Error('Falta el texto del modelo.');
      if (unknown.length) throw new Error(`El texto usa marcadores que no existen: ${unknown.join(', ')}.`);
      const keys = fields.map((f) => f.key);
      if (keys.some((k) => !/^[a-z][a-z0-9_]*$/.test(k))) throw new Error('Los identificadores de campo sólo admiten minúsculas, números y guión bajo, y deben empezar con una letra.');
      if (new Set(keys).size !== keys.length) throw new Error('Hay campos con el mismo identificador.');
      if (keys.some((k) => STANDARD_FIELDS.some((s) => s.key === k))) throw new Error('Un campo adicional usa el identificador de un campo estándar.');
      if (fields.some((f) => !f.label.trim())) throw new Error('Todos los campos necesitan un nombre visible.');
      if (fields.some((f) => f.type === 'select' && !(f.options ?? []).length)) throw new Error('Los campos de lista necesitan opciones.');
      if (isNew) {
        const nid = await run((s) => s.createTemplate(meta, { body, fields, change_notes: notes }, file ?? undefined));
        nav(`/admin/modelos/${nid}`, { replace: true });
        return;
      }
      if (metaChanged) await run((s) => s.updateTemplateMeta(t!.id, meta));
      if (contentChanged) {
        if (!notes.trim()) throw new Error('Describí qué cambia en esta versión (queda en el historial).');
        await run((s) => s.newVersion(t!.id, { body, fields, change_notes: notes }, file ?? undefined, meta.title));
      }
      setNotes(''); setFile(null); setFileWarn('');
      setOk(contentChanged ? 'Se publicó una nueva versión vigente. Las solicitudes ya enviadas conservan la versión con la que se generaron.' : 'Cambios guardados.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const setField = (i: number, patch: Partial<FieldDef>) => setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: number) => setFields((fs) => { const c = [...fs]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c; });

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-1 text-sm"><Link to="/admin/modelos" className="text-brand-500 hover:underline">← Modelos</Link></div>
      <PageTitle sub={isNew ? 'Definí el texto con marcadores {{campo}}, los datos que debe completar el gerente y opcionalmente el Word original.' : `Versión vigente: v${current?.version} · ${versions.length} versión(es)`}
        actions={!isNew && t && (
          <Button variant={t.active ? 'outline' : 'success'} onClick={() => run((s) => s.updateTemplateMeta(t.id, { active: !t.active }))}>{t.active ? 'Desactivar modelo' : 'Activar modelo'}</Button>
        )}>
        {isNew ? 'Cargar modelo' : meta.title || 'Modelo'} {t && !t.active && <Pill tone="gray">Inactivo</Pill>}
      </PageTitle>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card title="Datos generales">
            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Nombre" required value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
              <Select label="Sección de la biblioteca" value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value as TemplateCategory })}>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <Textarea wrapClass="md:col-span-2" className="min-h-[60px]" label="Descripción" value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} />
              <div className="md:col-span-2">
                <div className="mb-2 text-sm font-semibold text-ink-700">Tipos de solicitud que usan este modelo</div>
                <div className="flex flex-wrap gap-4">
                  {data.measure_types.map((m) => (
                    <Checkbox key={m.id} label={<>{m.name}{!m.active && <span className="text-ink-400"> (inactivo)</span>}</>} checked={meta.measure_type_ids.includes(m.id)}
                      onChange={(v) => setMeta({ ...meta, measure_type_ids: v ? [...meta.measure_type_ids, m.id] : meta.measure_type_ids.filter((x) => x !== m.id) })} />
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-400">Sin tipos marcados, el documento es sólo de consulta en la biblioteca.</p>
              </div>
            </div>
          </Card>

          <Card title="Texto del modelo">
            <Textarea className="min-h-[380px] font-mono text-[13px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribí o pegá el texto. Usá {{colaborador}}, {{legajo}}, etc." />
            {unknown.length > 0 && <div className="mt-2"><Notice tone="error">Marcadores desconocidos: {unknown.map((k) => `{{${k}}}`).join(', ')}. Agregalos como campos adicionales o corregilos.</Notice></div>}
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold uppercase text-ink-500">Insertar campo</div>
              <div className="flex flex-wrap gap-1.5">
                {[...STANDARD_FIELDS, ...fields.map((f) => ({ key: f.key, label: f.label }))].map((f) => (
                  <button key={f.key} title={f.label} onClick={() => setBody((b) => `${b}{{${f.key}}}`)} className="rounded border border-chrome-300 bg-chrome-100 px-2 py-0.5 font-mono text-xs hover:bg-chrome-200">{`{{${f.key}}}`}</button>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Campos que debe completar el gerente" actions={<Button size="sm" variant="outline" onClick={() => setFields([...fields, { key: `campo_${fields.length + 1}`, label: '', type: 'text', required: true }])}><Plus size={14} /> Agregar campo</Button>}>
            <p className="mb-3 text-sm text-ink-500">Además de los datos comunes (colaborador, legajo, tienda, fecha, hechos, antecedentes), el formulario pedirá estos campos al elegir este modelo.</p>
            {fields.length === 0 ? <p className="text-sm text-ink-400">Sin campos adicionales.</p> : (
              <div className="space-y-3">
                {fields.map((f, i) => (
                  <div key={i} className="grid gap-3 rounded-lg border border-chrome-300 p-3 md:grid-cols-[1fr_1fr_160px_auto]">
                    <Input label="Nombre visible" value={f.label} onChange={(e) => setField(i, { label: e.target.value })} />
                    <Input label="Identificador (marcador)" value={f.key} onChange={(e) => setField(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })} hint={`Se usa como {{${f.key}}}`} />
                    <Select label="Tipo" value={f.type} onChange={(e) => setField(i, { type: e.target.value as FieldType })}>
                      {Object.entries(FIELD_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Select>
                    <div className="flex items-end gap-1 pb-1">
                      <button className="rounded p-1.5 hover:bg-chrome-100 disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={15} /></button>
                      <button className="rounded p-1.5 hover:bg-chrome-100 disabled:opacity-30" disabled={i === fields.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><ArrowDown size={15} /></button>
                      <button className="rounded p-1.5 text-rose-600 hover:bg-rose-50" onClick={() => setFields(fields.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 size={15} /></button>
                    </div>
                    {f.type === 'select' && <Input wrapClass="md:col-span-2" label="Opciones (separadas por coma)" value={(f.options ?? []).join(', ')} onChange={(e) => setField(i, { options: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />}
                    <Input wrapClass={f.type === 'select' ? '' : 'md:col-span-2'} label="Ayuda para el gerente" value={f.help ?? ''} onChange={(e) => setField(i, { help: e.target.value })} />
                    <div className="flex items-end pb-2"><Checkbox label="Obligatorio" checked={f.required} onChange={(v) => setField(i, { required: v })} /></div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Archivo original (opcional)">
            <p className="mb-3 text-sm text-ink-500">
              Subí el modelo en <b>Word (.docx)</b> con los mismos marcadores <code>{'{{campo}}'}</code>: el sistema lo completa respetando el formato, logos y tipografía. También se aceptan PDF u otros archivos para documentos de consulta.
            </p>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-chrome-300 px-4 py-4 text-sm text-ink-500 hover:bg-chrome-100">
              <Upload size={20} /> {file ? file.name : current?.file_name ? `Reemplazar “${current.file_name}”` : 'Elegir archivo'}
              <input type="file" className="hidden" accept=".docx,.pdf,.doc,.odt,.xlsx" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            </label>
            {fileWarn && <div className="mt-2"><Notice tone={fileWarn.startsWith('Marcadores') ? 'ok' : 'warn'}>{fileWarn}</Notice></div>}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title={isNew ? 'Publicar' : 'Guardar cambios'}>
            {contentChanged && !isNew && <Notice tone="info">Cambiaste el contenido: se publicará la <b>versión {(current?.version ?? 0) + 1}</b>. La actual queda en el historial.</Notice>}
            {(contentChanged || isNew) && <Textarea wrapClass="mt-3" className="min-h-[70px]" label="Qué cambia en esta versión" required={!isNew} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej.: se actualiza la cita legal según criterio de Legales." />}
            {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
            {ok && <div className="mt-3"><Notice tone="ok">{ok}</Notice></div>}
            <Button className="mt-4 w-full" disabled={busy || (!isNew && !contentChanged && !metaChanged)} onClick={save}>{isNew ? 'Publicar modelo' : contentChanged ? 'Publicar nueva versión' : 'Guardar'}</Button>
          </Card>

          <Card title="Vista previa">
            <div className="doc-paper max-h-[420px] overflow-y-auto rounded border border-chrome-300 p-4 text-[11px] text-ink-900">{render(body, sample) || 'Sin texto.'}</div>
          </Card>

          {!isNew && (
            <Card title="Historial de versiones">
              <ul className="divide-y divide-chrome-200">
                {versions.map((v) => (
                  <li key={v.id} className="py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <b>v{v.version}</b> {v.id === t?.current_version_id && <Pill tone="green">Vigente</Pill>}
                      <span className="ml-auto text-xs text-ink-400">{fmtDateTime(v.created_at)}</span>
                    </div>
                    <div className="text-ink-500">{v.change_notes}</div>
                    <div className="text-xs text-ink-400">{v.created_by_name} · {v.fields.length} campo(s) · {v.file_name ?? 'sin archivo'}</div>
                    <div className="mt-1 flex gap-3">
                      <Button variant="link" onClick={() => setView(v)}>Ver</Button>
                      {v.file_id && <FileLink fileId={v.file_id} />}
                      {v.id !== t?.current_version_id && <Button variant="link" onClick={() => run((s) => s.restoreVersion(t!.id, v.id)).then(() => setInit(false))}>Restaurar como vigente</Button>}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      {view && (
        <Modal wide title={`${meta.title} · versión ${view.version}`} onClose={() => setView(null)}>
          <div className="mb-2 text-sm text-ink-500">{view.change_notes} · {view.created_by_name} · {fmtDateTime(view.created_at)}</div>
          <div className="doc-paper rounded border border-chrome-300 p-6 text-[13px]">{view.body}</div>
          {view.fields.length > 0 && <div className="mt-3 text-sm"><b>Campos:</b> {view.fields.map((f) => `${f.label} (${f.key}${f.required ? ', obligatorio' : ''})`).join(' · ')}</div>}
        </Modal>
      )}
    </div>
  );
}

function FileLink({ fileId }: { fileId: string }) {
  const { svc } = useData();
  return <Button variant="link" onClick={async () => { const f = await svc?.getFile(fileId); if (f) downloadStored(f); }}><FileDown size={14} /> Archivo</Button>;
}

import { Download, FileDown, Lock, MessageSquare, Paperclip, Printer, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, cx, Empty, fmtSize, Input, Modal, Notice, Pill, StatusBadge, Textarea } from '../components/ui';
import { downloadDraftDocx, downloadFinal, downloadStored, printDocument } from '../lib/documents';
import { useData } from '../lib/store';
import { fmtDate, fmtDateTime } from '../lib/template';
import { ROLE_LABEL, STATUS_LABEL, type AuditEvent, type DisciplinaryRequest, type RequestData, type RequestRevision, type RequestStatus } from '../lib/types';
import { can, denyReason, isOverdue } from '../lib/workflow';

const FLOW: RequestStatus[] = ['borrador', 'enviada', 'pendiente_revision', 'aprobada', 'cerrada'];

const ACTION_LABEL: Record<string, string> = {
  creada: 'Borrador creado', guardada: 'Borrador guardado', enviada: 'Enviada a RH', reenviada: 'Reenviada a RH', asignada: 'Asignada',
  tomada: 'Revisión iniciada', modificaciones_solicitadas: 'Modificaciones solicitadas', aprobada: 'Aprobada', rechazada: 'Rechazada',
  cerrada: 'Caso cerrado', notificada: 'Notificación al colaborador', rectificacion_iniciada: 'Rectificación iniciada',
  observacion_interna: 'Observación interna de RH', comentario: 'Comentario', documento_descargado: 'Documento descargado',
};

export function SolicitudDetalle() {
  const { id } = useParams();
  const { user, data, svc, run } = useData();
  const nav = useNavigate();
  const [tab, setTab] = useState<'resumen' | 'documento' | 'versiones' | 'historial'>('resumen');
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | 'aprobar' | 'rechazar' | 'pedir_modificaciones'>(null);
  const [modal, setModal] = useState<null | 'notificar' | 'rectificar' | 'cerrar'>(null);
  const [modalText, setModalText] = useState('');
  const [modalDate, setModalDate] = useState(new Date().toISOString().slice(0, 10));

  const r = data.requests.find((x) => x.id === id);
  if (!user || !svc) return null;
  if (!r) return <Empty>Solicitud no encontrada o sin acceso.</Empty>;

  const policy = data.policy;
  const revisions = data.request_revisions.filter((x) => x.request_id === r.id).sort((a, b) => b.revision - a.revision);
  const events = data.audit_events.filter((e) => e.entity === 'request' && e.entity_id === r.id).sort((a, b) => b.at.localeCompare(a.at));
  const finals = data.final_documents.filter((d) => d.request_id === r.id).sort((a, b) => b.approved_at.localeCompare(a.approved_at));
  const finalDoc = finals.find((d) => d.id === r.final_document_id);
  const tv = svc.templateVersion(r.template_version_id);
  const tpl = data.templates.find((t) => t.id === r.template_id);
  const isRH = user.role !== 'gerente';
  const prior = data.requests.filter((x) => x.employee_id === r.employee_id && x.id !== r.id && x.status !== 'borrador');
  const lastFeedback = events.find((e) => e.action === 'modificaciones_solicitadas' || e.action === 'rechazada');

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const decide = async () => {
    if (!confirm) return;
    if (await act(() => run((s) => s.decide(r.id, confirm, comment)))) {
      setComment('');
      setConfirm(null);
      setTab(confirm === 'aprobar' ? 'documento' : 'historial');
    } else setConfirm(null);
  };

  const flowIndex = FLOW.indexOf(r.status === 'requiere_modificaciones' ? 'pendiente_revision' : r.status === 'rechazada' ? 'aprobada' : r.status);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-1 text-sm"><Link to={isRH ? '/aprobaciones' : '/solicitudes'} className="text-brand-500 hover:underline">← {isRH ? 'Solicitudes pendientes' : 'Mis solicitudes'}</Link></div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-ink-900">
            {r.measure_type_name || 'Medida'} · {r.employee_name || 'Colaborador'} <StatusBadge status={r.status} />
            {isOverdue(r, policy) && <Pill tone="red">Fuera de plazo</Pill>}
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            <span className="font-mono">{r.number}</span> · Legajo {r.legajo} · {r.store_name} · {r.area} · Gerente: {r.manager_name}
            {r.coordinator_name && <> · RH: {r.coordinator_name}</>} · Versión {r.revision || '—'}
          </p>
        </div>
        {can('editar', user, r, policy) && <Button onClick={() => nav(`/solicitudes/${r.id}/editar`)}>{r.status === 'requiere_modificaciones' ? 'Corregir y reenviar' : 'Continuar borrador'}</Button>}
      </div>

      {/* Avance del circuito */}
      <ol className="mb-6 grid grid-cols-5 gap-2 text-sm">
        {FLOW.map((s, i) => {
          let label = STATUS_LABEL[s];
          if (s === 'aprobada' && r.status === 'rechazada') label = 'Rechazada';
          if (s === 'pendiente_revision' && r.status === 'requiere_modificaciones') label = 'Requiere modificaciones';
          const bad = (s === 'aprobada' && r.status === 'rechazada') || (s === 'pendiente_revision' && r.status === 'requiere_modificaciones');
          return (
            <li key={s} className={cx('border-t-4 pt-2', i < flowIndex ? 'border-emerald-500 text-ink-700' : i === flowIndex ? (bad ? 'border-orange-500 font-bold text-ink-900' : 'border-brand-500 font-bold text-ink-900') : 'border-chrome-300 text-ink-400')}>{label}</li>
          );
        })}
      </ol>

      {r.status === 'aprobada' || r.status === 'cerrada' ? (
        <div className="mb-5"><Notice tone="ok" title={`Aprobada por ${r.approved_by_name} el ${fmtDateTime(r.approved_at)} · versión ${r.approved_revision}`}>
          {finalDoc && <>Huella del documento definitivo (SHA-256): <span className="font-mono text-xs">{finalDoc.sha256}</span>{'\n'}</>}
          {r.notified_at ? `Notificada al colaborador el ${fmtDate(r.notified_at)}.` : 'Pendiente de notificación al colaborador.'}
        </Notice></div>
      ) : r.status !== 'rechazada' ? (
        <div className="mb-5"><Notice tone="warn" title="Sin aprobación de RH">Esta solicitud no es una sanción autorizada. El documento es un BORRADOR y no puede entregarse ni comunicarse al colaborador.</Notice></div>
      ) : null}
      {lastFeedback && (r.status === 'requiere_modificaciones' || r.status === 'rechazada') && (
        <div className="mb-5"><Notice tone={r.status === 'rechazada' ? 'error' : 'warn'} title={`${ACTION_LABEL[lastFeedback.action]} por ${lastFeedback.actor_name} · ${fmtDateTime(lastFeedback.at)}`}>{lastFeedback.comment}</Notice></div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div className="mb-4 flex gap-1 border-b border-chrome-200">
            {(['resumen', 'documento', 'versiones', 'historial'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cx('-mb-px border-b-2 px-4 py-2 text-[15px] capitalize', tab === t ? 'border-ink-900 font-bold text-ink-900' : 'border-transparent text-ink-500 hover:text-ink-900')}>
                {t === 'versiones' ? `Versiones (${revisions.length})` : t === 'historial' ? `Historial (${events.length})` : t}
              </button>
            ))}
          </div>

          {tab === 'resumen' && <Resumen r={r} data={r} fieldsLabel={(k) => tv?.fields.find((f) => f.key === k)?.label ?? k} prior={isRH ? prior : []} />}

          {tab === 'documento' && (
            <div className="space-y-4">
              {finalDoc ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><ShieldCheck size={17} /> Documento definitivo · versión {finalDoc.revision}</span>
                    <div className="ml-auto flex gap-2">
                      {finalDoc.docx_file_id && <Button size="sm" onClick={() => downloadFinal(svc, r, finalDoc, 'docx').then(() => run(async () => {}))}><FileDown size={15} /> Word</Button>}
                      <Button size="sm" variant="outline" onClick={() => downloadFinal(svc, r, finalDoc, 'print').then(() => run(async () => {}))}><Printer size={15} /> Imprimir / PDF</Button>
                    </div>
                  </div>
                  <div className="doc-paper rounded-lg border border-chrome-300 bg-white p-10 text-[13px] text-ink-900 shadow-sm">{finalDoc.content}</div>
                  <p className="flex items-center gap-1.5 text-xs text-ink-400"><Lock size={13} /> Bloqueado: generado al aprobar, no admite cambios. Cualquier cambio requiere una rectificación y una nueva aprobación.</p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold text-rose-700">BORRADOR {tpl && <span className="font-normal text-ink-400">· modelo “{tpl.title}” v{tv?.version}</span>}</span>
                    <div className="ml-auto flex gap-2">
                      {tv?.file_id && <Button size="sm" variant="outline" onClick={() => act(async () => { if (!(await downloadDraftDocx(svc, r, tv))) throw new Error('El modelo no tiene un Word asociado.'); })}><FileDown size={15} /> Borrador en Word</Button>}
                      <Button size="sm" variant="outline" onClick={() => printDocument({ title: `${r.number} BORRADOR`, content: svc.renderDraft(r), draft: true, footer: policy.draft_disclaimer })}><Printer size={15} /> Imprimir borrador</Button>
                    </div>
                  </div>
                  {tv ? <div className="watermark doc-paper rounded-lg border border-chrome-300 bg-white p-10 text-[13px] text-ink-900">{svc.renderDraft(r)}</div> : <Empty>Todavía no se eligió un modelo.</Empty>}
                </>
              )}
              {finals.filter((d) => d.id !== r.final_document_id).length > 0 && (
                <Card title="Versiones definitivas sin efecto">
                  <ul className="space-y-2 text-sm">
                    {finals.filter((d) => d.id !== r.final_document_id).map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2">
                        <span>Versión {d.revision} · aprobada por {d.approved_by_name} el {fmtDateTime(d.approved_at)} · <span className="text-rose-700">reemplazada por rectificación</span></span>
                        <Button size="sm" variant="ghost" onClick={() => printDocument({ title: `${r.number} v${d.revision} SIN EFECTO`, content: d.content, draft: true, footer: `SIN EFECTO – reemplazada por rectificación. SHA-256 ${d.sha256}` })}><Printer size={14} /></Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {tab === 'versiones' && <Versiones revisions={revisions} approved={r.approved_revision} />}

          {tab === 'historial' && <Historial events={events} />}
        </div>

        {/* Panel de acciones */}
        <aside className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}

          {isRH && (r.status === 'enviada' || r.status === 'pendiente_revision') && (
            <Card title="Decisión de RH">
              {r.status === 'enviada' && can('tomar', user, r, policy) && (
                <Button variant="outline" className="mb-4 w-full" disabled={busy} onClick={() => act(() => run((s) => s.take(r.id)))}>Tomar la solicitud para revisión</Button>
              )}
              {denyReason('aprobar', user, r, policy) ? (
                <Notice tone="warn">{denyReason('aprobar', user, r, policy)}</Notice>
              ) : (
                <>
                  <Textarea label="Devolución para el gerente" value={comment} onChange={(e) => setComment(e.target.value)}
                    hint="Obligatoria para rechazar o pedir modificaciones. El gerente la ve." placeholder="Ej.: falta el acta de arqueo firmada…" />
                  <div className="mt-4 grid gap-2">
                    <Button variant="success" disabled={busy} onClick={() => setConfirm('aprobar')}>Aprobar versión {r.revision}</Button>
                    <Button variant="outline" disabled={busy} onClick={() => setConfirm('pedir_modificaciones')}>Solicitar modificaciones</Button>
                    <Button variant="danger" disabled={busy} onClick={() => setConfirm('rechazar')}>Rechazar</Button>
                  </div>
                </>
              )}
            </Card>
          )}

          {(can('registrar_notificacion', user, r, policy) || can('cerrar', user, r, policy) || can('rectificar', user, r, policy)) && (
            <Card title="Cierre del caso">
              <div className="grid gap-2">
                {can('registrar_notificacion', user, r, policy) && <Button onClick={() => { setModal('notificar'); setModalText(''); }}>Registrar notificación al colaborador</Button>}
                {can('cerrar', user, r, policy) && <Button variant="outline" onClick={() => { setModal('cerrar'); setModalText(''); }}>Cerrar caso</Button>}
                {can('rectificar', user, r, policy) && <Button variant="link" onClick={() => { setModal('rectificar'); setModalText(''); }}>Rectificar (requiere nueva aprobación)</Button>}
              </div>
              {r.status === 'aprobada' && !r.notified_at && isRH && <p className="mt-3 text-xs text-ink-400">Para cerrar, primero debe registrarse la notificación al colaborador.</p>}
            </Card>
          )}

          {isRH && (
            <Card title="Observaciones internas">
              <p className="mb-2 text-xs text-ink-400">Sólo las ve RH. Quedan en el historial de auditoría.</p>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej.: consultar con Legales la proporcionalidad…" />
              <Button className="mt-3" size="sm" disabled={busy || !note.trim()} onClick={() => act(() => run((s) => s.addComment(r.id, note, true))).then((ok) => ok && setNote(''))}>Agregar observación</Button>
              <ul className="mt-4 space-y-3">
                {events.filter((e) => e.internal && e.action === 'observacion_interna').map((e) => (
                  <li key={e.id} className="rounded-md bg-amber-50 p-3 text-sm">
                    <div className="text-ink-700">{e.comment}</div>
                    <div className="mt-1 text-xs text-ink-400">{e.actor_name} · {fmtDateTime(e.at)} · v{e.revision}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {r.status !== 'borrador' && (
            <Card title="Mensajes">
              {!isRH ? (
                <>
                  <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Consulta o aclaración para RH…" className="min-h-[70px]" />
                  <Button className="mt-3" size="sm" disabled={busy || !msg.trim()} onClick={() => act(() => run((s) => s.addComment(r.id, msg, false))).then((ok) => ok && setMsg(''))}><MessageSquare size={14} /> Enviar a RH</Button>
                </>
              ) : (
                <>
                  <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Mensaje visible para el gerente…" className="min-h-[70px]" />
                  <Button className="mt-3" size="sm" disabled={busy || !msg.trim()} onClick={() => act(() => run((s) => s.addComment(r.id, msg, false))).then((ok) => ok && setMsg(''))}><MessageSquare size={14} /> Enviar al gerente</Button>
                </>
              )}
              <ul className="mt-4 space-y-3">
                {events.filter((e) => e.action === 'comentario').map((e) => (
                  <li key={e.id} className="rounded-md bg-chrome-100 p-3 text-sm"><div>{e.comment}</div><div className="mt-1 text-xs text-ink-400">{e.actor_name} · {fmtDateTime(e.at)}</div></li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      {confirm && (
        <Modal title={{ aprobar: 'Aprobar la medida', rechazar: 'Rechazar la solicitud', pedir_modificaciones: 'Solicitar modificaciones' }[confirm]} onClose={() => setConfirm(null)}
          footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Cancelar</Button><Button variant={confirm === 'aprobar' ? 'success' : confirm === 'rechazar' ? 'danger' : 'primary'} disabled={busy} onClick={decide}>Confirmar</Button></>}>
          {confirm === 'aprobar' ? (
            <div className="space-y-3 text-sm text-ink-700">
              <p>Vas a aprobar la <b>versión {r.revision}</b> de la solicitud <b>{r.number}</b> ({r.measure_type_name} para {r.employee_name}).</p>
              <p>Se generará el documento definitivo con el modelo “{tpl?.title}” v{tv?.version}, quedará registrado que lo aprobaste vos ({user.name}) con fecha y hora, y ya no podrá modificarse.</p>
              {comment && <p>Comentario: “{comment}”</p>}
            </div>
          ) : (
            <div className="text-sm text-ink-700">{comment.trim() ? <>El gerente recibirá esta devolución:<blockquote className="mt-2 border-l-4 border-chrome-300 pl-3">{comment}</blockquote></> : <Notice tone="error">Escribí la devolución para el gerente antes de confirmar.</Notice>}</div>
          )}
        </Modal>
      )}

      {modal && (
        <Modal title={{ notificar: 'Registrar notificación', cerrar: 'Cerrar caso', rectificar: 'Rectificar medida aprobada' }[modal]} onClose={() => setModal(null)}
          footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button><Button disabled={busy} onClick={async () => {
            const ok = await act(() => run((s) => modal === 'notificar' ? s.registerNotification(r.id, modalDate, modalText) : modal === 'cerrar' ? s.close(r.id, modalText) : s.rectify(r.id, modalText)));
            if (ok) setModal(null);
          }}>Confirmar</Button></>}>
          <div className="space-y-4">
            {modal === 'notificar' && <Input label="Fecha de notificación" type="date" value={modalDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setModalDate(e.target.value)} />}
            {modal === 'rectificar' && <Notice tone="warn">La versión definitiva aprobada quedará <b>sin efecto</b> (se conserva en el historial). La solicitud vuelve a borrador y necesita una nueva aprobación de RH.</Notice>}
            <Textarea label={modal === 'rectificar' ? 'Motivo de la rectificación' : 'Observaciones'} required={modal === 'rectificar'} value={modalText} onChange={(e) => setModalText(e.target.value)}
              placeholder={modal === 'notificar' ? 'Ej.: firmó en conformidad / se negó a firmar, firmaron dos testigos…' : ''} />
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-3 border-b border-chrome-100 py-2.5 text-sm">
      <div className="text-ink-500">{label}</div>
      <div className="whitespace-pre-wrap text-ink-900">{children || <span className="text-ink-400">—</span>}</div>
    </div>
  );
}

function Resumen({ r, data, fieldsLabel, prior }: { r: DisciplinaryRequest; data: RequestData; fieldsLabel: (k: string) => string; prior: DisciplinaryRequest[] }) {
  const { svc } = useData();
  return (
    <div className="space-y-5">
      <Card title="Datos de la solicitud">
        <Row label="Colaborador">{data.employee_name}</Row>
        <Row label="Legajo">{data.legajo}</Row>
        <Row label="Puesto">{data.position}</Row>
        <Row label="Tienda / área">{data.store_name} · {data.area}</Row>
        <Row label="Fecha del incidente">{fmtDate(data.incident_date)}</Row>
        <Row label="Tipo de situación">{data.situation_type_name}</Row>
        <Row label="Medida solicitada">{data.measure_type_name}</Row>
        <Row label="Descripción de los hechos">{data.description}</Row>
        <Row label="Antecedentes">{data.antecedentes}</Row>
        {Object.entries(data.extra).map(([k, v]) => <Row key={k} label={fieldsLabel(k)}>{/^\d{4}-\d{2}-\d{2}$/.test(v) ? fmtDate(v) : v}</Row>)}
        <Row label="Presentada">{r.submitted_at ? fmtDateTime(r.submitted_at) : 'Sin enviar'}</Row>
      </Card>
      <Card title={`Documentación respaldatoria (${data.attachments.length})`}>
        {data.attachments.length === 0 ? <p className="text-sm text-ink-400">Sin adjuntos.</p> : (
          <ul className="divide-y divide-chrome-200">
            {data.attachments.map((a) => (
              <li key={a.file_id} className="flex items-center gap-3 py-2 text-sm">
                <Paperclip size={15} className="text-ink-400" />
                <span className="flex-1">{a.name} <span className="text-xs text-ink-400">· {fmtSize(a.size)} · {a.uploaded_by}</span></span>
                <Button size="sm" variant="ghost" onClick={async () => { const f = await svc?.getFile(a.file_id); if (f) downloadStored(f); }}><Download size={15} /> Descargar</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {prior.length > 0 && (
        <Card title="Otras solicitudes de este colaborador">
          <ul className="space-y-1 text-sm">
            {prior.map((p) => <li key={p.id}><Link className="text-brand-500 hover:underline" to={`/solicitudes/${p.id}`}>{p.number}</Link> · {p.measure_type_name} · {fmtDate(p.incident_date)} · {STATUS_LABEL[p.status]}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}

const DIFF_KEYS: [keyof RequestData, string][] = [
  ['employee_name', 'Colaborador'], ['incident_date', 'Fecha del incidente'], ['situation_type_name', 'Tipo de situación'],
  ['measure_type_name', 'Medida'], ['template_version_id', 'Versión del modelo'], ['description', 'Descripción'], ['antecedentes', 'Antecedentes'],
];

function Versiones({ revisions, approved }: { revisions: RequestRevision[]; approved: number | null }) {
  const [open, setOpen] = useState<RequestRevision | null>(null);
  if (!revisions.length) return <Empty>Todavía no se envió ninguna versión a RH.</Empty>;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">Cada envío a RH queda guardado como una versión inmutable, con el borrador tal como se generó en ese momento.</p>
      {revisions.map((v, i) => {
        const prev = revisions[i + 1];
        const changes = prev ? DIFF_KEYS.filter(([k]) => JSON.stringify(prev.data[k]) !== JSON.stringify(v.data[k])).map(([, l]) => l) : [];
        const extraChanged = prev && JSON.stringify(prev.data.extra) !== JSON.stringify(v.data.extra);
        const attChanged = prev && prev.data.attachments.length !== v.data.attachments.length;
        return (
          <div key={v.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-chrome-300 p-4">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-chrome-100 text-lg font-bold text-ink-700">v{v.revision}</div>
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-ink-900">{v.reason} {approved === v.revision && <Pill tone="green">Aprobada</Pill>}</div>
              <div className="text-ink-500">{v.created_by_name} · {fmtDateTime(v.created_at)} · modelo v{v.template_version}</div>
              {prev && <div className="mt-1 text-xs text-ink-500">Cambios respecto de v{prev.revision}: {[...changes, extraChanged && 'Datos del modelo', attChanged && 'Adjuntos'].filter(Boolean).join(', ') || 'sin cambios en los datos'}</div>}
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpen(v)}>Ver</Button>
          </div>
        );
      })}
      {open && (
        <Modal wide title={`Versión ${open.revision} · ${fmtDateTime(open.created_at)}`} onClose={() => setOpen(null)}>
          <div className="watermark doc-paper rounded-lg border border-chrome-300 p-8 text-[13px]">{open.rendered}</div>
        </Modal>
      )}
    </div>
  );
}

export function Historial({ events }: { events: AuditEvent[] }) {
  if (!events.length) return <Empty>Sin registros.</Empty>;
  return (
    <ol className="relative ml-3 border-l-2 border-chrome-200">
      {events.map((e) => (
        <li key={e.id} className="mb-5 ml-5">
          <span className={cx('absolute -left-[7px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-white', e.action === 'aprobada' ? 'bg-emerald-500' : e.action === 'rechazada' ? 'bg-rose-500' : e.internal ? 'bg-amber-400' : 'bg-brand-500')} />
          <div className="text-sm">
            <span className="font-semibold text-ink-900">{ACTION_LABEL[e.action] ?? e.action}</span>
            {e.from_status && e.to_status && <span className="text-ink-500"> · {STATUS_LABEL[e.from_status]} → {STATUS_LABEL[e.to_status]}</span>}
            {e.revision ? <span className="text-ink-400"> · v{e.revision}</span> : null}
            {e.internal && <> <Pill tone="amber">Interno RH</Pill></>}
          </div>
          <div className="text-xs text-ink-400">{e.actor_name} ({ROLE_LABEL[e.actor_role]}) · {fmtDateTime(e.at)}</div>
          {e.comment && <div className="mt-1 whitespace-pre-wrap text-sm text-ink-700">{e.comment}</div>}
        </li>
      ))}
    </ol>
  );
}

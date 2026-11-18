import { Download, FileDown, MessageSquare, Paperclip, Printer, Upload } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { GestionBadge } from '../components/GestionBadge';
import { Button, Card, cx, Empty, fmtSize, Input, Modal, Notice, Pill, Textarea } from '../components/ui';
import { downloadStored, downloadVacationNotice, printDocument } from '../lib/documents';
import { certificateOverdue, gCan, gDenyReason, leaveRequiresCertificate } from '../lib/gestiones';
import { useData } from '../lib/store';
import { fmtDate, fmtDateTime } from '../lib/template';
import type { Gestion } from '../lib/types';
import { Historial } from './SolicitudDetalle';

type Att = Gestion['attachments'][number];

export function GestionDetalle() {
  const { id } = useParams();
  const { user, data, svc, run } = useData();
  const nav = useNavigate();
  const [comment, setComment] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [modal, setModal] = useState<null | 'cerrar' | 'anular'>(null);
  const [mText, setMText] = useState('');
  const [mDate, setMDate] = useState('');
  const g = data.gestiones.find((x) => x.id === id);
  if (!user || !svc) return null;
  if (!g) return <Empty>Gestión no encontrada o sin acceso.</Empty>;

  const policy = data.policy;
  const isLic = g.kind === 'licencia';
  const isRH = user.role !== 'gerente';
  const events = data.audit_events.filter((e) => e.entity === 'gestion' && e.entity_id === g.id).sort((a, b) => b.at.localeCompare(a.at));
  const lastObs = events.find((e) => e.action === 'observada');
  const role: Att['role'] = isLic ? 'certificado' : 'firmada';
  const hasDoc = g.attachments.some((a) => a.role === role);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await fn(); return true; } catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  };
  const upload = (files: FileList | null) => act(async () => {
    if (!files?.length) return;
    const add: Att[] = [];
    for (const f of Array.from(files)) add.push({ ...(await svc.uploadFile(f)), role });
    await run((s) => s.updateGestion(g.id, { attachments: [...g.attachments, ...add] }));
  });

  const steps = isLic
    ? ['Aviso cargado', 'Certificado', 'Enviada a RH', 'Recibida por RH', 'Reintegro']
    : ['Fechas cargadas', 'Notificación firmada', 'Enviada a RH', 'Recibida por RH', 'Reintegro'];
  const idx = { pendiente_certificado: 1, pendiente_firma: 1, observada: 2, enviada: 2, recibida: 3, cerrada: 5, anulada: -1 }[g.status];

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-1 text-sm"><Link to="/gestiones" className="text-brand-500 hover:underline">← Licencias y vacaciones</Link></div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-bold text-ink-900">
            {isLic ? `Licencia · ${g.leave_type_name}` : `Vacaciones ${g.period_year}`} · {g.employee_name} <GestionBadge status={g.status} />
            {certificateOverdue(g, policy) && <Pill tone="red">Certificado demorado</Pill>}
          </h1>
          <p className="mt-1 text-sm text-ink-500"><span className="font-mono">{g.number}</span> · Legajo {g.legajo} · {g.position} · {g.store_name} · {g.area} · Gerente: {g.manager_name}{g.coordinator_name && <> · RH: {g.coordinator_name}</>}</p>
        </div>
        {gCan('editar', user, g, policy) && <Button variant="outline" onClick={() => nav(`/gestiones/${g.id}/editar`)}>Corregir datos</Button>}
      </div>

      {idx >= 0 && (
        <ol className="mb-6 grid grid-cols-5 gap-2 text-sm">
          {steps.map((s, i) => (
            <li key={s} className={cx('border-t-4 pt-2', i < idx ? 'border-emerald-500 text-ink-700' : i === idx ? (g.status === 'observada' ? 'border-orange-500 font-bold text-ink-900' : 'border-brand-500 font-bold text-ink-900') : 'border-chrome-300 text-ink-400')}>{i === idx && g.status === 'observada' ? 'Observada por RH' : s}</li>
          ))}
        </ol>
      )}

      {g.status === 'observada' && lastObs && <div className="mb-5"><Notice tone="warn" title={`Observación de ${lastObs.actor_name} · ${fmtDateTime(lastObs.at)}`}>{lastObs.comment}</Notice></div>}
      {g.status === 'pendiente_certificado' && <div className="mb-5"><Notice tone={certificateOverdue(g, policy) ? 'error' : 'warn'} title="Falta el certificado">RH ya está avisado de la licencia. Cargá el certificado apenas lo tengas (plazo: {policy.certificate_days ?? 2} días hábiles desde el inicio).</Notice></div>}
      {g.status === 'pendiente_firma' && <div className="mb-5"><Notice tone="warn" title="Falta la notificación firmada">1) Descargá la notificación · 2) Hacela firmar por el colaborador · 3) Subí la copia firmada. Recién ahí le llega a RH.</Notice></div>}

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <Card title="Datos">
            <Row label="Colaborador">{g.employee_name} · legajo {g.legajo}</Row>
            <Row label="Tienda / área">{g.store_name} · {g.area}</Row>
            {isLic ? <>
              <Row label="Tipo de licencia">{g.leave_type_name}</Row>
              <Row label="Avisó el">{fmtDate(g.notice_date)}</Row>
            </> : <Row label="Período">{g.period_year}</Row>}
            <Row label="Desde / hasta">{fmtDate(g.start_date)} → {fmtDate(g.end_date)} ({g.days} días corridos)</Row>
            <Row label="Observaciones">{g.notes}</Row>
            {g.reviewed_by_name && <Row label="Revisada por">{g.reviewed_by_name} · {fmtDateTime(g.reviewed_at)}</Row>}
            {g.return_date && <Row label="Reintegro">{fmtDate(g.return_date)}</Row>}
          </Card>

          {!isLic && (
            <Card title="Notificación de vacaciones" actions={<>
              <Button size="sm" onClick={() => act(() => downloadVacationNotice(svc, g))}><FileDown size={15} /> Descargar Word</Button>
              <Button size="sm" variant="outline" onClick={() => act(async () => printDocument({ title: `${g.number} – Notificación de vacaciones`, content: svc.renderVacationNotice(g), draft: false }))}><Printer size={15} /> Imprimir</Button>
            </>}>
              <div className="doc-paper max-h-[460px] overflow-y-auto rounded-lg border border-chrome-300 bg-white p-8 text-[13px] text-ink-900">{svc.renderVacationNotice(g)}</div>
            </Card>
          )}

          <Card title={isLic ? 'Certificado y constancias' : 'Notificación firmada'}>
            {g.attachments.length === 0 ? <p className="text-sm text-ink-400">{isLic ? (leaveRequiresCertificate(g.leave_type) ? 'Todavía no se cargó el certificado.' : 'Sin adjuntos.') : 'Todavía no se subió la notificación firmada.'}</p> : (
              <ul className="divide-y divide-chrome-200">
                {g.attachments.map((a) => (
                  <li key={a.file_id} className="flex items-center gap-3 py-2 text-sm">
                    <Paperclip size={15} className="text-ink-400" />
                    <span className="flex-1">{a.name} <span className="text-xs text-ink-400">· {a.role === 'certificado' ? 'certificado' : a.role === 'firmada' ? 'notificación firmada' : 'otro'} · {fmtSize(a.size)} · {a.uploaded_by} · {fmtDateTime(a.uploaded_at)}</span></span>
                    <Button size="sm" variant="ghost" onClick={async () => { const f = await svc.getFile(a.file_id); if (f) downloadStored(f); }}><Download size={15} /> Descargar</Button>
                  </li>
                ))}
              </ul>
            )}
            {gCan('editar', user, g, policy) && (
              <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-brand-500 px-4 py-4 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                <Upload size={20} /> {hasDoc ? 'Agregar otro archivo' : isLic ? 'Subir certificado' : 'Subir notificación firmada'} (PDF o foto)
                <input type="file" multiple accept=".pdf,image/*" className="hidden" disabled={busy} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </Card>

          <Card title={`Historial (${events.length})`}><Historial events={events} /></Card>
        </div>

        <aside className="space-y-4">
          {error && <Notice tone="error">{error}</Notice>}
          {isRH && g.status === 'enviada' && (
            <Card title="Recepción de RH">
              {gDenyReason('revisar', user, g, policy) ? <Notice tone="warn">{gDenyReason('revisar', user, g, policy)}</Notice> : <>
                <Textarea label="Observación para el gerente" value={comment} onChange={(e) => setComment(e.target.value)} hint="Obligatoria para observar. Ej.: el certificado no tiene sello." />
                <div className="mt-4 grid gap-2">
                  <Button variant="success" disabled={busy} onClick={() => act(() => run((s) => s.reviewGestion(g.id, 'recibir', comment))).then((ok) => ok && setComment(''))}>Dar por recibida</Button>
                  <Button variant="outline" disabled={busy} onClick={() => act(() => run((s) => s.reviewGestion(g.id, 'observar', comment))).then((ok) => ok && setComment(''))}>Observar (devolver al gerente)</Button>
                </div>
              </>}
            </Card>
          )}
          {(gCan('cerrar', user, g, policy) || gCan('anular', user, g, policy)) && (
            <Card title="Cierre">
              <div className="grid gap-2">
                {gCan('cerrar', user, g, policy) && <Button onClick={() => { setModal('cerrar'); setMText(''); setMDate(g.end_date ? new Date(new Date(`${g.end_date}T12:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10) : ''); }}>Registrar reintegro</Button>}
                {gCan('anular', user, g, policy) && <Button variant="link" onClick={() => { setModal('anular'); setMText(''); }}>Anular</Button>}
              </div>
            </Card>
          )}
          <Card title="Mensajes">
            <Textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={isRH ? 'Mensaje para el gerente…' : 'Consulta para RH…'} className="min-h-[70px]" />
            <Button className="mt-3" size="sm" disabled={busy || !msg.trim()} onClick={() => act(() => run((s) => s.commentGestion(g.id, msg))).then((ok) => ok && setMsg(''))}><MessageSquare size={14} /> Enviar</Button>
          </Card>
        </aside>
      </div>

      {modal && (
        <Modal title={modal === 'cerrar' ? 'Registrar reintegro' : 'Anular gestión'} onClose={() => setModal(null)}
          footer={<><Button variant="ghost" onClick={() => setModal(null)}>Cancelar</Button><Button disabled={busy} onClick={async () => {
            const ok = await act(() => run((s) => modal === 'cerrar' ? s.closeGestion(g.id, mDate, mText) : s.cancelGestion(g.id, mText)));
            if (ok) setModal(null);
          }}>Confirmar</Button></>}>
          <div className="space-y-4">
            {modal === 'cerrar' && <Input label="Fecha de reintegro" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />}
            <Textarea label={modal === 'anular' ? 'Motivo' : 'Observaciones'} required={modal === 'anular'} value={mText} onChange={(e) => setMText(e.target.value)} />
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        </Modal>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-chrome-100 py-2.5 text-sm">
      <div className="text-ink-500">{label}</div>
      <div className="whitespace-pre-wrap text-ink-900">{children || <span className="text-ink-400">—</span>}</div>
    </div>
  );
}

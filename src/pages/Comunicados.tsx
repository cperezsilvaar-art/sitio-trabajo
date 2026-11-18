import { CheckCircle2, Megaphone, Paperclip, Pin, Plus, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Checkbox, cx, Empty, Input, Modal, Notice, PageTitle, Pill, Select, Textarea } from '../components/ui';
import { downloadStored } from '../lib/documents';
import { useData } from '../lib/store';
import { fmtDate, fmtDateTime } from '../lib/template';
import type { Announcement, AnnouncementPriority, Attachment } from '../lib/types';

const PRIO: Record<AnnouncementPriority, { label: string; cls: string; tone: 'gray' | 'amber' | 'red' }> = {
  normal: { label: 'Informativo', cls: 'border-chrome-300', tone: 'gray' },
  importante: { label: 'Importante', cls: 'border-amber-400', tone: 'amber' },
  urgente: { label: 'Urgente', cls: 'border-rose-500', tone: 'red' },
};

const order = (a: Announcement, b: Announcement) =>
  Number(b.pinned) - Number(a.pinned) || ['urgente', 'importante', 'normal'].indexOf(a.priority) - ['urgente', 'importante', 'normal'].indexOf(b.priority) || b.published_at.localeCompare(a.published_at);

function isLive(a: Announcement) {
  return a.active && (!a.expires_at || a.expires_at >= new Date().toISOString().slice(0, 10));
}

/** Tarjeta de un comunicado, como un aviso en la cartelera. */
function Aviso({ a, compact }: { a: Announcement; compact?: boolean }) {
  const { user, data, svc, run } = useData();
  const read = data.announcement_reads.some((r) => r.announcement_id === a.id && r.user_id === user?.id);
  const isManager = user?.role === 'gerente';
  const [open, setOpen] = useState(!compact);
  const long = a.body.length > 220;
  return (
    <article className={cx('relative rounded-xl border-l-4 border bg-white p-5', PRIO[a.priority].cls, isManager && !read && 'bg-brand-50/40')}>
      <div className="flex flex-wrap items-center gap-2">
        {a.pinned && <Pin size={15} className="text-brand-600" />}
        {a.priority !== 'normal' && <Pill tone={PRIO[a.priority].tone}>{PRIO[a.priority].label}</Pill>}
        {isManager && !read && <Pill tone="blue">Nuevo</Pill>}
        <h3 className="text-[17px] font-bold text-ink-900">{a.title}</h3>
      </div>
      <p className={cx('mt-2 whitespace-pre-line text-[15px] text-ink-700', !open && long && 'line-clamp-3')}>{a.body}</p>
      {long && compact && <button className="mt-1 text-sm text-brand-500 hover:underline" onClick={() => setOpen(!open)}>{open ? 'Ver menos' : 'Leer completo'}</button>}
      {a.attachments.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {a.attachments.map((f) => (
            <button key={f.file_id} className="inline-flex items-center gap-1.5 rounded-full bg-chrome-100 px-3 py-1 text-sm hover:bg-chrome-200" onClick={async () => { const x = await svc?.getFile(f.file_id); if (x) downloadStored(x); }}>
              <Paperclip size={13} /> {f.name}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">
        <span>{a.author_name} · {fmtDateTime(a.published_at)}</span>
        {a.areas.length > 0 && <span>Para: {a.areas.join(', ')}</span>}
        {a.expires_at && <span>Vigente hasta {fmtDate(a.expires_at)}</span>}
        {isManager && (read
          ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={13} /> Leído</span>
          : <Button variant="link" className="!text-xs" onClick={() => run((s) => s.markAnnouncementRead(a.id))}>Marcar como leído</Button>)}
      </div>
    </article>
  );
}

/** Cartelera del inicio: comunicados vigentes, los no leídos primero. */
export function Cartelera() {
  const { user, data } = useData();
  if (!user) return null;
  const isManager = user.role === 'gerente';
  const canPublish = user.role === 'coordinador' || user.role === 'admin_rh';
  const live = data.announcements.filter(isLive).sort(order);
  const unread = live.filter((a) => !data.announcement_reads.some((r) => r.announcement_id === a.id && r.user_id === user.id));
  const shown = (isManager ? [...unread, ...live.filter((a) => !unread.includes(a))] : live).slice(0, 3);
  return (
    <Card title={<span className="flex items-center gap-2"><Megaphone size={20} className="text-brand-600" /> Comunicados importantes {isManager && unread.length > 0 && <Pill tone="blue">{unread.length} sin leer</Pill>}</span>}
      actions={<><Link to="/comunicados" className="text-[15px] text-brand-500 hover:underline">Ver la cartelera completa</Link>{canPublish && <Link to="/comunicados?nuevo=1"><Button size="sm"><Plus size={14} /> Publicar</Button></Link>}</>}>
      {shown.length === 0 ? <p className="text-sm text-ink-400">No hay comunicados vigentes.</p> : (
        <div className="grid gap-4 lg:grid-cols-3">{shown.map((a) => <Aviso key={a.id} a={a} compact />)}</div>
      )}
    </Card>
  );
}

export function Comunicados() {
  const { user, data, svc, run } = useData();
  const isManager = user?.role === 'gerente' || user?.role === 'gerente_area';
  const [params] = useSearchParams();
  const [edit, setEdit] = useState<Announcement | null>(() => (params.get('nuevo') && !isManager ? blank() : null));
  const [isNew, setIsNew] = useState(!!edit);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [readers, setReaders] = useState<Announcement | null>(null);
  const [showOld, setShowOld] = useState(false);
  if (!user || !svc) return null;
  const areas = [...new Set(data.stores.map((s) => s.area))].sort();
  const live = data.announcements.filter(isLive).sort(order);
  const old = data.announcements.filter((a) => !isLive(a)).sort((a, b) => b.published_at.localeCompare(a.published_at));

  function blank(): Announcement {
    return { id: '', title: '', body: '', priority: 'normal', areas: [], pinned: false, active: true, author_id: '', author_name: '', published_at: '', updated_at: '', expires_at: null, attachments: [] };
  }

  const save = async () => {
    if (!edit) return;
    setBusy(true); setError('');
    try {
      const { title, body, priority, areas: ar, pinned, expires_at, attachments } = edit;
      if (isNew) await run((s) => s.publishAnnouncement({ title, body, priority, areas: ar, pinned, expires_at, attachments }));
      else await run((s) => s.updateAnnouncement(edit.id, { title, body, priority, areas: ar, pinned, expires_at, attachments }));
      setEdit(null);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const upload = async (files: FileList | null) => {
    if (!files || !edit) return;
    setBusy(true);
    try {
      const add: Attachment[] = [];
      for (const f of Array.from(files)) add.push(await svc.uploadFile(f));
      setEdit({ ...edit, attachments: [...edit.attachments, ...add] });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-[1300px]">
      <PageTitle sub={isManager ? 'Lo que los coordinadores de RH necesitan que sepas. Marcá cada comunicado como leído.' : 'Publicá avisos para los gerentes. Aparecen en la cartelera de su inicio y les llega un aviso.'}
        actions={!isManager && <Button onClick={() => { setEdit(blank()); setIsNew(true); }}><Plus size={16} /> Publicar comunicado</Button>}>
        Cartelera de comunicados
      </PageTitle>
      {live.length === 0 ? <Empty>No hay comunicados vigentes.</Empty> : (
        <div className="space-y-4">
          {live.map((a) => {
            const audience = svc.audienceOf(a);
            const reads = data.announcement_reads.filter((r) => r.announcement_id === a.id && audience.some((p) => p.id === r.user_id));
            const mine = a.author_id === user.id || user.role === 'admin_rh';
            return (
              <div key={a.id}>
                <Aviso a={a} />
                {!isManager && (
                  <div className="mt-1 flex flex-wrap items-center gap-4 px-2 text-sm">
                    <button className="text-brand-500 hover:underline" onClick={() => setReaders(a)}>Leído por {reads.length} de {audience.length} gerentes</button>
                    {mine && <>
                      <Button variant="link" onClick={() => { setEdit({ ...a }); setIsNew(false); }}>Editar</Button>
                      <Button variant="link" onClick={() => run((s) => s.updateAnnouncement(a.id, { pinned: !a.pinned }))}>{a.pinned ? 'Desfijar' : 'Fijar arriba'}</Button>
                      <Button variant="link" onClick={() => run((s) => s.updateAnnouncement(a.id, { active: false }))}>Retirar</Button>
                    </>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isManager && old.length > 0 && (
        <div className="mt-8">
          <Button variant="link" onClick={() => setShowOld(!showOld)}>{showOld ? 'Ocultar' : 'Ver'} comunicados retirados o vencidos ({old.length})</Button>
          {showOld && <div className="mt-3 space-y-3 opacity-70">{old.map((a) => (
            <div key={a.id}><Aviso a={a} />{(a.author_id === user.id || user.role === 'admin_rh') && <Button variant="link" className="ml-2" onClick={() => run((s) => s.updateAnnouncement(a.id, { active: true, expires_at: null }))}>Volver a publicar</Button>}</div>
          ))}</div>}
        </div>
      )}

      {edit && (
        <Modal wide title={isNew ? 'Publicar comunicado' : 'Editar comunicado'} onClose={() => setEdit(null)}
          footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button disabled={busy || !edit.title.trim() || !edit.body.trim()} onClick={save}>{isNew ? 'Publicar' : 'Guardar'}</Button></>}>
          <div className="space-y-4">
            <Input label="Título" required value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} placeholder="Ej.: Cierre de novedades de noviembre: viernes 21" />
            <Textarea label="Texto" required className="min-h-[160px]" value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <Select label="Prioridad" value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value as AnnouncementPriority })}>
                <option value="normal">Informativo</option><option value="importante">Importante</option><option value="urgente">Urgente</option>
              </Select>
              <Input label="Vigente hasta (opcional)" type="date" value={edit.expires_at ?? ''} onChange={(e) => setEdit({ ...edit, expires_at: e.target.value || null })} hint="Después de esa fecha deja de verse en la cartelera." />
            </div>
            <div>
              <div className="mb-2 text-sm font-semibold text-ink-700">¿Para quiénes?</div>
              <div className="flex flex-wrap gap-4">
                <Checkbox label="Todos los gerentes" checked={edit.areas.length === 0} onChange={(v) => v && setEdit({ ...edit, areas: [] })} />
                {areas.map((a) => <Checkbox key={a} label={`Gerentes del ${a}`} checked={edit.areas.includes(a)} onChange={(v) => setEdit({ ...edit, areas: v ? [...edit.areas, a] : edit.areas.filter((x) => x !== a) })} />)}
              </div>
              <p className="mt-1 text-xs text-ink-400">Les llega {svc.audienceOf(edit).length} aviso(s).</p>
            </div>
            <Checkbox label="Fijar arriba de la cartelera" checked={edit.pinned} onChange={(v) => setEdit({ ...edit, pinned: v })} />
            <div>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-chrome-300 px-4 py-3 text-sm text-ink-500 hover:bg-chrome-100">
                <Upload size={18} /> Adjuntar archivo (instructivo, planilla, afiche…)
                <input type="file" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">{edit.attachments.map((f) => (
                <span key={f.file_id} className="inline-flex items-center gap-1.5 rounded-full bg-chrome-100 px-3 py-1 text-sm"><Paperclip size={13} /> {f.name}
                  <button className="text-ink-400 hover:text-rose-600" onClick={() => setEdit({ ...edit, attachments: edit.attachments.filter((x) => x.file_id !== f.file_id) })}>×</button></span>
              ))}</div>
            </div>
            {error && <Notice tone="error">{error}</Notice>}
          </div>
        </Modal>
      )}

      {readers && (() => {
        const audience = svc.audienceOf(readers);
        const reads = new Map(data.announcement_reads.filter((r) => r.announcement_id === readers.id).map((r) => [r.user_id, r.at]));
        return (
          <Modal title={`Lectura: ${readers.title}`} onClose={() => setReaders(null)}>
            <ul className="divide-y divide-chrome-200">
              {audience.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{p.name} <span className="text-xs text-ink-400">· {p.areas.join(', ')}</span></span>
                  {reads.has(p.id) ? <span className="text-emerald-700">Leído {fmtDateTime(reads.get(p.id))}</span> : <span className="text-rose-600">Sin leer</span>}
                </li>
              ))}
            </ul>
          </Modal>
        );
      })()}
    </div>
  );
}

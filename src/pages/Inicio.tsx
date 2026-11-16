import { BookOpen, ClipboardCheck, FilePenLine, FileSearch, LayoutGrid, List, MoreHorizontal, ShieldCheck, Files } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { RequestTable } from '../components/RequestTable';
import { Button, Card, cx } from '../components/ui';
import { useData } from '../lib/store';
import { CATEGORY_LABEL, type TemplateCategory } from '../lib/types';
import { isOverdue } from '../lib/workflow';

function Tool({ icon, title, text, to, cta = 'Utilizar ahora' }: { icon: ReactNode; title: string; text: string; to: string; cta?: string }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 font-bold text-ink-900">{icon}{title}</div>
      <p className="mt-3 line-clamp-2 flex-1 text-sm text-ink-500">{text}</p>
      <Link to={to} className="mt-4 text-[15px] text-brand-500 hover:underline">{cta}</Link>
    </div>
  );
}

const BANNERS: { cat: TemplateCategory; title: string; text: string; bg: string }[] = [
  { cat: 'procedimiento', title: 'Procedimiento disciplinario', text: 'Pasos, plazos y buenas prácticas antes de pedir una medida.', bg: 'from-[#0b2545] via-[#13315c] to-[#1473e6]' },
  { cat: 'sancion', title: 'Modelos de medidas', text: 'Apercibimiento, suspensión y llamado de atención en su versión vigente.', bg: 'from-[#3a0d4a] via-[#6b2a7a] to-[#d0608a]' },
  { cat: 'instructivo', title: 'Instructivos para gerentes', text: 'Cómo completar una solicitud y qué revisa RH antes de aprobarla.', bg: 'from-[#111] via-[#2b2b2b] to-[#4a4a4a]' },
];

export function Inicio() {
  const { user, data } = useData();
  const nav = useNavigate();
  const [view, setView] = useState<'list' | 'grid'>('list');
  if (!user) return null;
  const isManager = user.role === 'gerente';

  const mine = data.requests.filter((r) => (isManager ? r.manager_id === user.id : true));
  const recent = [...mine].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6);
  const needsMe = isManager
    ? mine.filter((r) => r.status === 'requiere_modificaciones')
    : data.requests.filter((r) => (r.status === 'enviada' || r.status === 'pendiente_revision') && r.manager_id !== user.id);
  const overdue = needsMe.filter((r) => isOverdue(r, data.policy)).length;
  const countBy = (c: TemplateCategory) => data.templates.filter((t) => t.category === c && t.active).length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-7">
      <div className="grid gap-5 xl:grid-cols-[1fr_400px]">
        <Card title="Herramientas recomendadas" actions={<><Link to="/biblioteca" className="text-[15px] text-brand-500 hover:underline">Ver la biblioteca completa</Link><MoreHorizontal size={18} className="text-ink-500" /></>}>
          <div className="grid gap-6 pt-2 md:grid-cols-3">
            {isManager ? (
              <>
                <Tool icon={<FilePenLine className="text-amber-500" size={22} />} title="Solicitar medida disciplinaria" text="Formulario guiado: colaborador, hechos, antecedentes y respaldo. El borrador se arma solo con el modelo de RH." to="/solicitudes/nueva" />
                <Tool icon={<BookOpen className="text-fuchsia-600" size={22} />} title="Consultar modelos" text="Modelos de apercibimiento, suspensión y comunicaciones formales en su versión vigente." to="/biblioteca?cat=sancion" />
                <Tool icon={<FileSearch className="text-violet-600" size={22} />} title="Seguir mis solicitudes" text="Estado de cada pedido, devoluciones de RH y documentos definitivos para notificar." to="/solicitudes" />
              </>
            ) : (
              <>
                <Tool icon={<ClipboardCheck className="text-amber-500" size={22} />} title="Revisar solicitudes" text="Solicitudes pendientes de aprobación de las áreas que cubrís." to="/aprobaciones" cta="Revisar ahora" />
                <Tool icon={<BookOpen className="text-fuchsia-600" size={22} />} title={user.role === 'admin_rh' ? 'Administrar modelos' : 'Biblioteca de RH'} text="Modelos, procedimientos e instructivos con su versión vigente." to={user.role === 'admin_rh' ? '/admin/modelos' : '/biblioteca'} />
                <Tool icon={<ShieldCheck className="text-violet-600" size={22} />} title="Historial de auditoría" text="Quién hizo qué y cuándo: envíos, observaciones, aprobaciones y versiones." to="/auditoria" cta="Consultar" />
              </>
            )}
          </div>
        </Card>
        <Card>
          <div className="flex h-full flex-col">
            <div className="flex items-start justify-between">
              <div className="text-[17px] font-bold text-ink-900">{isManager ? 'Requieren tu atención' : 'Pendientes de tu decisión'}</div>
              <MoreHorizontal size={18} className="text-ink-500" />
            </div>
            <p className="mt-2 text-[15px] text-ink-700">
              {needsMe.length === 0
                ? isManager ? 'No tenés solicitudes devueltas por RH.' : 'No hay solicitudes esperando revisión.'
                : isManager
                  ? `${needsMe.length} solicitud${needsMe.length > 1 ? 'es' : ''} con modificaciones pedidas por RH.`
                  : `${needsMe.length} solicitud${needsMe.length > 1 ? 'es' : ''} esperando revisión${overdue ? `, ${overdue} fuera de plazo` : ''}.`}
            </p>
            <div className="mt-auto flex items-end justify-between pt-4">
              <Button variant="outline" onClick={() => nav(isManager ? '/solicitudes?f=atencion' : '/aprobaciones')}>{needsMe.length ? 'Ver ahora' : 'Ver solicitudes'}</Button>
              <div className="text-5xl font-bold text-chrome-300">{needsMe.length}</div>
            </div>
          </div>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink-900">Biblioteca de RH destacada</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {BANNERS.map((b) => (
            <button key={b.cat} onClick={() => nav(`/biblioteca?cat=${b.cat}`)}
              className={cx('relative flex h-48 flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br p-5 text-left text-white transition hover:brightness-110', b.bg)}>
              <div className="pointer-events-none absolute -right-6 -top-6 opacity-20"><Files size={150} /></div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-black/45 px-2.5 py-1 text-sm"><Files size={15} /> {countBy(b.cat)} documento{countBy(b.cat) === 1 ? '' : 's'}</span>
              <div>
                <div className="text-xl font-bold">{b.title}</div>
                <div className="mt-1 text-sm text-white/80">{b.text}</div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-400">{CATEGORY_LABEL.comunicacion} y otros documentos institucionales, en la <Link className="text-brand-500 hover:underline" to="/biblioteca">biblioteca</Link>.</p>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink-900">Recientes</h2>
          <div className="flex gap-1">
            <button className={cx('rounded-md p-2', view === 'list' ? 'bg-ink-700 text-white' : 'text-ink-700 hover:bg-chrome-100')} onClick={() => setView('list')} aria-label="Lista"><List size={18} /></button>
            <button className={cx('rounded-md p-2', view === 'grid' ? 'bg-ink-700 text-white' : 'text-ink-700 hover:bg-chrome-100')} onClick={() => setView('grid')} aria-label="Cuadrícula"><LayoutGrid size={18} /></button>
          </div>
        </div>
        <RequestTable rows={recent} view={view} compact={isManager} empty={isManager ? 'Todavía no iniciaste solicitudes.' : 'Sin solicitudes.'} />
        <div className="mt-2 text-right"><Link to="/solicitudes" className="text-[15px] text-brand-500 hover:underline">Ver todas</Link></div>
      </section>
    </div>
  );
}

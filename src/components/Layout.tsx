import { Bell, HelpCircle, Home, LogOut, Menu, Plus, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../lib/store';
import { ROLE_LABEL } from '../lib/types';
import { fmtDateTime } from '../lib/template';
import { Logo } from './Logo';
import { Button, cx } from './ui';

interface NavItem { to: string; label: string; badge?: ReactNode }
interface NavGroup { title?: string; items: NavItem[] }

export function Layout({ children }: { children: ReactNode }) {
  const { user, data, signOut, isDemo, run } = useData();
  const nav = useNavigate();
  const loc = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [q, setQ] = useState('');
  if (!user) return null;

  const unread = data.notifications.filter((n) => !n.read && n.user_id === user.id);
  const pending = data.requests.filter((r) => r.status === 'enviada' || r.status === 'pendiente_revision').length;
  const attention = data.requests.filter((r) => r.manager_id === user.id && (r.status === 'requiere_modificaciones' || r.status === 'borrador')).length;
  const unreadAnn = user.role === 'gerente'
    ? data.announcements.filter((a) => !data.announcement_reads.some((r) => r.announcement_id === a.id && r.user_id === user.id)).length
    : 0;
  const vPend = user.role === 'gerente_area'
    ? data.vacancies.filter((v) => v.status === 'pendiente_area').length
    : user.role === 'gerente' ? 0 : data.vacancies.filter((v) => v.status === 'autorizada').length;
  const gPend = user.role === 'gerente'
    ? data.gestiones.filter((g) => g.manager_id === user.id && ['pendiente_certificado', 'pendiente_firma', 'observada'].includes(g.status)).length
    : data.gestiones.filter((g) => g.status === 'enviada').length;
  const coord = user.role === 'gerente'
    ? data.profiles.find((p) => p.id === data.policy.routing[user.areas[0]]) ?? data.profiles.find((p) => p.role === 'coordinador' && p.areas.some((a) => user.areas.includes(a)))
    : null;

  const groups: NavGroup[] = (() => {
    const g: NavGroup[] = [];
    if (user.role === 'gerente') {
      g.push({ items: [
        { to: '/', label: 'Inicio' },
        { to: '/comunicados', label: 'Comunicados', badge: unreadAnn ? <Count n={unreadAnn} /> : null },
        { to: '/solicitudes', label: 'Mis solicitudes' },
        { to: '/solicitudes?f=atencion', label: 'Requieren mi atención', badge: attention ? <Count n={attention} /> : null },
      ] });
      g.push({ title: 'Gestiones', items: [
        { to: '/gestiones/nueva/licencia', label: 'Avisar licencia' },
        { to: '/gestiones/nueva/vacaciones', label: 'Cargar vacaciones' },
        { to: '/solicitudes/nueva', label: 'Solicitar medida disciplinaria' },
        { to: '/gestiones', label: 'Mis licencias y vacaciones', badge: gPend ? <Count n={gPend} /> : null },
      ] });
      g.push({ title: 'Vacantes', items: [
        { to: '/vacantes/nueva', label: 'Solicitar vacante' },
        { to: '/vacantes', label: 'Mis vacantes' },
        { to: '/headcount', label: 'Headcount de mis tiendas' },
      ] });
    } else if (user.role === 'gerente_area') {
      g.push({ items: [{ to: '/', label: 'Inicio' }, { to: '/comunicados', label: 'Cartelera de comunicados' }] });
      g.push({ title: 'Vacantes', items: [
        { to: '/vacantes?f=accion', label: 'Para autorizar', badge: vPend ? <Count n={vPend} /> : null },
        { to: '/vacantes', label: 'Vacantes en curso' },
        { to: '/headcount', label: 'Headcount de mis áreas' },
      ] });
    } else {
      g.push({ items: [{ to: '/', label: 'Inicio' }, { to: '/comunicados', label: 'Cartelera de comunicados' }] });
      g.push({ title: 'Aprobaciones', items: [
        { to: '/aprobaciones', label: 'Solicitudes pendientes de aprobación', badge: pending ? <Count n={pending} /> : null },
        { to: '/solicitudes', label: 'Todas las solicitudes' },
      ] });
      g.push({ title: 'Vacantes', items: [
        { to: '/vacantes?f=accion', label: 'Autorizadas para buscar', badge: vPend ? <Count n={vPend} /> : null },
        { to: '/vacantes', label: 'Vacantes en curso' },
        { to: '/headcount', label: 'Headcount' },
      ] });
      g.push({ title: 'Licencias y vacaciones', items: [
        { to: '/gestiones?f=pendientes', label: 'Para revisar', badge: gPend ? <Count n={gPend} /> : null },
        { to: '/gestiones?tipo=licencia', label: 'Licencias' },
        { to: '/gestiones?tipo=vacaciones', label: 'Vacaciones' },
      ] });
    }
    g.push({ title: 'Biblioteca de RH', items: [
      { to: '/biblioteca', label: 'Todos los documentos' },
      { to: '/biblioteca?cat=sancion', label: 'Modelos de medidas' },
      { to: '/biblioteca?cat=comunicacion', label: 'Comunicaciones formales' },
      { to: '/biblioteca?cat=procedimiento', label: 'Procedimientos' },
      { to: '/biblioteca?cat=instructivo', label: 'Instructivos para gerentes' },
    ] });
    if (user.role === 'admin_rh') {
      g.push({ title: 'Administración de RH', items: [
        { to: '/admin/modelos', label: 'Modelos y versiones' },
        { to: '/admin/tipos', label: 'Tipos de medida y situaciones' },
        { to: '/admin/circuito', label: 'Circuito, permisos y usuarios' },
      ] });
    }
    if (user.role === 'coordinador' || user.role === 'admin_rh') g.push({ title: 'Control', items: [{ to: '/auditoria', label: 'Historial de auditoría' }] });
    return g;
  })();

  const isActive = (to: string) => {
    const [path, qs] = to.split('?');
    return loc.pathname === path && (qs ? loc.search === `?${qs}` : !loc.search || path === '/');
  };

  const cta = user.role === 'gerente'
    ? <Button onClick={() => nav('/solicitudes/nueva')}>Nueva solicitud</Button>
    : user.role === 'gerente_area'
      ? <Button onClick={() => nav('/vacantes?f=accion')}>Para autorizar ({vPend})</Button>
      : user.role === 'admin_rh'
      ? <Button onClick={() => nav('/admin/modelos/nuevo')}>Cargar modelo</Button>
      : <Button onClick={() => nav('/aprobaciones')}>Pendientes ({pending})</Button>;

  return (
    <div className="flex min-h-full flex-col">
      {/* Barra superior */}
      <div className="flex h-11 items-center gap-1 bg-chrome-200 px-2 text-sm text-ink-700">
        <button className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-chrome-300 lg:hidden" onClick={() => setMenuOpen((v) => !v)}><Menu size={18} /> Menú</button>
        <Link to="/" className="rounded bg-white px-3 py-1.5 hover:bg-chrome-100" aria-label="Inicio"><Home size={18} /></Link>
        {user.role === 'gerente' && (
          <button className="ml-1 flex items-center gap-1.5 rounded border border-chrome-300 bg-chrome-100 px-2.5 py-1 hover:bg-white" onClick={() => nav('/solicitudes/nueva')}><Plus size={15} /> Crear</button>
        )}
        {isDemo && <span className="ml-2 hidden rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 sm:inline">{import.meta.env.VITE_EMBED === '1' ? 'Demo en línea · datos ficticios · impresión y descargas desactivadas' : 'Modo demostración · datos sólo en este navegador'}</span>}
        <div className="ml-auto flex items-center gap-1">
          <Link to="/biblioteca?cat=instructivo" className="rounded p-1.5 hover:bg-chrome-300" title="Ayuda"><HelpCircle size={19} /></Link>
          <div className="relative">
            <button className="relative rounded p-1.5 hover:bg-chrome-300" onClick={() => setBellOpen((v) => !v)} aria-label="Avisos">
              <Bell size={19} />
              {unread.length > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unread.length}</span>}
            </button>
            {bellOpen && (
              <div className="absolute right-0 z-40 mt-1 w-96 rounded-lg border border-chrome-300 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-chrome-200 px-4 py-2.5">
                  <span className="font-bold text-ink-900">Avisos</span>
                  {unread.length > 0 && <Button variant="link" onClick={() => run((s) => s.markRead(unread.map((n) => n.id)))}>Marcar todo como leído</Button>}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {data.notifications.filter((n) => n.user_id === user.id).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 15).map((n) => (
                    <button key={n.id} className={cx('block w-full border-b border-chrome-100 px-4 py-3 text-left text-sm hover:bg-chrome-100', !n.read && 'bg-brand-50')}
                      onClick={() => { setBellOpen(false); if (!n.read) run((s) => s.markRead([n.id])); if (n.link) nav(n.link); else if (n.request_id) nav(`/solicitudes/${n.request_id}`); }}>
                      <div className="text-ink-700">{n.message}</div>
                      <div className="mt-0.5 text-xs text-ink-400">{fmtDateTime(n.at)}</div>
                    </button>
                  ))}
                  {data.notifications.filter((n) => n.user_id === user.id).length === 0 && <div className="px-4 py-6 text-center text-sm text-ink-400">Sin avisos.</div>}
                </div>
              </div>
            )}
          </div>
          <div className="ml-3 hidden text-right leading-tight sm:block">
            <div className="text-[15px] font-bold text-ink-900">{user.name}</div>
            <div className="text-[11px] text-ink-500">{ROLE_LABEL[user.role]}{user.areas.length > 0 && user.role !== 'admin_rh' ? ` · ${user.areas.join(', ')}` : ''}</div>
          </div>
          <button className="ml-2 rounded p-1.5 hover:bg-chrome-300" onClick={() => signOut().then(() => nav("/"))} title="Salir"><LogOut size={18} /></button>
        </div>
      </div>

      {/* Encabezado */}
      <header className="flex flex-wrap items-center gap-4 border-b border-chrome-300 bg-white px-5 py-3">
        <Logo size={34} className="rounded-sm" />
        <div className="text-[17px] text-ink-900">Te damos la bienvenida al <span className="font-semibold">Portal de RR. HH.</span> <span className="text-ink-400">· Farmatodo</span></div>
        <form className="ml-auto flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); nav(`/solicitudes?q=${encodeURIComponent(q)}`); }}>
          <label className="flex items-center gap-2 rounded-full px-3 py-1.5 text-[15px] hover:bg-chrome-100 focus-within:bg-chrome-100">
            <Search size={19} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="w-28 bg-transparent outline-none placeholder:text-ink-700 focus:w-56 transition-all" />
          </label>
        </form>
        {cta}
      </header>

      <div className="flex flex-1">
        {/* Menú lateral */}
        <aside className={cx('w-72 shrink-0 flex-col border-r border-chrome-200 bg-white px-4 py-4 lg:flex', menuOpen ? 'fixed inset-y-0 left-0 z-40 flex shadow-2xl' : 'hidden')}>
          <nav className="flex-1 space-y-5 overflow-y-auto">
            {groups.map((g, i) => (
              <div key={i}>
                {g.title && <div className="mb-1 px-4 text-[15px] font-bold text-ink-900">{g.title}</div>}
                {g.items.map((it) => (
                  <NavLink key={it.to} to={it.to} onClick={() => setMenuOpen(false)}
                    className={cx('flex items-center justify-between rounded-md px-4 py-2.5 text-[15px] text-ink-700 hover:bg-chrome-100', isActive(it.to) && 'bg-chrome-200 hover:bg-chrome-200')}>
                    <span>{it.label}</span>{it.badge}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-6 rounded-lg border-2 border-brand-500 p-4">
            {user.role === 'gerente' ? (
              <>
                <div className="text-[17px] font-bold text-ink-900">¿Dudas con una medida?</div>
                <p className="mt-1 text-sm text-ink-700">
                  Tu coordinador/a de RH es <b>{coord?.name ?? 'el área de RH'}</b>. Ninguna sanción se comunica sin su aprobación.
                </p>
                <Button className="mt-3" onClick={() => nav('/biblioteca?cat=procedimiento')}>Ver procedimiento</Button>
              </>
            ) : user.role === 'gerente_area' ? (
              <>
                <div className="text-[17px] font-bold text-ink-900">Vacantes</div>
                <p className="mt-1 text-sm text-ink-700">Autorizás o rechazás los pedidos de tus tiendas; después RH hace la búsqueda y vas viendo cada etapa.</p>
                <Button className="mt-3" onClick={() => nav('/vacantes?f=accion')}>Ver pendientes</Button>
              </>
            ) : (
              <>
                <div className="text-[17px] font-bold text-ink-900">Plazo de revisión</div>
                <p className="mt-1 text-sm text-ink-700">Las solicitudes deben decidirse en {data.policy.review_sla_days} días hábiles desde su envío.</p>
                <Button className="mt-3" onClick={() => nav('/aprobaciones')}>Revisar pendientes</Button>
              </>
            )}
          </div>
        </aside>
        {menuOpen && <div className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMenuOpen(false)} />}

        <main className="min-w-0 flex-1 bg-white px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Count({ n }: { n: number }) {
  return <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[11px] font-bold text-white">{n}</span>;
}

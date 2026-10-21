import {
  BarChart3, Bell, CalendarRange, CheckCircle2, ClipboardCheck, Cloud, Database, FileSpreadsheet, GitCompare,
  LayoutDashboard, LogOut, Menu, RefreshCw, Settings, Store as StoreIcon, Users, X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useData } from '../lib/store';
import { cx } from './ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'gerente'] },
  { to: '/planificacion', label: 'Carga de horarios', icon: CalendarRange, roles: ['admin', 'gerente'] },
  { to: '/tienda', label: 'Dinámica por tienda', icon: BarChart3, roles: ['admin', 'gerente'] },
  { to: '/comparacion', label: 'Comparación de tiendas', icon: GitCompare, roles: ['admin'] },
  { to: '/alertas', label: 'Alertas', icon: Bell, roles: ['admin', 'gerente'] },
  { to: '/aprobaciones', label: 'Estado y aprobaciones', icon: ClipboardCheck, roles: ['admin', 'gerente'] },
  { to: '/empleados', label: 'Empleados', icon: Users, roles: ['admin', 'gerente'] },
  { to: '/reportes', label: 'Exportación y reportes', icon: FileSpreadsheet, roles: ['admin', 'gerente'] },
  { to: '/configuracion', label: 'Tiendas y parámetros', icon: Settings, roles: ['admin', 'gerente'] },
];

function SaveIndicator() {
  const { saveState } = useData();
  if (saveState.status === 'idle') return null;
  if (saveState.status === 'saving') return <span className="flex items-center gap-1 text-xs text-slate-500"><RefreshCw size={13} className="animate-spin" /> Guardando…</span>;
  if (saveState.status === 'error') return <span className="max-w-xs truncate text-xs font-medium text-rose-600" title={saveState.message}>Error al guardar: {saveState.message}</span>;
  return <span className="flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 size={13} /> Borrador guardado {saveState.at ? new Date(saveState.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>;
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, signOut, mode, stores, error } = useData();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const myStore = stores.find((s) => s.id === user.store_id);
  const nav = NAV.filter((n) => n.roles.includes(user.role));

  const sidebar = (
    <nav className="flex h-full flex-col bg-navy-900 text-slate-200">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-teal-500 text-lg font-black text-navy-900">+</div>
        <div>
          <div className="text-base font-semibold text-white">FarmaPlan</div>
          <div className="text-[11px] text-slate-400">Horarios y dinámica de tiendas</div>
        </div>
      </div>
      <ul className="flex-1 space-y-0.5 px-3">
        {nav.map((n) => (
          <li key={n.to}>
            <NavLink
              to={n.to}
              end={n.to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => cx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                isActive ? 'bg-navy-700 font-medium text-white shadow-inner ring-1 ring-teal-500/40' : 'hover:bg-navy-800 hover:text-white',
              )}
            >
              <n.icon size={17} className="shrink-0 text-teal-400" />
              {n.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="m-3 rounded-lg bg-navy-800 p-3 text-xs">
        <div className="font-medium text-white">{user.name}</div>
        <div className="text-slate-400">{user.role === 'admin' ? 'Administrador RR. HH. / Operaciones' : 'Gerente de Tienda'}</div>
        {myStore && <div className="mt-1 flex items-center gap-1 text-slate-300"><StoreIcon size={12} /> {myStore.name}</div>}
        <button onClick={() => void signOut()} className="mt-2 flex items-center gap-1.5 text-teal-300 hover:text-teal-200">
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-navy-950/50" />
          <aside className="absolute left-0 top-0 h-full w-72" onClick={(e) => e.stopPropagation()}>
            {sidebar}
            <button aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute right-3 top-5 text-slate-300"><X /></button>
          </aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur sm:px-6">
          <button aria-label="Abrir menú" onClick={() => setOpen(true)} className="rounded p-1 text-navy-900 lg:hidden"><Menu /></button>
          {mode === 'local' ? (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-300" title="Los datos se guardan en este navegador. Configure Supabase para una base de datos compartida.">
              <Database size={13} /> Modo demostración · datos guardados en este navegador
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
              <Cloud size={13} /> Conectado a Supabase
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            <SaveIndicator />
          </div>
        </header>
        {error && <div className="bg-rose-50 px-6 py-2 text-sm text-rose-700">{error}</div>}
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

import { AlertOctagon, AlertTriangle, ChevronLeft, ChevronRight, Info, X } from 'lucide-react';
import { useEffect, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes } from 'react';
import { MONTHS, STATUS_LABEL, STATUS_STYLE } from '../lib/constants';
import type { AnalysisAlert } from '../lib/calc';
import type { PlanStatus, Store } from '../lib/types';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ title, subtitle, actions, children, className, bodyClass }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={cx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-navy-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint, tone = 'default', icon }: {
  label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad'; icon?: ReactNode;
}) {
  const ring = { default: 'border-slate-200', good: 'border-emerald-200', warn: 'border-amber-300', bad: 'border-rose-300' }[tone];
  return (
    <div className={cx('rounded-xl border bg-white p-4 shadow-sm', ring)}>
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-500">
        <span>{label}</span>
        {icon && <span className="text-teal-600">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold text-navy-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'; size?: 'sm' | 'md';
}) {
  const v = {
    primary: 'bg-navy-800 text-white hover:bg-navy-700 disabled:bg-slate-300',
    accent: 'bg-teal-600 text-white hover:bg-teal-700 disabled:bg-slate-300',
    secondary: 'bg-white text-navy-900 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
    ghost: 'text-navy-800 hover:bg-slate-100 disabled:text-slate-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-slate-300',
  }[variant];
  const s = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm';
  return (
    <button
      {...props}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500', v, s, className)}
    />
  );
}

export function Select({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className={cx('flex flex-col gap-1 text-xs font-medium text-slate-600', className)}>
      {label}
      <select
        {...props}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100"
      >
        {children}
      </select>
    </label>
  );
}

export function Input({ label, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className={cx('flex flex-col gap-1 text-xs font-medium text-slate-600', className)}>
      {label}
      <input
        {...props}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-100"
      />
    </label>
  );
}

export function StatusBadge({ status }: { status: PlanStatus }) {
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1', STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span title="Datos ficticios de demostración" className="ml-1.5 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-300">
      Demo
    </span>
  );
}

export function StoreName({ store }: { store: Store | undefined }) {
  if (!store) return <span>—</span>;
  return (
    <span className="inline-flex items-center">
      {store.name}
      <DemoBadge show={store.is_demo} />
    </span>
  );
}

export function MonthPicker({ year, month, onChange }: { year: number; month: number; onChange: (y: number, m: number) => void }) {
  const move = (d: number) => {
    const idx = year * 12 + (month - 1) + d;
    onChange(Math.floor(idx / 12), (idx % 12) + 1);
  };
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      Mes y año
      <div className="flex items-center gap-1">
        <button aria-label="Mes anterior" onClick={() => move(-1)} className="rounded-lg border border-slate-300 bg-white p-2 hover:bg-slate-50">
          <ChevronLeft size={16} />
        </button>
        <select value={month} onChange={(e) => onChange(year, Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800">
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={year} onChange={(e) => onChange(Number(e.target.value), month)} className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-800">
          {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => <option key={y}>{y}</option>)}
        </select>
        <button aria-label="Mes siguiente" onClick={() => move(1)} className="rounded-lg border border-slate-300 bg-white p-2 hover:bg-slate-50">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function SeverityIcon({ severity, size = 16 }: { severity: 'error' | 'advertencia'; size?: number }) {
  return severity === 'error'
    ? <AlertOctagon size={size} className="shrink-0 text-rose-600" aria-label="Error" />
    : <AlertTriangle size={size} className="shrink-0 text-amber-500" aria-label="Advertencia" />;
}

export function AlertList({ alerts, max, empty = 'Sin alertas para los filtros seleccionados.' }: { alerts: AnalysisAlert[]; max?: number; empty?: string }) {
  if (!alerts.length) {
    return <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><Info size={16} /> {empty}</div>;
  }
  const list = max ? alerts.slice(0, max) : alerts;
  return (
    <ul className="divide-y divide-slate-100">
      {list.map((a, i) => (
        <li key={i} className="flex items-start gap-2 py-2 text-sm">
          <SeverityIcon severity={a.severity} />
          <div className="min-w-0">
            <span className={cx('mr-1.5 text-[10px] font-bold uppercase', a.severity === 'error' ? 'text-rose-700' : 'text-amber-700')}>
              {a.severity === 'error' ? 'Error' : 'Advertencia'}
            </span>
            <span className="text-slate-700">{a.message}</span>
          </div>
        </li>
      ))}
      {max && alerts.length > max && <li className="py-2 text-xs text-slate-500">… y {alerts.length - max} alerta(s) más.</li>}
    </ul>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx('max-h-[92vh] w-full overflow-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3">
          <h2 className="text-base font-semibold text-navy-900">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-navy-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-end gap-2">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">{children}</div>;
}

export function Progress({ value, tone }: { value: number; tone?: 'good' | 'warn' | 'bad' }) {
  const t = tone ?? (value >= 1 ? 'good' : value >= 0.5 ? 'warn' : 'bad');
  const c = { good: 'bg-emerald-500', warn: 'bg-amber-400', bad: 'bg-rose-500' }[t];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full', c)} style={{ width: `${Math.min(100, value * 100)}%` }} />
    </div>
  );
}

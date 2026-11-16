import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import {
  useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { STATUS_LABEL, STATUS_STYLE, type RequestStatus } from '../lib/types';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ title, actions, children, className, bodyClass }: {
  title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string;
}) {
  return (
    <section className={cx('rounded-xl border border-chrome-300 bg-white', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5">
          {title && <h2 className="text-lg font-bold text-ink-900">{title}</h2>}
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </header>
      )}
      <div className={cx('px-6 pb-5 pt-4', bodyClass)}>{children}</div>
    </section>
  );
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'success' | 'link'; size?: 'sm' | 'md';
}) {
  const v = {
    primary: 'rounded-full bg-brand-500 font-bold text-white hover:bg-brand-600 disabled:bg-chrome-300 disabled:text-ink-400',
    outline: 'rounded-full border-2 border-ink-500 font-bold text-ink-700 hover:bg-chrome-100 disabled:border-chrome-300 disabled:text-ink-400',
    ghost: 'rounded-lg text-ink-700 hover:bg-chrome-100 disabled:text-ink-400',
    danger: 'rounded-full bg-rose-600 font-bold text-white hover:bg-rose-700 disabled:bg-chrome-300',
    success: 'rounded-full bg-emerald-600 font-bold text-white hover:bg-emerald-700 disabled:bg-chrome-300',
    link: 'text-brand-500 hover:underline disabled:text-ink-400',
  }[variant];
  const s = variant === 'link' ? 'text-sm' : size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-1.5 text-[15px]';
  return (
    <button
      type="button"
      {...props}
      className={cx('inline-flex items-center justify-center gap-1.5 transition disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1', v, s, className)}
    />
  );
}

const fieldCls = 'w-full rounded-md border border-chrome-300 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-chrome-100';

function Label({ label, required, hint, error, children, className }: {
  label?: ReactNode; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode; className?: string;
}) {
  return (
    <label className={cx('flex flex-col gap-1 text-sm', className)}>
      {label && <span className="font-semibold text-ink-700">{label}{required && <span className="text-rose-600"> *</span>}</span>}
      {children}
      {hint && !error && <span className="text-xs text-ink-400">{hint}</span>}
      {error && <span className="text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

type Common = { label?: ReactNode; required?: boolean; hint?: ReactNode; error?: string; wrapClass?: string };

export function Input({ label, required, hint, error, wrapClass, className, ...p }: InputHTMLAttributes<HTMLInputElement> & Common) {
  return <Label {...{ label, required, hint, error }} className={wrapClass}><input {...p} className={cx(fieldCls, error && 'border-rose-400', className)} /></Label>;
}

export function Textarea({ label, required, hint, error, wrapClass, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & Common) {
  return <Label {...{ label, required, hint, error }} className={wrapClass}><textarea {...p} className={cx(fieldCls, 'min-h-[110px]', error && 'border-rose-400', className)} /></Label>;
}

export function Select({ label, required, hint, error, wrapClass, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & Common) {
  return <Label {...{ label, required, hint, error }} className={wrapClass}><select {...p} className={cx(fieldCls, error && 'border-rose-400', className)}>{children}</select></Label>;
}

export function Checkbox({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-700">
      <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_STYLE[status])}>{STATUS_LABEL[status]}</span>;
}

export function Pill({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'gray' | 'red' | 'green' | 'amber' }) {
  const t = {
    blue: 'bg-brand-600 text-white', gray: 'bg-chrome-200 text-ink-700', red: 'bg-rose-100 text-rose-800',
    green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800',
  }[tone];
  return <span className={cx('inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-bold', t)}>{children}</span>;
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onMouseDown={onClose}>
      <div className={cx('flex max-h-[92vh] w-full flex-col rounded-xl bg-white shadow-2xl', wide ? 'max-w-4xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="flex items-center justify-between border-b border-chrome-200 px-6 py-4">
          <h3 className="text-lg font-bold text-ink-900">{title}</h3>
          <button className="rounded p-1 text-ink-400 hover:bg-chrome-100" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </header>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-chrome-200 px-6 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

export function Notice({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode; title?: ReactNode }) {
  const t = {
    info: 'border-brand-100 bg-brand-50 text-brand-800', warn: 'border-amber-200 bg-amber-50 text-amber-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900', ok: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone];
  const Icon = tone === 'ok' ? CheckCircle2 : AlertTriangle;
  return (
    <div className={cx('flex gap-3 rounded-lg border px-4 py-3 text-sm', t)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{title && <div className="font-bold">{title}</div>}<div className="whitespace-pre-line">{children}</div></div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-chrome-300 px-4 py-10 text-center text-sm text-ink-400">{children}</div>;
}

/** Miniatura de documento, como en los listados de archivos recientes. */
export function DocThumb({ lines = 7, accent, small }: { lines?: number; accent?: string; small?: boolean }) {
  return (
    <div className={cx('relative shrink-0 rounded-sm border border-chrome-300 bg-white p-1 shadow-sm', small ? 'h-11 w-8' : 'h-14 w-11')}>
      {accent && <div className={cx('mb-1 h-1.5 w-full rounded-sm', accent)} />}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="mb-[3px] h-[2px] rounded bg-chrome-300" style={{ width: `${60 + ((i * 37) % 40)}%` }} />
      ))}
    </div>
  );
}

export function PageTitle({ children, sub, actions }: { children: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">{children}</h1>
        {sub && <p className="mt-1 text-sm text-ink-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cx('px-3 py-3 text-left text-xs font-normal uppercase tracking-wide text-ink-500', className)}>{children}</th>;
}
export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx('px-3 py-3 align-middle text-[15px] text-ink-500', className)}>{children}</td>;
}

export function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
export function shortDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

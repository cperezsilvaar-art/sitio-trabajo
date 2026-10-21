import { CheckCircle2, History, MessageSquareWarning, RotateCcw, Send } from 'lucide-react';
import { useState } from 'react';
import type { PlanAnalysis } from '../lib/calc';
import { MONTHS, STATUS_LABEL } from '../lib/constants';
import { fmtDateTime } from '../lib/dates';
import { useData } from '../lib/store';
import type { HistoryItem } from '../lib/types';
import { Button, Modal, Progress, StatusBadge } from './ui';

export const ACTION_LABEL: Record<HistoryItem['action'], string> = {
  creacion: 'Inicio de la carga',
  edicion: 'Edición de horarios',
  envio: 'Enviada para revisión',
  observacion: 'Devuelta con observaciones',
  aprobacion: 'Aprobada',
  reapertura: 'Reabierta para edición',
  edicion_post_envio: 'Modificada después del envío',
};

export function PlanWorkflow({ storeId, year, month, a }: { storeId: string; year: number; month: number; a: PlanAnalysis | null }) {
  const { user, planFor, transitionPlan, history, canEditStore } = useData();
  const plan = planFor(storeId, year, month);
  const status = plan?.status ?? 'pendiente';
  const [dialog, setDialog] = useState<null | 'enviar' | 'observar' | 'aprobar' | 'reabrir' | 'historial'>(null);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isAdmin = user?.role === 'admin';
  const editable = canEditStore(storeId);
  const items = history.filter((h) => h.plan_id === plan?.id);

  const run = async (to: Parameters<typeof transitionPlan>[3]) => {
    setBusy(true);
    setErr(null);
    try {
      await transitionPlan(storeId, year, month, to, comment);
      setDialog(null);
      setComment('');
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = editable && (status === 'en_preparacion' || status === 'observada');
  const errors = a?.errors ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <div className="text-xs text-slate-500">Estado de la planificación · {MONTHS[month - 1]} {year}</div>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={status} />
            {plan?.changed_after_submit && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Cambios posteriores al envío</span>}
          </div>
        </div>
        <div className="min-w-[10rem] flex-1">
          <div className="flex justify-between text-xs text-slate-500"><span>Carga completa</span><span className="font-medium text-navy-900">{Math.round((a?.completeness ?? 0) * 100)}%</span></div>
          <div className="mt-1.5"><Progress value={a?.completeness ?? 0} /></div>
        </div>
        <div className="text-xs text-slate-500">
          <div><span className="font-semibold text-rose-700">{errors}</span> error(es) · <span className="font-semibold text-amber-700">{a?.warnings ?? 0}</span> advertencia(s)</div>
          <div>Último cambio: {fmtDateTime(plan?.updated_at)} {plan?.updated_by_name && `· ${plan.updated_by_name}`}</div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDialog('historial')}><History size={14} /> Historial ({items.length})</Button>
          {canSubmit && <Button size="sm" variant="accent" onClick={() => setDialog('enviar')}><Send size={14} /> Enviar para revisión</Button>}
          {isAdmin && (status === 'enviada' || status === 'observada') && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setDialog('observar')}><MessageSquareWarning size={14} /> Observar</Button>
              <Button size="sm" disabled={errors > 0} title={errors > 0 ? 'Hay errores que impiden aprobar' : ''} onClick={() => setDialog('aprobar')}><CheckCircle2 size={14} /> Aprobar</Button>
            </>
          )}
          {isAdmin && status === 'aprobada' && <Button size="sm" variant="secondary" onClick={() => setDialog('reabrir')}><RotateCcw size={14} /> Reabrir</Button>}
        </div>
      </div>
      {status === 'observada' && plan?.last_comment && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="font-semibold">Observaciones de RR. HH.:</span> {plan.last_comment}
        </div>
      )}
      {status === 'aprobada' && (
        <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Planificación aprobada el {fmtDateTime(plan?.approved_at)}. Para modificarla, un administrador debe reabrirla.</div>
      )}

      <Modal
        open={dialog === 'enviar' || dialog === 'observar' || dialog === 'aprobar' || dialog === 'reabrir'}
        title={{ enviar: 'Enviar para revisión', observar: 'Devolver con observaciones', aprobar: 'Aprobar planificación', reabrir: 'Reabrir planificación' }[dialog as 'enviar'] ?? ''}
        onClose={() => { setDialog(null); setErr(null); }}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button disabled={busy} variant={dialog === 'observar' ? 'danger' : 'primary'}
              onClick={() => run(dialog === 'enviar' ? 'enviada' : dialog === 'observar' ? 'observada' : dialog === 'aprobar' ? 'aprobada' : 'en_preparacion')}>
              Confirmar
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {dialog === 'enviar' && errors > 0 && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800">
              La planificación tiene <b>{errors} error(es)</b>. Podés enviarla, pero RR. HH. no podrá aprobarla hasta que se corrijan.
            </div>
          )}
          {dialog === 'enviar' && <p>Se registrará el envío con tu usuario y la fecha actual. Si después modificás horarios, quedará marcado como cambio posterior al envío.</p>}
          {dialog === 'aprobar' && <p>Se aprobará la planificación con {a?.warnings ?? 0} advertencia(s). Quedará bloqueada para edición.</p>}
          {dialog === 'reabrir' && <p>La planificación volverá a "{STATUS_LABEL.en_preparacion}" y el gerente podrá modificarla.</p>}
          <label className="block text-xs font-medium text-slate-600">
            {dialog === 'observar' ? 'Observaciones (obligatorio)' : 'Comentario (opcional)'}
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-teal-500 focus:outline-none" />
          </label>
          {err && <div className="rounded-lg bg-rose-50 px-3 py-2 text-rose-700">{err}</div>}
        </div>
      </Modal>

      <Modal open={dialog === 'historial'} title="Historial de cambios y aprobaciones" onClose={() => setDialog(null)} wide>
        {items.length ? (
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {items.map((h) => (
              <li key={h.id}>
                <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-teal-500" />
                <div className="text-sm font-medium text-navy-900">{ACTION_LABEL[h.action]}</div>
                <div className="text-xs text-slate-500">{fmtDateTime(h.at)} · {h.user_name ?? 'Usuario desconocido'}{h.to_status && h.from_status !== h.to_status && ` · ${STATUS_LABEL[h.from_status ?? 'pendiente']} → ${STATUS_LABEL[h.to_status]}`}</div>
                {h.comment && <div className="mt-1 text-sm text-slate-700">{h.comment}</div>}
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-slate-500">Todavía no hay movimientos registrados para este mes.</p>}
      </Modal>
    </div>
  );
}

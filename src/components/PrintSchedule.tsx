import { Printer } from 'lucide-react';
import { useState } from 'react';
import { MONTHS } from '../lib/constants';
import { pad } from '../lib/dates';
import { downloadSchedulePdf, type PrintLayout } from '../lib/printSchedule';
import { useAnalysis, useData } from '../lib/store';
import { Button, Modal, cx } from './ui';

const LAYOUTS: { id: PrintLayout; title: string; desc: string }[] = [
  { id: 'a4-quincenas', title: 'A4 apaisado · por quincena', desc: 'Dos hojas (días 1–15 y 16 a fin de mes). Letra más grande; recomendado para impresoras comunes.' },
  { id: 'a3-mes', title: 'A3 apaisado · mes completo', desc: 'Todo el mes en una sola hoja grande, ideal para cartelera.' },
  { id: 'a4-mes', title: 'A4 apaisado · mes completo', desc: 'Todo el mes en una hoja A4. Letra pequeña.' },
];

/** Botón + diálogo para generar la planilla mensual imprimible con firmas. */
export function PrintScheduleButton({ storeId, year, month, size = 'sm', variant = 'secondary' }: {
  storeId: string; year: number; month: number; size?: 'sm' | 'md'; variant?: 'secondary' | 'primary' | 'accent';
}) {
  const { stores, employees, entriesFor, planFor, profiles } = useData();
  const a = useAnalysis(storeId, year, month);
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<PrintLayout>('a4-quincenas');
  const [signature, setSignature] = useState(true);
  const [notes, setNotes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const store = stores.find((s) => s.id === storeId);
  const plan = planFor(storeId, year, month);
  if (!store) return null;

  const run = async () => {
    if (!a) return;
    setBusy(true);
    setMsg(null);
    try {
      const manager = profiles.find((p) => p.role === 'gerente' && p.store_id === storeId);
      await downloadSchedulePdf({
        store, a, plan,
        employees: employees.filter((e) => e.store_id === storeId),
        entries: entriesFor(storeId, year, month).filter((e) => e.date.startsWith(`${year}-${pad(month)}`)),
        managerName: manager?.name ?? null,
      }, { layout, signature, notes });
      setMsg({ ok: true, text: 'PDF generado. Abrilo e imprimilo desde tu visor de PDF.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size={size} variant={variant} onClick={() => { setMsg(null); setOpen(true); }}><Printer size={15} /> Imprimir planilla</Button>
      <Modal open={open} title={`Planilla para cartelera · ${MONTHS[month - 1]} ${year}`} onClose={() => setOpen(false)}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cerrar</Button><Button disabled={busy || !a} onClick={() => void run()}><Printer size={15} /> {busy ? 'Generando…' : 'Descargar PDF para imprimir'}</Button></>}>
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">Se genera un PDF con los horarios de <b>{store.name}</b>, listo para imprimir, colgar en la cartelera y que cada empleado firme su notificación.</p>
          {plan?.status !== 'aprobada' && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-200">
              La planificación todavía no está aprobada: la planilla saldrá marcada como <b>BORRADOR</b>. Conviene imprimir la versión definitiva una vez aprobada.
            </div>
          )}
          {a && a.completeness < 1 && <div className="rounded-lg bg-rose-50 px-3 py-2 text-rose-800">Hay días sin cargar ({Math.round(a.completeness * 100)}% completo): aparecerán vacíos en la planilla.</div>}
          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium text-slate-600">Formato de hoja</legend>
            {LAYOUTS.map((l) => (
              <label key={l.id} className={cx('flex cursor-pointer gap-3 rounded-lg p-3 ring-1', layout === l.id ? 'bg-teal-50 ring-teal-500' : 'ring-slate-200 hover:ring-slate-300')}>
                <input type="radio" name="layout" checked={layout === l.id} onChange={() => setLayout(l.id)} className="mt-1" />
                <span><span className="font-medium text-navy-900">{l.title}</span><span className="block text-xs text-slate-500">{l.desc}</span></span>
              </label>
            ))}
          </fieldset>
          <label className="flex items-center gap-2"><input type="checkbox" checked={signature} onChange={(e) => setSignature(e.target.checked)} /> Columna de firma de cada empleado</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={notes} onChange={(e) => setNotes(e.target.checked)} /> Incluir observaciones de los turnos</label>
          <p className="text-xs text-slate-500">Incluye también referencias, firma y aclaración del gerente y fecha de publicación en cartelera.</p>
          {msg && <div className={cx('rounded-lg px-3 py-2', msg.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-700')}>{msg.text}</div>}
        </div>
      </Modal>
    </>
  );
}

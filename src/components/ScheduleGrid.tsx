import { ClipboardPaste, Copy, Eraser, Pencil, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import type { PlanAnalysis } from '../lib/calc';
import { KIND_CELL_STYLE, KIND_LABEL, POSITIONS, POSITION_BY_ID, POSITION_COLORS, WEEKDAYS_SHORT } from '../lib/constants';
import { fmtHours, weekday } from '../lib/dates';
import { cellText, entryLabel, parseCellInput, stripEntry } from '../lib/parse';
import type { CellChange } from '../lib/store';
import type { Employee, Entry, EntryKind, PositionId, Store } from '../lib/types';
import { Button, Input, Modal, Select, cx } from './ui';

export type CellEntries = CellChange['entries'];

interface Props {
  store: Store;
  employees: Employee[];
  dates: string[];
  entries: Entry[];
  analysis: PlanAnalysis | null;
  readOnly: boolean;
  onChange: (changes: CellChange[]) => void;
  presets: [string, string][];
}

const key = (r: number, c: number) => `${r}:${c}`;

export function ScheduleGrid({ store, employees, dates, entries, analysis, readOnly, onChange, presets }: Props) {
  const cells = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = `${e.employee_id}|${e.date}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    for (const l of m.values()) l.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
    return m;
  }, [entries]);

  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [anchor, setAnchor] = useState<{ r: number; c: number } | null>(null);
  const [extra, setExtra] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ r: number; c: number; text: string; invalid?: boolean } | null>(null);
  const [modal, setModal] = useState(false);
  const [showPos, setShowPos] = useState(false);
  const undo = useRef<CellChange[][]>([]);
  const clip = useRef<CellEntries[][] | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [customStart, setCustomStart] = useState('08:00');
  const [customEnd, setCustomEnd] = useState('16:00');

  const rows = employees.length;
  const cols = dates.length;

  const selected = useMemo(() => {
    const s = new Set(extra);
    const a = anchor ?? focus;
    for (let r = Math.min(a.r, focus.r); r <= Math.max(a.r, focus.r); r++)
      for (let c = Math.min(a.c, focus.c); c <= Math.max(a.c, focus.c); c++) s.add(key(r, c));
    return s;
  }, [anchor, focus, extra]);

  const selectedCells = useCallback(
    () => [...selected].map((k) => k.split(':').map(Number) as [number, number]).filter(([r, c]) => r < rows && c < cols),
    [selected, rows, cols],
  );

  const getCell = useCallback((r: number, c: number) => cells.get(`${employees[r]?.id}|${dates[c]}`) ?? [], [cells, employees, dates]);

  /** Aplica cambios registrando el estado previo para deshacer. */
  const apply = useCallback((changes: CellChange[]) => {
    if (readOnly || !changes.length) return;
    const inverse: CellChange[] = changes.map((ch) => ({
      employee_id: ch.employee_id, date: ch.date,
      entries: (cells.get(`${ch.employee_id}|${ch.date}`) ?? []).map(stripEntry),
    }));
    undo.current.push(inverse);
    if (undo.current.length > 50) undo.current.shift();
    onChange(changes);
  }, [readOnly, cells, onChange]);

  const applyToSelection = useCallback((list: CellEntries) => {
    apply(selectedCells().map(([r, c]) => ({ employee_id: employees[r].id, date: dates[c], entries: list.map((x) => ({ ...x })) })));
  }, [apply, selectedCells, employees, dates]);

  const doUndo = () => {
    const last = undo.current.pop();
    if (last) onChange(last);
  };

  const copySel = (): string => {
    const sc = selectedCells();
    if (!sc.length) return '';
    const r0 = Math.min(...sc.map((x) => x[0])), r1 = Math.max(...sc.map((x) => x[0]));
    const c0 = Math.min(...sc.map((x) => x[1])), c1 = Math.max(...sc.map((x) => x[1]));
    const data: CellEntries[][] = [];
    for (let r = r0; r <= r1; r++) {
      const row: CellEntries[] = [];
      for (let c = c0; c <= c1; c++) row.push(getCell(r, c).map(stripEntry));
      data.push(row);
    }
    clip.current = data;
    return data.map((row) => row.map((cell) => cellText(cell)).join('\t')).join('\n');
  };

  const pasteData = (data: CellEntries[][]) => {
    const sc = selectedCells();
    const r0 = sc.length ? Math.min(...sc.map((x) => x[0])) : focus.r;
    const c0 = sc.length ? Math.min(...sc.map((x) => x[1])) : focus.c;
    const r1 = sc.length ? Math.max(...sc.map((x) => x[0])) : r0;
    const c1 = sc.length ? Math.max(...sc.map((x) => x[1])) : c0;
    const h = data.length, w = data[0]?.length ?? 0;
    if (!h || !w) return;
    // si la selección es más grande que lo copiado, se repite el patrón (p. ej. copiar un día a varios días)
    const rr = Math.max(r1 - r0 + 1, h), cc = Math.max(c1 - c0 + 1, w);
    const changes: CellChange[] = [];
    for (let i = 0; i < rr && r0 + i < rows; i++)
      for (let j = 0; j < cc && c0 + j < cols; j++)
        changes.push({ employee_id: employees[r0 + i].id, date: dates[c0 + j], entries: data[i % h][j % w].map((x) => ({ ...x })) });
    apply(changes);
  };

  const onCopy = (e: ClipboardEvent) => {
    if (editing) return;
    e.preventDefault();
    e.clipboardData.setData('text/plain', copySel());
  };

  const onPaste = (e: ClipboardEvent) => {
    if (editing || readOnly) return;
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const internalText = clip.current?.map((row) => row.map((cell) => cellText(cell)).join('\t')).join('\n');
    if (clip.current && text.replace(/\r/g, '').trim() === (internalText ?? '').trim()) return pasteData(clip.current);
    const data = text.replace(/\r/g, '').split('\n').filter((l, i, arr) => l || i < arr.length - 1).map((l) => l.split('\t').map((t) => parseCellInput(t) ?? []));
    pasteData(data);
  };

  const commitEdit = () => {
    if (!editing) return;
    const parsed = parseCellInput(editing.text);
    if (!parsed) {
      setEditing({ ...editing, invalid: true });
      return;
    }
    const existing = getCell(editing.r, editing.c);
    // conservar posición y observaciones al reescribir el horario
    const merged = parsed.map((p, i) => ({ ...p, position_id: existing[i]?.position_id ?? null, notes: existing[i]?.notes ?? null }));
    const sc = selectedCells();
    const targets = sc.length > 1 && sc.some(([r, c]) => r === editing.r && c === editing.c) ? sc : [[editing.r, editing.c] as [number, number]];
    apply(targets.map(([r, c]) => ({ employee_id: employees[r].id, date: dates[c], entries: merged.map((x) => ({ ...x })) })));
    setEditing(null);
    move(1, 0, false);
    gridRef.current?.focus();
  };

  const move = (dr: number, dc: number, extend: boolean) => {
    setFocus((f) => {
      const n = { r: Math.max(0, Math.min(rows - 1, f.r + dr)), c: Math.max(0, Math.min(cols - 1, f.c + dc)) };
      if (extend) setAnchor((a) => a ?? f);
      else setAnchor(null);
      return n;
    });
    if (!extend) setExtra(new Set());
  };

  const onKey = (e: KeyboardEvent) => {
    if (editing || modal) return;
    const mod = e.ctrlKey || e.metaKey;
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1], Tab: [0, e.shiftKey ? -1 : 1] };
    if (arrows[e.key]) {
      e.preventDefault();
      move(arrows[e.key][0], arrows[e.key][1], e.shiftKey && e.key !== 'Tab');
    } else if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      doUndo();
    } else if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setAnchor({ r: 0, c: 0 });
      setFocus({ r: rows - 1, c: cols - 1 });
    } else if (readOnly) {
      return;
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      applyToSelection([]);
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      if (e.shiftKey) setModal(true);
      else setEditing({ ...focus, text: cellText(getCell(focus.r, focus.c)) });
    } else if (e.key === 'Escape') {
      setAnchor(null);
      setExtra(new Set());
    } else if (!mod && e.key.length === 1 && /[0-9a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      setEditing({ ...focus, text: e.key });
    }
  };

  const onCellMouseDown = (r: number, c: number, ev: React.MouseEvent) => {
    if (editing && (editing.r !== r || editing.c !== c)) commitEditSilently();
    if (ev.shiftKey) {
      setAnchor((a) => a ?? focus);
      setFocus({ r, c });
    } else if (ev.ctrlKey || ev.metaKey) {
      setExtra((s) => {
        const n = new Set(s);
        selected.forEach((k) => n.add(k));
        const k = key(r, c);
        if (n.has(k)) n.delete(k);
        else n.add(k);
        return n;
      });
      setAnchor({ r, c });
      setFocus({ r, c });
    } else {
      setExtra(new Set());
      setAnchor({ r, c });
      setFocus({ r, c });
      dragging.current = true;
    }
  };
  const dragging = useRef(false);
  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, []);

  const commitEditSilently = () => {
    if (!editing) return;
    const parsed = parseCellInput(editing.text);
    if (parsed) apply([{ employee_id: employees[editing.r].id, date: dates[editing.c], entries: parsed }]);
    setEditing(null);
  };

  const selectColumn = (c: number) => {
    setExtra(new Set());
    setAnchor({ r: 0, c });
    setFocus({ r: rows - 1, c });
    gridRef.current?.focus();
  };
  const selectRow = (r: number) => {
    setExtra(new Set());
    setAnchor({ r, c: 0 });
    setFocus({ r, c: cols - 1 });
    gridRef.current?.focus();
  };

  // celdas con error (superposición / turno incompleto)
  const errorCells = useMemo(() => {
    const s = new Set<string>();
    analysis?.alerts.forEach((a) => {
      if (a.severity === 'error' && a.employee_id && a.date) s.add(`${a.employee_id}|${a.date}`);
    });
    return s;
  }, [analysis]);
  const problemDays = useMemo(() => new Set(analysis?.problemDays ?? []), [analysis]);

  const posGroups = useMemo(() => {
    const out: { pos: PositionId; start: number }[] = [];
    employees.forEach((e, i) => {
      if (!out.length || out[out.length - 1].pos !== e.position_id) out.push({ pos: e.position_id, start: i });
    });
    return out;
  }, [employees]);

  const quick = (kind: EntryKind) => applyToSelection([{ kind, start: null, end: null, position_id: null, notes: null }]);

  return (
    <div>
      {/* Barra de herramientas */}
      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
          <span className="px-1 text-xs font-medium text-slate-500">Aplicar a la selección ({selected.size}):</span>
          {presets.map(([s, e]) => (
            <Button key={s + e} size="sm" variant="secondary" onClick={() => applyToSelection([{ kind: 'turno', start: s, end: e, position_id: null, notes: null }])}>
              {entryLabel({ kind: 'turno', start: s, end: e })}
            </Button>
          ))}
          <div className="flex items-center gap-1 rounded-lg bg-slate-50 px-1.5 py-1 ring-1 ring-slate-200">
            <input aria-label="Entrada" type="time" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[6.75rem] rounded border border-slate-300 px-1 py-0.5 text-xs" />
            <span className="text-xs">a</span>
            <input aria-label="Salida" type="time" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[6.75rem] rounded border border-slate-300 px-1 py-0.5 text-xs" />
            <Button size="sm" variant="accent" disabled={!customStart || !customEnd || customStart === customEnd} onClick={() => applyToSelection([{ kind: 'turno', start: customStart, end: customEnd, position_id: null, notes: null }])}>Aplicar</Button>
          </div>
          <Button size="sm" variant="secondary" onClick={() => quick('franco')}>Franco</Button>
          <Button size="sm" variant="secondary" onClick={() => quick('vacaciones')}>Vacaciones</Button>
          <Button size="sm" variant="secondary" onClick={() => quick('licencia')}>Licencia</Button>
          <Button size="sm" variant="secondary" onClick={() => quick('ausencia')}>Ausencia</Button>
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
          <Button size="sm" variant="ghost" title="Editar en detalle (Shift+Enter)" onClick={() => setModal(true)}><Pencil size={14} /> Detalle</Button>
          <Button size="sm" variant="ghost" title="Copiar (Ctrl+C)" onClick={() => { const t = copySel(); void navigator.clipboard?.writeText(t).catch(() => undefined); }}><Copy size={14} /> Copiar</Button>
          <Button size="sm" variant="ghost" title="Pegar (Ctrl+V)" disabled={!clip.current} onClick={() => clip.current && pasteData(clip.current)}><ClipboardPaste size={14} /> Pegar</Button>
          <Button size="sm" variant="ghost" title="Borrar (Supr)" onClick={() => applyToSelection([])}><Eraser size={14} /> Borrar</Button>
          <Button size="sm" variant="ghost" title="Deshacer (Ctrl+Z)" onClick={doUndo}><Undo2 size={14} /> Deshacer</Button>
        </div>
      )}

      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={onKey}
        onCopy={onCopy}
        onPaste={onPaste}
        className="relative max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
      >
        <table className="border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className="sticky left-0 z-30 min-w-[11rem] border-b border-r border-slate-200 bg-navy-900 px-3 py-2 text-left font-medium text-white sm:min-w-[14rem]">
                Empleado / posición
              </th>
              <th className="border-b border-r border-slate-200 bg-navy-900 px-2 py-2 font-medium text-white" title="Horas planificadas / horas contractuales del mes">Horas</th>
              {dates.map((d, c) => {
                const wd = weekday(d);
                const closed = store.hours[wd]?.closed;
                return (
                  <th
                    key={d}
                    onClick={() => selectColumn(c)}
                    title={closed ? 'Tienda cerrada' : problemDays.has(d) ? 'Día con problemas de cobertura' : 'Seleccionar día'}
                    className={cx(
                      'min-w-[3.6rem] cursor-pointer border-b border-r border-slate-200 px-1 py-1.5 text-center font-medium',
                      problemDays.has(d) ? 'bg-rose-700 text-white' : wd === 0 || wd === 6 ? 'bg-navy-700 text-white' : 'bg-navy-800 text-white',
                    )}
                  >
                    <div className="text-[10px] font-normal opacity-80">{WEEKDAYS_SHORT[wd]}</div>
                    <div>{Number(d.slice(8))}</div>
                    {closed && <div className="text-[9px] font-normal opacity-80">cerrado</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, r) => {
              const group = posGroups.find((g) => g.start === r);
              const hours = analysis?.hoursByEmployee[emp.id] ?? 0;
              const contract = analysis?.contractByEmployee[emp.id];
              const diffPct = contract ? (hours - contract) / contract : 0;
              return [
                group && (
                  <tr key={`g-${group.pos}`}>
                    <td colSpan={cols + 2} className="sticky left-0 border-b border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: POSITION_COLORS[group.pos] }} />
                      {POSITION_BY_ID[group.pos].name}
                    </td>
                  </tr>
                ),
                <tr key={emp.id}>
                  <td
                    onClick={() => selectRow(r)}
                    className={cx('sticky left-0 z-10 cursor-pointer border-b border-r border-slate-200 bg-white px-3 py-1.5', !emp.active && 'opacity-60')}
                  >
                    <div className="truncate font-medium text-navy-900" title={emp.name}>{emp.name}</div>
                    <div className="text-[10px] text-slate-500">{POSITION_BY_ID[emp.position_id].short}{!emp.active && ' · inactivo'}</div>
                  </td>
                  <td className="whitespace-nowrap border-b border-r border-slate-200 px-2 text-center tabular-nums" title={contract ? `Contrato: ${fmtHours(contract)} h en el mes` : 'Sin horas contractuales cargadas'}>
                    <div className="font-semibold text-navy-900">{fmtHours(hours)}</div>
                    {contract ? (
                      <div className={cx('text-[10px]', Math.abs(diffPct) > 0.1 ? 'text-amber-700' : 'text-slate-400')}>/ {fmtHours(contract, 0)}</div>
                    ) : <div className="text-[10px] text-slate-300">—</div>}
                  </td>
                  {dates.map((d, c) => {
                    const list = getCell(r, c);
                    const isSel = selected.has(key(r, c));
                    const isFocus = focus.r === r && focus.c === c;
                    const isEdit = editing && editing.r === r && editing.c === c;
                    const wd = weekday(d);
                    const hasErr = errorCells.has(`${emp.id}|${d}`);
                    const kind = list[0]?.kind;
                    const posOverride = list.find((x) => x.position_id && x.position_id !== emp.position_id)?.position_id;
                    return (
                      <td
                        key={d}
                        onMouseDown={(ev) => onCellMouseDown(r, c, ev)}
                        onMouseEnter={() => dragging.current && setFocus({ r, c })}
                        onDoubleClick={() => !readOnly && setModal(true)}
                        title={list.map((x) => `${KIND_LABEL[x.kind]} ${x.start ? `${x.start}–${x.end}` : ''}${x.position_id ? ` · cubre ${POSITION_BY_ID[x.position_id].name}` : ''}${x.notes ? ` · ${x.notes}` : ''}`).join('\n') || 'Sin cargar'}
                        className={cx(
                          'relative h-11 cursor-cell select-none border-b border-r border-slate-200 p-0 text-center align-middle',
                          kind ? KIND_CELL_STYLE[kind] : wd === 0 || wd === 6 ? 'bg-slate-50' : 'bg-white',
                          isSel && 'outline outline-2 -outline-offset-2 outline-teal-500/60 !bg-teal-100',
                          isFocus && 'outline outline-2 -outline-offset-2 outline-teal-600',
                        )}
                      >
                        {isEdit ? (
                          <input
                            autoFocus
                            value={editing.text}
                            onChange={(e) => setEditing({ ...editing, text: e.target.value, invalid: false })}
                            onKeyDown={(e) => {
                              e.stopPropagation();
                              if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commitEdit(); }
                              if (e.key === 'Escape') { setEditing(null); gridRef.current?.focus(); }
                            }}
                            onBlur={() => commitEditSilently()}
                            className={cx('absolute inset-0 z-10 w-full min-w-[6rem] border-2 bg-white px-1 text-xs focus:outline-none', editing.invalid ? 'border-rose-500' : 'border-teal-600')}
                            placeholder="8-16 / f / v"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center leading-tight">
                            {list.map((x) => (
                              <span key={x.id} className={cx('whitespace-nowrap', x.kind === 'turno' ? 'font-medium tabular-nums' : 'text-[10px] font-bold')}>
                                {entryLabel(x)}
                              </span>
                            ))}
                          </div>
                        )}
                        {hasErr && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-rose-600" aria-label="Error" />}
                        {list.some((x) => x.notes) && <span className="absolute left-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-sky-500" aria-label="Con observaciones" />}
                        {posOverride && <span className="absolute bottom-0 left-0 right-0 h-1" style={{ background: POSITION_COLORS[posOverride] }} />}
                      </td>
                    );
                  })}
                </tr>,
              ];
            })}
          </tbody>
          {analysis && (
            <tfoot className="sticky bottom-0 z-20">
              <tr>
                <td className="sticky left-0 z-30 border-t-2 border-r border-slate-300 bg-slate-100 px-3 py-1.5 font-semibold text-navy-900">
                  Personas trabajando
                  <button onClick={() => setShowPos((s) => !s)} className="ml-2 text-[10px] font-medium text-teal-700 underline">{showPos ? 'ocultar posiciones' : 'ver por posición'}</button>
                </td>
                <td className="border-t-2 border-r border-slate-300 bg-slate-100 text-center font-semibold tabular-nums">{fmtHours(analysis.totalHours, 0)} h</td>
                {dates.map((d, c) => (
                  <td key={d} className={cx('border-t-2 border-r border-slate-300 py-1 text-center tabular-nums', problemDays.has(d) ? 'bg-rose-50 font-bold text-rose-700' : 'bg-slate-100 font-semibold text-navy-900')}>
                    {analysis.workingByDay[c]}
                    <div className="text-[9px] font-normal text-slate-500">{fmtHours(analysis.hoursByDay[c], 0)} h</div>
                  </td>
                ))}
              </tr>
              {showPos && POSITIONS.map((p) => (
                <tr key={p.id}>
                  <td className="sticky left-0 z-30 border-r border-t border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-600">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: POSITION_COLORS[p.id] }} />{p.name}
                  </td>
                  <td className="border-r border-t border-slate-200 bg-slate-50 text-center text-[11px] tabular-nums">{fmtHours(analysis.hoursByPosition[p.id], 0)} h</td>
                  {dates.map((d, c) => (
                    <td key={d} className={cx('border-r border-t border-slate-200 bg-slate-50 text-center text-[11px] tabular-nums', analysis.posByDay[p.id][c] === 0 && 'text-rose-600')}>{analysis.posByDay[p.id][c]}</td>
                  ))}
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Escribí directamente en una celda: <code>8-16</code>, <code>8:30-17</code>, <code>22-6</code> (nocturno), <code>8-12 15-19</code> (cortado), <code>f</code> franco, <code>v</code> vacaciones, <code>l</code> licencia, <code>a</code> ausencia. Shift/Ctrl + clic o arrastrar para seleccionar varias celdas; clic en el día o en el empleado para seleccionar la columna o la fila. Ctrl+C / Ctrl+V copian y pegan (también desde Excel); si la selección destino es mayor, el patrón se repite. Los cambios se guardan automáticamente.
      </p>

      {modal && (
        <CellEditor
          employees={employees}
          cells={selectedCells().map(([r, c]) => ({ emp: employees[r], date: dates[c], list: getCell(r, c) }))}
          onClose={() => { setModal(false); gridRef.current?.focus(); }}
          onSave={(list) => { applyToSelection(list); setModal(false); gridRef.current?.focus(); }}
        />
      )}
    </div>
  );
}

function CellEditor({ cells, onClose, onSave }: {
  employees: Employee[];
  cells: { emp: Employee; date: string; list: Entry[] }[];
  onClose: () => void;
  onSave: (list: CellEntries) => void;
}) {
  const first = cells[0];
  const base = first?.list ?? [];
  const [kind, setKind] = useState<EntryKind>(base[0]?.kind ?? 'turno');
  const [s1, setS1] = useState(base[0]?.start ?? '08:00');
  const [e1, setE1] = useState(base[0]?.end ?? '16:00');
  const [split, setSplit] = useState(base.length > 1);
  const [s2, setS2] = useState(base[1]?.start ?? '17:00');
  const [e2, setE2] = useState(base[1]?.end ?? '21:00');
  const [pos, setPos] = useState<PositionId | ''>(base[0]?.position_id ?? '');
  const [notes, setNotes] = useState(base[0]?.notes ?? '');
  if (!first) return null;

  const list: CellEntries = kind === 'turno'
    ? [
        { kind, start: s1, end: e1, position_id: pos || null, notes: notes || null },
        ...(split ? [{ kind, start: s2, end: e2, position_id: pos || null, notes: notes || null }] : []),
      ]
    : [{ kind, start: null, end: null, position_id: null, notes: notes || null }];

  // vista previa de horas y superposición
  const preview = analyzePreview(list);
  const invalid = kind === 'turno' && (!s1 || !e1 || s1 === e1 || (split && (!s2 || !e2 || s2 === e2)));

  return (
    <Modal
      open
      title={cells.length > 1 ? `Editar ${cells.length} celdas` : `${first.emp.name} · ${first.date.split('-').reverse().join('/')}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={() => onSave([])}><Eraser size={14} /> Borrar</Button>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={invalid} onClick={() => onSave(list)}>Guardar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(KIND_LABEL) as EntryKind[]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={cx('rounded-lg px-3 py-1.5 text-sm ring-1', kind === k ? 'bg-navy-800 text-white ring-navy-800' : 'bg-white text-slate-700 ring-slate-300 hover:ring-teal-500')}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        {kind === 'turno' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Horario de entrada" type="time" value={s1} onChange={(e) => setS1(e.target.value)} />
              <Input label="Horario de salida" type="time" value={e1} onChange={(e) => setE1(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={split} onChange={(e) => setSplit(e.target.checked)} /> Turno cortado (segundo tramo)
            </label>
            {split && (
              <div className="grid grid-cols-2 gap-3">
                <Input label="Entrada 2º tramo" type="time" value={s2} onChange={(e) => setS2(e.target.value)} />
                <Input label="Salida 2º tramo" type="time" value={e2} onChange={(e) => setE2(e.target.value)} />
              </div>
            )}
            <Select label="Posición cubierta en el turno" value={pos} onChange={(e) => setPos(e.target.value as PositionId | '')}>
              <option value="">Posición habitual del empleado</option>
              {POSITIONS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <div className={cx('rounded-lg px-3 py-2 text-sm', preview.overlap ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600')}>
              {fmtHours(preview.hours)} h en el día{preview.overnight && ' · termina al día siguiente'}{preview.overlap && ' · los tramos se superponen'}
            </div>
          </>
        )}
        <Input label="Observaciones" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
      </div>
    </Modal>
  );
}

function analyzePreview(list: CellEntries) {
  let hours = 0;
  let overnight = false;
  const iv: [number, number][] = [];
  for (const e of list) {
    if (e.kind !== 'turno' || !e.start || !e.end) continue;
    const [sh, sm] = e.start.split(':').map(Number);
    const [eh, em] = e.end.split(':').map(Number);
    const s = sh * 60 + sm;
    let en = eh * 60 + em;
    if (en <= s) { en += 1440; overnight = true; }
    hours += (en - s) / 60;
    iv.push([s, en]);
  }
  iv.sort((a, b) => a[0] - b[0]);
  const overlap = iv.some((x, i) => i > 0 && x[0] < iv[i - 1][1]);
  return { hours, overnight, overlap };
}

/** Turnos más usados de la tienda (para botones rápidos). */
export function frequentShifts(entries: Entry[], store: Store): [string, string][] {
  const count = new Map<string, number>();
  for (const e of entries) if (e.kind === 'turno' && e.start && e.end) count.set(`${e.start}|${e.end}`, (count.get(`${e.start}|${e.end}`) ?? 0) + 1);
  const top = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k.split('|') as [string, string]);
  if (top.length) return top;
  const h = store.hours.find((x) => !x.closed);
  if (!h) return [['08:00', '16:00']];
  const [oh, om] = h.open.split(':').map(Number);
  const o = oh * 60 + om;
  const f = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return [[f(o), f(o + 480)], [f(o + 360), f(o + 840)]];
}


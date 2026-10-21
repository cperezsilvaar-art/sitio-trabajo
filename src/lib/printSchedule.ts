import { jsPDF } from 'jspdf';
import autoTable, { type CellDef, type RowInput } from 'jspdf-autotable';
import type { PlanAnalysis } from './calc';
import { MONTHS, POSITION_BY_ID, STATUS_LABEL } from './constants';
import { fmtHours, weekday } from './dates';
import { saveFile } from './download';
import { shortTime } from './parse';
import type { Employee, Entry, Plan, Store } from './types';

export type PrintLayout = 'a4-quincenas' | 'a3-mes' | 'a4-mes';

export interface PrintOptions {
  layout: PrintLayout;
  /** columna de firma de notificación por empleado */
  signature: boolean;
  /** incluir observaciones de los turnos al pie */
  notes: boolean;
}

interface Input {
  store: Store;
  employees: Employee[];
  entries: Entry[];
  plan: Plan | null;
  a: PlanAnalysis;
  managerName: string | null;
}

const NAVY: [number, number, number] = [11, 31, 58];
const TEAL: [number, number, number] = [13, 148, 136];
const DAY_LETTER = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const KIND_TEXT = { franco: 'F', vacaciones: 'VAC', licencia: 'LIC', ausencia: 'AUS' } as const;

function cellText(list: Entry[]): string {
  return list
    .sort((x, y) => (x.start ?? '').localeCompare(y.start ?? ''))
    .map((e) => (e.kind === 'turno' ? `${shortTime(e.start)}-${shortTime(e.end)}` : KIND_TEXT[e.kind]))
    .join('\n');
}

/** Genera la planilla mensual para cartelera (PDF), con espacio para la firma de cada empleado. */
export function buildSchedulePdf(input: Input, opts: PrintOptions): jsPDF {
  const { store, a, plan } = input;
  const format = opts.layout === 'a3-mes' ? 'a3' : 'a4';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  const ranges: number[][] = opts.layout === 'a4-quincenas'
    ? [Array.from({ length: 15 }, (_, i) => i), Array.from({ length: a.days - 15 }, (_, i) => i + 15)]
    : [Array.from({ length: a.days }, (_, i) => i)];

  const withEntries = new Set(input.entries.map((e) => e.employee_id));
  const emps = input.employees
    .filter((e) => e.active || withEntries.has(e.id))
    .sort((x, y) => POSITION_BY_ID[x.position_id].sort - POSITION_BY_ID[y.position_id].sort || x.name.localeCompare(y.name));
  const cells = new Map<string, Entry[]>();
  for (const e of input.entries) {
    const k = `${e.employee_id}|${e.date}`;
    cells.set(k, [...(cells.get(k) ?? []), e]);
  }
  const status = plan?.status ?? 'pendiente';
  const approved = status === 'aprobada';
  const period = `${MONTHS[a.month - 1]} ${a.year}`;

  const drawHeader = (part: string) => {
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, pageW, 4, 'F');
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text(`Horarios del personal · ${period}`, margin, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 70, 85);
    doc.text(`${store.name} (${store.code})${store.address ? ` · ${store.address}` : ''}${part ? ` · ${part}` : ''}`, margin, 18.5);
    doc.setFontSize(9);
    if (approved) {
      doc.setTextColor(...TEAL);
      doc.text(`Planificación aprobada${plan?.approved_at ? ` el ${new Date(plan.approved_at).toLocaleDateString('es-AR')}` : ''}`, pageW - margin, 13, { align: 'right' });
    } else {
      doc.setTextColor(200, 40, 40);
      doc.setFont('helvetica', 'bold');
      doc.text(`BORRADOR · ${STATUS_LABEL[status]}`, pageW - margin, 13, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }
    if (store.is_demo) {
      doc.setTextColor(180, 110, 0);
      doc.text('DATOS DE DEMOSTRACIÓN', pageW - margin, 18.5, { align: 'right' });
    }
  };

  ranges.forEach((range, ri) => {
    if (ri > 0) doc.addPage(format, 'landscape');
    const part = ranges.length > 1 ? `Días ${range[0] + 1} al ${range[range.length - 1] + 1}` : '';
    drawHeader(part);

    const dayHead: CellDef[] = range.map((di) => {
      const d = a.dates[di];
      const closed = store.hours[weekday(d)]?.closed;
      return { content: `${DAY_LETTER[weekday(d)]}\n${di + 1}`, styles: { halign: 'center', fillColor: closed ? [120, 130, 145] : weekday(d) === 0 || weekday(d) === 6 ? [27, 64, 111] : NAVY } };
    });
    const head: RowInput[] = [[
      { content: 'Empleado', styles: { halign: 'left' } },
      ...dayHead,
      { content: 'Horas', styles: { halign: 'center' } },
      ...(opts.signature ? [{ content: 'Firma del empleado', styles: { halign: 'center' } } as CellDef] : []),
    ]];

    const body: RowInput[] = [];
    let lastPos = '';
    for (const e of emps) {
      if (e.position_id !== lastPos) {
        lastPos = e.position_id;
        body.push([{ content: POSITION_BY_ID[e.position_id].name.toUpperCase(), colSpan: range.length + 2 + (opts.signature ? 1 : 0), styles: { fillColor: [236, 241, 247], textColor: [70, 85, 105], fontStyle: 'bold', fontSize: 6.5, minCellHeight: 4.5, cellPadding: { top: 0.8, bottom: 0.8, left: 2, right: 2 } } }]);
      }
      const hours = a.intervals.filter((iv) => iv.employee_id === e.id && range.includes(iv.dayIdx)).reduce((s, iv) => s + (iv.end - iv.start) / 60, 0);
      body.push([
        { content: e.name, styles: { fontStyle: 'bold' } },
        ...range.map((di): CellDef => {
          const d = a.dates[di];
          const list = cells.get(`${e.id}|${d}`) ?? [];
          const kind = list[0]?.kind;
          const wk = weekday(d) === 0 || weekday(d) === 6;
          const fill: [number, number, number] = kind === 'franco' ? [226, 232, 240] : kind && kind !== 'turno' ? [224, 236, 252] : wk ? [248, 250, 252] : [255, 255, 255];
          return { content: cellText(list), styles: { halign: 'center', fillColor: fill, fontStyle: kind && kind !== 'turno' ? 'bold' : 'normal' } };
        }),
        { content: fmtHours(hours), styles: { halign: 'center', fontStyle: 'bold' } },
        ...(opts.signature ? [{ content: '' } as CellDef] : []),
      ]);
    }

    const nameW = format === 'a3' ? 48 : 40;
    const hoursW = 11;
    const signW = opts.signature ? (format === 'a3' ? 42 : 34) : 0;
    const dayW = (pageW - 2 * margin - nameW - hoursW - signW) / range.length;
    const columnStyles: Record<number, { cellWidth: number }> = { 0: { cellWidth: nameW } };
    range.forEach((_, i) => (columnStyles[i + 1] = { cellWidth: dayW }));
    columnStyles[range.length + 1] = { cellWidth: hoursW };
    if (opts.signature) columnStyles[range.length + 2] = { cellWidth: signW };
    const dense = dayW < 8;

    const startPage = doc.getNumberOfPages();
    autoTable(doc, {
      head, body, startY: 23, margin: { left: margin, right: margin, bottom: 14, top: 23 },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: dense ? 6 : 7.5, cellPadding: dense ? 0.6 : 1, lineColor: [190, 198, 210], lineWidth: 0.2, textColor: [20, 30, 45], valign: 'middle', minCellHeight: opts.signature ? 6.6 : 5.8, overflow: 'linebreak' },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: dense ? 6.5 : 7.5, valign: 'middle', minCellHeight: 7 },
      columnStyles,
      rowPageBreak: 'avoid',
      showHead: 'everyPage',
      didDrawPage: () => {
        // el encabezado de la primera hoja ya está dibujado; repetirlo si la tabla continúa
        if (doc.getCurrentPageInfo().pageNumber > startPage) drawHeader(part);
      },
    });

    // Pie: referencias y firmas
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    let y = finalY + 4.5;
    if (y + 16 > pageH - 8) {
      doc.addPage(format, 'landscape');
      drawHeader(part);
      y = 28;
    }
    doc.setFontSize(7.5);
    doc.setTextColor(70, 80, 95);
    doc.setFont('helvetica', 'normal');
    const refs = doc.splitTextToSize(`Referencias: 8-16 = entrada y salida · F = franco · VAC = vacaciones · LIC = licencia · AUS = ausencia · si la salida es menor que la entrada, termina al día siguiente.${opts.signature ? ' Cada empleado firma en señal de haber tomado conocimiento de sus horarios.' : ''}`, pageW - 2 * margin) as string[];
    doc.text(refs, margin, y);
    y += refs.length * 3.2 + 7;
    doc.setDrawColor(120, 130, 145);
    const boxW = 70;
    [
      ['Firma del Gerente de Tienda', input.managerName ?? ''],
      ['Aclaración', ''],
      ['Fecha de publicación en cartelera', ''],
    ].forEach(([label, value], i) => {
      const x = margin + i * (boxW + 15);
      if (value) {
        doc.setFontSize(8.5);
        doc.setTextColor(20, 30, 45);
        if (i === 0) doc.text(value, x, y - 2);
      }
      doc.line(x, y, x + boxW, y);
      doc.setFontSize(7.5);
      doc.setTextColor(70, 80, 95);
      doc.text(label, x, y + 3.5);
    });

    if (opts.notes) {
      const notes = input.entries.filter((e) => e.notes && range.includes(Number(e.date.slice(8)) - 1));
      if (notes.length) {
        y += 9;
        const emp = new Map(input.employees.map((e) => [e.id, e.name]));
        doc.setFontSize(7.5);
        doc.setTextColor(20, 30, 45);
        doc.text('Observaciones:', margin, y);
        notes.slice(0, 12).forEach((n, i) => {
          const line = `Día ${Number(n.date.slice(8))} · ${emp.get(n.employee_id)}: ${n.notes}`;
          const col = i % 2;
          const row = Math.floor(i / 2);
          if (y + 4 + row * 3.8 < pageH - 12) doc.text(line, margin + col * ((pageW - 2 * margin) / 2), y + 4 + row * 3.8);
        });
      }
    }
  });

  // Numeración y pie de página
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(130, 140, 155);
    doc.text(`Generado con FarmaPlan el ${new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}${plan?.updated_by_name ? ` · última modificación: ${plan.updated_by_name}` : ''}`, margin, pageH - 6);
    doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 6, { align: 'right' });
  }
  return doc;
}

export function scheduleFileName(store: Store, a: PlanAnalysis) {
  return `planilla_horarios_${store.code}_${a.year}-${String(a.month).padStart(2, '0')}.pdf`;
}

export async function downloadSchedulePdf(input: Input, opts: PrintOptions) {
  const doc = buildSchedulePdf(input, opts);
  await saveFile(scheduleFileName(input.store, input.a), doc.output('blob'));
}

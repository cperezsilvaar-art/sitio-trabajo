import { useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area,
} from 'recharts';
import type { PlanAnalysis } from '../lib/calc';
import { POSITIONS, POSITION_COLORS, SEQ_BLUE, WEEKDAYS_SHORT } from '../lib/constants';
import { fmtHours, pad, weekday } from '../lib/dates';
import type { PositionId, StoreSettings } from '../lib/types';
import { cx } from './ui';

const AXIS = { fontSize: 11, fill: '#6b7280' };
const GRID = '#e5e7eb';
const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.08)' };

/** Personas trabajando por día. */
export function DailyCoverageChart({ a, minStaff, height = 220, onPick }: { a: PlanAnalysis; minStaff?: number; height?: number; onPick?: (date: string) => void }) {
  const data = a.dates.map((d, i) => ({
    dia: `${Number(d.slice(8))} ${WEEKDAYS_SHORT[weekday(d)]}`, date: d, personas: a.workingByDay[i], horas: Math.round(a.hoursByDay[i] * 10) / 10,
    problema: a.problemDays.includes(d),
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} onClick={(e) => e?.activePayload && onPick?.(e.activePayload[0].payload.date)}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="dia" tick={AXIS} interval={a.days > 20 ? 2 : 0} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(20,184,166,.08)' }}
          formatter={(v: number, n: string) => [n === 'personas' ? `${v} personas` : `${v} h`, n === 'personas' ? 'Trabajando' : 'Horas']} />
        <Bar isAnimationActive={false} dataKey="personas" fill="#1b406f" radius={[4, 4, 0, 0]} maxBarSize={22}
          shape={(p: unknown) => {
            const { x, y, width, height: h, payload } = p as { x: number; y: number; width: number; height: number; payload: { problema: boolean } };
            return <rect x={x} y={y} width={width} height={Math.max(0, h)} rx={3} fill={payload.problema ? '#d03b3b' : '#1b406f'} />;
          }}
        />
        {minStaff ? <ReferenceLine y={minStaff} stroke="#14b8a6" strokeDasharray="4 3" label={{ value: `mín. por franja ${minStaff}`, position: 'insideTopRight', fontSize: 10, fill: '#0f766e' }} /> : null}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Dotación por hora: un día puntual o el promedio del mes, con mínimo y objetivo. */
export function HourlyChart({ a, settings, date, pos, height = 240 }: { a: PlanAnalysis; settings: StoreSettings; date?: string | null; pos?: PositionId | null; height?: number }) {
  const di = date ? a.dates.indexOf(date) : -1;
  const data = Array.from({ length: 24 }, (_, h) => {
    let val: number;
    let min = 0, max = 0;
    if (di >= 0) {
      val = pos ? a.coverageByPos[pos][di * 24 + h] : a.coverage[di * 24 + h];
    } else {
      const vals: number[] = [];
      for (let d = 0; d < a.days; d++) vals.push(pos ? a.coverageByPos[pos][d * 24 + h] : a.coverage[d * 24 + h]);
      val = vals.reduce((x, y) => x + y, 0) / vals.length;
      min = Math.min(...vals);
      max = Math.max(...vals);
    }
    return {
      hora: `${pad(h)}h`, dotacion: Math.round(val * 10) / 10, rango: di >= 0 ? undefined : [min, max],
      objetivo: !pos && settings.target_by_hour?.[h] ? settings.target_by_hour[h] : null,
      minimo: !pos && (di >= 0 ? a.openSlots[di * 24 + h] : true) ? settings.min_staff : null,
    };
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="hora" tick={AXIS} interval={1} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle}
          formatter={(v: number | number[], n: string) => {
            if (Array.isArray(v)) return [`${v[0]} a ${v[1]}`, 'Rango del mes'];
            return [v, ({ dotacion: di >= 0 ? 'Dotación' : 'Dotación promedio', objetivo: 'Objetivo', minimo: 'Mínimo' } as Record<string, string>)[n] ?? n];
          }} />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => ({ dotacion: di >= 0 ? 'Dotación' : 'Dotación promedio', objetivo: 'Objetivo', minimo: 'Mínimo', rango: 'Rango mín.–máx.' } as Record<string, string>)[v] ?? v} />
        {di < 0 && <Area isAnimationActive={false} dataKey="rango" fill="#cde2fb" stroke="none" />}
        {di >= 0
          ? <Bar isAnimationActive={false} dataKey="dotacion" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={18} />
          : <Line isAnimationActive={false} dataKey="dotacion" stroke="#2a78d6" strokeWidth={2} dot={{ r: 3 }} />}
        <Line isAnimationActive={false} dataKey="objetivo" stroke="#0d9488" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls={false} />
        <Line isAnimationActive={false} dataKey="minimo" stroke="#d03b3b" strokeWidth={1.5} strokeDasharray="2 3" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Mapa de calor días × franjas horarias. */
export function Heatmap({ a, pos, onPick, selected }: { a: PlanAnalysis; pos?: PositionId | null; onPick?: (date: string) => void; selected?: string | null }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const val = (d: number, h: number) => (pos ? a.coverageByPos[pos][d * 24 + h] : a.coverage[d * 24 + h]);
  let max = 0;
  for (let d = 0; d < a.days; d++) for (let h = 0; h < 24; h++) max = Math.max(max, val(d, h));
  const color = (v: number) => (v === 0 ? '#ffffff' : SEQ_BLUE[Math.min(SEQ_BLUE.length - 1, Math.ceil((v / Math.max(1, max)) * (SEQ_BLUE.length - 1)))]);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-[2px] text-[10px]">
          <thead>
            <tr>
              <th />
              {Array.from({ length: 24 }, (_, h) => <th key={h} className="w-6 font-normal text-slate-500">{pad(h)}</th>)}
            </tr>
          </thead>
          <tbody>
            {a.dates.map((d, di) => (
              <tr key={d} className={cx(selected === d && 'outline outline-1 outline-teal-600')}>
                <th onClick={() => onPick?.(d)} className={cx('cursor-pointer whitespace-nowrap pr-1.5 text-right font-normal', a.problemDays.includes(d) ? 'font-semibold text-rose-700' : 'text-slate-500')}>
                  {WEEKDAYS_SHORT[weekday(d)]} {Number(d.slice(8))}
                </th>
                {Array.from({ length: 24 }, (_, h) => {
                  const v = val(di, h);
                  const open = a.openSlots[di * 24 + h];
                  return (
                    <td
                      key={h}
                      onMouseEnter={() => setHover({ d: di, h })}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => onPick?.(d)}
                      className={cx('h-4 w-6 cursor-pointer rounded-[3px] text-center tabular-nums', !open && 'opacity-40', open && v === 0 && 'ring-1 ring-inset ring-rose-400')}
                      style={{ background: open || v ? color(v) : 'repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 2px,#e2e8f0 2px,#e2e8f0 4px)', color: v / Math.max(1, max) > 0.55 ? '#fff' : '#334155' }}
                      title={`${d.split('-').reverse().join('/')} ${pad(h)}–${pad(h + 1)} h: ${v} persona(s)${open ? '' : ' · tienda cerrada'}`}
                    >
                      {v || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span>Menor</span>
        <div className="flex">{SEQ_BLUE.map((c) => <span key={c} className="h-3 w-5" style={{ background: c }} />)}</div>
        <span>Mayor dotación (máx. {max})</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[3px] ring-1 ring-inset ring-rose-400" /> abierta sin personal</span>
        <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-[3px]" style={{ background: 'repeating-linear-gradient(45deg,#f1f5f9,#f1f5f9 2px,#e2e8f0 2px,#e2e8f0 4px)' }} /> cerrada</span>
        {hover && <span className="ml-auto font-medium text-navy-900">Día {hover.d + 1}, {pad(hover.h)}–{pad(hover.h + 1)} h: {val(hover.d, hover.h)} persona(s)</span>}
      </div>
    </div>
  );
}

/** Personas por posición por día (barras apiladas). */
export function PositionByDayChart({ a, height = 260 }: { a: PlanAnalysis; height?: number }) {
  const data = a.dates.map((d, i) => {
    const row: Record<string, number | string> = { dia: `${Number(d.slice(8))}` };
    for (const p of POSITIONS) row[p.id] = a.posByDay[p.id][i];
    return row;
  });
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="dia" tick={AXIS} tickLine={false} interval={a.days > 20 ? 1 : 0} axisLine={{ stroke: '#cbd5e1' }} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `Día ${l}`} formatter={(v: number, n: string) => [v, POSITIONS.find((p) => p.id === n)?.name ?? n]} />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => POSITIONS.find((p) => p.id === v)?.short ?? v} />
        {POSITIONS.map((p, i) => (
          <Bar isAnimationActive={false} key={p.id} dataKey={p.id} stackId="a" fill={POSITION_COLORS[p.id]} stroke="#fff" strokeWidth={1}
            radius={i === POSITIONS.length - 1 ? [4, 4, 0, 0] : undefined} maxBarSize={22} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horas por posición (barras horizontales). */
export function HoursByPositionChart({ a, height = 230 }: { a: PlanAnalysis; height?: number }) {
  const data = POSITIONS.map((p) => ({ name: p.short, full: p.name, id: p.id, horas: Math.round(a.hoursByPosition[p.id]) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="name" tick={AXIS} width={70} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${fmtHours(v, 0)} h`, 'Horas planificadas']} labelFormatter={(_, p) => p?.[0]?.payload.full} />
        <Bar isAnimationActive={false} dataKey="horas" radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fontSize: 11, fill: '#334155' }}
          shape={(p: unknown) => {
            const { x, y, width, height: h, payload } = p as { x: number; y: number; width: number; height: number; payload: { id: PositionId } };
            return <rect x={x} y={y} width={Math.max(0, width)} height={h} rx={3} fill={POSITION_COLORS[payload.id]} />;
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Presencia de posiciones por franja horaria en un día (o promedio). */
export function PositionPresence({ a, date }: { a: PlanAnalysis; date: string | null }) {
  const di = date ? a.dates.indexOf(date) : -1;
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[2px] text-[10px]">
        <thead>
          <tr>
            <th />
            {Array.from({ length: 24 }, (_, h) => <th key={h} className="w-6 font-normal text-slate-500">{pad(h)}</th>)}
          </tr>
        </thead>
        <tbody>
          {POSITIONS.map((p) => (
            <tr key={p.id}>
              <th className="whitespace-nowrap pr-2 text-right font-normal text-slate-600">{p.short}</th>
              {Array.from({ length: 24 }, (_, h) => {
                let v: number;
                let open: boolean;
                if (di >= 0) {
                  v = a.coverageByPos[p.id][di * 24 + h];
                  open = a.openSlots[di * 24 + h];
                } else {
                  let cnt = 0, tot = 0, op = 0;
                  for (let d = 0; d < a.days; d++) {
                    if (a.openSlots[d * 24 + h]) { op++; if (a.coverageByPos[p.id][d * 24 + h] > 0) cnt++; }
                    tot += a.coverageByPos[p.id][d * 24 + h];
                  }
                  v = op ? cnt / op : 0;
                  open = op > 0;
                  void tot;
                }
                const label = di >= 0 ? (v || '') : v && v < 1 ? `${Math.round(v * 100)}` : '';
                const intensity = di >= 0 ? Math.min(1, v / 3) : v;
                return (
                  <td key={h} className={cx('h-5 w-6 min-w-[1.5rem] rounded-[3px] text-center text-[9px] tabular-nums', open && v === 0 && 'ring-1 ring-inset ring-rose-400')}
                    style={{ background: v ? POSITION_COLORS[p.id] : open ? '#fff' : '#f1f5f9', opacity: v ? 0.35 + intensity * 0.65 : 1, color: v ? '#fff' : '#94a3b8' }}
                    title={di >= 0 ? `${p.name} ${pad(h)}–${pad(h + 1)} h: ${v}` : `${p.name} ${pad(h)}–${pad(h + 1)} h: presente el ${Math.round(v * 100)}% de los días abiertos`}>
                    {label}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-slate-500">{di >= 0 ? 'Cantidad de personas de cada posición por franja.' : '% de días abiertos en que la posición está presente en cada franja.'} Borde rojo: tienda abierta sin esa posición.</p>
    </div>
  );
}

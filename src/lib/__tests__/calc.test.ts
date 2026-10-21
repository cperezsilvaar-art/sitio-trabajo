import { describe, expect, it } from 'vitest';
import { analyzePlan, shiftMinutes } from '../calc';
import { buildDemoData } from '../demo';

describe('cálculos', () => {
  it('turnos que cruzan la medianoche', () => {
    expect(shiftMinutes('22:00', '06:00')).toBe(480);
    expect(shiftMinutes('08:00', '16:00')).toBe(480);
  });
  it('analiza los datos demo', () => {
    const d = buildDemoData(new Date(2026, 9, 21));
    for (const s of d.stores) {
      for (const p of d.plans.filter((x) => x.store_id === s.id)) {
        const a = analyzePlan({
          year: p.year, month: p.month, store: s,
          settings: d.store_settings.find((x) => x.store_id === s.id)!,
          employees: d.employees.filter((e) => e.store_id === s.id),
          entries: d.entries.filter((e) => e.plan_id === p.id), plan: p,
          carryIn: d.entries.filter((e) => e.store_id === s.id && e.date === (p.month === 10 ? '2026-09-30' : '2026-08-31')),
        });
        console.log(s.name, p.month, p.status, 'h', Math.round(a.totalHours), 'compl', a.completeness.toFixed(2), 'E', a.errors, 'W', a.warnings);
        const codes: Record<string, number> = {};
        a.alerts.forEach((x) => (codes[x.code] = (codes[x.code] ?? 0) + 1));
        console.log('  ', JSON.stringify(codes));
      }
    }
  });
  it('cobertura nocturna pasa al día siguiente', () => {
    const d = buildDemoData(new Date(2026, 9, 21));
    const s = d.stores[0];
    const p = d.plans.find((x) => x.store_id === s.id && x.month === 10)!;
    const a = analyzePlan({ year: 2026, month: 10, store: s, settings: d.store_settings[0], employees: d.employees.filter((e) => e.store_id === s.id), entries: d.entries.filter((e) => e.plan_id === p.id), plan: p });
    expect(a.coverage[1 * 24 + 3]).toBeGreaterThan(0);
  });
});

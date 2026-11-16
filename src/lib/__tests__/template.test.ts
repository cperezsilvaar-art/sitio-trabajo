import { describe, expect, it } from 'vitest';
import { makeDocx } from '../seed';
import { buildValues, docxPlaceholders, extractPlaceholders, fillDocx, render, unknownPlaceholders } from '../template';
import { emptyRequestData } from '../service';
import PizZip from 'pizzip';

describe('motor de modelos', () => {
  const data = { ...emptyRequestData(), employee_name: 'Ana Paz', legajo: '123', incident_date: '2026-11-03', description: 'Hechos.', extra: { dias: '2', desde: '2026-11-20' } };
  const fields = [{ key: 'dias', label: 'Días', type: 'number' as const, required: true }, { key: 'desde', label: 'Desde', type: 'date' as const, required: true }];

  it('reemplaza marcadores estándar y adicionales', () => {
    const v = buildValues(data, { number: 'MD-1', manager_name: 'G', issued_at: '2026-11-16T10:00:00Z', city: 'CABA', final: false }, fields);
    const out = render('{{colaborador}} ({{legajo}}) {{fecha_incidente}} {{fecha_incidente_larga}} {{dias}} días desde {{desde}}', v);
    expect(out).toBe('Ana Paz (123) 03/11/2026 3 de noviembre de 2026 2 días desde 20/11/2026');
  });
  it('el borrador lleva la leyenda y el definitivo no', () => {
    const base = { number: 'MD-1', manager_name: 'G', issued_at: '2026-11-16', city: 'CABA' };
    expect(render('{{estado_documento}}', buildValues(data, { ...base, final: false }))).toMatch(/BORRADOR/);
    expect(render('{{estado_documento}}{{aprobado_por}}', buildValues(data, { ...base, final: true, approved_by_name: 'RH' }))).toBe('RH');
  });
  it('marca los marcadores sin dato y detecta los desconocidos', () => {
    expect(render('{{inexistente}}', {})).toBe('[inexistente]');
    expect(extractPlaceholders('{{a}} {{ b }} {{a}}')).toEqual(['a', 'b']);
    expect(unknownPlaceholders('{{colaborador}} {{dias}} {{otro}}', fields)).toEqual(['otro']);
  });
  it('completa un Word con marcadores conservando el archivo', async () => {
    const tpl = await makeDocx('Sr. {{colaborador}}, legajo {{legajo}}.');
    expect(await docxPlaceholders(tpl)).toEqual(['colaborador', 'legajo']);
    const bytes = await fillDocx(tpl, { colaborador: 'Ana Paz', legajo: '123' });
    const xml = new PizZip(bytes).file('word/document.xml')!.asText();
    expect(xml).toContain('Sr. Ana Paz, legajo 123.');
  });
});

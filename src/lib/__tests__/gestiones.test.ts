import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { daysInclusive, seniorityYears, statusFor, vacationChecks, vacationEntitlement } from '../gestiones';
import { policy } from '../seed';

describe('cálculos de vacaciones (LCT)', () => {
  it('días por antigüedad al 31/12 del período (art. 150)', () => {
    expect(vacationEntitlement('2024-03-01', 2026)).toBe(14);
    expect(vacationEntitlement('2021-12-31', 2026)).toBe(21);
    expect(vacationEntitlement('2016-06-01', 2026)).toBe(28);
    expect(vacationEntitlement('2005-03-01', 2026)).toBe(35);
    expect(seniorityYears('2021-12-31', 2026)).toBe(5);
  });
  it('advierte si no empieza lunes, si se notifica tarde o si excede los días', () => {
    const c = vacationChecks({ start_date: '2027-01-05', end_date: '2027-01-30', hire_date: '2024-01-01', period_year: 2026 }, policy, '2026-12-20');
    const msgs = c.map((x) => x.message).join(' ');
    expect(msgs).toMatch(/lunes/);
    expect(msgs).toMatch(/anticipación/);
    expect(msgs).toMatch(/le corresponden 14/);
    expect(c.every((x) => x.level !== 'error')).toBe(true);
  });
  it('con 45 días de anticipación, un lunes y dentro de lo que corresponde no advierte', () => {
    const c = vacationChecks({ start_date: '2027-01-04', end_date: '2027-01-17', hire_date: '2024-01-01', period_year: 2026 }, policy, '2026-11-18');
    expect(c.filter((x) => x.level !== 'info')).toEqual([]);
    expect(daysInclusive('2027-01-04', '2027-01-17')).toBe(14);
  });
  it('el estado depende del documento adjunto', () => {
    expect(statusFor({ kind: 'vacaciones', leave_type: '', attachments: [] })).toBe('pendiente_firma');
    expect(statusFor({ kind: 'licencia', leave_type: 'enfermedad', attachments: [] })).toBe('pendiente_certificado');
    expect(statusFor({ kind: 'licencia', leave_type: 'mudanza', attachments: [] })).toBe('enviada');
  });
});

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
};
const { LocalBackend } = await import('../backend/local');
const { buildSeed } = await import('../seed');
const { PortalService } = await import('../service');
type Snap = Awaited<ReturnType<InstanceType<typeof PortalService>['load']>>;
const backend = new LocalBackend();
async function as(email: string) {
  const user = await backend.signIn(email, 'demo1234');
  let snap: Snap;
  const svc = new PortalService(backend, user, () => snap);
  const refresh = async () => { snap = await svc.load(); return snap; };
  await refresh();
  return { svc, refresh, get snap() { return snap; } };
}
const fakeFile = (name: string) => new File([new Uint8Array([37, 80, 68, 70])], name, { type: 'application/pdf' });

beforeAll(async () => {
  await backend.resetAll();
  const s = await buildSeed();
  await backend.seed(s.data, s.passwords);
});

describe('licencia: aviso, certificado y recepción de RH', () => {
  let id = '';
  it('el aviso llega a RH aunque falte el certificado', async () => {
    const g = await as('gerente.310@demo.portal');
    const e = g.snap.employees.find((x) => x.store_id === 's-310')!;
    id = await g.svc.createGestion('licencia', {
      store_id: 's-310', store_name: 'Suc 310', area: 'Área 3', employee_id: e.id, employee_name: e.name, legajo: e.legajo,
      leave_type: 'enfermedad', start_date: '2026-11-16', end_date: '2026-11-18', notice_date: '2026-11-16',
    });
    const c = await as('coord.area3@demo.portal');
    const lic = c.snap.gestiones.find((x) => x.id === id)!;
    expect(lic.status).toBe('pendiente_certificado');
    expect(c.snap.notifications.some((n) => n.link === `/gestiones/${id}` && /Falta el certificado/.test(n.message))).toBe(true);
    await expect(c.svc.reviewGestion(id, 'recibir', '')).rejects.toThrow(/enviadas/);
  });
  it('al cargar el certificado pasa a RH; RH observa y el gerente corrige', async () => {
    const g = await as('gerente.310@demo.portal');
    const att = { ...(await g.svc.uploadFile(fakeFile('certificado.pdf'))), role: 'certificado' as const };
    await g.svc.updateGestion(id, { attachments: [att] });
    let c = await as('coord.area3@demo.portal');
    expect(c.snap.gestiones.find((x) => x.id === id)!.status).toBe('enviada');
    await expect(c.svc.reviewGestion(id, 'observar', '')).rejects.toThrow(/corregir/);
    await c.svc.reviewGestion(id, 'observar', 'Falta el sello del médico.');
    const g2 = await as('gerente.310@demo.portal');
    const lic = g2.snap.gestiones.find((x) => x.id === id)!;
    expect(lic.status).toBe('observada');
    const att2 = { ...(await g2.svc.uploadFile(fakeFile('certificado-con-sello.pdf'))), role: 'certificado' as const };
    await g2.svc.updateGestion(id, { attachments: [...lic.attachments, att2] }, 'Certificado con sello.');
    c = await as('coord.area3@demo.portal');
    await c.svc.reviewGestion(id, 'recibir', '');
    await c.refresh();
    expect(c.snap.gestiones.find((x) => x.id === id)!.status).toBe('recibida');
  });
  it('el gerente no puede dar por recibida ni modificar lo recibido; otra área no la ve', async () => {
    const g = await as('gerente.310@demo.portal');
    await expect(backend.update('gestiones', id, { status: 'recibida' })).rejects.toThrow();
    await expect(g.svc.updateGestion(id, { notes: 'x' })).rejects.toThrow(/no admite/);
    const o = await as('coord.area1@demo.portal');
    expect(o.snap.gestiones.find((x) => x.id === id)).toBeUndefined();
  });
});

describe('vacaciones: notificación para firmar', () => {
  it('se genera la notificación con el modelo; sin la copia firmada no llega a RH', async () => {
    const g = await as('gerente.310@demo.portal');
    const e = g.snap.employees.find((x) => x.store_id === 's-310')!;
    const id = await g.svc.createGestion('vacaciones', {
      store_id: 's-310', store_name: 'Suc 310', area: 'Área 3', employee_id: e.id, employee_name: e.name, legajo: e.legajo,
      hire_date: e.hire_date, position: e.position, start_date: '2027-01-04', end_date: '2027-01-17', period_year: 2026,
    });
    await g.refresh();
    const v = g.snap.gestiones.find((x) => x.id === id)!;
    expect(v.status).toBe('pendiente_firma');
    expect(v.days).toBe(14);
    const text = g.svc.renderVacationNotice(v);
    expect(text).toContain(e.name);
    expect(text).toContain('04/01/2027');
    expect(text).toContain('18/01/2027'); // reintegro
    expect(text).not.toMatch(/\[[a-z_]+\]/);
    const att = { ...(await g.svc.uploadFile(fakeFile('firmada.pdf'))), role: 'firmada' as const };
    await g.svc.updateGestion(id, { attachments: [att] });
    await g.refresh();
    expect(g.snap.gestiones.find((x) => x.id === id)!.status).toBe('enviada');
    // Si cambian las fechas, la firma ya no vale: vuelve a "falta la notificación firmada".
    const c = await as('coord.area3@demo.portal');
    await c.svc.reviewGestion(id, 'observar', 'Corregir: arrancan el 11/01.');
    const g2 = await as('gerente.310@demo.portal');
    await g2.svc.updateGestion(id, { start_date: '2027-01-11', end_date: '2027-01-24' });
    await g2.refresh();
    const v2 = g2.snap.gestiones.find((x) => x.id === id)!;
    expect(v2.status).toBe('pendiente_firma');
    expect(v2.attachments.filter((a) => a.role === 'firmada')).toHaveLength(0);
  });
});

import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Employee, Headcount, Vacancy } from '../types';
import { canRequest, slotFor, stageTimes } from '../vacantes';

const hc: Headcount[] = [{ id: 's1:Cajero/a', store_id: 's1', position: 'Cajero/a', authorized: 2, updated_by_name: '', updated_at: '' }];
const emp = (id: string, active = true): Employee => ({ id, legajo: id, name: id, position: 'Cajero/a', store_id: 's1', active });
const vac = (over: Partial<Vacancy>): Vacancy => ({
  id: 'v', number: 'V', status: 'pendiente_area', store_id: 's1', store_name: '', area: 'A', position: 'Cajero/a', shift: '', workday: 'completa',
  reason: 'nueva', replaced_employee_id: '', replaced_employee_name: '', leaving_reason: '', leaving_date: '', needed_by: '', profile_notes: '',
  manager_id: 'g', manager_name: '', area_manager_id: null, area_manager_name: null, area_decided_at: null, coordinator_id: null, coordinator_name: null,
  candidate_name: '', candidate_legajo: '', hire_date: '', created_at: '2026-11-01T10:00:00Z', updated_at: '', closed_at: null, ...over,
});

describe('headcount', () => {
  it('disponibles = autorizados − ocupados − en proceso', () => {
    expect(slotFor('s1', 'Cajero/a', hc, [emp('a')], []).available).toBe(1);
    expect(slotFor('s1', 'Cajero/a', hc, [emp('a')], [vac({})]).available).toBe(0);
    expect(slotFor('s1', 'Cajero/a', hc, [emp('a'), emp('b', false)], [vac({ status: 'cubierta' })]).available).toBe(1);
  });
  it('sin lugar no se puede pedir una posición nueva', () => {
    const r = canRequest({ store_id: 's1', position: 'Cajero/a', reason: 'nueva', replaced_employee_id: '' }, hc, [emp('a'), emp('b')], []);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Sin vacante disponible/);
  });
  it('sin headcount configurado no se puede pedir', () => {
    expect(canRequest({ store_id: 's1', position: 'Repositor/a', reason: 'nueva', replaced_employee_id: '' }, hc, [], []).reason).toMatch(/no tiene headcount/);
  });
  it('un reemplazo de alguien que se va libera su lugar, una sola vez', () => {
    const emps = [emp('a'), emp('b')];
    const r1 = canRequest({ store_id: 's1', position: 'Cajero/a', reason: 'reemplazo', replaced_employee_id: 'a' }, hc, emps, []);
    expect(r1.ok).toBe(true);
    const open = [vac({ reason: 'reemplazo', replaced_employee_id: 'a' })];
    expect(canRequest({ store_id: 's1', position: 'Cajero/a', reason: 'reemplazo', replaced_employee_id: 'a' }, hc, emps, open).reason).toMatch(/Ya hay una vacante/);
    // Con el reemplazo abierto, el lugar sigue completo: no se puede pedir otra nueva.
    expect(canRequest({ store_id: 's1', position: 'Cajero/a', reason: 'nueva', replaced_employee_id: '' }, hc, emps, open).ok).toBe(false);
  });
  it('tiempos por etapa a partir del historial', () => {
    const v = vac({ id: 'v1', status: 'entrevistas' });
    const ev = (at: string, to: string) => ({ id: at, entity: 'vacancy' as const, entity_id: 'v1', action: 'x', actor_id: '', actor_name: '', actor_role: 'gerente' as const, at, internal: false, to_status: to as never });
    const t = stageTimes(v, [ev('2026-11-01T10:00:00Z', 'pendiente_area'), ev('2026-11-03T10:00:00Z', 'autorizada'), ev('2026-11-04T10:00:00Z', 'en_busqueda'), ev('2026-11-10T10:00:00Z', 'entrevistas')], '2026-11-12T10:00:00Z');
    expect(t.map((x) => x.days)).toEqual([2, 1, 6, 2]);
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

beforeAll(async () => {
  await backend.resetAll();
  const s = await buildSeed();
  await backend.seed(s.data, s.passwords);
});

describe('circuito de una vacante', () => {
  let id = '';
  it('el gerente pide dentro del headcount; fuera de él, se bloquea', async () => {
    const g = await as('gerente.310@demo.portal');
    await expect(g.svc.requestVacancy({ store_id: 's-310', position: 'Encargado/a de turno', shift: 'Mañana', workday: 'completa', reason: 'nueva', replaced_employee_id: '', leaving_reason: '', leaving_date: '', needed_by: '', profile_notes: '' }))
      .rejects.toThrow(/Sin vacante disponible/);
    id = await g.svc.requestVacancy({ store_id: 's-310', position: 'Cajero/a', shift: 'Tarde', workday: 'completa', reason: 'nueva', replaced_employee_id: '', leaving_reason: '', leaving_date: '', needed_by: '', profile_notes: '' });
    await g.refresh();
    // Ese lugar quedó tomado: una segunda no entra.
    await expect(g.svc.requestVacancy({ store_id: 's-310', position: 'Cajero/a', shift: 'Tarde', workday: 'completa', reason: 'nueva', replaced_employee_id: '', leaving_reason: '', leaving_date: '', needed_by: '', profile_notes: '' }))
      .rejects.toThrow(/Sin vacante disponible/);
  });
  it('sólo el gerente de área de esa zona autoriza; RH no puede saltearlo', async () => {
    const c = await as('coord.area3@demo.portal');
    await expect(c.svc.decideVacancy(id, 'autorizar', '')).rejects.toThrow(/gerente de área/);
    await expect(c.svc.advanceVacancy(id, '')).rejects.toThrow();
    const otro = await as('gerente.area1@demo.portal');
    expect(otro.snap.vacancies.find((v) => v.id === id)).toBeUndefined();
    const ga = await as('gerente.area3@demo.portal');
    expect(ga.snap.notifications.some((n) => n.link === `/vacantes/${id}`)).toBe(true);
    await ga.svc.decideVacancy(id, 'autorizar', 'OK');
  });
  it('RH avanza las etapas con novedades y al cubrirla da de alta al ingresante', async () => {
    const c = await as('coord.area3@demo.portal');
    await c.svc.advanceVacancy(id, 'Publicada.'); await c.refresh();
    await c.svc.advanceVacancy(id, 'Entrevistas.'); await c.refresh();
    await c.svc.vacancyNote(id, '3 finalistas.'); await c.refresh();
    await c.svc.advanceVacancy(id, 'Preocupacional.', { candidate_name: 'Ana Ruiz' }); await c.refresh();
    await expect(c.svc.advanceVacancy(id, '')).rejects.toThrow(/fecha/);
    await c.svc.advanceVacancy(id, 'Ingresa el lunes.', { candidate_name: 'Ana Ruiz', hire_date: '2026-12-01' }); await c.refresh();
    await c.svc.advanceVacancy(id, 'Ingresó.', { candidate_legajo: '50001' }); const s = await c.refresh();
    const v = s.vacancies.find((x) => x.id === id)!;
    expect(v.status).toBe('cubierta');
    expect(s.employees.some((e) => e.name === 'Ana Ruiz' && e.store_id === 's-310' && e.position === 'Cajero/a')).toBe(true);
    const g = await as('gerente.310@demo.portal');
    expect(g.snap.audit_events.filter((e) => e.entity_id === id).length).toBeGreaterThanOrEqual(7);
    expect(g.snap.notifications.filter((n) => n.link === `/vacantes/${id}`).length).toBeGreaterThanOrEqual(5);
  });
});

// Prueba de punta a punta del circuito con el backend local (IndexedDB simulado).
import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k),
};

const { LocalBackend } = await import('../backend/local');
const { buildSeed } = await import('../seed');
const { PortalService, emptyRequestData } = await import('../service');
type Snap = Awaited<ReturnType<InstanceType<typeof PortalService>['load']>>;

const backend = new LocalBackend();

async function as(email: string) {
  const user = await backend.signIn(email, 'demo1234');
  let snap: Snap;
  const svc = new PortalService(backend, user, () => snap);
  const refresh = async () => { snap = await svc.load(); return snap; };
  await refresh();
  return { svc, refresh, user, get snap() { return snap; } };
}

const GER = 'gerente.310@demo.portal';
const COORD = 'coord.area3@demo.portal';
const OTHER = 'coord.area1@demo.portal';

let requestId = '';

beforeAll(async () => {
  const s = await buildSeed();
  await backend.seed(s.data, s.passwords);
});

describe('circuito de aprobación', () => {
  it('el gerente arma y envía la solicitud; se asigna al coordinador del área', async () => {
    const g = await as(GER);
    const e = g.snap.employees.find((x) => x.store_id === 's-310')!;
    const t = g.snap.templates.find((x) => x.id === 't-apercibimiento')!;
    const data = {
      ...emptyRequestData(), employee_id: e.id, employee_name: e.name, legajo: e.legajo, position: e.position,
      store_id: 's-310', store_name: 'Sucursal 310', area: 'Área 3', incident_date: '2026-11-10', situation_type_id: 'sit-1',
      situation_type_name: 'Llegada tarde reiterada', measure_type_id: 'm-apercibimiento', measure_type_name: 'Apercibimiento',
      template_id: t.id, template_version_id: t.current_version_id!, antecedentes: 'Sin antecedentes',
      description: 'Llegó 40 minutos tarde los días 3, 5 y 10 de noviembre sin aviso previo, según el reloj biométrico de la sucursal.',
    };
    requestId = await g.svc.createDraft(data);
    await g.refresh();
    await expect(g.svc.submit(requestId, { ...data, description: 'corta' })).rejects.toThrow(/detallada/);
    await g.svc.submit(requestId, data);
    const s = await g.refresh();
    const r = s.requests.find((x) => x.id === requestId)!;
    expect(r.status).toBe('enviada');
    expect(r.coordinator_id).toBe('u-coord3');
    expect(s.request_revisions.filter((x) => x.request_id === requestId)).toHaveLength(1);
    // El gerente no puede aprobar su solicitud ni siquiera saltando la interfaz.
    await expect(g.svc.decide(requestId, 'aprobar', '')).rejects.toThrow();
    await expect(backend.update('requests', requestId, { status: 'aprobada' })).rejects.toThrow(/aprobar/);
  });

  it('el coordinador recibe el aviso, pide modificaciones y deja una observación interna', async () => {
    const c = await as(COORD);
    expect(c.snap.notifications.some((n) => n.request_id === requestId)).toBe(true);
    await c.svc.take(requestId);
    await c.refresh();
    await c.svc.addComment(requestId, 'Verificar planilla de asistencia.', true);
    await expect(c.svc.decide(requestId, 'pedir_modificaciones', '')).rejects.toThrow(/motivo/);
    await c.svc.decide(requestId, 'pedir_modificaciones', 'Adjuntar el reporte del reloj.');
    const s = await c.refresh();
    expect(s.requests.find((x) => x.id === requestId)!.status).toBe('requiere_modificaciones');
  });

  it('otro coordinador no ve la solicitud y el gerente no ve observaciones internas', async () => {
    const o = await as(OTHER);
    expect(o.snap.requests.find((x) => x.id === requestId)).toBeUndefined();
    const g = await as(GER);
    expect(g.snap.audit_events.some((e) => e.entity_id === requestId && e.internal)).toBe(false);
  });

  it('el gerente corrige y reenvía: se crea la versión 2', async () => {
    const g = await as(GER);
    const r = g.snap.requests.find((x) => x.id === requestId)!;
    const { pickData } = await import('../service');
    await g.svc.saveDraft(requestId, { ...pickData(r), antecedentes: 'Llamado verbal el 20/09.' });
    await g.refresh();
    await g.svc.submit(requestId, { ...pickData(r), antecedentes: 'Llamado verbal el 20/09.' }, 'Se agregan antecedentes.');
    const s = await g.refresh();
    expect(s.requests.find((x) => x.id === requestId)!.revision).toBe(2);
    expect(s.request_revisions.filter((x) => x.request_id === requestId)).toHaveLength(2);
  });

  it('el coordinador aprueba: se genera el definitivo, con aprobador, fecha, versión y huella', async () => {
    const c = await as(COORD);
    await c.svc.decide(requestId, 'aprobar', '');
    const s = await c.refresh();
    const r = s.requests.find((x) => x.id === requestId)!;
    expect(r.status).toBe('aprobada');
    expect(r.approved_by).toBe('u-coord3');
    expect(r.approved_revision).toBe(2);
    const doc = s.final_documents.find((d) => d.id === r.final_document_id)!;
    expect(doc.content).not.toMatch(/BORRADOR/);
    expect(doc.content).toContain('Christian Pérez');
    expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(doc.docx_file_id).toBeTruthy();
    expect(s.audit_events.some((e) => e.entity_id === requestId && e.action === 'aprobada' && e.revision === 2)).toBe(true);
  });

  it('lo aprobado no se modifica: ni los datos, ni el documento, ni el historial', async () => {
    const g = await as(GER);
    await expect(g.svc.saveDraft(requestId, { ...emptyRequestData(), description: 'cambio' })).rejects.toThrow();
    await expect(backend.update('requests', requestId, { description: 'cambio' })).rejects.toThrow(/rectificación/);
    const r = g.snap.requests.find((x) => x.id === requestId)!;
    await expect(backend.update('final_documents', r.final_document_id!, { content: 'x' })).rejects.toThrow(/historial/);
    const ev = g.snap.audit_events.find((e) => e.entity_id === requestId)!;
    await expect(backend.update('audit_events', ev.id, { comment: 'x' })).rejects.toThrow(/historial/);
  });

  it('una rectificación deja sin efecto la aprobación y exige una nueva', async () => {
    const g = await as(GER);
    await g.svc.rectify(requestId, 'Error en la fecha del incidente.');
    const s = await g.refresh();
    const r = s.requests.find((x) => x.id === requestId)!;
    expect(r.status).toBe('borrador');
    expect(r.final_document_id).toBeNull();
    expect(s.final_documents.filter((d) => d.request_id === requestId)).toHaveLength(1);
  });
});

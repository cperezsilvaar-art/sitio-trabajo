import { describe, expect, it } from 'vitest';
import { policy, profiles } from '../seed';
import type { DisciplinaryRequest, RequestStatus } from '../types';
import { canTransition, denyReason, resolveCoordinator, validateRequest } from '../workflow';
import { emptyRequestData } from '../service';

const u = (id: string) => profiles.find((p) => p.id === id)!;
const req = (status: RequestStatus, over: Partial<DisciplinaryRequest> = {}): DisciplinaryRequest => ({
  ...emptyRequestData(), id: 'r1', number: 'MD-1', status, manager_id: 'u-ger310', manager_name: 'Valeria', area: 'Área 3',
  coordinator_id: 'u-coord3', coordinator_name: 'Christian', revision: 1, created_at: '', updated_at: '', submitted_at: '2026-11-10T10:00:00Z',
  decided_at: null, approved_by: null, approved_by_name: null, approved_at: null, approved_revision: null, final_document_id: null,
  closed_at: null, notified_at: null, ...over,
});

describe('permisos de aprobación', () => {
  it('el coordinador del área puede aprobar', () => {
    expect(denyReason('aprobar', u('u-coord3'), req('pendiente_revision'), policy)).toBeNull();
  });
  it('un gerente nunca puede aprobar, ni siquiera su propia solicitud', () => {
    expect(denyReason('aprobar', u('u-ger310'), req('enviada'), policy)).toMatch(/exclusiva/);
  });
  it('nadie aprueba una solicitud que inició', () => {
    const own = req('enviada', { manager_id: 'u-coord3' });
    expect(denyReason('aprobar', u('u-coord3'), own, policy)).toMatch(/propia/);
    expect(denyReason('aprobar', u('u-admin'), req('enviada', { manager_id: 'u-admin' }), policy)).toMatch(/propia/);
  });
  it('un coordinador de otra área no puede decidir ni ver', () => {
    expect(denyReason('aprobar', u('u-coord1'), req('enviada'), policy)).toMatch(/acceso/);
  });
  it('con restricción por área desactivada, un coordinador con acceso puede decidir', () => {
    const c = { ...u('u-coord1'), areas: ['Área 1'] };
    const r = req('enviada', { coordinator_id: 'u-coord1' });
    expect(denyReason('aprobar', c, r, { ...policy, restrict_to_area: true })).toMatch(/área/);
    expect(denyReason('aprobar', c, r, { ...policy, restrict_to_area: false })).toBeNull();
  });
  it('si el rol coordinador no es aprobador, no puede decidir', () => {
    expect(denyReason('aprobar', u('u-coord3'), req('enviada'), { ...policy, approver_roles: ['admin_rh'] })).toMatch(/exclusiva/);
  });
  it('no se decide dos veces', () => {
    expect(denyReason('aprobar', u('u-coord3'), req('aprobada'), policy)).toMatch(/pendiente/);
  });
});

describe('edición y ciclo de vida', () => {
  it('el gerente sólo edita borradores y devoluciones', () => {
    expect(denyReason('editar', u('u-ger310'), req('borrador'), policy)).toBeNull();
    expect(denyReason('editar', u('u-ger310'), req('requiere_modificaciones'), policy)).toBeNull();
    for (const s of ['enviada', 'pendiente_revision', 'aprobada', 'rechazada', 'cerrada'] as RequestStatus[]) {
      expect(denyReason('editar', u('u-ger310'), req(s), policy)).not.toBeNull();
    }
  });
  it('transiciones', () => {
    expect(canTransition('borrador', 'aprobada')).toBe(false);
    expect(canTransition('requiere_modificaciones', 'aprobada')).toBe(false);
    expect(canTransition('cerrada', 'borrador')).toBe(false);
    expect(canTransition('aprobada', 'borrador')).toBe(true);
  });
  it('no se cierra una medida aprobada sin notificación', () => {
    expect(denyReason('cerrar', u('u-coord3'), req('aprobada'), policy)).toMatch(/notificación/);
    expect(denyReason('cerrar', u('u-coord3'), req('aprobada', { notified_at: '2026-11-12' }), policy)).toBeNull();
  });
  it('no se rectifica una medida ya notificada', () => {
    expect(denyReason('rectificar', u('u-ger310'), req('aprobada', { notified_at: '2026-11-12' }), policy)).toMatch(/notificada/);
  });
  it('sin aprobación no hay documento definitivo', () => {
    expect(denyReason('descargar_definitivo', u('u-ger310'), req('pendiente_revision'), policy)).not.toBeNull();
  });
});

describe('ruteo y validación', () => {
  it('asigna el coordinador según la política de ruteo', () => {
    expect(resolveCoordinator('Área 3', policy, profiles)?.id).toBe('u-coord3');
    expect(resolveCoordinator('Área 9', policy, profiles)).toBeNull();
  });
  it('exige los datos obligatorios y una descripción detallada', () => {
    const issues = validateRequest(emptyRequestData(), { fields: [], stores: [], managerStoreIds: [] });
    const f = issues.map((i) => i.field);
    expect(f).toEqual(expect.arrayContaining(['employee_id', 'legajo', 'store_id', 'incident_date', 'situation_type_id', 'measure_type_id', 'template_id', 'description']));
  });
  it('exige campos del modelo, antecedentes y respaldo según el tipo de medida', () => {
    const issues = validateRequest({ ...emptyRequestData(), store_id: 's-1', incident_date: '2030-01-01' }, {
      measure: { id: 'm', name: 'Suspensión', description: '', active: true, requires_attachment: true, requires_antecedentes: true, order: 1 },
      fields: [{ key: 'dias', label: 'Días', type: 'number', required: true }], stores: [], managerStoreIds: ['s-2'], today: '2026-11-16',
    });
    const f = issues.map((i) => i.field);
    expect(f).toEqual(expect.arrayContaining(['antecedentes', 'attachments', 'extra.dias', 'store_id', 'incident_date']));
  });
});

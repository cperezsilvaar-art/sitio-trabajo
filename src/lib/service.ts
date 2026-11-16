// Operaciones del portal. Cada operación verifica permisos con las reglas de workflow.ts,
// escribe los cambios y deja el registro de auditoría correspondiente.

import type { Backend } from './backend/types';
import { buildValues, bytesToBase64, fillDocx, renderForRequest, sha256 } from './template';
import type {
  Attachment, AuditEvent, DisciplinaryRequest, Employee, FieldDef, FinalDocument, MeasureType, Notification, Policy,
  Profile, RequestData, RequestRevision, RequestStatus, SituationType, Store, StoredFile, TableName, Template,
  TemplateVersion,
} from './types';
import { DOCX_MIME } from './seed';
import { canTransition, denyReason, isApprover, resolveCoordinator, validateRequest, type Action } from './workflow';

export interface Snapshot {
  profiles: Profile[];
  stores: Store[];
  employees: Employee[];
  templates: Template[];
  template_versions: TemplateVersion[];
  measure_types: MeasureType[];
  situation_types: SituationType[];
  requests: DisciplinaryRequest[];
  request_revisions: RequestRevision[];
  final_documents: FinalDocument[];
  audit_events: AuditEvent[];
  notifications: Notification[];
  policy: Policy;
}

export const EMPTY_SNAPSHOT: Snapshot = {
  profiles: [], stores: [], employees: [], templates: [], template_versions: [], measure_types: [], situation_types: [],
  requests: [], request_revisions: [], final_documents: [], audit_events: [], notifications: [],
  policy: {
    id: 'policy', approver_roles: ['coordinador', 'admin_rh'], restrict_to_area: true, routing: {},
    comment_required_on_approve: false, review_sla_days: 2, draft_disclaimer: '',
  },
};

export const uid = (p: string) => `${p}-${crypto.randomUUID()}`;
const nowIso = () => new Date().toISOString();

export function emptyRequestData(): RequestData {
  return {
    employee_id: '', employee_name: '', legajo: '', position: '', store_id: '', store_name: '', area: '',
    incident_date: '', situation_type_id: '', situation_type_name: '', measure_type_id: '', measure_type_name: '',
    template_id: '', template_version_id: '', description: '', antecedentes: '', extra: {}, attachments: [],
  };
}

export function pickData(r: RequestData): RequestData {
  const e = emptyRequestData();
  const out = {} as Record<string, unknown>;
  for (const k of Object.keys(e)) out[k] = (r as unknown as Record<string, unknown>)[k];
  return JSON.parse(JSON.stringify(out)) as RequestData;
}

export class PortalError extends Error {}

export class PortalService {
  constructor(private backend: Backend, private user: Profile, private snap: () => Snapshot) {}

  async load(): Promise<Snapshot> {
    const tables: TableName[] = [
      'profiles', 'stores', 'employees', 'templates', 'template_versions', 'measure_types', 'situation_types',
      'requests', 'request_revisions', 'final_documents', 'audit_events', 'notifications', 'policy',
    ];
    const rows = await Promise.all(tables.map((t) => this.backend.all(t)));
    const s = Object.fromEntries(tables.map((t, i) => [t, rows[i]])) as unknown as Snapshot & { policy: Policy[] };
    return { ...s, policy: (s.policy as unknown as Policy[])[0] ?? EMPTY_SNAPSHOT.policy };
  }

  /* ---------- utilidades ---------- */

  private async log(e: Omit<AuditEvent, 'id' | 'actor_id' | 'actor_name' | 'actor_role' | 'at' | 'internal'> & { internal?: boolean }) {
    const ev: AuditEvent = {
      id: uid('ev'), actor_id: this.user.id, actor_name: this.user.name, actor_role: this.user.role, at: nowIso(),
      internal: false, ...e,
    };
    await this.backend.insert('audit_events', [ev]);
  }

  private async notify(user_id: string | null | undefined, request_id: string | null, message: string) {
    if (!user_id || user_id === this.user.id) return;
    await this.backend.insert<Notification>('notifications', [{ id: uid('n'), user_id, request_id, message, read: false, at: nowIso() }]);
  }

  private request(id: string) {
    const r = this.snap().requests.find((x) => x.id === id);
    if (!r) throw new PortalError('Solicitud inexistente o sin acceso.');
    return r;
  }

  private ensure(action: Action, r: DisciplinaryRequest) {
    const why = denyReason(action, this.user, r, this.snap().policy);
    if (why) throw new PortalError(why);
  }

  private async setStatus(r: DisciplinaryRequest, to: RequestStatus, patch: Partial<DisciplinaryRequest> = {}) {
    if (!canTransition(r.status, to)) throw new PortalError(`No se puede pasar de "${r.status}" a "${to}".`);
    await this.backend.update<DisciplinaryRequest>('requests', r.id, { ...patch, status: to, updated_at: nowIso() });
  }

  templateVersion(id: string) {
    return this.snap().template_versions.find((v) => v.id === id) ?? null;
  }

  currentVersion(templateId: string) {
    const t = this.snap().templates.find((x) => x.id === templateId);
    return t?.current_version_id ? this.templateVersion(t.current_version_id) : null;
  }

  fieldsFor(data: RequestData): FieldDef[] {
    return this.templateVersion(data.template_version_id)?.fields ?? [];
  }

  validate(data: RequestData) {
    const s = this.snap();
    return validateRequest(data, {
      measure: s.measure_types.find((m) => m.id === data.measure_type_id),
      fields: this.fieldsFor(data),
      stores: s.stores,
      managerStoreIds: this.user.store_ids,
    });
  }

  renderDraft(r: DisciplinaryRequest | (RequestData & { number: string; manager_name: string })) {
    const v = this.templateVersion(r.template_version_id);
    if (!v) return '';
    return renderForRequest(v.body, v.fields, r, { final: false });
  }

  /* ---------- archivos ---------- */

  async uploadFile(file: File): Promise<Attachment> {
    if (file.size > 10 * 1024 * 1024) throw new PortalError(`"${file.name}" supera los 10 MB.`);
    const buf = new Uint8Array(await file.arrayBuffer());
    const f: StoredFile = {
      id: uid('f'), name: file.name, mime: file.type || 'application/octet-stream', size: file.size,
      data: bytesToBase64(buf), created_at: nowIso(), created_by: this.user.id,
    };
    await this.backend.insert('files', [f]);
    return { file_id: f.id, name: f.name, size: f.size, mime: f.mime, uploaded_at: f.created_at, uploaded_by: this.user.name };
  }

  async getFile(id: string): Promise<StoredFile | null> {
    const all = await this.backend.all<StoredFile>('files');
    return all.find((f) => f.id === id) ?? null;
  }

  /* ---------- solicitudes: gerente ---------- */

  async createDraft(data: RequestData): Promise<string> {
    if (this.user.role !== 'gerente') throw new PortalError('Sólo los gerentes inician solicitudes de medidas disciplinarias.');
    const d = new Date();
    const number = `MD-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
    const r: DisciplinaryRequest = {
      ...pickData(data), id: uid('r'), number, status: 'borrador', manager_id: this.user.id, manager_name: this.user.name,
      coordinator_id: null, coordinator_name: null, revision: 0, created_at: nowIso(), updated_at: nowIso(),
      submitted_at: null, decided_at: null, approved_by: null, approved_by_name: null, approved_at: null,
      approved_revision: null, final_document_id: null, closed_at: null, notified_at: null,
    };
    await this.backend.insert('requests', [r]);
    await this.log({ entity: 'request', entity_id: r.id, action: 'creada', to_status: 'borrador', comment: `Borrador iniciado para ${r.employee_name || 'colaborador sin elegir'}.` });
    return r.id;
  }

  async saveDraft(id: string, data: RequestData) {
    const r = this.request(id);
    this.ensure('editar', r);
    await this.backend.update<DisciplinaryRequest>('requests', id, { ...pickData(data), updated_at: nowIso() });
    await this.log({ entity: 'request', entity_id: id, action: 'guardada', comment: 'Cambios guardados en el borrador.' });
  }

  async submit(id: string, data: RequestData, note = '') {
    const r = this.request(id);
    this.ensure('enviar', r);
    const issues = this.validate(data);
    if (issues.length) throw new PortalError(issues.map((i) => i.message).join('\n'));
    const s = this.snap();
    // El listado de perfiles que ve un gerente puede estar limitado: se usa la política de ruteo.
    const coord = resolveCoordinator(data.area, s.policy, s.profiles);
    const coordinator_id = coord?.id ?? s.policy.routing[data.area] ?? null;
    if (!coordinator_id) throw new PortalError(`No hay coordinador de RH asignado al ${data.area}. Avise a RH.`);
    const coordinator_name = coord?.name ?? null;

    const revision = r.revision + 1;
    const merged = { ...r, ...pickData(data) };
    const tv = this.templateVersion(data.template_version_id);
    if (!tv) throw new PortalError('El modelo elegido no tiene una versión vigente.');
    const rev: RequestRevision = {
      id: uid('rev'), request_id: id, revision, data: pickData(data), rendered: this.renderDraft(merged),
      template_version: tv.version, created_by: this.user.id, created_by_name: this.user.name, created_at: nowIso(),
      reason: revision === 1 ? 'Envío inicial a RH.' : note || 'Reenvío con las modificaciones solicitadas.',
    };
    await this.backend.update<DisciplinaryRequest>('requests', id, { ...pickData(data), revision, coordinator_id, coordinator_name, updated_at: nowIso() });
    await this.backend.insert('request_revisions', [rev]);
    const from = r.status;
    await this.setStatus({ ...r, revision }, 'enviada', { submitted_at: nowIso() });
    await this.log({
      entity: 'request', entity_id: id, action: revision === 1 ? 'enviada' : 'reenviada', from_status: from, to_status: 'enviada',
      revision, comment: rev.reason,
    });
    await this.log({ entity: 'request', entity_id: id, action: 'asignada', revision, comment: `Asignada a ${coordinator_name ?? 'coordinación de RH'} (${data.area}).` });
    await this.notify(coordinator_id, id, `${this.user.name} envió ${r.number} (${data.measure_type_name} – ${data.employee_name}) para su aprobación.`);
  }

  async registerNotification(id: string, date: string, comment: string) {
    const r = this.request(id);
    this.ensure('registrar_notificacion', r);
    await this.backend.update<DisciplinaryRequest>('requests', id, { notified_at: date, updated_at: nowIso() });
    await this.log({ entity: 'request', entity_id: id, action: 'notificada', revision: r.approved_revision, comment: `Notificada al colaborador el ${date.slice(0, 10)}. ${comment}`.trim() });
    await this.notify(r.coordinator_id, id, `${r.number}: el gerente registró la notificación al colaborador.`);
  }

  /** Cambio posterior a la aprobación: la aprobación anterior deja de estar vigente y se requiere una nueva. */
  async rectify(id: string, reason: string) {
    const r = this.request(id);
    this.ensure('rectificar', r);
    if (!reason.trim()) throw new PortalError('Indique el motivo de la rectificación.');
    await this.setStatus(r, 'borrador', {
      approved_by: null, approved_by_name: null, approved_at: null, approved_revision: null, final_document_id: null, decided_at: null,
    });
    await this.log({
      entity: 'request', entity_id: id, action: 'rectificacion_iniciada', from_status: 'aprobada', to_status: 'borrador', revision: r.revision,
      comment: `Se deja sin efecto la versión definitiva v${r.approved_revision} (aprobada por ${r.approved_by_name}). Motivo: ${reason}`,
    });
    await this.notify(r.manager_id, id, `${r.number}: se inició una rectificación. Corrija y reenvíe para una nueva aprobación.`);
    await this.notify(r.coordinator_id, id, `${r.number}: se inició una rectificación de una medida aprobada.`);
  }

  /* ---------- solicitudes: RH ---------- */

  async take(id: string) {
    const r = this.request(id);
    this.ensure('tomar', r);
    await this.setStatus(r, 'pendiente_revision', { coordinator_id: this.user.id, coordinator_name: this.user.name });
    await this.log({ entity: 'request', entity_id: id, action: 'tomada', from_status: 'enviada', to_status: 'pendiente_revision', revision: r.revision, comment: `${this.user.name} inició la revisión.` });
    await this.notify(r.manager_id, id, `${r.number}: RH está revisando su solicitud.`);
  }

  async decide(id: string, decision: 'aprobar' | 'rechazar' | 'pedir_modificaciones', comment: string) {
    const r = this.request(id);
    this.ensure(decision, r);
    const policy = this.snap().policy;
    if (decision !== 'aprobar' && !comment.trim()) throw new PortalError('Escriba el motivo: el gerente lo verá como devolución.');
    if (decision === 'aprobar' && policy.comment_required_on_approve && !comment.trim()) throw new PortalError('La política exige un comentario al aprobar.');
    const at = nowIso();

    if (decision === 'pedir_modificaciones') {
      await this.setStatus(r, 'requiere_modificaciones', { decided_at: at });
      await this.log({ entity: 'request', entity_id: id, action: 'modificaciones_solicitadas', from_status: r.status, to_status: 'requiere_modificaciones', revision: r.revision, comment });
      await this.notify(r.manager_id, id, `${r.number}: RH solicita modificaciones. ${comment}`);
      return;
    }
    if (decision === 'rechazar') {
      await this.setStatus(r, 'rechazada', { decided_at: at });
      await this.log({ entity: 'request', entity_id: id, action: 'rechazada', from_status: r.status, to_status: 'rechazada', revision: r.revision, comment });
      await this.notify(r.manager_id, id, `${r.number}: la solicitud fue rechazada. ${comment}`);
      return;
    }

    // Aprobación: se genera la versión definitiva a partir de la revisión enviada (no de datos editables).
    const rev = this.snap().request_revisions.find((x) => x.request_id === id && x.revision === r.revision);
    if (!rev) throw new PortalError('No se encontró la versión enviada.');
    const tv = this.templateVersion(rev.data.template_version_id);
    if (!tv) throw new PortalError('No se encontró la versión del modelo.');
    const src = { ...rev.data, number: r.number, manager_name: r.manager_name };
    const content = renderForRequest(tv.body, tv.fields, src, { final: true, approved_by_name: this.user.name, issued_at: at });
    let docx_file_id: string | null = null;
    if (tv.file_id && tv.file_name?.toLowerCase().endsWith('.docx')) {
      const tpl = await this.getFile(tv.file_id);
      if (tpl) {
        const values = buildValues(rev.data, { number: r.number, manager_name: r.manager_name, issued_at: at, city: 'Ciudad Autónoma de Buenos Aires', approved_by_name: this.user.name, final: true }, tv.fields);
        const bytes = await fillDocx(tpl.data, values);
            const f: StoredFile = {
          id: uid('f'), name: `${r.number} – ${rev.data.measure_type_name} – ${rev.data.employee_name} (DEFINITIVO v${r.revision}).docx`,
          mime: DOCX_MIME, size: bytes.length, data: bytesToBase64(bytes), created_at: at, created_by: this.user.id,
        };
        await this.backend.insert('files', [f]);
        docx_file_id = f.id;
      }
    }
    const doc: FinalDocument = {
      id: uid('doc'), request_id: id, revision: r.revision, template_version_id: tv.id, content, sha256: await sha256(content),
      approved_by: this.user.id, approved_by_name: this.user.name, approved_at: at, docx_file_id,
    };
    await this.backend.insert('final_documents', [doc]);
    await this.setStatus(r, 'aprobada', {
      decided_at: at, approved_by: this.user.id, approved_by_name: this.user.name, approved_at: at,
      approved_revision: r.revision, final_document_id: doc.id,
    });
    await this.log({
      entity: 'request', entity_id: id, action: 'aprobada', from_status: r.status, to_status: 'aprobada', revision: r.revision,
      comment: `Aprobada la versión ${r.revision} (modelo "${tv.template_id}" v${tv.version}). Huella SHA-256: ${doc.sha256.slice(0, 16)}… ${comment}`.trim(),
    });
    await this.notify(r.manager_id, id, `${r.number}: medida APROBADA. Ya puede descargar el documento definitivo y notificar al colaborador.`);
  }

  async close(id: string, comment: string) {
    const r = this.request(id);
    this.ensure('cerrar', r);
    await this.setStatus(r, 'cerrada', { closed_at: nowIso() });
    await this.log({ entity: 'request', entity_id: id, action: 'cerrada', from_status: r.status, to_status: 'cerrada', revision: r.revision, comment: comment || 'Caso cerrado.' });
    await this.notify(r.manager_id, id, `${r.number}: el caso fue cerrado por RH.`);
  }

  async addComment(id: string, text: string, internal: boolean) {
    const r = this.request(id);
    if (!text.trim()) return;
    if (internal) this.ensure('observar', r);
    await this.log({ entity: 'request', entity_id: id, action: internal ? 'observacion_interna' : 'comentario', revision: r.revision, comment: text, internal });
    if (!internal) await this.notify(this.user.id === r.manager_id ? r.coordinator_id : r.manager_id, id, `${r.number}: nuevo comentario de ${this.user.name}.`);
  }

  async logDownload(id: string, what: string) {
    await this.log({ entity: 'request', entity_id: id, action: 'documento_descargado', comment: what, internal: true });
  }

  async markRead(ids: string[]) {
    for (const id of ids) await this.backend.update<Notification>('notifications', id, { read: true });
  }

  /* ---------- administración de modelos (RH) ---------- */

  private ensureAdmin() {
    if (this.user.role !== 'admin_rh') throw new PortalError('Sección exclusiva de administradores de RH.');
  }

  async createTemplate(meta: Pick<Template, 'title' | 'category' | 'description' | 'measure_type_ids'>, version: Pick<TemplateVersion, 'body' | 'fields' | 'change_notes'>, file?: File) {
    this.ensureAdmin();
    const t: Template = { id: uid('t'), ...meta, active: true, current_version_id: null, created_at: nowIso(), updated_at: nowIso() };
    await this.backend.insert('templates', [t]);
    await this.log({ entity: 'template', entity_id: t.id, action: 'modelo_creado', comment: `Se creó el modelo "${t.title}".` });
    await this.newVersion(t.id, version, file, t.title);
    return t.id;
  }

  async updateTemplateMeta(id: string, patch: Partial<Pick<Template, 'title' | 'category' | 'description' | 'measure_type_ids' | 'active'>>) {
    this.ensureAdmin();
    const t = this.snap().templates.find((x) => x.id === id);
    await this.backend.update<Template>('templates', id, { ...patch, updated_at: nowIso() });
    const what = 'active' in patch ? (patch.active ? 'Modelo activado.' : 'Modelo desactivado.') : 'Datos del modelo actualizados.';
    await this.log({ entity: 'template', entity_id: id, action: 'modelo_actualizado', comment: `${t?.title ?? id}: ${what}` });
  }

  /** Publica una nueva versión vigente. Las anteriores se conservan para el historial y para las solicitudes que las usaron. */
  async newVersion(templateId: string, v: Pick<TemplateVersion, 'body' | 'fields' | 'change_notes'>, file?: File, title?: string) {
    this.ensureAdmin();
    const prev = this.snap().template_versions.filter((x) => x.template_id === templateId);
    const version = prev.reduce((m, x) => Math.max(m, x.version), 0) + 1;
    let file_id: string | null = null;
    let file_name: string | null = null;
    if (file) {
      const a = await this.uploadFile(file);
      file_id = a.file_id;
      file_name = a.name;
    } else if (prev.length) {
      const last = prev.sort((a, b) => b.version - a.version)[0];
      file_id = last.file_id;
      file_name = last.file_name;
    }
    const tv: TemplateVersion = {
      id: uid('tv'), template_id: templateId, version, body: v.body, fields: v.fields, file_id, file_name,
      change_notes: v.change_notes || (version === 1 ? 'Versión inicial.' : 'Nueva versión.'),
      created_by: this.user.id, created_by_name: this.user.name, created_at: nowIso(),
    };
    await this.backend.insert('template_versions', [tv]);
    await this.backend.update<Template>('templates', templateId, { current_version_id: tv.id, updated_at: nowIso() });
    await this.log({ entity: 'template', entity_id: templateId, action: 'version_publicada', comment: `${title ?? templateId}: versión ${version} vigente. ${tv.change_notes}` });
    return tv.id;
  }

  /** Vuelve a dejar vigente una versión anterior (se registra como una versión nueva, con el mismo contenido). */
  async restoreVersion(templateId: string, versionId: string) {
    const old = this.templateVersion(versionId);
    if (!old) throw new PortalError('Versión inexistente.');
    await this.newVersion(templateId, { body: old.body, fields: old.fields, change_notes: `Se restaura el contenido de la versión ${old.version}.` });
  }

  async saveMeasureType(m: MeasureType, isNew: boolean) {
    this.ensureAdmin();
    if (isNew) await this.backend.insert('measure_types', [m]);
    else await this.backend.update<MeasureType>('measure_types', m.id, m);
    await this.log({ entity: 'measure_type', entity_id: m.id, action: isNew ? 'tipo_creado' : 'tipo_actualizado', comment: `${m.name} (${m.active ? 'activo' : 'inactivo'}).` });
  }

  async saveSituationType(s: SituationType, isNew: boolean) {
    this.ensureAdmin();
    if (isNew) await this.backend.insert('situation_types', [s]);
    else await this.backend.update<SituationType>('situation_types', s.id, s);
    await this.log({ entity: 'config', entity_id: s.id, action: isNew ? 'situacion_creada' : 'situacion_actualizada', comment: `${s.name} (${s.active ? 'activa' : 'inactiva'}).` });
  }

  async savePolicy(p: Policy) {
    this.ensureAdmin();
    if (!p.approver_roles.length) throw new PortalError('Debe haber al menos un rol aprobador.');
    if (p.approver_roles.includes('gerente')) throw new PortalError('Los gerentes no pueden ser aprobadores.');
    await this.backend.update<Policy>('policy', 'policy', p);
    await this.log({ entity: 'config', entity_id: 'policy', action: 'politica_actualizada', comment: `Aprobadores: ${p.approver_roles.join(', ')}; restringir por área: ${p.restrict_to_area ? 'sí' : 'no'}; plazo de revisión: ${p.review_sla_days} días hábiles.` });
  }

  async saveProfile(p: Profile, isNew: boolean) {
    this.ensureAdmin();
    if (p.id === this.user.id && (!p.active || p.role !== 'admin_rh')) throw new PortalError('No puede quitarse a sí mismo el rol de administrador.');
    if (isNew) await this.backend.insert('profiles', [p]);
    else await this.backend.update<Profile>('profiles', p.id, p);
    await this.log({ entity: 'user', entity_id: p.id, action: isNew ? 'usuario_creado' : 'usuario_actualizado', comment: `${p.name} – ${p.role} – ${p.active ? 'activo' : 'inactivo'}.` });
  }

  isApprover() {
    return isApprover(this.user, this.snap().policy);
  }
}

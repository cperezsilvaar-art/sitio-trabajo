// Modelo de datos del Portal RH. Los nombres de tabla y columnas coinciden con supabase/schema.sql.

export type Role = 'gerente' | 'coordinador' | 'admin_rh';

export const ROLE_LABEL: Record<Role, string> = {
  gerente: 'Gerente de tienda',
  coordinador: 'Coordinador/a de RH',
  admin_rh: 'Administrador/a de RH',
};

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  /** Gerente: tiendas a su cargo. */
  store_ids: string[];
  /** Coordinador: áreas que cubre. */
  areas: string[];
  active: boolean;
}

export interface Store {
  id: string;
  name: string;
  area: string;
}

export interface Employee {
  id: string;
  legajo: string;
  name: string;
  position: string;
  store_id: string;
  dni?: string;
  hire_date?: string;
  active: boolean;
}

/* ---------- Biblioteca y modelos ---------- */

export type TemplateCategory = 'sancion' | 'comunicacion' | 'procedimiento' | 'instructivo' | 'otro';

export const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  sancion: 'Modelos de medidas disciplinarias',
  comunicacion: 'Comunicaciones formales',
  procedimiento: 'Procedimientos disciplinarios',
  instructivo: 'Instructivos para gerentes',
  otro: 'Otros documentos institucionales',
};

export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select';

/** Campo adicional que el gerente debe completar al usar un modelo (definido por RH, sin código). */
export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  help?: string;
}

export interface Template {
  id: string;
  title: string;
  category: TemplateCategory;
  description: string;
  active: boolean;
  /** Tipos de medida (solicitud) que pueden usar este modelo. Vacío = documento sólo de consulta. */
  measure_type_ids: string[];
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Versión de un modelo. Inmutable: para cambiar algo se crea otra versión. */
export interface TemplateVersion {
  id: string;
  template_id: string;
  version: number;
  /** Texto del modelo con marcadores {{campo}}. Se usa para la vista previa, impresión y PDF. */
  body: string;
  /** Campos adicionales que pide esta versión. */
  fields: FieldDef[];
  /** Archivo original (Word con marcadores, PDF, etc.). */
  file_id: string | null;
  file_name: string | null;
  change_notes: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export interface MeasureType {
  id: string;
  name: string;
  description: string;
  active: boolean;
  requires_attachment: boolean;
  requires_antecedentes: boolean;
  /** Área de RH que revisa: por defecto la del coordinador de la tienda. */
  order: number;
}

export interface SituationType {
  id: string;
  name: string;
  active: boolean;
}

/* ---------- Solicitudes ---------- */

export type RequestStatus =
  | 'borrador'
  | 'enviada'
  | 'pendiente_revision'
  | 'requiere_modificaciones'
  | 'aprobada'
  | 'rechazada'
  | 'cerrada';

export const STATUS_LABEL: Record<RequestStatus, string> = {
  borrador: 'Borrador',
  enviada: 'Enviada a RH',
  pendiente_revision: 'Pendiente de revisión',
  requiere_modificaciones: 'Requiere modificaciones',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cerrada: 'Cerrada',
};

export const STATUS_STYLE: Record<RequestStatus, string> = {
  borrador: 'bg-slate-100 text-slate-700 ring-slate-300',
  enviada: 'bg-sky-50 text-sky-800 ring-sky-300',
  pendiente_revision: 'bg-amber-50 text-amber-800 ring-amber-300',
  requiere_modificaciones: 'bg-orange-50 text-orange-800 ring-orange-300',
  aprobada: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  rechazada: 'bg-rose-50 text-rose-800 ring-rose-300',
  cerrada: 'bg-slate-200 text-slate-700 ring-slate-400',
};

export interface Attachment {
  file_id: string;
  name: string;
  size: number;
  mime: string;
  uploaded_at: string;
  uploaded_by: string;
}

/** Datos que completa el gerente. Es lo que se versiona en cada envío. */
export interface RequestData {
  employee_id: string;
  employee_name: string;
  legajo: string;
  position: string;
  store_id: string;
  store_name: string;
  area: string;
  incident_date: string;
  situation_type_id: string;
  situation_type_name: string;
  measure_type_id: string;
  measure_type_name: string;
  template_id: string;
  template_version_id: string;
  description: string;
  antecedentes: string;
  extra: Record<string, string>;
  attachments: Attachment[];
}

export interface DisciplinaryRequest extends RequestData {
  id: string;
  number: string;
  status: RequestStatus;
  manager_id: string;
  manager_name: string;
  coordinator_id: string | null;
  coordinator_name: string | null;
  /** Número de la versión vigente de los datos (1, 2, 3…). */
  revision: number;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  /** Aprobación vigente (si existe). */
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  approved_revision: number | null;
  final_document_id: string | null;
  closed_at: string | null;
  notified_at: string | null;
}

/** Fotografía inmutable de la solicitud en cada envío / aprobación. */
export interface RequestRevision {
  id: string;
  request_id: string;
  revision: number;
  data: RequestData;
  /** Texto del documento generado con esa versión de datos. */
  rendered: string;
  template_version: number;
  created_by: string;
  created_by_name: string;
  created_at: string;
  reason: string;
}

/** Documento definitivo, generado sólo al aprobar. Inmutable. */
export interface FinalDocument {
  id: string;
  request_id: string;
  revision: number;
  template_version_id: string;
  content: string;
  /** SHA-256 del contenido: permite verificar que no fue alterado. */
  sha256: string;
  approved_by: string;
  approved_by_name: string;
  approved_at: string;
  docx_file_id: string | null;
}

export type EventAction =
  | 'creada'
  | 'guardada'
  | 'enviada'
  | 'asignada'
  | 'tomada'
  | 'modificaciones_solicitadas'
  | 'reenviada'
  | 'aprobada'
  | 'rechazada'
  | 'cerrada'
  | 'notificada'
  | 'rectificacion_iniciada'
  | 'observacion_interna'
  | 'comentario'
  | 'documento_descargado'
  | 'adjunto_agregado'
  | 'adjunto_quitado';

/** Historial de auditoría. Sólo se agregan registros: nunca se editan ni borran. */
export interface AuditEvent {
  id: string;
  /** Solicitud, modelo o configuración a la que se refiere. */
  entity: 'request' | 'template' | 'measure_type' | 'config' | 'user';
  entity_id: string;
  action: EventAction | string;
  actor_id: string;
  actor_name: string;
  actor_role: Role;
  at: string;
  from_status?: RequestStatus | null;
  to_status?: RequestStatus | null;
  revision?: number | null;
  comment?: string;
  /** Las observaciones internas no las ve el gerente. */
  internal: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  request_id: string | null;
  message: string;
  read: boolean;
  at: string;
}

/** Políticas configurables del circuito (una sola fila, id = 'policy'). */
export interface Policy {
  id: 'policy';
  /** Roles que pueden aprobar / rechazar. */
  approver_roles: Role[];
  /** Si el coordinador sólo puede decidir solicitudes de sus áreas. */
  restrict_to_area: boolean;
  /** Área → coordinador responsable (si no se define, se toma el primero que cubra el área). */
  routing: Record<string, string>;
  /** Exigir comentario al aprobar. */
  comment_required_on_approve: boolean;
  /** Días para revisar antes de marcar la solicitud como demorada. */
  review_sla_days: number;
  /** Texto legal al pie de los borradores. */
  draft_disclaimer: string;
}

export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  /** Contenido en base64. */
  data: string;
  created_at: string;
  created_by: string;
}

export type TableName =
  | 'profiles'
  | 'stores'
  | 'employees'
  | 'templates'
  | 'template_versions'
  | 'measure_types'
  | 'situation_types'
  | 'requests'
  | 'request_revisions'
  | 'final_documents'
  | 'audit_events'
  | 'notifications'
  | 'policy'
  | 'files';

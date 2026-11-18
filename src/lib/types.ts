// Modelo de datos del Portal RH. Los nombres de tabla y columnas coinciden con supabase/schema.sql.

export type Role = 'gerente' | 'gerente_area' | 'coordinador' | 'admin_rh';

export const ROLE_LABEL: Record<Role, string> = {
  gerente: 'Gerente de tienda',
  gerente_area: 'Gerente de área',
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
  /** Gestiones que usan este modelo (p. ej. la notificación de vacaciones). */
  gestion_kinds?: GestionKind[];
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
  entity: 'request' | 'gestion' | 'announcement' | 'vacancy' | 'headcount' | 'template' | 'measure_type' | 'config' | 'user';
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
  /** Pantalla a la que lleva el aviso. */
  link?: string | null;
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
  /** Días hábiles para presentar el certificado médico desde el inicio de la licencia. */
  certificate_days?: number;
  /** Días corridos de anticipación para notificar vacaciones (art. 154 LCT: 45). */
  vacation_notice_days?: number;
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
  | 'files'
  | 'gestiones'
  | 'announcements'
  | 'announcement_reads'
  | 'headcount'
  | 'vacancies';

/* ---------- Licencias y vacaciones ---------- */

export type GestionKind = 'licencia' | 'vacaciones';

export const GESTION_LABEL: Record<GestionKind, string> = { licencia: 'Licencia', vacaciones: 'Vacaciones' };

export type GestionStatus =
  | 'pendiente_certificado'
  | 'pendiente_firma'
  | 'enviada'
  | 'observada'
  | 'recibida'
  | 'cerrada'
  | 'anulada';

export const GESTION_STATUS_LABEL: Record<GestionStatus, string> = {
  pendiente_certificado: 'Falta el certificado',
  pendiente_firma: 'Falta la notificación firmada',
  enviada: 'Enviada a RH',
  observada: 'Observada por RH',
  recibida: 'Recibida por RH',
  cerrada: 'Cerrada',
  anulada: 'Anulada',
};

export const GESTION_STATUS_STYLE: Record<GestionStatus, string> = {
  pendiente_certificado: 'bg-amber-50 text-amber-800 ring-amber-300',
  pendiente_firma: 'bg-amber-50 text-amber-800 ring-amber-300',
  enviada: 'bg-sky-50 text-sky-800 ring-sky-300',
  observada: 'bg-orange-50 text-orange-800 ring-orange-300',
  recibida: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  cerrada: 'bg-slate-200 text-slate-700 ring-slate-400',
  anulada: 'bg-rose-50 text-rose-800 ring-rose-300',
};

/** Tipos de licencia. Las que tienen "certificate: true" exigen certificado. */
export const LEAVE_TYPES: { id: string; name: string; certificate: boolean; hint?: string }[] = [
  { id: 'enfermedad', name: 'Enfermedad inculpable', certificate: true, hint: 'Art. 208 LCT. Certificado con fecha, días de reposo, firma y sello del médico.' },
  { id: 'accidente', name: 'Accidente de trabajo / in itinere (ART)', certificate: true, hint: 'Hacer además la denuncia a la ART.' },
  { id: 'familiar', name: 'Atención de familiar enfermo', certificate: true },
  { id: 'maternidad', name: 'Maternidad', certificate: true, hint: 'Certificado con fecha probable de parto.' },
  { id: 'nacimiento', name: 'Nacimiento de hijo/a', certificate: true, hint: 'Partida o constancia de nacimiento.' },
  { id: 'matrimonio', name: 'Matrimonio', certificate: true, hint: 'Acta o constancia del Registro Civil.' },
  { id: 'fallecimiento', name: 'Fallecimiento de familiar', certificate: true, hint: 'Acta o constancia de defunción.' },
  { id: 'examen', name: 'Examen (estudios)', certificate: true, hint: 'Constancia de la institución.' },
  { id: 'mudanza', name: 'Mudanza', certificate: false },
  { id: 'otra', name: 'Otra', certificate: false },
];

export interface Gestion {
  id: string;
  number: string;
  kind: GestionKind;
  status: GestionStatus;
  manager_id: string;
  manager_name: string;
  coordinator_id: string | null;
  coordinator_name: string | null;
  employee_id: string;
  employee_name: string;
  legajo: string;
  position: string;
  hire_date: string;
  store_id: string;
  store_name: string;
  area: string;
  start_date: string;
  end_date: string;
  /** Días corridos (vacaciones) o días de reposo/licencia. */
  days: number;
  /** Licencia: tipo y fecha en que avisó el colaborador. */
  leave_type: string;
  leave_type_name: string;
  notice_date: string;
  /** Vacaciones: período (año) al que corresponden y versión del modelo usado. */
  period_year: number;
  template_version_id: string;
  notes: string;
  /** Certificados (licencia) o notificación firmada (vacaciones) y otros adjuntos. */
  attachments: (Attachment & { role: 'certificado' | 'firmada' | 'otro' })[];
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  return_date: string | null;
}

/* ---------- Cartelera de comunicados ---------- */

export type AnnouncementPriority = 'normal' | 'importante' | 'urgente';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  /** Áreas destinatarias. Vacío = todos los gerentes. */
  areas: string[];
  pinned: boolean;
  active: boolean;
  author_id: string;
  author_name: string;
  published_at: string;
  updated_at: string;
  /** Hasta cuándo se muestra en la cartelera (vacío = sin vencimiento). */
  expires_at: string | null;
  attachments: Attachment[];
}

/** Constancia de lectura de un comunicado. */
export interface AnnouncementRead {
  id: string;
  announcement_id: string;
  user_id: string;
  user_name: string;
  at: string;
}

/* ---------- Headcount y vacantes ---------- */

/** Puestos autorizados de una tienda. id = `${store_id}:${position}`. */
export interface Headcount {
  id: string;
  store_id: string;
  position: string;
  authorized: number;
  updated_by_name: string;
  updated_at: string;
}

export type VacancyStatus =
  | 'pendiente_area'
  | 'rechazada'
  | 'autorizada'
  | 'en_busqueda'
  | 'entrevistas'
  | 'preocupacional'
  | 'ingreso'
  | 'cubierta'
  | 'cancelada';

export const VACANCY_STATUS_LABEL: Record<VacancyStatus, string> = {
  pendiente_area: 'Esperando al gerente de área',
  rechazada: 'Rechazada por el gerente de área',
  autorizada: 'Autorizada · esperando a RH',
  en_busqueda: 'Búsqueda publicada',
  entrevistas: 'Entrevistas y selección',
  preocupacional: 'Preocupacional y documentación',
  ingreso: 'Ingreso programado',
  cubierta: 'Cubierta',
  cancelada: 'Cancelada',
};

/** Etapas del "line up", en orden. */
export const VACANCY_STAGES: VacancyStatus[] = ['pendiente_area', 'autorizada', 'en_busqueda', 'entrevistas', 'preocupacional', 'ingreso', 'cubierta'];

export const VACANCY_STAGE_SHORT: Record<VacancyStatus, string> = {
  pendiente_area: 'Solicitada', rechazada: 'Rechazada', autorizada: 'Autorizada', en_busqueda: 'Búsqueda', entrevistas: 'Entrevistas',
  preocupacional: 'Preocupacional', ingreso: 'Ingreso', cubierta: 'Cubierta', cancelada: 'Cancelada',
};

export const VACANCY_STATUS_STYLE: Record<VacancyStatus, string> = {
  pendiente_area: 'bg-amber-50 text-amber-800 ring-amber-300',
  rechazada: 'bg-rose-50 text-rose-800 ring-rose-300',
  autorizada: 'bg-sky-50 text-sky-800 ring-sky-300',
  en_busqueda: 'bg-violet-50 text-violet-800 ring-violet-300',
  entrevistas: 'bg-violet-50 text-violet-800 ring-violet-300',
  preocupacional: 'bg-violet-50 text-violet-800 ring-violet-300',
  ingreso: 'bg-teal-50 text-teal-800 ring-teal-300',
  cubierta: 'bg-emerald-50 text-emerald-800 ring-emerald-300',
  cancelada: 'bg-slate-200 text-slate-700 ring-slate-400',
};

export const VACANCY_REASONS = [
  { id: 'reemplazo', name: 'Reemplazo de un colaborador que se va o se fue' },
  { id: 'nueva', name: 'Posición disponible dentro del headcount' },
] as const;

export const LEAVING_REASONS = ['Renuncia', 'Despido', 'Fin de período de prueba', 'Traslado a otra tienda', 'Jubilación', 'Otro'];

export const SHIFTS = ['Mañana', 'Tarde', 'Noche', 'Rotativo', 'Fin de semana'];

export interface Vacancy {
  id: string;
  number: string;
  status: VacancyStatus;
  store_id: string;
  store_name: string;
  area: string;
  position: string;
  shift: string;
  /** Jornada: completa o parcial. */
  workday: 'completa' | 'parcial';
  reason: 'reemplazo' | 'nueva';
  replaced_employee_id: string;
  replaced_employee_name: string;
  leaving_reason: string;
  leaving_date: string;
  needed_by: string;
  profile_notes: string;
  manager_id: string;
  manager_name: string;
  area_manager_id: string | null;
  area_manager_name: string | null;
  area_decided_at: string | null;
  coordinator_id: string | null;
  coordinator_name: string | null;
  candidate_name: string;
  candidate_legajo: string;
  hire_date: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

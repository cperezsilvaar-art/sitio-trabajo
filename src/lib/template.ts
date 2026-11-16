// Motor de modelos: reemplaza los marcadores {{campo}} del modelo aprobado por RH con los datos
// de la solicitud. Funciona igual para el texto del modelo y para archivos Word (.docx) con marcadores.

import type { DisciplinaryRequest, FieldDef, RequestData } from './types';

/** Campos que el sistema completa solo. RH puede usarlos en cualquier modelo. */
export const STANDARD_FIELDS: { key: string; label: string }[] = [
  { key: 'numero_solicitud', label: 'Número de solicitud' },
  { key: 'colaborador', label: 'Nombre y apellido del colaborador' },
  { key: 'legajo', label: 'Legajo' },
  { key: 'puesto', label: 'Puesto del colaborador' },
  { key: 'tienda', label: 'Tienda' },
  { key: 'area', label: 'Área' },
  { key: 'fecha_incidente', label: 'Fecha del incidente (dd/mm/aaaa)' },
  { key: 'fecha_incidente_larga', label: 'Fecha del incidente en letras' },
  { key: 'tipo_situacion', label: 'Tipo de situación' },
  { key: 'tipo_medida', label: 'Tipo de medida' },
  { key: 'descripcion_hechos', label: 'Descripción de los hechos' },
  { key: 'antecedentes', label: 'Antecedentes' },
  { key: 'gerente', label: 'Gerente solicitante' },
  { key: 'fecha_emision', label: 'Fecha de emisión (dd/mm/aaaa)' },
  { key: 'fecha_emision_larga', label: 'Fecha de emisión en letras' },
  { key: 'ciudad', label: 'Ciudad de emisión' },
  { key: 'aprobado_por', label: 'Aprobado por (vacío en borradores)' },
  { key: 'estado_documento', label: '"BORRADOR – SIN VALIDEZ" o vacío si es definitivo' },
];

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function fmtDateLong(iso: string | null | undefined) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

const TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Marcadores usados en un texto, sin repetir y en orden de aparición. */
export function extractPlaceholders(body: string): string[] {
  const seen = new Set<string>();
  for (const m of body.matchAll(TOKEN)) seen.add(m[1]);
  return [...seen];
}

/** Marcadores del texto que no son estándar ni están definidos como campo del modelo. */
export function unknownPlaceholders(body: string, fields: FieldDef[]) {
  const known = new Set([...STANDARD_FIELDS.map((f) => f.key), ...fields.map((f) => f.key)]);
  return extractPlaceholders(body).filter((k) => !known.has(k));
}

export interface RenderContext {
  number: string;
  manager_name: string;
  issued_at: string;
  city: string;
  approved_by_name?: string | null;
  final: boolean;
}

export function buildValues(data: RequestData, ctx: RenderContext, fields: FieldDef[] = []): Record<string, string> {
  const values: Record<string, string> = {
    numero_solicitud: ctx.number,
    colaborador: data.employee_name,
    legajo: data.legajo,
    puesto: data.position,
    tienda: data.store_name,
    area: data.area,
    fecha_incidente: fmtDate(data.incident_date),
    fecha_incidente_larga: fmtDateLong(data.incident_date),
    tipo_situacion: data.situation_type_name,
    tipo_medida: data.measure_type_name,
    descripcion_hechos: data.description.trim(),
    antecedentes: data.antecedentes.trim() || 'Sin antecedentes registrados.',
    gerente: ctx.manager_name,
    fecha_emision: fmtDate(ctx.issued_at),
    fecha_emision_larga: fmtDateLong(ctx.issued_at),
    ciudad: ctx.city,
    aprobado_por: ctx.final ? ctx.approved_by_name ?? '' : '',
    estado_documento: ctx.final ? '' : 'BORRADOR – SIN VALIDEZ HASTA SU APROBACIÓN POR RRHH',
  };
  for (const f of fields) {
    const v = data.extra?.[f.key] ?? '';
    values[f.key] = f.type === 'date' ? fmtDate(v) : v;
  }
  return values;
}

/** Reemplaza los marcadores. Los que no tienen valor quedan visibles como [campo] para que se noten. */
export function render(body: string, values: Record<string, string>) {
  return body.replace(TOKEN, (_, key: string) => {
    const v = values[key];
    return v === undefined || v === '' ? (key === 'estado_documento' || key === 'aprobado_por' ? '' : `[${key}]`) : v;
  });
}

export function renderForRequest(
  body: string,
  fields: FieldDef[],
  req: Pick<DisciplinaryRequest, 'number' | 'manager_name'> & RequestData,
  opts: { final: boolean; approved_by_name?: string | null; issued_at?: string; city?: string },
) {
  const values = buildValues(req, {
    number: req.number,
    manager_name: req.manager_name,
    issued_at: opts.issued_at ?? new Date().toISOString(),
    city: opts.city ?? 'Ciudad Autónoma de Buenos Aires',
    approved_by_name: opts.approved_by_name,
    final: opts.final,
  }, fields);
  return render(body, values);
}

/* ---------- Word (.docx) ---------- */

export function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

/** Completa un modelo Word que usa los mismos marcadores {{campo}}. Conserva formato, logos y estilos. */
export async function fillDocx(templateB64: string, values: Record<string, string>): Promise<Uint8Array> {
  const [{ default: PizZip }, { default: Docxtemplater }] = await Promise.all([import('pizzip'), import('docxtemplater')]);
  const zip = new PizZip(base64ToBytes(templateB64));
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '{{', end: '}}' },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: (part: { value?: string }) => (part.value ? `[${part.value}]` : ''),
  });
  doc.render(values);
  return doc.getZip().generate({ type: 'uint8array' }) as Uint8Array;
}

/** Marcadores presentes en un .docx (para validar el archivo al cargarlo). */
export async function docxPlaceholders(templateB64: string): Promise<string[]> {
  const { default: PizZip } = await import('pizzip');
  const zip = new PizZip(base64ToBytes(templateB64));
  const xml = Object.keys(zip.files)
    .filter((n) => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n))
    .map((n) => zip.file(n)!.asText().replace(/<[^>]+>/g, ''))
    .join('\n');
  return extractPlaceholders(xml);
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

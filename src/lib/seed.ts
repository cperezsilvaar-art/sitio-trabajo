// Datos de DEMOSTRACIÓN. Personas, legajos y tiendas son ficticios.
// Los textos de los modelos son ejemplos: RH debe reemplazarlos por sus modelos vigentes
// revisados por el área legal.

import type {
  Employee, GestionKind, FieldDef, MeasureType, Policy, Profile, SituationType, Store, StoredFile, Template, TemplateVersion,
} from './types';
import { bytesToBase64 } from './template';

export const DEMO_PASSWORD = 'demo1234';

const now = new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();

export const stores: Store[] = [
  { id: 's-101', name: 'Sucursal 101 · Palermo', area: 'Área 1' },
  { id: 's-102', name: 'Sucursal 102 · Belgrano', area: 'Área 1' },
  { id: 's-205', name: 'Sucursal 205 · Caballito', area: 'Área 2' },
  { id: 's-206', name: 'Sucursal 206 · Flores', area: 'Área 2' },
  { id: 's-310', name: 'Sucursal 310 · Quilmes', area: 'Área 3' },
  { id: 's-311', name: 'Sucursal 311 · Lanús', area: 'Área 3' },
];

export const profiles: Profile[] = [
  { id: 'u-admin', email: 'admin.rh@demo.portal', name: 'Laura Méndez', role: 'admin_rh', store_ids: [], areas: ['Área 1', 'Área 2', 'Área 3'], active: true },
  { id: 'u-coord1', email: 'coord.area1@demo.portal', name: 'Martín Ríos', role: 'coordinador', store_ids: [], areas: ['Área 1'], active: true },
  { id: 'u-coord2', email: 'coord.area2@demo.portal', name: 'Paula Gómez', role: 'coordinador', store_ids: [], areas: ['Área 2'], active: true },
  { id: 'u-coord3', email: 'coord.area3@demo.portal', name: 'Christian Pérez', role: 'coordinador', store_ids: [], areas: ['Área 3'], active: true },
  { id: 'u-ger101', email: 'gerente.101@demo.portal', name: 'Sofía Álvarez', role: 'gerente', store_ids: ['s-101', 's-102'], areas: ['Área 1'], active: true },
  { id: 'u-ger205', email: 'gerente.205@demo.portal', name: 'Diego Fernández', role: 'gerente', store_ids: ['s-205'], areas: ['Área 2'], active: true },
  { id: 'u-ger310', email: 'gerente.310@demo.portal', name: 'Valeria Sosa', role: 'gerente', store_ids: ['s-310', 's-311'], areas: ['Área 3'], active: true },
];

const NAMES = [
  'Lucas Benítez', 'Camila Torres', 'Federico Acosta', 'Micaela Romero', 'Nicolás Herrera', 'Agustina Medina',
  'Joaquín Castro', 'Florencia Vega', 'Matías Molina', 'Julieta Ortiz', 'Tomás Navarro', 'Rocío Domínguez',
  'Gonzalo Ramos', 'Brenda Suárez', 'Ezequiel Ruiz', 'Carla Giménez', 'Santiago Peralta', 'Aldana Ferreyra',
];
const POSITIONS = ['Cajero/a', 'Repositor/a', 'Auxiliar de farmacia', 'Vendedor/a de dermocosmética', 'Encargado/a de turno', 'Farmacéutico/a'];

export const employees: Employee[] = NAMES.map((name, i) => ({
  id: `e-${i + 1}`,
  legajo: String(41200 + i * 7),
  name,
  position: POSITIONS[i % POSITIONS.length],
  store_id: stores[i % stores.length].id,
  dni: String(35100000 + i * 13791),
  hire_date: `20${18 + (i % 7)}-0${1 + (i % 9)}-1${i % 9}`,
  active: true,
}));

export const measureTypes: MeasureType[] = [
  { id: 'm-llamado', name: 'Llamado de atención por escrito', description: 'Primera advertencia formal por una falta leve.', active: true, requires_attachment: false, requires_antecedentes: false, order: 1 },
  { id: 'm-apercibimiento', name: 'Apercibimiento', description: 'Sanción formal que queda registrada en el legajo.', active: true, requires_attachment: false, requires_antecedentes: true, order: 2 },
  { id: 'm-suspension', name: 'Suspensión', description: 'Suspensión sin goce de haberes (arts. 218 a 220 LCT). Requiere antecedentes y respaldo.', active: true, requires_attachment: true, requires_antecedentes: true, order: 3 },
  { id: 'm-descargo', name: 'Citación a descargo', description: 'Se solicita al colaborador su versión de los hechos antes de decidir una medida.', active: true, requires_attachment: false, requires_antecedentes: false, order: 4 },
];

export const situationTypes: SituationType[] = [
  'Llegada tarde reiterada', 'Ausencia sin aviso', 'Abandono del puesto', 'Incumplimiento de procedimiento operativo',
  'Diferencia de caja', 'Falta de respeto a superiores o compañeros', 'Maltrato a clientes',
  'Incumplimiento de normas de seguridad e higiene', 'Uso indebido de bienes de la empresa', 'Otra situación',
].map((name, i) => ({ id: `sit-${i + 1}`, name, active: true }));

export const policy: Policy = {
  id: 'policy',
  approver_roles: ['coordinador', 'admin_rh'],
  restrict_to_area: true,
  routing: { 'Área 1': 'u-coord1', 'Área 2': 'u-coord2', 'Área 3': 'u-coord3' },
  comment_required_on_approve: false,
  review_sla_days: 2,
  certificate_days: 2,
  vacation_notice_days: 45,
  draft_disclaimer: 'Documento en borrador generado desde el Portal RH. No constituye sanción ni puede comunicarse al colaborador hasta su aprobación por Recursos Humanos.',
};

/* ---------- Modelos ---------- */

const APERCIBIMIENTO = `{{estado_documento}}

{{ciudad}}, {{fecha_emision_larga}}

Sr./Sra. {{colaborador}}
Legajo N° {{legajo}} – {{puesto}}
{{tienda}}

Ref.: APERCIBIMIENTO

Por medio de la presente, le notificamos que se ha resuelto aplicarle un APERCIBIMIENTO en los términos del artículo 67 de la Ley de Contrato de Trabajo, en razón de los hechos ocurridos el día {{fecha_incidente}}, que se describen a continuación:

{{descripcion_hechos}}

La conducta descripta constituye un incumplimiento de sus obligaciones laborales ({{tipo_situacion}}), contrario a los deberes de diligencia y colaboración establecidos en los artículos 62, 63 y 84 de la LCT y a las normas internas de la empresa.

Antecedentes: {{antecedentes}}

Se lo exhorta a ajustar su conducta a las pautas de trabajo vigentes, haciéndole saber que la reiteración de hechos de esta naturaleza dará lugar a la aplicación de sanciones de mayor gravedad.

Queda Ud. debidamente notificado/a.

__________________________          __________________________
Firma del colaborador               Por la empresa
Aclaración:                         {{aprobado_por}}
Fecha de recepción: ____/____/______

Solicitud N° {{numero_solicitud}}`;

const SUSPENSION = `{{estado_documento}}

{{ciudad}}, {{fecha_emision_larga}}

Sr./Sra. {{colaborador}}
Legajo N° {{legajo}} – {{puesto}}
{{tienda}}

Ref.: SUSPENSIÓN DISCIPLINARIA

Por medio de la presente, le notificamos que se ha resuelto aplicarle una SUSPENSIÓN DISCIPLINARIA de {{dias_suspension}} día/s, sin goce de haberes, a cumplirse desde el día {{fecha_inicio_suspension}}, debiendo reintegrarse a sus tareas el día {{fecha_reintegro}} en su horario habitual.

La medida se funda en los hechos ocurridos el día {{fecha_incidente}}:

{{descripcion_hechos}}

Dicha conducta ({{tipo_situacion}}) configura un grave incumplimiento de sus obligaciones laborales (arts. 62, 63 y 84 LCT). La presente se aplica en los términos de los artículos 67, 218, 219 y 220 de la Ley de Contrato de Trabajo.

Antecedentes considerados: {{antecedentes}}

Se le hace saber que, de reiterarse conductas como la descripta, la empresa podrá adoptar medidas de mayor gravedad.

Queda Ud. debidamente notificado/a.

__________________________          __________________________
Firma del colaborador               Por la empresa
Aclaración:                         {{aprobado_por}}
Fecha de recepción: ____/____/______

Solicitud N° {{numero_solicitud}}`;

const DESCARGO = `{{estado_documento}}

{{ciudad}}, {{fecha_emision_larga}}

Sr./Sra. {{colaborador}}
Legajo N° {{legajo}} – {{puesto}}
{{tienda}}

Ref.: SOLICITUD DE DESCARGO

Le informamos que con fecha {{fecha_incidente}} se habría producido la siguiente situación ({{tipo_situacion}}):

{{descripcion_hechos}}

En virtud de ello, y a fin de garantizar su derecho de defensa, lo/a invitamos a presentar su descargo por escrito dentro de las {{plazo_horas}} horas de recibida la presente, ante {{lugar_presentacion}}.

Vencido dicho plazo sin que se presente descargo, la empresa resolverá con los elementos con que cuenta.

__________________________          __________________________
Firma del colaborador               Por la empresa
Aclaración:                         {{aprobado_por}}

Solicitud N° {{numero_solicitud}}`;

const LLAMADO = `{{estado_documento}}

{{ciudad}}, {{fecha_emision_larga}}

Sr./Sra. {{colaborador}}
Legajo N° {{legajo}} – {{puesto}}
{{tienda}}

Ref.: LLAMADO DE ATENCIÓN

Por medio de la presente le comunicamos un llamado de atención formal en relación con lo ocurrido el día {{fecha_incidente}} ({{tipo_situacion}}):

{{descripcion_hechos}}

Le solicitamos ajustar su desempeño a las pautas establecidas. Su gerente queda a disposición para acompañarlo/a en lo que necesite.

__________________________          __________________________
Firma del colaborador               Por la empresa
                                    {{aprobado_por}}

Solicitud N° {{numero_solicitud}}`;

const PROCEDIMIENTO = `PROCEDIMIENTO DISCIPLINARIO – RESUMEN PARA GERENTES

1. Registrar el hecho el mismo día: qué pasó, cuándo, dónde, quiénes lo vieron. Sin adjetivos ni opiniones.
2. Reunir el respaldo: planillas de asistencia, arqueos, capturas de cámara (si corresponde), declaraciones de testigos.
3. Hablar con el colaborador antes de pedir una medida, salvo hechos graves.
4. Iniciar la solicitud en el Portal RH dentro de las 48 horas hábiles del hecho (la demora puede invalidar la sanción por falta de contemporaneidad).
5. RH revisa: proporcionalidad, antecedentes, contemporaneidad y que no exista doble sanción por el mismo hecho.
6. Sólo con la aprobación de RH se imprime el documento definitivo y se notifica al colaborador, en privado y con un testigo.
7. Si el colaborador se niega a firmar, dejar constancia con la firma de dos testigos y avisar a RH.
8. Registrar en el portal la fecha de notificación. El original firmado se envía a RH para el legajo.

Nunca: comunicar una sanción sin aprobación, sancionar dos veces el mismo hecho, ni aplicar descuentos por fuera de una suspensión aprobada.`;

const INSTRUCTIVO = `INSTRUCTIVO: CÓMO PEDIR UNA MEDIDA DISCIPLINARIA EN EL PORTAL

Paso 1 · Nueva solicitud: elegir al colaborador. El legajo, el puesto y la tienda se completan solos.
Paso 2 · El hecho: fecha, tipo de situación y una descripción detallada (mínimo 80 caracteres).
Paso 3 · Antecedentes y respaldo: medidas anteriores y archivos (fotos, planillas, actas).
Paso 4 · Medida y modelo: elegir el tipo de medida y el modelo; completar los datos que pide el modelo.
Paso 5 · Revisar el borrador generado y enviarlo a RH.

Estados: Borrador → Enviada a RH → Pendiente de revisión → Aprobada / Rechazada / Requiere modificaciones → Cerrada.
Si RH pide modificaciones, la solicitud vuelve a usted con la devolución: corrija y reenvíe.
El documento definitivo sólo se descarga cuando la solicitud está aprobada.`;

const COMUNICACION = `{{ciudad}}, {{fecha_emision_larga}}

Sr./Sra. {{colaborador}}
Legajo N° {{legajo}}
{{tienda}}

Ref.: {{asunto}}

{{cuerpo}}

Saludos cordiales.

Recursos Humanos`;

const VACACIONES = `{{ciudad}}, {{fecha_emision_larga}}

Sr./Sra. {{colaborador}}
Legajo N° {{legajo}} – {{puesto}}
{{tienda}}

Ref.: NOTIFICACIÓN DE VACACIONES – PERÍODO {{periodo}}

Por medio de la presente le notificamos que, conforme a los artículos 150, 151 y 154 de la Ley de Contrato de Trabajo, se le otorgan {{dias_vacaciones}} días corridos de vacaciones anuales correspondientes al período {{periodo}}.

Las vacaciones comenzarán el día {{fecha_inicio_vacaciones_larga}} ({{fecha_inicio_vacaciones}}) y finalizarán el día {{fecha_fin_vacaciones}}, debiendo reintegrarse a sus tareas el día {{fecha_reintegro}} en su horario habitual.

La retribución correspondiente al período de vacaciones le será abonada conforme lo establecido en el artículo 155 de la LCT.

Observaciones: {{observaciones}}

Queda Ud. debidamente notificado/a.

__________________________          __________________________
Firma del colaborador               Firma del gerente
Aclaración:                         {{gerente}}
Fecha de recepción: ____/____/______

Gestión N° {{numero_gestion}}`;

const SUSP_FIELDS: FieldDef[] = [
  { key: 'dias_suspension', label: 'Días de suspensión', type: 'number', required: true, help: 'Máximo 30 días por año (art. 220 LCT). RH valida la cantidad.' },
  { key: 'fecha_inicio_suspension', label: 'Fecha de inicio de la suspensión', type: 'date', required: true },
  { key: 'fecha_reintegro', label: 'Fecha de reintegro', type: 'date', required: true },
];
const DESCARGO_FIELDS: FieldDef[] = [
  { key: 'plazo_horas', label: 'Plazo para el descargo', type: 'select', required: true, options: ['48', '72'] },
  { key: 'lugar_presentacion', label: 'Dónde presenta el descargo', type: 'text', required: true, help: 'Ej.: la gerencia de la sucursal, o por correo a RH.' },
];
const COMUNICACION_FIELDS: FieldDef[] = [
  { key: 'asunto', label: 'Asunto', type: 'text', required: true },
  { key: 'cuerpo', label: 'Texto de la comunicación', type: 'textarea', required: true },
];

interface TplSeed { id: string; title: string; category: Template['category']; description: string; measures: string[]; body: string; fields: FieldDef[]; versions?: number; gestion?: GestionKind[] }

const TEMPLATES: TplSeed[] = [
  { id: 't-apercibimiento', title: 'Modelo de apercibimiento', category: 'sancion', description: 'Notificación de apercibimiento (art. 67 LCT). Incluye espacio para firma y recepción.', measures: ['m-apercibimiento'], body: APERCIBIMIENTO, fields: [], versions: 2 },
  { id: 't-suspension', title: 'Modelo de suspensión', category: 'sancion', description: 'Suspensión disciplinaria sin goce de haberes, con fechas de inicio y reintegro.', measures: ['m-suspension'], body: SUSPENSION, fields: SUSP_FIELDS },
  { id: 't-llamado', title: 'Modelo de llamado de atención', category: 'sancion', description: 'Advertencia formal escrita por faltas leves.', measures: ['m-llamado'], body: LLAMADO, fields: [] },
  { id: 't-descargo', title: 'Citación a descargo', category: 'comunicacion', description: 'Pedido de descargo previo a la decisión de una medida.', measures: ['m-descargo'], body: DESCARGO, fields: DESCARGO_FIELDS },
  { id: 't-vacaciones', title: 'Notificación de vacaciones', category: 'comunicacion', description: 'Notificación al colaborador del período de vacaciones (arts. 150 a 155 LCT), para firmar.', measures: [], body: VACACIONES, fields: [], gestion: ['vacaciones'] },
  { id: 't-comunicacion', title: 'Comunicación formal al colaborador', category: 'comunicacion', description: 'Modelo general para comunicaciones formales.', measures: [], body: COMUNICACION, fields: COMUNICACION_FIELDS },
  { id: 't-procedimiento', title: 'Procedimiento disciplinario', category: 'procedimiento', description: 'Pasos, plazos y buenas prácticas antes, durante y después de una medida.', measures: [], body: PROCEDIMIENTO, fields: [] },
  { id: 't-instructivo', title: 'Instructivo: medidas disciplinarias en el portal', category: 'instructivo', description: 'Guía paso a paso para gerentes.', measures: [], body: INSTRUCTIVO, fields: [] },
];

/* ---------- Word mínimo (para mostrar el flujo con .docx) ---------- */

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Arma un .docx simple a partir de párrafos de texto (cada línea, un párrafo). */
export async function makeDocx(text: string, title?: string): Promise<string> {
  const { default: PizZip } = await import('pizzip');
  const zip = new PizZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  const paras = text.split('\n').map((line) => {
    const bold = /^Ref\.:|^[A-ZÁÉÍÓÚ ]{12,}$/.test(line.trim());
    const rpr = `<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/>${bold ? '<w:b/>' : ''}</w:rPr>`;
    return `<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="both"/></w:pPr><w:r>${rpr}<w:t xml:space="preserve">${esc(line)}</w:t></w:r></w:p>`;
  });
  const header = title
    ? `<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:color w:val="1473E6"/><w:sz w:val="18"/></w:rPr><w:t xml:space="preserve">${esc(title)}</w:t></w:r></w:p>`
    : '';
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${header}${paras.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1701"/></w:sectPr></w:body></w:document>`);
  return bytesToBase64(zip.generate({ type: 'uint8array' }) as Uint8Array);
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function buildSeed() {
  const templates: Template[] = [];
  const versions: TemplateVersion[] = [];
  const files: StoredFile[] = [];
  for (const t of TEMPLATES) {
    const n = t.versions ?? 1;
    let lastId = '';
    for (let v = 1; v <= n; v++) {
      const id = `${t.id}-v${v}`;
      const isLast = v === n;
      const body = isLast ? t.body : t.body.replace('Se lo exhorta', 'Se le solicita');
      let file_id: string | null = null;
      let file_name: string | null = null;
      if (isLast && t.category !== 'procedimiento' && t.category !== 'instructivo') {
        const data = await makeDocx(body, 'Recursos Humanos');
        file_id = `f-${id}`;
        file_name = `${t.title} v${v}.docx`;
        files.push({ id: file_id, name: file_name, mime: DOCX_MIME, size: Math.round((data.length * 3) / 4), data, created_at: daysAgo(40 - v), created_by: 'u-admin' });
      }
      versions.push({
        id, template_id: t.id, version: v, body, fields: t.fields, file_id, file_name,
        change_notes: v === 1 ? 'Versión inicial aprobada por RH y Legales.' : 'Se ajusta la redacción del cierre según criterio de Legales.',
        created_by: 'u-admin', created_by_name: 'Laura Méndez', created_at: daysAgo(60 - v * 20),
      });
      lastId = id;
    }
    templates.push({
      id: t.id, title: t.title, category: t.category, description: t.description, active: true,
      measure_type_ids: t.measures, gestion_kinds: t.gestion ?? [], current_version_id: lastId, created_at: daysAgo(60), updated_at: daysAgo(60 - n * 20),
    });
  }
  return {
    data: {
      profiles, stores, employees,
      measure_types: measureTypes,
      situation_types: situationTypes,
      policy: [policy],
      templates, template_versions: versions, files,
    },
    passwords: Object.fromEntries(profiles.map((p) => [p.id, DEMO_PASSWORD])),
    now,
  };
}

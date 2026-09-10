/* ============ CONVENIO COLECTIVO DE TRABAJO 414/05 — ADEF ============
 *
 * El convenio de farmacias de CABA y el conurbano, que es el que rige al área.
 *
 * Lo que hace falta que el panel sepa del convenio no es todo el texto: es lo
 * que se cuenta. Las licencias del artículo 25 tienen tope —dos días por examen
 * y diez al año, cuatro días por enfermedad de un padre— y sin registro de lo
 * que cada uno se fue tomando no hay forma de saber cuánto le queda. Esa es la
 * pregunta que aparece en la tienda: "¿me quedan días de estudio?".
 *
 * Fuente: CCT 414/2005 (Res. S.T. 269/2005), con las modificaciones del Acuerdo
 * 389/2009 (Res. S.T. 488/2009) y el Acuerdo 1209/2010 (Res. S.T. 1165/2010).
 */

const CCT = {
  numero: '414/05',
  nombre: 'Convenio Colectivo de Trabajo 414/05 — ADEF',
  sindicato: 'Asociación de Empleados de Farmacia (ADEF)',
  ambito: 'Farmacias de CABA y partidos del conurbano bonaerense (art. 3°)'
};

/* ------------------------- Categorías (art. 5 a 9) ------------------------ */
const CATEGORIAS_CCT = [
  { id: 'inicialA',    nombre: 'Categoría Inicial "A"', articulo: 5,
    detalle: 'Ayudante de mostrador, portería, sereno, ascensorista.' },
  { id: 'inicialB',    nombre: 'Categoría Inicial "B"', articulo: 5,
    detalle: 'Empaque, reparto, chofer, maestranza y limpieza.' },
  { id: 'cajeroPerf',  nombre: 'Cajero, perfumería y administrativo', articulo: 6,
    detalle: 'Exclusivamente caja, perfumería o tareas administrativas, sin despacho al público.' },
  { id: 'empleado',    nombre: 'Empleado de farmacia', articulo: 7,
    detalle: 'Atención al público, obras sociales, validaciones, laboratorio, reposición.' },
  { id: 'especializado', nombre: 'Empleado especializado de farmacia', articulo: 8,
    detalle: '5 años en el mismo establecimiento (o 6 en varios con 3 en uno), o título de Auxiliar de Farmacia, o 2° año de la carrera aprobado.' },
  { id: 'farmaceutico', nombre: 'Farmacéutico', articulo: 9,
    detalle: 'Título de farmacéutico nacional, provincial o revalidado.' },
  { id: 'fueraConvenio', nombre: 'Fuera de convenio', articulo: null,
    detalle: 'Gerencia y posiciones no comprendidas en el CCT.' }
];

const CATEGORIAS_CCT_POR_ID = CATEGORIAS_CCT.reduce((a, c) => (a[c.id] = c, a), {});

/* Cómo llama la nómina a cada categoría. La planilla usa el nombre corto de la
   empresa, no el del convenio. */
const MAPA_CATEGORIA_CCT = {
  INICIALA: 'inicialA',
  INICIALB: 'inicialB',
  PERFUMERIA: 'cajeroPerf',
  CAJERO: 'cajeroPerf',
  ADMINISTRATIVO: 'cajeroPerf',
  EMPLEADODEFARMACIA: 'empleado',
  EMPLEADOESPDEFARMACIA: 'especializado',
  EMPLEADOESPECIALIZADODEFARMACIA: 'especializado',
  FARMACEUTICO: 'farmaceutico',
  FARMACEUTICOAUXILIAR: 'farmaceutico',
  FARMAAUXBLOQUEO: 'farmaceutico',
  FARMAAUXJORNADAPARCIAL: 'farmaceutico',
  DIRECTORTECNICO: 'farmaceutico',
  DTNOPRESENCIAL: 'farmaceutico',
  FUERADECONVENIO: 'fueraConvenio',
  GERENTEDETIENDA: 'fueraConvenio'
};

const _normCct = t => String(t == null ? '' : t)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Categoría del convenio a partir de lo que dice la nómina. */
function categoriaCct(texto) {
  const k = _normCct(texto);
  if (!k) return null;
  if (MAPA_CATEGORIA_CCT[k]) return CATEGORIAS_CCT_POR_ID[MAPA_CATEGORIA_CCT[k]];
  /* Los nombres de la planilla varían: se busca por contenido antes de rendirse. */
  if (/FARMACEUTIC|DIRECTORTECNICO|^DT/.test(k)) return CATEGORIAS_CCT_POR_ID.farmaceutico;
  if (/ESPECIALIZAD|ESP DEFARMACIA|ESPDEFARMACIA/.test(k)) return CATEGORIAS_CCT_POR_ID.especializado;
  if (/EMPLEADODEFARMACIA/.test(k)) return CATEGORIAS_CCT_POR_ID.empleado;
  if (/PERFUMERIA|CAJERO|ADMINISTRATIV/.test(k)) return CATEGORIAS_CCT_POR_ID.cajeroPerf;
  if (/INICIAL/.test(k)) return CATEGORIAS_CCT_POR_ID.inicialB;
  if (/FUERADECONVENIO|GERENTE/.test(k)) return CATEGORIAS_CCT_POR_ID.fueraConvenio;
  return null;
}

/* ---------------- Bloqueo de título y no presenciales ----------------
 *
 * El farmacéutico que ejerce la Dirección Técnica con bloqueo de título
 * (art. 18 b) y el auxiliar con bloqueo (art. 18 c) prestan la habilitación
 * profesional que la farmacia necesita para abrir. Están en la nómina, cobran
 * y cuestan, pero no están en el piso: no cubren un turno ni reemplazan una
 * ausencia.
 *
 * Contarlos en la dotación de la tienda infla la cobertura y hace ver una
 * sucursal completa donde falta gente para atender. Por eso el panel los cuenta
 * aparte en todo lo operativo, y los sigue contando en el costo, que es donde
 * sí pesan.
 */
function esNoPresencial(colaborador) {
  const c = colaborador || {};
  const texto = _normCct([c.categoriaConvenio, c.cargo, c.nivelCargo].join(' '));
  if (/NOPRESENCIAL/.test(texto)) {
    return { noPresencial: true, motivo: 'No presencial' };
  }
  if (/BLOQUE/.test(texto)) {
    return { noPresencial: true, motivo: 'Bloqueo de título' };
  }
  return { noPresencial: false, motivo: '' };
}

/* ---------------- Escalafón por antigüedad (art. 13) ---------------- */
const ESCALAFON_ANTIGUEDAD = [
  { anios: 25, pct: 0.50 },
  { anios: 20, pct: 0.40 },
  { anios: 15, pct: 0.35 },
  { anios: 10, pct: 0.30 },
  { anios: 5,  pct: 0.20 },
  { anios: 2,  pct: 0.10 },
  { anios: 1,  pct: 0.05 }
];

/** Porcentaje de antigüedad que le corresponde, y cuándo salta al siguiente. */
function escalafonDe(anios) {
  const a = Math.floor(Number(anios) || 0);
  const tramo = ESCALAFON_ANTIGUEDAD.find(t => a >= t.anios);
  const siguiente = ESCALAFON_ANTIGUEDAD.filter(t => t.anios > a).pop() || null;
  return {
    pct: tramo ? tramo.pct : 0,
    desdeAnios: tramo ? tramo.anios : 0,
    proximo: siguiente,
    faltanAnios: siguiente ? siguiente.anios - a : null
  };
}

/* --------------- Licencia anual ordinaria (art. 24) --------------- *
   Los días son corridos y el convenio mejora la Ley de Contrato de Trabajo en
   los dos primeros tramos: 17 en vez de 14, y 26 en vez de 21. */
const VACACIONES_CCT = [
  { hasta: 5,   dias: 17 },
  { hasta: 10,  dias: 26 },
  { hasta: 20,  dias: 35 },
  { hasta: 999, dias: 44 }
];

function vacacionesDe(anios) {
  const a = Number(anios) || 0;
  const t = VACACIONES_CCT.find(x => a <= x.hasta) || VACACIONES_CCT[VACACIONES_CCT.length - 1];
  const sig = VACACIONES_CCT[VACACIONES_CCT.indexOf(t) + 1] || null;
  return { dias: t.dias, proximo: sig, faltanAnios: sig ? Math.ceil(t.hasta - a) : null };
}

/* ---------------- Licencias especiales pagas (art. 25) ---------------- *
 *
 * `tope` dice contra qué se cuenta:
 *   evento — se otorga entero cada vez que pasa el hecho (fallecimiento, mudanza).
 *   anual  — hay un máximo por año calendario (estudio: 10 días).
 *   unica  — una vez en la relación laboral (matrimonio).
 *
 * `porEvento` es lo que corresponde por cada hecho; `porAnio` el techo anual
 * cuando lo hay. Los dos conviven en estudio: 2 por examen, 10 en el año.
 */
const LICENCIAS_CCT = [
  { id: 'matrimonio', nombre: 'Matrimonio', articulo: '25 a)', tope: 'unica',
    porEvento: 15, unidad: 'corridos',
    nota: '12 días corridos si tiene menos de 1 año de antigüedad. Puede pedirse pegada a las vacaciones.',
    comprobante: 'Acta de matrimonio' },

  { id: 'nacimiento', nombre: 'Nacimiento o adopción', articulo: '25 b)', tope: 'evento',
    porEvento: 2, unidad: 'hábiles',
    comprobante: 'Partida de nacimiento o resolución de adopción' },

  { id: 'enfHijo', nombre: 'Enfermedad de un hijo', articulo: '25 c)', tope: 'anual',
    porEvento: null, porAnio: 6, unidad: 'hábiles',
    nota: 'Dos días más si la persona enferma está a más de 500 km.',
    comprobante: 'Certificado médico' },

  { id: 'enfFamiliar', nombre: 'Enfermedad de padres o cónyuge', articulo: '25 c)', tope: 'anual',
    porEvento: null, porAnio: 4, unidad: 'hábiles',
    nota: 'Dos días más si la persona enferma está a más de 500 km.',
    comprobante: 'Certificado médico' },

  { id: 'fallecimiento', nombre: 'Fallecimiento de familiar', articulo: '25 d)', tope: 'evento',
    porEvento: 4, unidad: 'hábiles',
    nota: 'Hijos, cónyuge, padres, hermanos, abuelos, padres e hijos políticos. Seis días si residía a más de 500 km.',
    comprobante: 'Certificado de defunción' },

  { id: 'estudio', nombre: 'Estudio (rendir examen)', articulo: '25 e)', tope: 'anual',
    porEvento: 2, porAnio: 10, unidad: 'corridos',
    nota: 'Dos días corridos por examen, hasta diez en el año calendario. Enseñanza media o superior con plan oficial.',
    comprobante: 'Constancia de examen rendido' },

  { id: 'sangre', nombre: 'Donación de sangre', articulo: '25 f)', tope: 'evento',
    porEvento: 1, unidad: 'día',
    comprobante: 'Constancia de la donación' },

  { id: 'mudanza', nombre: 'Mudanza', articulo: '25 g)', tope: 'evento',
    porEvento: 1, unidad: 'hábiles',
    nota: 'Un día por cada mudanza. Hay que probar el hecho.',
    comprobante: 'Contrato de alquiler, escritura o constancia' },

  { id: 'sindical', nombre: 'Capacitación sindical', articulo: '25 h)', tope: 'anual',
    porEvento: null, porAnio: 21, unidad: 'corridos',
    nota: 'Solo delegados o miembros de Comisión Directiva convocados por ADEF. No dos personas del mismo local a la vez, no más de tres veces al año, y se avisa con 10 días hábiles.',
    comprobante: 'Convocatoria y certificación de asistencia de ADEF' },

  { id: 'gremial', nombre: 'Permiso gremial (horas)', articulo: '43', tope: 'mensual',
    porEvento: null, porMes: 40, unidad: 'horas',
    nota: 'Hasta 40 horas por mes calendario y en no más de 8 oportunidades. Se preavisa con 48 horas.',
    comprobante: 'Comprobante escrito de ADEF' }
];

const LICENCIAS_CCT_POR_ID = LICENCIAS_CCT.reduce((a, l) => (a[l.id] = l, a), {});

/* Qué concepto del convenio es cada columna del libro de novedades. Con esto
   el contador se alimenta solo de la liquidación: si hubiera que cargar cada
   licencia a mano, el saldo nunca estaría al día. */
const NOVEDAD_A_LICENCIA = {
  examen: 'estudio',
  fallecimiento: 'fallecimiento',
  mudanza: 'mudanza',
  gremio: 'sindical'
};

/**
 * Cuánto se tomó y cuánto le queda a una persona de cada licencia con tope, en
 * un año calendario.
 *
 * Es la razón de ser de este módulo: la licencia por estudio son dos días por
 * examen hasta diez al año, y sin este registro nadie sabe cuántos van.
 *
 * Suma dos fuentes que no se pisan: lo que trajo la liquidación del mes y lo
 * que se cargó a mano en la ficha. Lo segundo existe porque una licencia de
 * este mes recién aparece en la liquidación del mes que viene, y en la tienda
 * la pregunta es hoy.
 */
function saldoLicencias(colaborador, anio) {
  const c = colaborador || {};
  const a = String(anio || new Date().getFullYear());

  const manuales = (c.licencias || [])
    .filter(l => String(l.desde || '').slice(0, 4) === a);

  /* De la liquidación: cada período del año aporta los días de sus columnas. */
  const deLiquidacion = {};
  Object.keys(c.novedades || {}).forEach(periodo => {
    if (String(periodo).slice(0, 4) !== a) return;
    const nov = c.novedades[periodo] || {};
    Object.keys(NOVEDAD_A_LICENCIA).forEach(campo => {
      const dias = Number(nov[campo]) || 0;
      if (!dias) return;
      const id = NOVEDAD_A_LICENCIA[campo];
      if (!deLiquidacion[id]) deLiquidacion[id] = { dias: 0, periodos: [] };
      deLiquidacion[id].dias += dias;
      deLiquidacion[id].periodos.push(periodo);
    });
  });

  return LICENCIAS_CCT.map(lic => {
    const propias = manuales.filter(l => l.tipo === lic.id);
    const aMano = propias.reduce((s, l) => s + (Number(l.dias) || 0), 0);
    const liq = deLiquidacion[lic.id] || { dias: 0, periodos: [] };
    const usados = aMano + liq.dias;

    const tope = lic.tope === 'anual' ? lic.porAnio
               : lic.tope === 'unica' ? lic.porEvento
               : null;      // por evento o por mes: no hay techo anual que contar

    return {
      licencia: lic,
      eventos: propias.length,
      aMano,
      deLiquidacion: liq.dias,
      periodos: liq.periodos.sort(),
      usados,
      tope,
      restante: tope === null ? null : Math.max(0, tope - usados),
      excedido: tope !== null && usados > tope,
      /* Un evento que se pasó de lo que corresponde por vez: dos días de
         estudio por examen, no tres. */
      eventosLargos: lic.porEvento
        ? propias.filter(l => (Number(l.dias) || 0) > lic.porEvento).length
        : 0
    };
  }).filter(x => x.usados || x.eventos || x.tope !== null);
}

/** Las que se pasaron del tope o están por pasarse. Para avisar en la ficha. */
function alertasLicencias(colaborador, anio) {
  return saldoLicencias(colaborador, anio)
    .filter(x => x.excedido || x.eventosLargos ||
                 (x.tope !== null && x.restante !== null && x.usados > 0 && x.restante <= 2))
    .map(x => {
      if (x.excedido) {
        return { nivel: 'alerta',
          texto: `${x.licencia.nombre}: lleva ${x.usados} días y el tope del art. ${x.licencia.articulo} es ${x.tope}.` };
      }
      if (x.eventosLargos) {
        return { nivel: 'alerta',
          texto: `${x.licencia.nombre}: ${x.eventosLargos} vez${x.eventosLargos === 1 ? '' : 'es'} se otorgaron más de ${x.licencia.porEvento} días, que es lo que corresponde por evento.` };
      }
      if (x.restante === 0) {
        return { nivel: 'alerta',
          texto: `${x.licencia.nombre}: agotó los ${x.tope} días del año (art. ${x.licencia.articulo}). Lo que pida de acá en más no tiene amparo en el convenio.` };
      }
      return { nivel: 'aviso',
        texto: `${x.licencia.nombre}: le ${x.restante === 1 ? 'queda 1 día' : `quedan ${x.restante} días`} de los ${x.tope} del año.` };
    });
}

/* ---------------------- Jornada y nocturnidad ---------------------- */
/* La nómina no trae una columna de jornada: el tiempo parcial viene escrito
   dentro del cargo o de la categoría —"DIRECTOR TECNICO TP", "FARMA AUX.
   JORNADA PARCIAL"—. */
const RE_PARCIAL = /(^| )(TP|PT)( |$)|JORNADA PARCIAL|TIEMPO PARCIAL|MEDIA JORNADA|PART TIME/;

const _palabrasCct = t => String(t == null ? '' : t)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

/**
 * Cuánto de una jornada completa ocupa el vínculo de una persona: 1 el full
 * time, 0,5 el tiempo parcial. Es la unidad con la que se suma la dotación,
 * porque dos part time no son dos personas de piso, son una.
 *
 * @returns {{fte:number, parcial:boolean, texto:string}}
 */
function jornadaDeVinculo(colaborador) {
  const c = colaborador || {};
  /* Lo que el coordinador corrige a mano manda sobre lo que dice el cargo.
     Llega como texto desde el formulario, así que se compara por número. */
  const puesto = Number(c.jornada);
  if (puesto === 0.5 || puesto === 1) {
    return { fte: puesto, parcial: puesto < 1,
             texto: puesto < 1 ? 'Tiempo parcial' : 'Jornada completa' };
  }
  const texto = _palabrasCct([c.categoriaConvenio, c.cargo, c.nivelCargo].join(' '));
  return RE_PARCIAL.test(texto)
    ? { fte: 0.5, parcial: true,  texto: 'Tiempo parcial' }
    : { fte: 1,   parcial: false, texto: 'Jornada completa' };
}

const JORNADA_CCT = {
  diaria: 8, semanal: 45,                    // art. 14
  nocturnaDiaria: 7, nocturnaSemanal: 42,    // art. 16
  nocturnoDesde: 21, nocturnoHasta: 6,       // art. 16
  insalubreDiaria: 6, insalubreSemanal: 33,  // art. 15
  recargoNocturnoVoluntario: 1.00            // art. 17: 100% sobre el básico
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CCT, CATEGORIAS_CCT, CATEGORIAS_CCT_POR_ID, MAPA_CATEGORIA_CCT, categoriaCct,
    NOVEDAD_A_LICENCIA,
    esNoPresencial, ESCALAFON_ANTIGUEDAD, escalafonDe, VACACIONES_CCT, vacacionesDe,
    LICENCIAS_CCT, LICENCIAS_CCT_POR_ID, saldoLicencias, alertasLicencias, JORNADA_CCT,
    jornadaDeVinculo
  };
}

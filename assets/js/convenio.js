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

/* ==================== El período de liquidación ======================= *
 * El mes de Nómina **no es el mes calendario**. El período de septiembre de
 * 2026 fue del 21/08 al 17/09: arranca el día 21 del mes anterior y cierra el
 * 17 de este. Los dos días salen de `parametros` (`periodoDesdeDia` y
 * `periodoHastaDia`), editables en `#/config`.
 *
 * Todo el panel medía en meses calendario y eso metía los días en la ventana
 * equivocada. Con los datos de septiembre de 2026 la diferencia era grande:
 * 166 días de ausentismo contra 120 del período real. De esos 166, **52 caían
 * después del corte** —todos del libro, que ubicaba sus licencias desde el 1 y
 * las estiraba— y **6 días que la liquidación de septiembre sí pagó** quedaban
 * contados en agosto.
 *
 * Estas dos funciones son **la única traducción entre un período y sus
 * fechas**, en los dos sentidos. Escribir la conversión a mano en cada
 * pantalla es garantizar que un día difieran.
 *
 * `rangoDePeriodo()` devuelve el período **declarado** —lo que dice el
 * calendario de Nómina— y `periodoDeFecha()` **reparte los días**: cada día
 * del año cae en uno y solo uno. Cuando los dos números encajan las dos cosas
 * coinciden. Cuando no —el corte del 17 con arranque el 21— los días sueltos
 * caen en el **recibo siguiente**, que es como funciona un corte de verdad: si
 * Nómina cerró el 17, una falta del 18 la paga el mes que viene. Perderlos
 * sería peor: desaparecerían de la serie del año sin que nadie lo note.
 *
 * **Con `desde` menor o igual que `hasta` el período vive adentro del mismo
 * mes**, así que poner 1 y 31 devuelve los meses calendario sin tocar nada
 * más. Es el caso general escrito una vez, no una excepción.
 */

/* `_isoDelPeriodo` y no `_iso`: ese nombre ya existe en `agenda.js` y los .js
   comparten ámbito global — una segunda declaración deja la página en blanco.
   Lo agarró el chequeo del archivo armado, que es para lo que está. */
const _diasDelMesDe = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();
const _isoDelPeriodo = (anio, mes, dia) =>
  `${anio}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, _diasDelMesDe(anio, mes))).padStart(2, '0')}`;

/** Los dos días que definen el período, saneados. */
function diasDelPeriodo(parametros) {
  const p = parametros || {};
  const n = (v, x) => {
    const k = Math.round(Number(v));
    return isNaN(k) || k < 1 || k > 31 ? x : k;
  };
  return {
    desde: n(p.periodoDesdeDia, 21),
    hasta: n(p.periodoHastaDia, 17)
  };
}

/**
 * De `'2026-09'` a sus fechas: `{ desde: '2026-08-21', hasta: '2026-09-20' }`.
 *
 * El día se recorta al último del mes cuando no existe —un 31 en febrero es el
 * 28—, para que ningún período quede sin fecha o se pase al mes siguiente.
 */
function rangoDePeriodo(periodo, parametros) {
  const t = String(periodo || '');
  if (!/^\d{4}-\d{2}$/.test(t)) return null;
  const anio = +t.slice(0, 4), mes = +t.slice(5, 7);
  const d = diasDelPeriodo(parametros);
  const hasta = _isoDelPeriodo(anio, mes, d.hasta);
  if (d.desde <= d.hasta) return { desde: _isoDelPeriodo(anio, mes, d.desde), hasta };
  const anterior = mes === 1 ? { a: anio - 1, m: 12 } : { a: anio, m: mes - 1 };
  return { desde: _isoDelPeriodo(anterior.a, anterior.m, d.desde), hasta };
}

/**
 * Y al revés: en qué período cae una fecha. **El pivote es el día de cierre**,
 * no el de arranque: lo que pasa después del corte lo paga el recibo que
 * viene. Así cada día del año cae en un período y en uno solo, también cuando
 * los dos números no encajan.
 */
function periodoDeFecha(fechaISO, parametros) {
  const t = String(fechaISO || '');
  if (!/^\d{4}-\d{2}-\d{2}/.test(t)) return '';
  const anio = +t.slice(0, 4), mes = +t.slice(5, 7), dia = +t.slice(8, 10);
  /* El recorte de fin de mes vale acá también: con cierre el 31, en un febrero
     de 28 el día 28 todavía es de este período. */
  const cierre = Math.min(diasDelPeriodo(parametros).hasta, _diasDelMesDe(anio, mes));
  if (dia <= cierre) return t.slice(0, 7);
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

/**
 * Los días que **caen** en este período, que no siempre son los del período
 * declarado.
 *
 * `rangoDePeriodo()` devuelve lo que dice el calendario de Nómina —del 21 al
 * 17— y `periodoDeFecha()` reparte por el día de cierre, así que el 18, el 19
 * y el 20 caen en el período siguiente aunque el declarado no los liste. Las
 * dos cosas tienen que usar la **misma** regla o el número no cierra: contar
 * un día arriba de la fracción y no abajo daba una tasa de ausentismo más alta
 * en la serie que en el Panel, sobre exactamente los mismos días.
 *
 * Cuando los dos números encajan esto devuelve lo mismo que
 * `rangoDePeriodo()`. Por eso son dos funciones y no una: son dos preguntas
 * —qué declaró Nómina y qué días entran acá— que casi siempre tienen la misma
 * respuesta.
 */
function ventanaDePeriodo(periodo, parametros) {
  const r = rangoDePeriodo(periodo, parametros);
  if (!r) return null;
  const t = String(periodo);
  const anio = +t.slice(0, 4), mes = +t.slice(5, 7);
  const previo = mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, '0')}`;
  const anterior = rangoDePeriodo(previo, parametros);
  if (!anterior) return r;
  const d = new Date(anterior.hasta + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  const desde = d.toISOString().slice(0, 10);
  return { desde: desde < r.desde ? desde : r.desde, hasta: r.hasta };
}

/** Cuántos días tiene el período. No son 30 ni los del mes: son los que son. */
function diasQueDuraPeriodo(periodo, parametros) {
  const r = rangoDePeriodo(periodo, parametros);
  if (!r) return 0;
  return Math.round((new Date(r.hasta + 'T00:00:00') - new Date(r.desde + 'T00:00:00')) / 86400000) + 1;
}

/**
 * Si los dos días encajan, es decir si el período siguiente arranca el día
 * después de que este cierra. Cuando no, hay días de cada mes que quedan fuera
 * del período **declarado** y se cuentan en el recibo siguiente — `#/config`
 * los nombra en vez de impedir nada, porque el calendario lo decide Nómina.
 */
function periodosEncajan(parametros) {
  const d = diasDelPeriodo(parametros);
  if (d.desde <= d.hasta) return d.desde === 1 && d.hasta >= 28;
  return d.desde === d.hasta + 1;
}

/** Los días que caen fuera del período declarado, para poder nombrarlos. */
function diasFueraDePeriodo(parametros) {
  const d = diasDelPeriodo(parametros);
  if (periodosEncajan(parametros) || d.desde <= d.hasta) return [];
  const out = [];
  for (let x = d.hasta + 1; x < d.desde; x++) out.push(x);
  return out;
}

/**
 * «septiembre de 2026 · del 21/08 al 17/09».
 *
 * El rango va escrito al lado del nombre en todas las pantallas del cierre, y
 * no es adorno: «septiembre» a secas se lee como el mes calendario, que es
 * justamente lo que el panel dejó de hacer.
 *
 * El nombre lo pone `nombreDePeriodo()`, que vive en `agenda.js`. Acá se
 * escribió una segunda —con su propia lista de meses— y **no rompió nada**:
 * dos `function` con el mismo nombre no tiran error como dos `const`, gana la
 * que carga última y la otra desaparece en silencio. Se notó porque la
 * pantalla decía «septiembre de 2026» y esta escribía «septiembre 2026».
 * `agenda.js` carga después de este archivo, así que a la hora de llamarla ya
 * existe.
 */
function etiquetaDePeriodo(periodo, parametros) {
  const r = rangoDePeriodo(periodo, parametros);
  if (!r) return nombreDePeriodo(periodo);
  const dm = f => f.slice(8, 10) + '/' + f.slice(5, 7);
  return `${nombreDePeriodo(periodo)} · del ${dm(r.desde)} al ${dm(r.hasta)}`;
}

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
/* La nómina no siempre lo dice, y por eso se puede marcar a mano.
 *
 * El bloqueo viaja en el cargo —«DIRECTOR TECNICO CON BLOQUEO»— en cinco de las
 * fichas del área, pero hay gente cargada como Director Técnico a secas que en
 * la práctica no pisa el local: presta la matrícula y nada más. Para el panel
 * esa persona era un FTE del piso de su tienda.
 *
 * Arreglarlo escribiéndole «CON BLOQUEO» al cargo duraría hasta la nómina
 * siguiente, que vuelve a pisar `cargo`, `nivelCargo` y `categoriaConvenio`
 * —son campos de `CAMPOS_NOMINA`—. Por eso es una marca propia, en una clave
 * que la importación no toca, como `c.laboratorio` con la especialidad: lo que
 * sabe el coordinador y la planilla no trae se guarda aparte.
 */
const MOTIVOS_NO_PRESENCIAL = [
  { id: 'bloqueo',      nombre: 'Bloqueo de título' },
  { id: 'noPresencial', nombre: 'No presencial' }
];
const MOTIVO_NO_PRESENCIAL_POR_ID = MOTIVOS_NO_PRESENCIAL
  .reduce((a, x) => (a[x.id] = x, a), {});

function esNoPresencial(colaborador) {
  const c = colaborador || {};
  const texto = _normCct([c.categoriaConvenio, c.cargo, c.nivelCargo].join(' '));
  if (/NOPRESENCIAL/.test(texto)) {
    return { noPresencial: true, motivo: 'No presencial', aMano: false };
  }
  if (/BLOQUE/.test(texto)) {
    return { noPresencial: true, motivo: 'Bloqueo de título', aMano: false };
  }
  /* La marca a mano va después del cargo: lo que dice la nómina se respeta, y
     esto completa lo que no dice. Cuando una nómina posterior traiga el cargo
     con el bloqueo escrito, las dos coinciden y no hay nada que decidir. */
  const m = MOTIVO_NO_PRESENCIAL_POR_ID[String(c.noPresencialManual || '')];
  if (m) return { noPresencial: true, motivo: m.nombre, aMano: true };
  return { noPresencial: false, motivo: '', aMano: false };
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

/* ---------------- El curso de ADEF y el art. 8 ----------------
 *
 * El art. 8 da **tres vías** a la categoría de Empleado especializado y las
 * tres valen por separado: 5 años en el mismo establecimiento, 6 en varios con
 * 3 en uno, o el título de Auxiliar de Farmacia. Las dos primeras llegan solas
 * con el calendario y no se negocian; la tercera es la única que se puede
 * empujar, y el curso que la da lo dicta ADEF.
 *
 * Por eso el relevamiento del curso y el reloj del artículo se miran juntos:
 * son el mismo problema desde los dos lados. Quien está por cumplir los años
 * va a cambiar de categoría se haga lo que se haga —y eso hay que preverlo—; a
 * quien le faltan cuatro años, el curso le adelanta la categoría y a la tienda
 * le adelanta a alguien que puede despachar.
 */

/**
 * Los estados del relevamiento del curso.
 *
 * «Sin relevar» **no está en la lista** y es a propósito: es la ausencia del
 * campo. En un relevamiento la primera pregunta no es quién cursa sino a quién
 * todavía no le preguntaste, y un estado «no sé» mezclado con los demás se
 * tilda de apuro y borra esa diferencia.
 */
const ESTADOS_ADEF = [
  { id: 'no',            nombre: 'No lo está haciendo', chip: '' },
  { id: 'cursando',      nombre: 'Cursando',            chip: 'azul' },
  { id: 'terminado',     nombre: 'Terminado',           chip: 'verde' },
  { id: 'noCorresponde', nombre: 'No corresponde',      chip: '' }
];

const ESTADOS_ADEF_POR_ID = ESTADOS_ADEF.reduce((a, x) => (a[x.id] = x, a), {});

const _aniosEntre = (desde, hasta) => {
  const a = new Date(String(desde) + 'T00:00:00');
  const b = new Date(String(hasta) + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return (b.getTime() - a.getTime()) / (365.25 * 24 * 3600 * 1000);
};

/**
 * La antigüedad partida en tramos, uno por establecimiento.
 *
 * El artículo no pregunta cuánta antigüedad tiene sino **cómo se repartió**,
 * así que un solo número no alcanza. Los cortes son los traspasos ya
 * aplicados, que es todo lo que el panel sabe del recorrido de la persona: si
 * nunca la movieron —el caso de casi todo el plantel— hay un solo tramo y es
 * la antigüedad entera.
 */
function tramosDeAntiguedad(colaborador, hoyISO) {
  const c = colaborador || {};
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const ini = c.fechaIngreso;
  if (!ini || ini > hoy) return null;

  const cortes = (c.movimientos || [])
    .filter(m => typeof esTraspaso === 'function' && esTraspaso(m.tipo)
                 && m.aplicadoEl && m.vigencia && m.vigencia > ini && m.vigencia <= hoy)
    .map(m => m.vigencia)
    .sort();

  const hitos = [ini].concat(cortes, [hoy]);
  const tramos = [];
  for (let i = 0; i < hitos.length - 1; i++) {
    const a = _aniosEntre(hitos[i], hitos[i + 1]);
    if (a > 0) tramos.push(a);
  }
  return tramos.length ? tramos : [0];
}

/**
 * Si le corresponde la categoría de Empleado especializado, y por cuál vía.
 *
 * Solo aplica al **Empleado de farmacia** (art. 7): es la categoría desde la
 * que se asciende. Perfumería y caja están en otro artículo y el farmacéutico
 * ya está arriba, así que para ellos el artículo no dice nada — el
 * relevamiento del curso sí los incluye, porque saber quién se está formando
 * es otra pregunta.
 */
function situacionArt8(colaborador, hoyISO) {
  const c = colaborador || {};
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const cat = categoriaCct(c.categoriaConvenio || c.categoria || '');
  const adef = c.adef || {};

  const tramos = tramosDeAntiguedad(c, hoy) || [];
  const anios = tramos.reduce((a, b) => a + b, 0);
  const enElEstablecimiento = tramos.length ? tramos[tramos.length - 1] : 0;
  const maxEnUno = tramos.length ? Math.max.apply(null, tramos) : 0;

  const porEstablecimiento = enElEstablecimiento >= 5;
  const porVarios = anios >= 6 && maxEnUno >= 3;
  const porCurso = adef.estado === 'terminado';

  /* Cuánto falta para que lo cumpla el calendario, por la vía que llegue
     primero. La segunda vía necesita las dos condiciones a la vez, y los tres
     años «en uno» solo pueden crecer en el tramo actual: un tramo cerrado ya no
     suma. */
  const faltaEstablecimiento = Math.max(0, 5 - enElEstablecimiento);
  const faltaVarios = Math.max(
    Math.max(0, 6 - anios),
    maxEnUno >= 3 ? 0 : Math.max(0, 3 - enElEstablecimiento)
  );
  const faltanAnios = Math.min(faltaEstablecimiento, faltaVarios);

  return {
    aplica: !!cat && cat.id === 'empleado',
    categoria: cat,
    yaEsEspecializado: !!cat && cat.id === 'especializado',
    tramos, anios, enElEstablecimiento, maxEnUno,
    porEstablecimiento, porVarios, porCurso,
    cumple: porEstablecimiento || porVarios || porCurso,
    via: porCurso ? 'curso' : porEstablecimiento ? 'establecimiento' : porVarios ? 'varios' : '',
    /* Meses y no años: «le faltan 7 meses» se agenda, «0,6 años» no. */
    faltanMeses: (porEstablecimiento || porVarios) ? 0 : Math.round(faltanAnios * 12)
  };
}

/* Cuántos meses antes conviene enterarse. Un año es el tiempo que tarda el
   curso y es también lo que dura un presupuesto: antes de eso el aviso no
   sirve para decidir nada. */
const MESES_AVISO_ART8 = 12;

/**
 * El relevamiento del curso, de conjunto: a cuántos les preguntaste, qué
 * contestaron y a quiénes se les viene el art. 8 encima.
 *
 * Los de baja quedan afuera de la cuenta: el relevamiento es sobre el plantel
 * que hoy trabaja, y una baja del año pasado no se releva.
 */
function relevamientoAdef(estado, hoyISO) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const gente = ((estado || {}).sucursales || [])
    .flatMap(s => (s.colaboradores || [])
      .filter(c => c.activo !== false)
      .map(c => ({ c, sucursal: s.nombre || s.codigo, sucursalId: s.id })));

  const porEstado = {};
  ESTADOS_ADEF.forEach(x => { porEstado[x.id] = 0; });
  let relevados = 0;

  const filas = gente.map(g => {
    const est = ((g.c.adef || {}).estado) || '';
    if (porEstado[est] !== undefined) { porEstado[est]++; relevados++; }
    return Object.assign({ estado: est, art8: situacionArt8(g.c, hoy) }, g);
  });

  /* Los dos que piden algo, y son distintos: uno ya pasó y hay que
     recategorizarlo, al otro todavía se lo puede adelantar con el curso. */
  const cumplenSinSerlo = filas.filter(f => f.art8.aplica && f.art8.cumple);
  const porVencer = filas.filter(f => f.art8.aplica && !f.art8.cumple
    && f.art8.faltanMeses <= MESES_AVISO_ART8);

  return {
    hoy, total: gente.length, relevados,
    sinRelevar: gente.length - relevados,
    porEstado, filas,
    alcanzados: filas.filter(f => f.art8.aplica).length,
    cumplenSinSerlo, porVencer
  };
}

/* ------------- Topes de horas extras (Decreto 484/2000) -------------
 *
 * El CCT 414/05 no pone tope a las horas suplementarias: lo pone el
 * **Decreto 484/2000**, que fija **30 horas mensuales y 200 anuales** como
 * máximo sin autorización administrativa previa. Es la vara que se usa en la
 * práctica y la que le van a mirar al área.
 *
 * El panel **no chequea el tope diario**, y no es un olvido: las novedades de
 * liquidación traen el total del mes por persona, no el reparto por día, así
 * que un control diario sería un número inventado. Lo que sí trae es el corte
 * entre 50% y 100% (art. 201 LCT), que suma igual contra los topes: el recargo
 * cambia lo que se paga, no cuántas horas se trabajaron.
 *
 * Es una orientación sobre la norma general, no un dictamen, y la pantalla lo
 * dice — igual que los plazos de los arts. 208 y 211.
 */
const TOPES_HORAS_EXTRAS = {
  mensual: 30,
  anual: 200,
  norma: 'Decreto 484/2000',
  /* A partir de qué parte del tope conviene mirarlo. No es un límite legal: es
     cuándo todavía se puede hacer algo con el mes en curso. */
  avisoDesde: 0.8
};

/** Las horas extras de un período, con el corte de la LCT art. 201. */
function horasExtrasDe(colaborador, periodo) {
  const n = ((colaborador || {}).novedades || {})[periodo] || {};
  const al50 = +n.he50 || 0;
  const al100 = +n.he100 || 0;
  return { al50, al100, total: al50 + al100 };
}

/**
 * Los períodos del mismo año calendario que el que se mira, hasta él
 * inclusive.
 *
 * El tope anual es del año, no de los últimos doce meses: se cuenta del enero
 * al diciembre en que se trabajaron. Mezclar las dos ventanas daría un número
 * que no se puede llevar a ningún lado.
 */
function periodosDelAnio(colaborador, periodo) {
  const anio = String(periodo || '').slice(0, 4);
  if (!anio) return [];
  return Object.keys((colaborador || {}).novedades || {})
    .filter(p => p.slice(0, 4) === anio && p <= periodo)
    .sort();
}

/**
 * Cómo viene una persona contra los dos topes.
 *
 * El mes y el año se contestan por separado porque son dos problemas: pasarse
 * en un mes se corrige el mes que viene, y pasarse en el año ya no se corrige.
 * Los dos se miden solo sobre los meses que están cargados, y eso se dice:
 * un acumulado anual con tres meses adentro no es un acumulado anual.
 */
function topeHorasExtras(colaborador, periodo) {
  const mes = horasExtrasDe(colaborador, periodo);
  const meses = periodosDelAnio(colaborador, periodo);
  const anio = meses.reduce((a, p) => {
    const h = horasExtrasDe(colaborador, p);
    return { al50: a.al50 + h.al50, al100: a.al100 + h.al100, total: a.total + h.total };
  }, { al50: 0, al100: 0, total: 0 });

  const estado = (valor, tope) => valor > tope ? 'excedido'
    : valor >= tope * TOPES_HORAS_EXTRAS.avisoDesde ? 'alBorde' : 'ok';

  return {
    periodo, mes, anio,
    mesesCargados: meses.length, meses,
    topeMensual: TOPES_HORAS_EXTRAS.mensual,
    topeAnual: TOPES_HORAS_EXTRAS.anual,
    estadoMes: estado(mes.total, TOPES_HORAS_EXTRAS.mensual),
    estadoAnio: estado(anio.total, TOPES_HORAS_EXTRAS.anual),
    excedeMes: mes.total > TOPES_HORAS_EXTRAS.mensual,
    excedeAnio: anio.total > TOPES_HORAS_EXTRAS.anual,
    /* Cuántas le quedan en el año sin pedir autorización. Negativo quiere decir
       que ya se pasó, y se muestra como tal en vez de recortarlo a cero. */
    restanEnElAnio: TOPES_HORAS_EXTRAS.anual - anio.total
  };
}

/**
 * El cierre del mes leído desde las novedades: por tienda y por persona, las
 * horas extras contra los topes y los días de ausencia que la liquidación
 * pagó.
 *
 * Sale de `c.novedades` y **no de `c.ausencias`**: son dos cosas distintas y
 * el panel no las mezcla. `c.ausencias` es la licencia con su certificado —lo
 * que el coordinador sigue día a día—; esto es lo que la liquidación terminó
 * pagando, que es contra lo que se cierra el mes. Que los dos números difieran
 * es información, no un error, y por eso cada uno se lee donde vive.
 */
function cierreDelMes(estado, periodo) {
  const e = estado || {};
  const tiendas = [];
  const gente = [];

  /* Los mismos divisores que la matriz de FTE de la estadística, y por eso
     salen de `parametros` y no de una constante nueva: si el coordinador los
     cambia en Configuración, las dos pantallas tienen que moverse juntas. Un
     FTE es una persona de jornada completa —45 horas semanales—, así que los
     días de ausencia se leen sobre 30 y las horas extras sobre 200. */
  const par = (e.config || {}).parametros || {};
  const diasMes = +par.diasMes || 30;
  const horasMes = +par.horasMes || 200;

  (e.sucursales || []).forEach(s => {
    const fila = {
      id: s.id, sucursal: s.nombre || s.codigo,
      personas: 0, conNovedades: 0,
      he50: 0, he100: 0, horasExtras: 0,
      diasAusencia: 0, porConcepto: {},
      diasVinculo: 0, diasFaltantes: 0, altas: [], bajas: [],
      excedenMes: 0
    };
    (s.colaboradores || []).forEach(c => {
      fila.personas++;
      const n = (c.novedades || {})[periodo];
      if (!n) return;
      fila.conNovedades++;

      /* Cuántos días del mes estuvo vinculada. Quien entró el 16 aportó
         quince y quien se fue el 12, doce: contarlos como un mes entero
         infla la dotación con gente que no estuvo, que es justamente lo que
         el cierre tiene que mostrar. La cuenta es la de la matriz de FTE
         (`movimientoDelMes()` en `store.js`) y no una nueva. */
      const mov = (typeof Store !== 'undefined' && Store.diasDeVinculo)
        ? Store.diasDeVinculo(c, periodo, diasMes)
        : { tipo: 'estable', dias: diasMes };
      fila.diasVinculo += mov.dias;
      fila.diasFaltantes += diasMes - mov.dias;
      if (mov.tipo === 'alta') fila.altas.push({ nombre: c.nombre, dias: mov.dias });
      if (mov.tipo === 'baja') fila.bajas.push({ nombre: c.nombre, dias: mov.dias });

      const tope = topeHorasExtras(c, periodo);
      fila.he50 += tope.mes.al50;
      fila.he100 += tope.mes.al100;
      fila.horasExtras += tope.mes.total;
      if (tope.excedeMes) fila.excedenMes++;

      /* Los días que la liquidación pagó como ausencia, por concepto. Las
         vacaciones, la maternidad, el matrimonio, el nacimiento y el
         fallecimiento entran en la lista porque el libro los trae, pero no
         suman al total: `cuentaComoAusentismo()` decide, y decide en un solo
         lugar para que la regla no se bifurque. */
      let dias = 0;
      MAPA_AUSENCIAS.forEach(m => {
        const d = +n[m.campo] || 0;
        if (!d) return;
        fila.porConcepto[m.nombre] = (fila.porConcepto[m.nombre] || 0) + d;
        if (cuentaComoAusentismo(m.campo)) dias += d;
      });
      fila.diasAusencia += dias;

      gente.push({
        id: c.id, nombre: c.nombre, sucursal: s.nombre || s.codigo, sucursalId: s.id,
        cargo: c.cargo || c.posicion || '', tope, dias,
        movimiento: mov.tipo, diasVinculo: mov.dias, diasFaltantes: diasMes - mov.dias,
        /* Lo mismo en la unidad en la que se piensa la dotación. El FTE real es
           la fórmula de TD01: los días que estuvo, menos los que faltó, más lo
           que se repuso con extras. */
        fteVinculo: mov.dias / diasMes,
        fteAusencia: dias / diasMes,
        fteExtras: tope.mes.total / horasMes,
        fteReal: mov.dias / diasMes - dias / diasMes + tope.mes.total / horasMes,
        fteNeto: tope.mes.total / horasMes - dias / diasMes - (diasMes - mov.dias) / diasMes,
        porConcepto: MAPA_AUSENCIAS.reduce((a, m) => {
          const d = +n[m.campo] || 0; if (d) a[m.nombre] = d; return a;
        }, {})
      });
    });
    if (fila.conNovedades) tiendas.push(fila);
  });

  tiendas.forEach(x => {
    x.fteAusencia = x.diasAusencia / diasMes;
    x.fteExtras = x.horasExtras / horasMes;
    x.fteVinculo = x.diasVinculo / diasMes;
    /* Lo que se perdió porque alguien entró o salió en el medio del mes. */
    x.fteMovimientos = x.diasFaltantes / diasMes;
    x.fteReal = x.fteVinculo - x.fteAusencia + x.fteExtras;
    /* El neto contra tener a todos el mes entero: es el número que dice
       cuánta gente faltó de verdad. */
    x.fteNeto = x.fteExtras - x.fteAusencia - x.fteMovimientos;
  });

  /* Por el neto y no por las horas: la pregunta de la tienda no es cuántas
     extras pagó sino cuánto turno le faltó, y una que perdió un FTE entero en
     licencias está peor que una que hizo cuarenta horas extras. */
  tiendas.sort((a, b) => a.fteNeto - b.fteNeto || b.diasAusencia - a.diasAusencia);
  gente.sort((a, b) => b.tope.mes.total - a.tope.mes.total || b.dias - a.dias);

  const tot = tiendas.reduce((a, x) => ({
    personas: a.personas + x.conNovedades,
    he50: a.he50 + x.he50, he100: a.he100 + x.he100,
    horasExtras: a.horasExtras + x.horasExtras,
    diasAusencia: a.diasAusencia + x.diasAusencia,
    diasVinculo: a.diasVinculo + x.diasVinculo,
    diasFaltantes: a.diasFaltantes + x.diasFaltantes,
    altas: a.altas + x.altas.length, bajas: a.bajas + x.bajas.length
  }), { personas: 0, he50: 0, he100: 0, horasExtras: 0, diasAusencia: 0,
        diasVinculo: 0, diasFaltantes: 0, altas: 0, bajas: 0 });
  tot.fteAusencia = tot.diasAusencia / diasMes;
  tot.fteExtras = tot.horasExtras / horasMes;
  tot.fteVinculo = tot.diasVinculo / diasMes;
  tot.fteMovimientos = tot.diasFaltantes / diasMes;
  tot.fteReal = tot.fteVinculo - tot.fteAusencia + tot.fteExtras;
  tot.fteNeto = tot.fteExtras - tot.fteAusencia - tot.fteMovimientos;

  return {
    periodo, tiendas, gente, total: tot, diasMes, horasMes,
    hayDatos: !!gente.length,
    excedenMes: gente.filter(g => g.tope.excedeMes),
    excedenAnio: gente.filter(g => g.tope.excedeAnio),
    alBordeDelAnio: gente.filter(g => !g.tope.excedeAnio && g.tope.estadoAnio === 'alBorde'),
    /* Los períodos que hay cargados, para el selector y para poder decir sobre
       cuántos meses está hecho el acumulado del año. */
    periodosCargados: Array.from(new Set((e.sucursales || [])
      .flatMap(s => (s.colaboradores || []).flatMap(c => Object.keys(c.novedades || {})))))
      .sort()
  };
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
    esNoPresencial, MOTIVOS_NO_PRESENCIAL, MOTIVO_NO_PRESENCIAL_POR_ID,
    ESCALAFON_ANTIGUEDAD, escalafonDe, VACACIONES_CCT, vacacionesDe,
    LICENCIAS_CCT, LICENCIAS_CCT_POR_ID, saldoLicencias, alertasLicencias, JORNADA_CCT,
    jornadaDeVinculo,
    ESTADOS_ADEF, ESTADOS_ADEF_POR_ID, tramosDeAntiguedad, situacionArt8,
    MESES_AVISO_ART8, relevamientoAdef,
    TOPES_HORAS_EXTRAS, horasExtrasDe, periodosDelAnio, topeHorasExtras, cierreDelMes
  };
}

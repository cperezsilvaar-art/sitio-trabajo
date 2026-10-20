/*
 * talento.js — Evaluación de desempeño y potencial, matriz 9-box y talent card.
 *
 * Los colaboradores cuelgan de la SUCURSAL, no de la visita: la evaluación es
 * un estado vigente que se ajusta cuando el gerente aporta información nueva,
 * y cada cambio queda en el historial con su fecha. Así la persona se mueve de
 * cuadrante sin perder de dónde venía.
 */

/* ------------------------------ Escalas ------------------------------ */
const ESCALA_DESEMPENO = [
  { valor: 1, nombre: 'Por debajo',  ayuda: 'No alcanza lo esperado para su posición.' },
  { valor: 2, nombre: 'Esperado',    ayuda: 'Cumple con lo que la posición requiere.' },
  { valor: 3, nombre: 'Supera',      ayuda: 'Consistentemente por encima de lo esperado.' }
];

const ESCALA_POTENCIAL = [
  { valor: 1, nombre: 'En su nivel', ayuda: 'Aporta donde está; no se proyecta un salto de nivel.' },
  { valor: 2, nombre: 'Puede crecer',ayuda: 'Puede asumir una posición de mayor alcance.' },
  { valor: 3, nombre: 'Alto',        ayuda: 'Puede crecer más de un nivel o cambiar de función.' }
];

/* --------------------------- Los nueve cuadrantes --------------------- *
 * Clave: `${potencial}${desempeno}`                                       */
const NINE_BOX = {
  '31': { nombre: 'Enigma',              tono: 'amarillo',
          lectura: 'Potencial visible sin resultados todavía.',
          accion: 'Entender qué lo frena: encuadre en el puesto, claridad de expectativas o acompañamiento. Definir un plazo para ver movimiento.' },
  '32': { nombre: 'Promesa',             tono: 'verde',
          lectura: 'Buen desempeño y potencial alto.',
          accion: 'Darle proyectos que estiren su alcance y un referente que lo acompañe. Candidato natural a sucesión.' },
  '33': { nombre: 'Estrella',            tono: 'verde',
          lectura: 'Supera lo esperado y puede crecer.',
          accion: 'Plan de sucesión concreto y conversación de carrera. Es el perfil más caro de perder: revisar retención.' },
  '21': { nombre: 'Inconsistente',       tono: 'amarillo',
          lectura: 'Puede crecer, pero hoy no rinde.',
          accion: 'Feedback específico sobre las brechas y un plan con seguimiento a 60 o 90 días.' },
  '22': { nombre: 'Profesional sólido',  tono: 'azul',
          lectura: 'Cumple y puede asumir algo más.',
          accion: 'Formación puntual y exposición a tareas de la posición siguiente.' },
  '23': { nombre: 'Alto desempeño',      tono: 'verde',
          lectura: 'Rinde muy bien en su nivel actual.',
          accion: 'Reconocer el aporte y explorar hasta dónde quiere llegar antes de asumir que quiere crecer.' },
  '11': { nombre: 'Riesgo',              tono: 'rojo',
          lectura: 'No alcanza lo esperado y no se proyecta crecimiento.',
          accion: 'Plan de mejora con objetivos medibles y plazo. Si no hay cambio, evaluar reubicación o desvinculación.' },
  '12': { nombre: 'Eficaz',              tono: 'azul',
          lectura: 'Hace lo que la posición pide.',
          accion: 'Sostener el desempeño y cuidar la motivación. No forzar un crecimiento que no busca.' },
  '13': { nombre: 'Especialista',        tono: 'azul',
          lectura: 'Muy bueno en lo suyo, sin proyección de nivel.',
          accion: 'Referente técnico del equipo: aprovecharlo para formar a otros. Riesgo alto si se va.' }
};

const cuadranteDe = (potencial, desempeno) =>
  NINE_BOX[String(potencial) + String(desempeno)] || null;

/* ------------------------------ Talent card --------------------------- */
const NIVELES_ESTUDIO = [
  { id: '',             nombre: 'Sin dato' },
  { id: 'noEstudia',    nombre: 'No estudia' },
  { id: 'secundario',   nombre: 'Secundario en curso' },
  { id: 'terciario',    nombre: 'Terciario en curso' },
  { id: 'universitario',nombre: 'Universitario en curso' },
  { id: 'posgrado',     nombre: 'Posgrado en curso' },
  { id: 'curso',        nombre: 'Curso o capacitación' }
];

const RIESGO_SALIDA = [
  { id: '',      nombre: 'Sin evaluar' },
  { id: 'bajo',  nombre: 'Bajo' },
  { id: 'medio', nombre: 'Medio' },
  { id: 'alto',  nombre: 'Alto' }
];

const MOVILIDAD = [
  { id: '',     nombre: 'Sin dato' },
  { id: 'si',   nombre: 'Sí, puede moverse de sucursal' },
  { id: 'no',   nombre: 'No, solo esta sucursal' },
  { id: 'zona', nombre: 'Solo dentro de la zona' }
];

/* ---------------------------- Utilidades ----------------------------- */

/** Antigüedad en años a partir de la fecha de ingreso. */
function antiguedadAnios(fechaIngreso) {
  if (!fechaIngreso) return null;
  const d = new Date(fechaIngreso + 'T00:00:00');
  if (isNaN(d)) return null;
  return (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
}

/**
 * Registra una evaluación. Solo agrega al historial si algo cambió, para que
 * el historial cuente movimientos y no reediciones.
 */
function registrarEvaluacion(colaborador, desempeno, potencial, contexto) {
  const d = Number(desempeno) || null;
  const pot = Number(potencial) || null;
  const previo = { desempeno: colaborador.desempeno || null, potencial: colaborador.potencial || null };
  const cambio = previo.desempeno !== d || previo.potencial !== pot;

  colaborador.desempeno = d;
  colaborador.potencial = pot;
  if (!Array.isArray(colaborador.historial)) colaborador.historial = [];

  if (cambio && (d || pot)) {
    colaborador.historial.push({
      fecha: (contexto && contexto.fecha) || new Date().toISOString().slice(0, 10),
      desempeno: d, potencial: pot,
      desde: previo.desempeno || previo.potencial ? previo : null,
      evaluadoCon: (contexto && contexto.evaluadoCon) || '',
      motivo: (contexto && contexto.motivo) || ''
    });
    colaborador.fechaEvaluacion = (contexto && contexto.fecha) || new Date().toISOString().slice(0, 10);
    colaborador.evaluadoCon = (contexto && contexto.evaluadoCon) || colaborador.evaluadoCon || '';
  }
  return cambio;
}

/** Distribución del plantel en la matriz, para el panel y el reporte. */
function distribucion9Box(colaboradores) {
  const activos = (colaboradores || []).filter(c => c.activo !== false);
  const evaluados = activos.filter(c => c.desempeno && c.potencial);

  const celdas = {};
  Object.keys(NINE_BOX).forEach(k => { celdas[k] = []; });
  evaluados.forEach(c => { celdas[String(c.potencial) + String(c.desempeno)].push(c); });

  // Todas las agrupaciones devuelven listas, para poder contarlas y nombrarlas
  const porTono = tono => evaluados.filter(c => (cuadranteDe(c.potencial, c.desempeno) || {}).tono === tono);

  return {
    activos, evaluados,
    sinEvaluar: activos.filter(c => !c.desempeno || !c.potencial),
    celdas,
    fortalezas: porTono('verde'),
    aTrabajar: porTono('amarillo'),
    enRiesgo: porTono('rojo'),
    listosParaCrecer: evaluados.filter(c => c.potencial >= 2 && c.desempeno >= 2),
    riesgoDeSalida: activos.filter(c => c.riesgoSalida === 'alto'),
    estudiando: activos.filter(c => c.estudia && c.estudia !== 'noEstudia')
  };
}

/* ------------------------ Los tres grupos del mapa -------------------- *
 * Nueve cuadrantes son el detalle de la conversación con un gerente; para
 * mirar el área de conjunto son demasiados. El coordinador la lee en tres
 * grupos —talento, especialista y contribuidor consistente (CC)— que es lo
 * que contesta «a quién tengo mapeado como qué» sin abrir la matriz.
 *
 * Los tres se derivan del cuadrante y no se cargan aparte: un campo nuevo
 * sería una segunda respuesta a la misma pregunta, y el día que difieran no
 * hay forma de saber cuál vale.
 *
 * El cuarto grupo no es uno de los tres y va igual: quien hoy no alcanza lo
 * esperado tiene que estar en algún lado, y dejarlo afuera daría un mapa que
 * no suma el plantel. */
/* `corto` es la lectura en tres palabras, para la tarjeta del organigrama:
   «CC» solo no le dice nada a quien no se sepa el 9-box de memoria, y la
   oración entera no entra al lado de un nombre. La oración completa sigue
   estando —en el `title` de la tarjeta y entera en la ficha—.

   **`tono` dice si pide algo, no cuál de los cuatro es.** Se intentó darle un
   color propio a cada grupo y no sobrevive: con los dos del laboratorio ya en
   la página, cualquier cuarto tono contra el verde se cae a ΔE 4,4 en
   deuteranopía —el validador lo marca como falla dura—. Así que el color
   contesta «¿tengo que hacer algo con esta persona?» —rojo pide acción, verde
   es a quien hay que retener, gris está bien donde está— y **cuál de los
   cuatro es lo dice el texto**, que está siempre escrito. Es la misma regla
   que la barra de composición. */
const GRUPOS_TALENTO = [
  { id: 'talento', nombre: 'Talento', tono: 'verde',
    corto: 'puede asumir más',
    cuadrantes: ['33', '32', '23', '22'],
    lectura: 'Entrega lo que la posición pide y puede asumir una de mayor alcance.',
    accion: 'Es de acá que sale la sucesión: plan de carrera, proyectos que estiren y retención.' },
  { id: 'especialista', nombre: 'Especialista', tono: '',
    corto: 'muy bueno en lo suyo',
    cuadrantes: ['13'],
    lectura: 'Muy bueno en lo suyo, sin proyección de cambio de nivel.',
    accion: 'Referente técnico del equipo y quien forma a los que entran. Perderlo se nota en el piso.' },
  { id: 'cc', nombre: 'Contribuidor consistente (CC)', corto_nombre: 'CC', tono: '',
    corto: 'cumple, no busca crecer',
    cuadrantes: ['12'],
    lectura: 'Hace lo que la posición pide, y no busca crecer.',
    accion: 'Es el sostén de la operación: cuidar la motivación y no forzarle un crecimiento que no pidió.' },
  { id: 'enPlan', nombre: 'En plan de mejora', tono: 'rojo',
    corto: 'hoy no alcanza',
    cuadrantes: ['31', '21', '11'],
    lectura: 'Hoy no alcanza lo esperado, con o sin potencial visible.',
    accion: 'Feedback concreto y un plazo para ver movimiento. No es un grupo donde quedarse.' }
];

const grupoDeTalento = c => {
  if (!c || !c.desempeno || !c.potencial) return null;
  const k = String(c.potencial) + String(c.desempeno);
  return GRUPOS_TALENTO.find(g => g.cuadrantes.indexOf(k) >= 0) || null;
};

/**
 * El plantel repartido en los grupos, en el orden en que se leen.
 *
 * `sinEvaluar` va aparte y no como un grupo más, por lo mismo que «sin
 * relevar» en el curso de ADEF: que a alguien todavía no lo miraste no es una
 * lectura sobre esa persona, y mezclarlo borra la única diferencia que
 * importa al empezar.
 */
function mapaDeTalento(colaboradores) {
  const d = distribucion9Box(colaboradores);
  const grupos = GRUPOS_TALENTO.map(g => ({
    ...g,
    gente: g.cuadrantes.reduce((a, k) => a.concat(d.celdas[k] || []), [])
      .slice().sort((x, y) => (x.nombre || '').localeCompare(y.nombre || '', 'es'))
  }));
  return {
    grupos, sinEvaluar: d.sinEvaluar,
    activos: d.activos, evaluados: d.evaluados,
    pct: g => (d.evaluados.length ? g.gente.length / d.evaluados.length : 0)
  };
}

/* ==================== Plan de desarrollo individual ==================== *
 * Lo que se acordó hacer entre una conversación y la siguiente.
 *
 * Vive acá y no en `desarrollo.js` porque es la otra mitad del 9-box: cada
 * cuadrante trae escrita su acción sugerida —«plan de mejora con objetivos
 * medibles y plazo», «proyectos que estiren su alcance»— y hasta ahora no
 * había dónde escribir qué se hizo con eso. Sirve para cualquiera del padrón,
 * esté o no entrenando para un rol.
 *
 * Cuelga de la **persona** (`c.planes[]`), como `c.ausencias`, `c.casos` y
 * `c.entrenamientos`, así el plan la acompaña si la trasladan de tienda.
 *
 * El entrenamiento a Senior ya tenía un campo `proximoPaso` por evaluación:
 * un renglón de texto libre que servía para acordarse y nada más —sin
 * competencia, sin fecha y sin nadie que vuelva a preguntar si se hizo—.
 * Sigue guardado y se sigue leyendo en la trazabilidad; lo que se trabaja de
 * acá en adelante es el plan.
 */

/* Qué pasó con cada acción cuando se revisa el plan. Son cuatro y no tres:
   «no se hizo» y «sigue abierta» parecen lo mismo y no lo son —una cierra el
   tema y la otra lo arrastra al plan siguiente—, y esa diferencia es la que
   hace que un plan tenga continuidad en vez de empezar de cero cada mes. */
const ESTADOS_ACCION = [
  { id: '',           nombre: 'Sin revisar',  tono: '',      abierta: true },
  { id: 'hecha',      nombre: 'Se hizo',      tono: 'verde', abierta: false },
  { id: 'sigue',      nombre: 'Sigue abierta',tono: 'ambar', abierta: true },
  { id: 'no-se-hizo', nombre: 'No se hizo',   tono: 'rojo',  abierta: false }
];

const estadoDeAccion = id =>
  ESTADOS_ACCION.find(x => x.id === (id || '')) || ESTADOS_ACCION[0];

/** El plan que se está trabajando hoy. Hay uno abierto a la vez: dos planes
    en curso son dos listas de prioridades, que es no tener ninguna. */
function planAbierto(colaborador) {
  return ((colaborador || {}).planes || []).find(p => !p.cerradoEl) || null;
}

/** Los planes de una persona, del más nuevo al más viejo. */
function planesDe(colaborador) {
  return ((colaborador || {}).planes || []).slice()
    .sort((a, b) => String(b.desde || '').localeCompare(String(a.desde || '')));
}

/**
 * Cómo viene el plan: cuántas acciones se hicieron y qué está vencido.
 *
 * El avance se cuenta sobre las acciones **revisadas**, no sobre el total: un
 * plan de tres acciones con una hecha y dos sin mirar no es «33% cumplido»,
 * es una hecha y dos que nadie revisó todavía. Es la misma regla que el
 * «sin evaluar» del entrenamiento y los días supuestos del ausentismo — el
 * número no se muestra solo.
 */
function avanceDelPlan(plan, hoy) {
  const h = hoy || new Date().toISOString().slice(0, 10);
  const acciones = ((plan || {}).acciones || []).map(a => {
    const est = estadoDeAccion(a.estado);
    return {
      accion: a, estado: est,
      /* Vencida es la que tiene fecha pasada y nadie cerró. Una acción ya
         revisada no vence: lo que pasó, pasó. */
      vencida: est.abierta && !!a.para && a.para < h
    };
  });
  const revisadas = acciones.filter(x => x.accion.estado);
  const hechas = acciones.filter(x => x.accion.estado === 'hecha');
  return {
    acciones,
    total: acciones.length,
    revisadas: revisadas.length,
    sinRevisar: acciones.length - revisadas.length,
    hechas: hechas.length,
    vencidas: acciones.filter(x => x.vencida).length,
    siguen: acciones.filter(x => x.accion.estado === 'sigue'),
    pct: revisadas.length ? hechas.length / revisadas.length : null
  };
}

/** En qué anda el plan: abierto, vencido o cerrado. Como el entrenamiento,
    el panel marca el vencimiento pero no cierra nada solo. */
function estadoDePlan(plan, hoy) {
  const h = hoy || new Date().toISOString().slice(0, 10);
  const p = plan || {};
  if (p.cerradoEl) return { id: 'cerrado', nombre: 'Cerrado', tono: '', abierto: false };
  const vencido = !!p.hasta && p.hasta < h;
  return {
    id: vencido ? 'vencido' : 'abierto',
    nombre: vencido ? 'Pasó la fecha de revisión' : 'En curso',
    tono: vencido ? 'rojo' : 'azul',
    abierto: true, vencido
  };
}

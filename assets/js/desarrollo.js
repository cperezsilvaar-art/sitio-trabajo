/*
 * desarrollo.js — La ruta de un APV al rol de Senior.
 *
 * Responde una pregunta que hasta ahora vivía en el WhatsApp del gerente:
 * "a quién propusiste, desde cuándo lo estás entrenando, cuándo termina y
 * cómo le está yendo". El panel guarda esa trazabilidad completa —quién lo
 * propuso, en qué fecha, la fecha tentativa de cierre, cada assessment y cada
 * conversación mensual con el gerente— y la deja colgada de la persona, no de
 * la tienda, para que la acompañe si se muda (igual que `c.baja`,
 * `c.movimientos` y `c.ausencias`).
 *
 * Lo que se evalúa no se inventó acá: sale del **Inventario de Competencias
 * de Farmatodo** y, dentro de él, de la matriz "Modelos de competencias por
 * áreas de negocio y roles", que para cada competencia fija el nivel de
 * indicador que pide el cargo. Comparando la columna APV con la columna APV
 * Senior queda, literalmente, lo que esta persona tiene que trabajar para ser
 * efectiva en el rol. Está documentado en `docs/desarrollo-senior.md`.
 *
 * Los niveles del inventario son **acumulativos**: quien está en 3 hace
 * también lo de 1 y 2. Por eso alcanza con guardar un número por competencia
 * y por evaluación.
 */

/* ------------------------------------------------------------------ *
 * 1. Las competencias del inventario que separan al APV del Senior     *
 * ------------------------------------------------------------------ */

/**
 * Las once competencias que la matriz del inventario le pide al APV Senior,
 * con el nivel que ya trae el APV (`apv`) y el que le exige el rol (`senior`).
 * Los indicadores llegan hasta el nivel del Senior: pedirle a un gerente que
 * lea los seis niveles de Liderazgo para evaluar el primero es la manera más
 * rápida de que no complete nada.
 */
const COMPETENCIAS_SENIOR = [
  {
    id: 'orden-detalle',
    nombre: 'Preocupación por el orden y el detalle',
    escala: 4, apv: 2, senior: 3,
    definicion: 'Es la capacidad para reducir al mínimo la posibilidad de errores en torno al desempeño individual o grupal de la tienda o farmacia. Se refleja en la continua comprobación y control del trabajo, en especial en la ejecución de las actividades operativas: planogramas, etiquetado, manejo y control de inventario, entre otros.',
    indicadores: [
      'Muestra preocupación por el detalle',
      'Comprueba su propio trabajo',
      'Verifica la calidad del trabajo de los demás'
    ]
  },
  {
    id: 'madurez',
    nombre: 'Madurez emocional',
    escala: 4, apv: 2, senior: 3,
    definicion: 'Implica tener confianza en sus propias capacidades y/o puntos de vista, asumiendo con seguridad y aplomo diferentes situaciones, retos, cambios y/o nuevas responsabilidades en el trabajo.',
    indicadores: [
      'Actúa con autonomía',
      'Demuestra seguridad en sus capacidades',
      'Asume retos con seguridad y aplomo'
    ]
  },
  {
    id: 'energia',
    nombre: 'Energía',
    escala: 4, apv: 3, senior: 4,
    definicion: 'Es la capacidad de mantener un nivel de actividad alto y constante, adaptado al ritmo del día a día organizacional, logrando incluso impactar positivamente en otras personas de su equipo. Implica trabajar duro, mostrar impulso y entusiasmo en la realización de todas las actividades, sin perder el foco en los resultados.',
    indicadores: [
      'Resiste con energía',
      'Mantiene el ritmo de trabajo',
      'Refleja entusiasmo',
      'Dirige la energía'
    ]
  },
  {
    id: 'desarrollo-otros',
    nombre: 'Desarrollo de otros',
    escala: 5, apv: 1, senior: 2,
    definicion: 'Es el interés y la disposición genuina por promover la formación y el desarrollo propio y del personal a su cargo, aun cuando no sean sus reportes directos, a partir de un análisis de las necesidades de cada individuo y de Farmatodo como organización.',
    indicadores: [
      'Se adueña de su desarrollo personal en el día a día',
      'Da instrucciones y apoya al desarrollo de otros'
    ]
  },
  {
    id: 'resultados',
    nombre: 'Orientación a resultados excelentes',
    escala: 4, apv: 1, senior: 2,
    definicion: 'Es el permanente interés por trabajar bien y alcanzar o sobrepasar los estándares de excelencia establecidos por sí mismo o la organización. Implica definir y alcanzar metas asumiendo algunos riesgos calculados que generen un crecimiento sostenible y rentable.',
    indicadores: [
      'Desempeña muy bien su trabajo',
      'Monitorea su desempeño y busca mejorarlo'
    ]
  },
  {
    id: 'cliente',
    nombre: 'Orientación al cliente',
    escala: 4, apv: 1, senior: 2,
    definicion: 'Es el deseo genuino por satisfacer las necesidades de los clientes internos y/o externos. Implica demostrar en su forma de actuar las conductas de servicio definidas por Farmatodo, identificar a profundidad las necesidades del cliente y tomar acciones efectivas para resolverlas de manera oportuna.',
    indicadores: [
      'Responde de manera efectiva al cliente',
      'Se compromete personalmente con el cliente'
    ]
  },
  {
    id: 'seguimiento',
    nombre: 'Seguimiento y control',
    escala: 4, apv: 1, senior: 2,
    definicion: 'Es la capacidad de hacer seguimiento estrecho y continuo a los detalles administrativos y operativos de la organización y del área para asegurar su efectiva gestión en los tiempos establecidos. Incluye detectar desviaciones y anticipar problemas, tomando las acciones necesarias que aseguren el cumplimiento de los estándares.',
    indicadores: [
      'Es cuidadoso con los detalles',
      'Hace seguimiento'
    ]
  },
  {
    id: 'urgencia',
    nombre: 'Sentido de urgencia',
    escala: 5, apv: 1, senior: 2,
    definicion: 'Es la capacidad de actuar, acatar instrucciones y adueñarse de una situación de manera efectiva, rápida y oportuna. En los primeros niveles implica detectar problemas, informar sobre ellos y persistir en su solución.',
    indicadores: [
      'Actúa rápidamente ante una situación',
      'Resuelve con efectividad'
    ]
  },
  {
    id: 'liderazgo',
    nombre: 'Liderazgo',
    escala: 6, apv: 0, senior: 1,
    definicion: 'Es la capacidad de inspirar a otros a alcanzar altos estándares de desempeño creando un clima de energía y compromiso, comunicando la visión y la cultura de la empresa, ya sea desde una posición formal o informal de autoridad. Contempla ganar la confianza y el apoyo del equipo a través de un relacionamiento cercano y genuino.',
    indicadores: [
      'Asume un rol de liderazgo, aunque no sea su rol formal'
    ]
  },
  {
    id: 'direccion-otros',
    nombre: 'Dirección de otros',
    escala: 4, apv: 1, senior: 1,
    definicion: 'Es la habilidad para orientar eficazmente el desempeño de su equipo o de otras personas. Implica fijar estándares, hacer seguimiento y dar retroalimentación con miras a generar claridad de expectativas y mejorar el desempeño.',
    indicadores: [
      'Explica detalladamente las expectativas de desempeño'
    ]
  },
  {
    id: 'excelencia',
    nombre: 'Excelencia operativa',
    escala: 5, apv: 1, senior: 1,
    definicion: 'Es el interés por optimizar permanentemente los procesos de la organización a fin de alcanzar mejores resultados en eficiencia y productividad. Implica identificar los objetivos de mejora, analizarlos y establecer planes de acción para concretarlos.',
    indicadores: [
      'Relaciona las responsabilidades de su trabajo con el proceso y las mejores prácticas'
    ]
  }
];

/**
 * Lo que el rol de Senior deja de pedir. La matriz le exige al APV nivel 3 de
 * Conciencia de equipo y al Senior no le pide la competencia: el salto no es
 * solo sumar, y decirlo evita que el gerente lo lea como un retroceso.
 */
const COMPETENCIA_QUE_NO_SIGUE = {
  nombre: 'Conciencia de equipo',
  apv: 3,
  nota: 'El rol de Senior no la lista entre sus competencias: lo que en el APV era cooperar con el equipo, en el Senior se le pide como Liderazgo y Dirección de otros.'
};

/** Las que suben de nivel entre un cargo y el otro: por donde empieza el plan. */
function competenciasQueSuben() {
  return COMPETENCIAS_SENIOR.filter(c => c.senior > c.apv);
}

/** Busca una competencia por su id. */
function competenciaSenior(id) {
  return COMPETENCIAS_SENIOR.find(c => c.id === id) || null;
}

/* ------------------------------------------------------------------ *
 * 2. El entrenamiento                                                  *
 * ------------------------------------------------------------------ */

const ESTADOS_ENTRENAMIENTO = [
  { id: 'propuesto',     nombre: 'Propuesto',        tono: 'ambar',
    ayuda: 'El gerente lo propuso y todavía no arrancó el entrenamiento.' },
  { id: 'entrenamiento', nombre: 'En entrenamiento', tono: 'azul',
    ayuda: 'Está cubriendo el rol y se lo evalúa mes a mes.' },
  { id: 'cerrado',       nombre: 'Cerrado',          tono: '',
    ayuda: 'Terminó: quedó efectivo en el rol o volvió a su puesto.' }
];

const RESULTADOS_ENTRENAMIENTO = [
  { id: 'efectivo',     nombre: 'Efectivo en el rol', tono: 'verde' },
  { id: 'continua',     nombre: 'Sigue como APV',     tono: 'ambar' },
  { id: 'interrumpido', nombre: 'Interrumpido',       tono: 'rojo' }
];

/**
 * Las instancias de assessment. Son las evaluaciones formales del proceso;
 * aparte de ellas está la conversación mensual con el gerente, que es la que
 * da la trazabilidad fina.
 */
const INSTANCIAS_EVALUACION = [
  { id: 'mensual',      nombre: 'Seguimiento mensual con el gerente' },
  { id: 'assessment-1', nombre: 'Assessment 1' },
  { id: 'assessment-2', nombre: 'Assessment 2' },
  { id: 'assessment-3', nombre: 'Assessment 3' },
  { id: 'cierre',       nombre: 'Evaluación de cierre' }
];

function nombreDeInstancia(id) {
  const x = INSTANCIAS_EVALUACION.find(i => i.id === id);
  return x ? x.nombre : (id || 'Evaluación');
}

/** Los meses que dura por defecto un entrenamiento, para proponer el fin. */
const MESES_ENTRENAMIENTO = 3;

/* ------------------------------------------------------------------ *
 * 3. Cómo viene                                                        *
 * ------------------------------------------------------------------ */

/**
 * El último nivel evaluado de cada competencia. Recorre las evaluaciones en
 * orden de fecha y se queda con la más reciente que puso un número: una
 * conversación mensual que habló de tres competencias no borra lo que se
 * midió en el assessment del mes pasado sobre las otras ocho.
 */
function nivelesActuales(entrenamiento) {
  const out = {};
  ((entrenamiento || {}).evaluaciones || [])
    .slice()
    .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')))
    .forEach(ev => {
      Object.keys(ev.niveles || {}).forEach(k => {
        const n = Number(ev.niveles[k]);
        if (!isNaN(n) && n > 0) out[k] = n;
      });
    });
  return out;
}

/**
 * Cuánto del perfil de Senior ya alcanzó.
 *
 * **Se cuenta sobre las que tienen salto, no sobre las once.** De las once del
 * modelo, dos —*Dirección de otros* y *Excelencia operativa*— le piden al
 * Senior el mismo nivel que ya le piden al APV: no hay nada que desarrollar
 * ahí, y meterlas en el denominador hacía que alguien que hizo todo bien
 * quedara en 9 de 11 para siempre, salvo que se puntuaran a mano dos
 * competencias que nadie tenía por qué puntuar. `competenciasConSalto()`
 * existía justamente para esto y no la llamaba nadie.
 *
 * No promedia niveles de escalas distintas —un 2 de Liderazgo sobre 6 y un 2
 * de Seguimiento sobre 4 no son lo mismo— sino que cuenta cuántas llegaron al
 * nivel que pide el rol.
 */
function avanceDeEntrenamiento(entrenamiento) {
  const niveles = nivelesActuales(entrenamiento);
  const filas = COMPETENCIAS_SENIOR.map(c => {
    const actual = niveles[c.id] || 0;
    /* Sin salto: el rol de Senior le pide lo mismo que el de APV, así que no
       es un objetivo de desarrollo sino un requisito que ya trae el puesto. */
    const sinSalto = c.senior <= c.apv;
    return {
      competencia: c,
      actual,
      objetivo: c.senior,
      sinSalto,
      evaluada: actual > 0,
      alcanzada: sinSalto || actual >= c.senior,
      brecha: Math.max(0, c.senior - actual)
    };
  });
  const aDesarrollar = filas.filter(f => !f.sinSalto);
  const evaluadas = aDesarrollar.filter(f => f.evaluada).length;
  const alcanzadas = aDesarrollar.filter(f => f.alcanzada).length;
  return {
    filas,
    aDesarrollar,
    sinSalto: filas.filter(f => f.sinSalto),
    evaluadas,
    alcanzadas,
    sinEvaluar: aDesarrollar.length - evaluadas,
    total: aDesarrollar.length,
    pendientes: aDesarrollar.filter(f => !f.alcanzada),
    pct: aDesarrollar.length ? alcanzadas / aDesarrollar.length : 0
  };
}

/**
 * En qué anda el entrenamiento hoy: el estado que eligió el coordinador más
 * lo que dice el almanaque. Un entrenamiento en curso cuya fecha tentativa ya
 * pasó no cambia de estado solo —la decisión de efectivizar es de una persona,
 * no del panel— pero sí se marca vencido, que es lo que dispara la charla.
 */
function estadoDeEntrenamiento(entrenamiento, hoy) {
  const h = hoy || _diaHoy();
  const ent = entrenamiento || {};
  const def = ESTADOS_ENTRENAMIENTO.find(x => x.id === ent.estado) || ESTADOS_ENTRENAMIENTO[0];
  const vencido = def.id === 'entrenamiento' && ent.finTentativo && ent.finTentativo < h;
  const porVencer = def.id === 'entrenamiento' && ent.finTentativo &&
                    !vencido && ent.finTentativo <= _sumarDias(h, 15);

  let texto = def.nombre;
  if (def.id === 'propuesto') {
    texto = ent.fechaPropuesta ? `Propuesto el ${_fecha(ent.fechaPropuesta)}` : 'Propuesto';
  } else if (def.id === 'entrenamiento') {
    if (vencido) texto = `Venció el ${_fecha(ent.finTentativo)}`;
    else if (ent.finTentativo) texto = `Hasta el ${_fecha(ent.finTentativo)}`;
  }

  /* Un entrenamiento cerrado se lee por cómo cerró, no por el hecho de estar
     cerrado: efectivo y interrumpido son dos noticias distintas. */
  const res = def.id === 'cerrado'
    ? RESULTADOS_ENTRENAMIENTO.find(x => x.id === ent.resultado) : null;
  if (def.id === 'cerrado') texto = res ? res.nombre : 'Cerrado';

  return {
    id: def.id,
    nombre: def.nombre,
    texto,
    vencido,
    porVencer,
    tono: vencido ? 'rojo' : porVencer ? 'ambar' : res ? res.tono : def.tono,
    abierto: def.id !== 'cerrado'
  };
}

/**
 * El entrenamiento abierto de una persona, o `null`.
 *
 * «Abierto» es propuesto **o** en curso: las dos son conversaciones vivas y en
 * las dos hay algo que seguir. Un cerrado no se marca — el proceso terminó y
 * la tarjeta volvería a gritar para siempre.
 *
 * Vive acá y no en la pantalla porque lo preguntan dos organigramas y el
 * aviso del menú: tres lugares con la misma cuenta escrita a mano es la
 * garantía de que un día difieran.
 */
function entrenamientoAbiertoDe(colaborador, hoy) {
  const h = hoy || _diaHoy();
  let mejor = null;
  ((colaborador || {}).entrenamientos || []).forEach(ent => {
    const est = estadoDeEntrenamiento(ent, h);
    if (!est.abierto) return;
    /* Si tuviera dos, manda el que apura: un vencido no se puede tapar con
       uno recién propuesto. */
    if (!mejor || (est.vencido && !mejor.estado.vencido)) mejor = { entrenamiento: ent, estado: est };
  });
  return mejor;
}

/**
 * Cuándo tocó la última evaluación y si el mes en curso ya tiene la suya.
 * El compromiso del proceso es una conversación por mes con el gerente: sin
 * esa cuenta, el seguimiento se convierte en dos evaluaciones y un silencio.
 */
function seguimientoDelMes(entrenamiento, hoy) {
  const h = hoy || _diaHoy();
  const mes = h.slice(0, 7);
  const evs = ((entrenamiento || {}).evaluaciones || [])
    .slice()
    .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  const ultima = evs[0] || null;
  return {
    ultima,
    cantidad: evs.length,
    delMes: evs.some(ev => String(ev.fecha || '').slice(0, 7) === mes),
    diasSinEvaluar: ultima && ultima.fecha ? _diasEntre(ultima.fecha, h) : null
  };
}

/**
 * Los tres cuadrantes de la pantalla, con la gente adentro de cada uno.
 * Devuelve filas planas —persona, sucursal, entrenamiento, estado, avance—
 * porque el entrenamiento cuelga de la persona y la pantalla necesita las
 * tres cosas juntas en cada línea.
 */
function cuadrantesDeDesarrollo(estado, hoy) {
  const h = hoy || _diaHoy();
  const filas = [];
  ((estado || {}).sucursales || []).forEach(s => {
    (s.colaboradores || []).forEach(c => {
      (c.entrenamientos || []).forEach(ent => {
        filas.push({
          colaboradorId: c.id,
          nombre: c.nombre,
          cargo: c.cargo || c.posicion || '',
          sucursalId: s.id,
          sucursal: s.nombre || s.codigo || '',
          entrenamiento: ent,
          estado: estadoDeEntrenamiento(ent, h),
          avance: avanceDeEntrenamiento(ent),
          seguimiento: seguimientoDelMes(ent, h)
        });
      });
    });
  });

  const porFecha = (a, b) =>
    String(a.entrenamiento.finTentativo || a.entrenamiento.fechaPropuesta || '')
      .localeCompare(String(b.entrenamiento.finTentativo || b.entrenamiento.fechaPropuesta || ''));

  return {
    propuestos: filas.filter(f => f.estado.id === 'propuesto').sort(porFecha),
    enCurso: filas.filter(f => f.estado.id === 'entrenamiento').sort(porFecha),
    cerrados: filas.filter(f => f.estado.id === 'cerrado')
      .sort((a, b) => String(b.entrenamiento.fechaCierre || '').localeCompare(String(a.entrenamiento.fechaCierre || ''))),
    todas: filas
  };
}

/**
 * Lo que pide acción hoy, para el contador del menú y el aviso de la pantalla:
 * un entrenamiento vencido, uno que vence en quince días y el que se quedó sin
 * la conversación del mes.
 */
function alertasDeDesarrollo(estado, hoy) {
  const h = hoy || _diaHoy();
  const cu = cuadrantesDeDesarrollo(estado, h);
  const out = [];
  cu.enCurso.forEach(f => {
    if (f.estado.vencido) {
      out.push({ fila: f, tono: 'rojo',
        texto: `venció el ${_fecha(f.entrenamiento.finTentativo)} y sigue abierto` });
    } else if (f.estado.porVencer) {
      out.push({ fila: f, tono: 'ambar',
        texto: `termina el ${_fecha(f.entrenamiento.finTentativo)}` });
    } else if (!f.seguimiento.delMes) {
      out.push({ fila: f, tono: 'ambar',
        texto: f.seguimiento.ultima
          ? `sin evaluación este mes (la última fue el ${_fecha(f.seguimiento.ultima.fecha)})`
          : 'todavía no tiene ninguna evaluación cargada' });
    }
  });
  cu.propuestos.forEach(f => {
    out.push({ fila: f, tono: 'ambar', texto: 'propuesto, falta arrancar el entrenamiento' });
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * 4. Ayudas de fecha                                                   *
 * ------------------------------------------------------------------ *
 * `_diaHoy`, `_sumarMeses` y `_fecha` viven en ausencias.js y `_sumarDias` en
 * agenda.js: acá se usan, no se redeclaran. Los .js comparten ámbito global y
 * en la build de un solo archivo van todos dentro del mismo bloque, así que
 * una segunda declaración con el mismo nombre rompe la página entera. */

/** Días entre dos fechas ISO, contando los dos extremos como el resto del panel. */
function _diasEntre(desde, hasta) {
  if (!desde || !hasta) return null;
  const a = new Date(desde + 'T00:00:00'), b = new Date(hasta + 'T00:00:00');
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}

/* ================= El período de prueba (art. 92 bis LCT) ================= *
 *
 * Una persona que entra tiene seis meses de prueba, y en esos seis meses el
 * coordinador no la ve: la ve el gerente de su tienda. Lo que se pidió es que
 * **el panel le pregunte al gerente cómo le va, cada dos meses**, y que las
 * tres conversaciones estén antes de que el plazo se venza — porque cuando se
 * vence, la decisión ya está tomada sola.
 *
 * **Las tres fechas no se guardan: se deducen de la fecha de ingreso.** Es la
 * misma regla de *lee, no copia* de la agenda, y acá resuelve además el
 * problema que tenía el pedido: si las creara el alta a mano, quien entra por
 * la nómina del mes no tendría ninguna. Deduciéndolas, **toda persona nueva
 * aparece con sus tres evaluaciones sin que nadie las cree**, haya entrado por
 * donde haya entrado. Lo único que se guarda es lo que el gerente contestó.
 *
 * La duración sale de `parametros.mesesPeriodoPrueba` (6, art. 92 bis según la
 * Ley 27.742) y la cadencia de `mesesEntreEvaluacionesPrueba` (2). Con esos dos
 * números salen tres hitos: ningún «3» escrito a mano.
 *
 * **El plazo corre desde `fechaIngreso` y no desde `fechaIngresoFTD`.** Las
 * farmacias del área se compraron, así que casi todo el plantel tiene una
 * fecha de Farmatodo reciente y una antigüedad vieja: medir desde la de
 * Farmatodo pondría a cien personas en período de prueba. La transferencia de
 * establecimiento continúa el vínculo (art. 225 LCT), no lo empieza.
 */
const PRUEBA_DEFECTO = { meses: 6, cada: 2 };

/* Lo que el gerente puede contestar. **Tres y ninguna más**, por lo mismo que
   los tres estados de un caso: «bien» y «muy bien» serían el mismo con dos
   nombres, y lo que cambia la decisión es si hay algo que corregir y si llega
   a tiempo. La tercera no dice «despedirlo»: dice que el gerente no lo
   confirma, y qué se hace con eso lo decide el coordinador. */
const RESULTADOS_PRUEBA = [
  { id: 'bien',          nombre: 'Va bien',                   tono: 'verde',
    lectura: 'Cumple lo que el puesto pide. El gerente lo confirmaría hoy.' },
  { id: 'observaciones', nombre: 'Con observaciones',         tono: 'ambar',
    lectura: 'Hay algo concreto que corregir, y tiempo para hacerlo.' },
  { id: 'noConfirma',    nombre: 'El gerente no lo confirma', tono: 'rojo',
    lectura: 'Tal como viene, no sigue. Hay que decidirlo antes de que venza.' }
];

const RESULTADO_PRUEBA_POR_ID = RESULTADOS_PRUEBA.reduce((a, x) => (a[x.id] = x, a), {});

/* Cuántos días antes del vencimiento la última evaluación pasa a urgente. Un
   mes es lo que tarda una conversación con el gerente, la decisión y el
   trámite; menos que eso ya es llegar tarde. */
const DIAS_AVISO_PRUEBA = 30;

function _paramsPrueba(parametros) {
  const p = parametros || {};
  const meses = Number(p.mesesPeriodoPrueba) || PRUEBA_DEFECTO.meses;
  const cada = Number(p.mesesEntreEvaluacionesPrueba) || PRUEBA_DEFECTO.cada;
  return { meses, cada: Math.max(1, Math.min(cada, meses)) };
}

/**
 * En qué anda el período de prueba de una persona.
 *
 * Devuelve siempre un objeto —no un booleano— y hay que leer `.enPrueba`, por
 * la misma trampa que `esNoPresencial()` y `esDeLaboratorio()`.
 */
function periodoDePrueba(colaborador, hoy, parametros) {
  const c = colaborador || {};
  const h = hoy || _diaHoy();
  const { meses, cada } = _paramsPrueba(parametros);
  const desde = c.fechaIngreso || '';
  const vacio = { aplica: false, enPrueba: false, desde: '', vence: '', hitos: [],
                  hechas: 0, pendientes: 0, vencidas: 0, proxima: null, diasParaVencer: null };
  if (!desde) return vacio;

  const vence = _sumarMeses(desde, meses);
  if (!vence) return vacio;
  /* Quien se fue no está a prueba: la misma regla que saca a las bajas de
     Presentismo. Su historial queda en la ficha igual. */
  const sigue = typeof sigueEnElPlantel === 'function' ? sigueEnElPlantel(c) : c.activo !== false;

  const hitos = [];
  for (let m = cada, n = 1; m <= meses; m += cada, n++) {
    const fecha = _sumarMeses(desde, m);
    const ev = (c.pruebas || []).find(x => Number(x.hito) === n) || null;
    hitos.push({
      n, meses: m, fecha,
      /* La última es la que decide: después de ella no queda tiempo para
         conversar nada. Se nombra para que no se lea como una más. */
      decide: m + cada > meses,
      hecha: !!ev, evaluacion: ev,
      vencida: !ev && !!fecha && fecha < h,
      diasPara: fecha ? _diasEntre(h, fecha) : null
    });
  }

  const pendientes = hitos.filter(x => !x.hecha);
  const diasParaVencer = _diasEntre(h, vence);
  return {
    aplica: sigue && h <= vence,
    enPrueba: sigue && h <= vence,
    terminado: h > vence,
    desde, vence, diasParaVencer,
    porVencer: sigue && h <= vence && diasParaVencer !== null && diasParaVencer <= DIAS_AVISO_PRUEBA,
    hitos,
    hechas: hitos.filter(x => x.hecha).length,
    pendientes: pendientes.length,
    vencidas: hitos.filter(x => x.vencida).length,
    proxima: pendientes.find(x => x.fecha && x.fecha >= h) || pendientes[0] || null
  };
}

/** Todo el que hoy está a prueba, lo que vence antes primero. */
function personasEnPrueba(estado, hoy, incluirTerminados) {
  const e = estado || {};
  const h = hoy || _diaHoy();
  const par = (e.config || {}).parametros;
  const filas = [];
  (e.sucursales || []).forEach(s => {
    (s.colaboradores || []).forEach(c => {
      const p = periodoDePrueba(c, h, par);
      if (!p.desde) return;
      if (!p.enPrueba && !(incluirTerminados && p.terminado && (c.pruebas || []).length)) return;
      filas.push({ colaboradorId: c.id, nombre: c.nombre || '', cargo: c.cargo || c.posicion || '',
                   sucursalId: s.id, sucursal: s.nombre || s.codigo || '', prueba: p });
    });
  });
  return filas.sort((a, b) => String(a.prueba.vence).localeCompare(String(b.prueba.vence)));
}

/**
 * Lo que hay que reclamarle a un gerente esta semana.
 *
 * **Solo lo que ya pasó o está por pasar**: una evaluación que toca dentro de
 * dos meses no es un pendiente, es el calendario. Meterla acá convertiría el
 * contador en un número fijo, que es la regla de los contadores en cero vista
 * al revés.
 */
function alertasDePrueba(estado, hoy) {
  const h = hoy || _diaHoy();
  const out = [];
  personasEnPrueba(estado, h).forEach(f => {
    const p = f.prueba;
    const sinHacer = p.hitos.filter(x => x.vencida);
    if (sinHacer.length) {
      const u = sinHacer[sinHacer.length - 1];
      out.push({ fila: f, hito: u, tono: u.decide || p.porVencer ? 'rojo' : 'ambar',
        texto: sinHacer.length === 1
          ? `la ${u.n}ª evaluación vencía el ${_fecha(u.fecha)}`
          : `${sinHacer.length} evaluaciones sin hacer, la última vencía el ${_fecha(u.fecha)}` });
      return;
    }
    if (p.porVencer && p.pendientes) {
      out.push({ fila: f, hito: p.proxima, tono: 'ambar',
        texto: `el período de prueba termina el ${_fecha(p.vence)}` });
    }
  });
  return out;
}

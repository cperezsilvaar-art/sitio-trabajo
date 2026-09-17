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
 * Cuánto del perfil de Senior ya alcanzó, en competencias listas sobre once.
 * Es la cuenta que el panel muestra como avance: no promedia niveles de
 * escalas distintas —un 2 de Liderazgo sobre 6 y un 2 de Seguimiento sobre 4
 * no son lo mismo— sino que cuenta cuántas llegaron al nivel que pide el rol.
 */
function avanceDeEntrenamiento(entrenamiento) {
  const niveles = nivelesActuales(entrenamiento);
  const filas = COMPETENCIAS_SENIOR.map(c => {
    const actual = niveles[c.id] || 0;
    return {
      competencia: c,
      actual,
      objetivo: c.senior,
      evaluada: actual > 0,
      alcanzada: actual >= c.senior,
      brecha: Math.max(0, c.senior - actual)
    };
  });
  const evaluadas = filas.filter(f => f.evaluada).length;
  const alcanzadas = filas.filter(f => f.alcanzada).length;
  return {
    filas,
    evaluadas,
    alcanzadas,
    total: COMPETENCIAS_SENIOR.length,
    pendientes: filas.filter(f => !f.alcanzada),
    pct: COMPETENCIAS_SENIOR.length ? alcanzadas / COMPETENCIAS_SENIOR.length : 0
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

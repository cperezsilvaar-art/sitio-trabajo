/*
 * catalogos.js — Taxonomías y parámetros de referencia.
 *
 * Fuentes:
 *  - TD01.xls  (Tablero de Estadísticas de RRHH de tienda): hojas DOT, ORG y
 *    ESTADISTICA (1) a (8). De ahí salen las posiciones, los conceptos de
 *    ausentismo con su código, los motivos de baja y las causas de rotación.
 *  - Dotacion_Selma_Abril2026.xlsx: factor de cargas, benchmarks de costo/venta
 *    y la regla de productividad por tickets/hora.
 *  - Succession_Planning_Toolkit.xlsx: escalas de criticidad, escasez,
 *    disponibilidad del rol y readiness del candidato.
 */

/* ------------------------------------------------------------------ *
 * 1. Posiciones estándar de sucursal (Farmatodo)                       *
 * ------------------------------------------------------------------ */
const POSICIONES = [
  { id: 'gerente',      nombre: 'Gerente de Tienda',  orden: 1, nivel: 1 },
  { id: 'senior',       nombre: 'Senior',             orden: 2, nivel: 2 },
  { id: 'farmaceutico', nombre: 'Farmacéutico',       orden: 3, nivel: 2 },
  { id: 'dt',           nombre: 'DT',                 orden: 4, nivel: 2 },
  { id: 'apv',          nombre: 'APV',                orden: 5, nivel: 3 },
  { id: 'dermo',        nombre: 'Asesora de Dermo',   orden: 6, nivel: 3 },
  { id: 'belleza',      nombre: 'Asesora de Belleza', orden: 7, nivel: 3 },
  { id: 'otros',        nombre: 'Otros',              orden: 8, nivel: 3 }
];

/* `nivel` ordena el organigrama de la sucursal: 1 es el Gerente de Tienda,
   2 las posiciones que responden a él y 3 el piso de venta. */

/**
 * Los cargos que existen hoy en el Área 3, con todo lo que cada uno arrastra.
 *
 * Salen de la nómina de septiembre de 2026: son los catorce que aparecen en las
 * 139 fichas, ni uno inventado. Cada fila junta lo que en la planilla vive en
 * cuatro columnas distintas —cargo, nivel de cargo, categoría de convenio y
 * jornada— porque en la práctica van juntos: elegir «FARMACEUTICO AUXILIAR TP»
 * ya dice que el nivel es FARMACEUTICO y que son 0,5 FTE. Al dar de alta a
 * alguien a mano se elige una sola cosa y el resto se completa; si mañana la
 * compañía crea un cargo nuevo, se agrega acá y aparece en todos lados.
 *
 * `noPresencial` es el bloqueo de matrícula: presta la habilitación pero no
 * cubre turno, así que `esNoPresencial()` lo saca de la dotación de piso.
 *
 * El orden es el del organigrama —de arriba hacia abajo—, no el de cuántos hay:
 * es el orden en el que se busca un cargo en una lista.
 */
const CARGOS_NOMINA = [
  { cargo: 'GERENTE DE TIENDA',                 nivel: 'GERENTE DE TIENDA',   categoria: 'FUERA DE CONVENIO',          posicion: 'Gerente de Tienda',  jornada: 1 },
  { cargo: 'ASISTENTE DE PISO DE VENTA SENIOR', nivel: 'APV SENIOR',          categoria: 'EMPLEADO ESP. DE FARMACIA',  posicion: 'Senior',             jornada: 1 },
  { cargo: 'DIRECTOR TECNICO',                  nivel: 'DIRECTOR TECNICO',    categoria: 'DIRECTOR TECNICO',           posicion: 'DT',                 jornada: 1 },
  { cargo: 'DIRECTOR TECNICO TP',               nivel: 'DIRECTOR TECNICO',    categoria: 'DIRECTOR TECNICO',           posicion: 'DT',                 jornada: 0.5 },
  { cargo: 'DIRECTOR TECNICO CON BLOQUEO',      nivel: 'DT CON BLOQUEO',      categoria: 'DT NO PRESENCIAL',           posicion: 'DT',                 jornada: 1, noPresencial: true },
  { cargo: 'FARMACEUTICO AUXILIAR',             nivel: 'FARMACEUTICO',        categoria: 'FARMACEUTICO AUXILIAR',      posicion: 'Farmacéutico',       jornada: 1 },
  { cargo: 'FARMACEUTICO AUXILIAR TP',          nivel: 'FARMACEUTICO',        categoria: 'FARMACEUTICO AUXILIAR',      posicion: 'Farmacéutico',       jornada: 0.5 },
  { cargo: 'FARMA AUX. JORNADA PARCIAL',        nivel: 'FARMACEUTICO',        categoria: 'FARMA AUX. JORNADA PARCIAL', posicion: 'Farmacéutico',       jornada: 0.5 },
  { cargo: 'FARM. AUX. BLOQUEO',                nivel: 'FARM. AUXL. BLOQUEO', categoria: 'FARMA. AUX. BLOQUEO',        posicion: 'Farmacéutico',       jornada: 1, noPresencial: true },
  { cargo: 'ASESORA DERMO',                     nivel: 'ASESORA DERMO',       categoria: 'PERFUMERIA',                 posicion: 'Asesora de Dermo',   jornada: 1 },
  { cargo: 'ASESORA DE BELLEZA',                nivel: 'ASESORA DE BELLEZA',  categoria: 'PERFUMERIA',                 posicion: 'Asesora de Belleza', jornada: 1 },
  { cargo: 'ASISTENTE DE PISO DE VENTAS',       nivel: 'BASE FARMACIA',       categoria: 'EMPLEADO DE FARMACIA',       posicion: 'APV',                jornada: 1 },
  { cargo: 'CHOFER',                            nivel: 'CHOFER',              categoria: 'INICIAL B',                  posicion: 'Otros',              jornada: 1 },
  { cargo: 'LIMPIEZA',                          nivel: 'LIMPIEZA',            categoria: 'INICIAL B',                  posicion: 'Otros',              jornada: 1 }
];

/** La clave con la que se busca un cargo: sin espacios, puntos ni acentos. */
const _claveCargo = t => String(t || '').toUpperCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, '');

/** Qué arrastra un cargo escrito como venga de la planilla. */
function cargoDeNomina(cargo) {
  const k = _claveCargo(cargo);
  return CARGOS_NOMINA.find(x => _claveCargo(x.cargo) === k) || null;
}

/**
 * Cargo de la nómina → posición del panel.
 *
 * La nómina abre el cargo mucho más que el tablero de FTE: distingue la jornada
 * parcial, el bloqueo de matrícula y el convenio. Para la dotación todo eso es
 * la misma posición, así que se agrupa; el cargo original queda guardado en el
 * perfil de cada persona, que es donde importa el detalle.
 *
 * Se arma desde `CARGOS_NOMINA` para que no haya dos listas de cargos que
 * mantener sincronizadas: agregar un cargo allá lo hace conocido acá.
 */
const MAPA_CARGOS = CARGOS_NOMINA.reduce((m, x) => {
  m[_claveCargo(x.cargo)] = x.posicion;
  return m;
}, {});

/** Las unidades de negocio del área, como las escribe la nómina. */
const UNIDADES_NEGOCIO = ['OPERACIONES - FARMACIA', 'OPERACIONES - LABORATORIO'];

/** Estatus del vínculo. Todo lo que no es INDETERMINADO se marca en la ficha. */
const ESTATUS_VINCULO = [
  'INDETERMINADO',
  'PERIODO DE PRUEBA',
  'PLAZO FIJO',
  'LICENCIA SIN GOCE DE SUELDO',
  'FUERA DE NOMINA (HONORARIOS)'
];

/* Talles que se registran para la ropa de trabajo. La nómina no los trae:
   se cargan a mano en el perfil de cada persona. */
const TALLES = [
  { id: 'remera',   nombre: 'Remera / chomba' },
  { id: 'camisa',   nombre: 'Camisa' },
  { id: 'pantalon', nombre: 'Pantalón' },
  { id: 'campera',  nombre: 'Campera' },
  { id: 'calzado',  nombre: 'Calzado' }
];

/* ------------------------------------------------------------------ *
 * 2. Conceptos de ausentismo — TD01, ESTADISTICA (2)                   *
 *    El código entre paréntesis es el de la planilla original.         *
 *                                                                      *
 * El corte que importa es si la ausencia se puede evitar o no:         *
 *                                                                      *
 *   CONTROLABLE (evitable): se origina en factores donde la tienda o   *
 *   el propio colaborador pueden incidir —faltas injustificadas, temas *
 *   personales postergables, clima, organización del tiempo—. Es sobre *
 *   estos días que la gestión de RRHH puede trabajar.                  *
 *                                                                      *
 *   NO CONTROLABLE (inevitable): enfermedad o accidente comprobados,   *
 *   accidente laboral, licencias amparadas por ley y fuerza mayor. No  *
 *   se gestionan: se planifican.                                       *
 *                                                                      *
 * `inactivo` es otra cosa y por eso es un atributo, no un grupo: marca *
 * los días que el colaborador no percibe haberes de la empresa (los    *
 * paga un tercero, o no se pagan). Sirve para el costo, no para saber  *
 * si la ausencia se podía evitar.                                      *
 * ------------------------------------------------------------------ */
const AUSENTISMO_GRUPOS = [
  {
    id: 'controlable',
    nombre: 'Controlable (evitable)',
    ayuda: 'Se originan en factores donde la tienda o el colaborador pueden incidir. Es lo que la gestión puede bajar.',
    conceptos: [
      { cod: '081', nombre: 'Ausente sin aviso',              inactivo: true },
      { cod: '080', nombre: 'Ausente con aviso',              inactivo: true },
      { cod: '084', nombre: 'Enfermo injustificado',          inactivo: true },
      { cod: '082', nombre: 'Permiso sin goce de haberes',    inactivo: true },
      { cod: '083', nombre: 'Suspensión',                     inactivo: true },
      { cod: '---', nombre: 'Permiso con goce de haberes' }
    ]
  },
  {
    id: 'incontrolable',
    nombre: 'No controlable (inevitable)',
    ayuda: 'Enfermedad y accidente comprobados, licencias legales y fuerza mayor. No se evitan; se planifican.',
    conceptos: [
      { cod: '085', nombre: 'Enfermedad' },
      { cod: '086', nombre: 'Accidente' },
      { cod: '031', nombre: 'Accidente +10 días a cargo ART', inactivo: true },
      { cod: '089', nombre: 'Maternidad',                     inactivo: true },
      { cod: '050', nombre: 'Nacimiento de hijo' },
      { cod: '051', nombre: 'Matrimonio' },
      { cod: '052', nombre: 'Fallecimiento 1er grado' },
      { cod: '053', nombre: 'Fallecimiento 2do grado' },
      { cod: '054', nombre: 'Mudanza' },
      { cod: '055', nombre: 'Examen secundario' },
      { cod: '056', nombre: 'Examen universitario' },
      { cod: '057', nombre: 'Trámite pre-matrimonial' },
      { cod: '058', nombre: 'Casamiento de hijo' },
      { cod: '059', nombre: 'Donación de sangre' },
      { cod: '071', nombre: 'Vacaciones' },
      { cod: 'LRO', nombre: 'Licencia repartición oficial' }
    ]
  }
];

/* Índice plano: código -> { grupo, nombre } */
const AUSENTISMO_INDICE = (() => {
  const idx = {};
  AUSENTISMO_GRUPOS.forEach(g => g.conceptos.forEach(c => {
    idx[c.cod] = { grupo: g.id, grupoNombre: g.nombre, nombre: c.nombre, inactivo: !!c.inactivo };
  }));
  return idx;
})();

/* ------------------------------------------------------------------ *
 * 3. Motivos de baja — TD01, ESTADISTICA (7), tablas 15 a 17           *
 * ------------------------------------------------------------------ */
const MOTIVOS_BAJA = [
  {
    id: 'renuncias', nombre: 'Renuncias', motivos: [
      'Mejores condiciones de trabajo',
      'Por supervisión',
      'Por horario',
      'Incompatibilidad con la función',
      'Problemas personales',
      'Jubilación',
      'Baja interna (traslado)'
    ]
  },
  {
    id: 'despidos', nombre: 'Despidos', motivos: [
      'Deshonestidad',
      'Desempeño',
      'Conflictivo',
      'Abandono de trabajo',
      'Despido indemnizado',
      'Reducción de personal'
    ]
  },
  {
    id: 'otros', nombre: 'Otros', motivos: [
      'Fin de período de prueba',
      'Finalización de contrato',
      'Fallecimiento'
    ]
  }
];

/* ------------------------------------------------------------------ *
 * 3b. Los trámites de una baja                                         *
 * ------------------------------------------------------------------ *
 * Una baja no es un evento sino un proceso: la persona deja de venir el
 * mismo día, pero atrás quedan cinco trámites que se hacen en distintos
 * lugares y con distinta gente, y el que se olvida aparece semanas después
 * —alguien que sigue teniendo acceso, un recibo que se liquida de más—.
 *
 * El orden es el que se sigue en la práctica. No están enumerados a
 * propósito: si uno se adelanta no hay que pelearse con el panel.
 */
const TRAMITES_BAJA = [
  { id: 'carta', nombre: 'Carta solicitada al estudio',
    ayuda: 'El telegrama o la carta documento que prepara el estudio.' },
  { id: 'notificacion', nombre: 'Notificación al empleado',
    ayuda: 'Que la persona quede notificada y firme.' },
  { id: 'nomina', nombre: 'Envío de novedades y baja a Nómina',
    ayuda: 'Lo último que hay que pasarle a Nómina de esta persona.' },
  { id: 'pac', nombre: 'Baja en PAC',
    ayuda: 'Mientras siga activo ahí, conserva accesos.' },
  { id: 'sommer', nombre: 'Baja en Sommer',
    ayuda: 'Mientras siga activo ahí, conserva accesos.' }
];

/**
 * Cómo viene el proceso de una baja.
 *
 * `cerrada` es una decisión del coordinador, no la consecuencia de tildar los
 * cinco: a veces un trámite no aplica y el proceso igual terminó. Por eso
 * `completa` —están los cinco— y `cerrada` son dos cosas distintas, y la
 * pantalla avisa cuando se cierra sin completar en vez de impedirlo.
 */
function estadoTramitesBaja(baja) {
  const t = (baja && baja.tramites) || {};
  const hechos = TRAMITES_BAJA.filter(x => t[x.id] && t[x.id].hecho);
  const faltan = TRAMITES_BAJA.filter(x => !(t[x.id] && t[x.id].hecho));
  const cerrada = !!(baja && baja.cerradaEl);
  return {
    hechos: hechos.length,
    total: TRAMITES_BAJA.length,
    faltan,
    completa: faltan.length === 0,
    cerrada,
    /* Lo que queda por hacer: si ya se cerró, nada, aunque falte un trámite. */
    pendiente: !cerrada,
    pct: TRAMITES_BAJA.length ? hechos.length / TRAMITES_BAJA.length : 0
  };
}

/* Tipos de movimiento que el coordinador registra sobre una persona.
 *
 * El traspaso se llamaba «cesión de contrato», que es el instrumento legal y
 * no la cosa que pasa: lo que pasa es que la persona se muda de tienda. La
 * cesión aplica solo cuando además cambia el empleador —otra razón social—, y
 * por eso ahora es una pregunta adentro del traspaso (`m.conCesion`) y no el
 * nombre del movimiento. Los guardados como `cesion` se leen como traspasos
 * con cesión, que es lo que eran.
 */
const TIPOS_MOVIMIENTO = [
  { id: 'traspaso',     nombre: 'Traspaso de sucursal', detalle: 'Se muda a otra tienda' },
  { id: 'modificacion', nombre: 'Modificación',         detalle: 'Cambia de puesto o de jornada' }
];

/** Un movimiento viejo guardado como `cesion` es un traspaso con cesión. */
const esTraspaso = tipo => tipo === 'traspaso' || tipo === 'cesion';

const ESTADOS_MOVIMIENTO = {
  pendiente:  { nombre: 'Pendiente de autorizar', chip: 'ambar' },
  autorizada: { nombre: 'Autorizada',             chip: 'azul' },
  aplicada:   { nombre: 'Aplicada',               chip: 'verde' },
  anulada:    { nombre: 'Anulada',                chip: '' }
};

/**
 * Qué tienda absorbe el costo del mes en una transferencia. Del procedimiento
 * de Empleos: del 1 al 15 lo paga la tienda de destino, del 16 en adelante la
 * de origen. Es la pregunta que aparece cuando se cierra el mes.
 */
function tiendaQueAbsorbeElCosto(vigencia) {
  const d = Number(String(vigencia || '').slice(8, 10));
  if (!d) return '';
  return d <= 15 ? 'destino' : 'origen';
}

/* Causas de rotación — TD01, ESTADÍSTICA (8), tabla 18 */
const CAUSAS_ROTACION = [
  { cod: 'A-1', nombre: 'Sueldo / progreso / beneficios',              grupo: 'Renuncias' },
  { cod: 'A-2', nombre: 'Problemas personales / estudios',             grupo: 'Renuncias' },
  { cod: 'A-3', nombre: 'Problemas con supervisores / ambiente',       grupo: 'Renuncias' },
  { cod: 'B-1', nombre: 'Actos irregulares (robos, fraudes)',          grupo: 'Despidos' },
  { cod: 'B-2', nombre: 'Ausentismo / abandono del trabajo',           grupo: 'Despidos' },
  { cod: 'B-3', nombre: 'Rendimiento / indisciplina / conducta',       grupo: 'Despidos' },
  { cod: 'C-1', nombre: 'Fin de contrato',                             grupo: 'Otros' },
  { cod: 'C-2', nombre: 'Reducción de personal',                       grupo: 'Otros' },
  { cod: 'C-3', nombre: 'Período de prueba',                           grupo: 'Otros' }
];

/* ------------------------------------------------------------------ *
 * 4. Sanciones — TD01, ESTADISTICA (1), tabla 3                        *
 * ------------------------------------------------------------------ */
const TIPOS_SANCION = ['Llamado de atención', 'Apercibimiento', 'Suspensión'];

const MOTIVOS_SANCION = [
  'Falla de caja',
  'Llegadas tarde',
  'Ausencias sin aviso',
  'Incumplimiento de procedimiento',
  'Trato al cliente',
  'Uso indebido de beneficios',
  'Incumplimiento de normas de seguridad e higiene',
  'Otro'
];

/* ------------------------------------------------------------------ *
 * 5. Sucesión — Succession Planning Toolkit                            *
 * ------------------------------------------------------------------ */
const ESCALA_CRITICIDAD = [
  { valor: 1, nombre: 'Baja' },
  { valor: 2, nombre: 'Media' },
  { valor: 3, nombre: 'Alta' }
];

const ESCALA_ESCASEZ = [
  { valor: 1, nombre: 'Talento disponible' },
  { valor: 2, nombre: 'Algo difícil de cubrir' },
  { valor: 3, nombre: 'Escaso / difícil de cubrir' }
];

const READINESS = [
  { id: 'lt1',  nombre: 'Listo en menos de 1 año',  orden: 1 },
  { id: '1a2',  nombre: 'Listo en 1 a 2 años',      orden: 2 },
  { id: 'gt2',  nombre: 'Listo en más de 2 años',   orden: 3 }
];

const DISPONIBILIDAD_ROL = [
  { id: 'lt1', nombre: 'Se requiere en menos de 1 año', orden: 1 },
  { id: '1a2', nombre: 'Se requiere en 1 a 2 años',     orden: 2 },
  { id: 'gt2', nombre: 'Se requiere en más de 2 años',  orden: 3 }
];

/* ------------------------------------------------------------------ *
 * 6. Parámetros por defecto — Dotacion_Selma_Abril2026                 *
 * ------------------------------------------------------------------ */
/* ==================== LECTURA DE TEXTO PEGADO ====================
 *
 * Todo lo que entra al panel entra pegando desde Excel, y Excel encierra entre
 * comillas cualquier celda que tenga un salto de línea adentro. Los
 * encabezados de la nómina los tienen —"Fecha de  Ingreso Farmatodo\nIngreso a
 * FTD"—, así que partir el texto por \n a secas rompe esa fila en varias y se
 * pierden en silencio todas las columnas que vienen después.
 *
 * Devuelve una fila por registro real, ya partida en celdas.
 */
function filasPegadas(crudo, separador) {
  const texto = String(crudo == null ? '' : crudo).replace(/\r\n?/g, '\n');
  if (!texto) return [];

  /* El separador se detecta sobre la primera línea física, que alcanza: si el
     encabezado se corta, igual conserva sus tabulaciones. */
  const primera = texto.split('\n')[0] || '';
  const sep = separador ||
    (primera.indexOf('\t') >= 0 ? '\t' : (primera.indexOf(';') >= 0 ? ';' : ','));

  const filas = [];
  let fila = [], celda = '', enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];

    if (enComillas) {
      if (ch === '"') {
        /* Dos comillas seguidas dentro de una celda son una comilla literal. */
        if (texto[i + 1] === '"') { celda += '"'; i++; }
        else enComillas = false;
      } else {
        celda += ch;
      }
      continue;
    }

    if (ch === '"' && celda.trim() === '') { enComillas = true; celda = ''; continue; }
    if (ch === sep) { fila.push(celda); celda = ''; continue; }
    if (ch === '\n') { fila.push(celda); filas.push(fila); fila = []; celda = ''; continue; }
    celda += ch;
  }
  if (celda !== '' || fila.length) { fila.push(celda); filas.push(fila); }

  /* Las celdas conservan sus saltos internos como espacios: un encabezado
     partido en dos renglones es una sola etiqueta. */
  return filas
    .map(f => f.map(c => c.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()))
    .filter(f => f.some(c => c));
}

const PARAMETROS_DEFECTO = {
  diasMes: 30,              // divisor de días para FTE
  horasMes: 200,            // divisor de horas extras para FTE
  factorCargas: 1.65,       // bruto -> costo laboral real
  benchmarkCostoVenta: 0.10,// 10% o menos: farmacia eficiente. Es el objetivo
  alertaCostoVenta: 0.15,   // 15%: techo de alerta. Por encima, sobreestructura
  benchmarkStaff: 0.06,     // 6% sobre venta de la red (estructura de soporte)
  ticketsHoraObjetivo: 6,   // 6 tickets por hora cada 6 horas trabajadas
  umbralAusentismo: 0.05,   // 5% de ausentismo total como alerta
  umbralHorasExtras: 0.05,  // HE > 5% de las horas teóricas = desvío
  horasJornada: 8,          // jornada de referencia, para el FTE del día
  coberturaMinima: 0.90,    // por debajo de este % de cobertura, la tienda opera en riesgo
  /* El período de liquidación, que **no es el mes calendario**. El de
     septiembre de 2026 fue del 21/08 al 17/09: arranca el día 21 del mes
     anterior y cierra el 17 de este.
     
     Trabajar en meses calendario metía los días en la ventana equivocada —lo
     que la liquidación pagó del 21 al 31 de agosto caía en agosto, y los días
     del 21 al 30 de septiembre se contaban en un recibo que todavía no
     existía—. Son los dos números que definen todo: `rangoDePeriodo()` y
     `periodoDeFecha()` (`convenio.js`) salen de acá y nadie más decide.
     
     **Con `desde` mayor que `hasta` el período arranca el mes anterior**, que
     es el caso normal. Con `desde` 1 y `hasta` 31 vuelven los meses
     calendario, sin ninguna otra cosa que tocar.
     
     **Del 21 al 17 quedan tres días de cada mes afuera** —el 18, el 19 y el
     20—, que es el calendario que hoy usa Nómina y una decisión del
     coordinador, no un error del panel. `#/config` los nombra sin impedir
     nada: cuál es el corte lo decide Nómina, no esta pantalla. Si algún mes
     pasa a cerrar el 20, es cambiar un número. */
  periodoDesdeDia: 21,
  periodoHastaDia: 17,
  /* Desde cuándo miden los indicadores del área: ausentismo y rotación.
   *
   * El coordinador venía midiendo a mano y arranca el panel con el corte del
   * **año fiscal, septiembre de 2026**. Antes de esa fecha no hay historia
   * completa —las ausencias entraron por una planilla que arranca en marzo de
   * 2025 y las bajas se cargaron de a poco—, y una tasa calculada sobre una
   * serie incompleta no es una tasa baja: es una tasa falsa, que además se
   * compara contra el año siguiente como si las dos midieran lo mismo.
   *
   * **Solo recorta los indicadores.** El historial de cada persona muestra
   * todo lo que tenga cargado, sea de cuando sea: que alguien tuvo una licencia
   * en mayo es un dato útil para su ficha aunque no entre en la tasa del área.
   *
   * Es una fecha y no un cálculo automático: moverla al próximo septiembre es
   * una decisión suya, y un corte que se corre solo le cambiaría los números
   * sin avisar. */
  /* Arranca con el **período** de septiembre y no con el 1 de septiembre: el
     ejercicio empieza donde empieza la primera liquidación que se mide, que es
     el 21/08. Con el corte en el 1 quedaban afuera los primeros once días del
     año fiscal, y las licencias que el libro ubica al arranque del período no
     entraban en ninguna tasa. */
  mideDesde: '2026-08-21',
  moneda: '$'
};

/* ===================== REPORTE DIARIO DE OPERACIÓN =====================
   El mes cerrado se mide con la matriz de FTE. El día se mide acá: la
   tienda abre o no abre, y con cuánta gente. Son dos preguntas distintas y
   se responden con datos distintos. */

/** Por qué faltó alguien hoy. Corto a propósito: en el día no hay legajo a
    mano, hay un llamado a las siete de la mañana. La clasificación fina
    contra los códigos de liquidación se hace al cierre del mes. */
const MOTIVOS_AUSENCIA_DIA = [
  { id: 'enfermedad',   nombre: 'Enfermedad / parte médico', grupo: 'incontrolable' },
  { id: 'accidente',    nombre: 'Accidente de trabajo',      grupo: 'incontrolable' },
  { id: 'licencia',     nombre: 'Licencia legal',            grupo: 'incontrolable' },
  { id: 'vacaciones',   nombre: 'Vacaciones',                grupo: 'incontrolable' },
  { id: 'injustificada', nombre: 'Falta sin aviso',          grupo: 'controlable' },
  { id: 'aviso',        nombre: 'Faltó con aviso, sin justificar', grupo: 'controlable' },
  { id: 'permiso',      nombre: 'Permiso personal',          grupo: 'controlable' },
  { id: 'tarde',        nombre: 'Llegada tarde que no cubrió el turno', grupo: 'controlable' }
];

/** Los cuatro motivos que justifican una hora extra en la tienda. */
const MOTIVOS_EXTRAS = [
  { id: 'afluencia',  nombre: 'Afluencia de público' },
  { id: 'ausencia',   nombre: 'Cubrir una ausencia' },
  { id: 'bancaria',   nombre: 'Promoción bancaria' },
  { id: 'inventario', nombre: 'Inventario' }
];

/** Novedades del día que dejan una vacante que hay que cubrir. */
const TIPOS_NOVEDAD_DIA = [
  { id: 'renuncia',  nombre: 'Renuncia' },
  { id: 'despido',   nombre: 'Desvinculación' },
  { id: 'abandono',  nombre: 'Abandono de puesto' },
  { id: 'licenciaLarga', nombre: 'Licencia prolongada (más de 10 días)' }
];

/**
 * Lectura del costo laboral sobre la venta, contra la banda de referencia de la
 * actividad en Argentina:
 *
 *   hasta 10%  farmacia eficiente: alta facturación por empleado, procesos
 *              optimizados, o peso fuerte de venta libre y perfumería.
 *   10% a 15%  por encima del objetivo, todavía manejable.
 *   15% o más  techo de alerta: sobreestructura, caída de ventas, o un modelo
 *              operativo caro (24 horas con plus nocturnos y horas extras,
 *              recetario magistral de alta demanda de mano de obra).
 */
function evaluarCostoVenta(pct, par) {
  const p = Object.assign({}, PARAMETROS_DEFECTO, par || {});
  if (pct === null || pct === undefined || isNaN(pct)) {
    return { zona: 'sd', icono: '⚪', texto: 'Sin datos de venta',
             lectura: 'Cargá la venta neta del período para poder medir el costo laboral.' };
  }
  if (pct <= p.benchmarkCostoVenta) {
    return { zona: 'eficiente', icono: '🟢', texto: 'Eficiente',
             lectura: 'El costo laboral está dentro del objetivo. Indica buena facturación por empleado y procesos ordenados.' };
  }
  if (pct < p.alertaCostoVenta) {
    return { zona: 'atencion', icono: '🟡', texto: 'Por encima del objetivo',
             lectura: 'Todavía por debajo del techo de alerta, pero conviene entender qué lo empuja: horas extras, cobertura de francos o venta por debajo de lo previsto.' };
  }
  return { zona: 'alerta', icono: '🔴', texto: 'Techo de alerta superado',
           lectura: 'Suele significar tienda sobreestructurada, caída de ventas, o un modelo operativo costoso: horario extendido con plus nocturnos y horas extras, o recetario de alta demanda de mano de obra.' };
}

/* Semáforo de dotación: reproduce el criterio de la planilla Selma.
   diferencia = dotación óptima - dotación actual                        */
function semaforoDotacion(diferencia) {
  if (diferencia === null || diferencia === undefined || isNaN(diferencia)) {
    return { clave: 'sd', icono: '⚪', texto: 'Sin datos de venta' };
  }
  if (diferencia >= 3)  return { clave: 'ampliar', icono: '🟢', texto: 'Ampliar dotación' };
  if (diferencia >= 0)  return { clave: 'optima',  icono: '✅', texto: 'Dotación óptima' };
  if (diferencia >= -2) return { clave: 'revisar', icono: '🟡', texto: 'Revisar' };
  return { clave: 'reducir', icono: '🔴', texto: 'Reducir dotación' };
}


const ESTADOS_CHECK = [
  { id: '',    nombre: '—' },
  { id: 'ok',  nombre: 'Hecho' },
  { id: 'no',  nombre: 'No pude' },
  { id: 'na',  nombre: 'No aplica' }
];

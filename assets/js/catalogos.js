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
  { id: 'gerente',      nombre: 'Gerente de Tienda',  orden: 1 },
  { id: 'senior',       nombre: 'Senior',             orden: 2 },
  { id: 'apv',          nombre: 'APV',                orden: 3 },
  { id: 'farmaceutico', nombre: 'Farmacéutico',       orden: 4 },
  { id: 'dt',           nombre: 'DT',                 orden: 5 },
  { id: 'dermo',        nombre: 'Asesora de Dermo',   orden: 6 }
];

/* ------------------------------------------------------------------ *
 * 2. Conceptos de ausentismo — TD01, ESTADISTICA (2)                   *
 *    El código entre paréntesis es el de la planilla original.         *
 * ------------------------------------------------------------------ */
const AUSENTISMO_GRUPOS = [
  {
    id: 'inactivo',
    nombre: 'Inactivo',
    ayuda: 'El colaborador no percibe haberes o está fuera de nómina activa.',
    conceptos: [
      { cod: '031', nombre: 'Accidente +10 días a cargo ART' },
      { cod: '082', nombre: 'Permiso sin goce de haberes' },
      { cod: '083', nombre: 'Suspensión' },
      { cod: '080', nombre: 'Ausente con aviso' },
      { cod: '081', nombre: 'Ausente sin aviso' },
      { cod: '089', nombre: 'Maternidad' },
      { cod: '084', nombre: 'Enfermo injustificado' }
    ]
  },
  {
    id: 'controlable',
    nombre: 'Activo controlable',
    ayuda: 'Ausencias sobre las que la gestión de RRHH y el gerente pueden incidir.',
    conceptos: [
      { cod: '---', nombre: 'Permiso con goce de haberes' },
      { cod: '085', nombre: 'Enfermedad' },
      { cod: '086', nombre: 'Accidente' }
    ]
  },
  {
    id: 'incontrolable',
    nombre: 'Activo incontrolable',
    ayuda: 'Licencias legales y vacaciones: no son gestionables, pero sí planificables.',
    conceptos: [
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
    idx[c.cod] = { grupo: g.id, grupoNombre: g.nombre, nombre: c.nombre };
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
  moneda: '$'
};

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

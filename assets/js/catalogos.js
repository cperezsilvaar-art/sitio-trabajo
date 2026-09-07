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
 * Cargo de la nómina → posición del panel.
 *
 * La nómina abre el cargo mucho más que el tablero de FTE: distingue la jornada
 * parcial, el bloqueo de matrícula y el convenio. Para la dotación todo eso es
 * la misma posición, así que se agrupa; el cargo original queda guardado en el
 * perfil de cada persona, que es donde importa el detalle.
 */
const MAPA_CARGOS = {
  'GERENTEDETIENDA':                'Gerente de Tienda',
  'ASISTENTEDEPISODEVENTASENIOR':   'Senior',
  'ASISTENTEDEPISODEVENTAS':        'APV',
  'FARMACEUTICOAUXILIAR':           'Farmacéutico',
  'FARMACEUTICOAUXILIARTP':         'Farmacéutico',
  'FARMAAUXJORNADAPARCIAL':         'Farmacéutico',
  'FARMAUXBLOQUEO':                 'Farmacéutico',
  'DIRECTORTECNICO':                'DT',
  'DIRECTORTECNICOCONBLOQUEO':      'DT',
  'DIRECTORTECNICOTP':              'DT',
  'ASESORADERMO':                   'Asesora de Dermo',
  'ASESORADEBELLEZA':               'Asesora de Belleza',
  'CHOFER':                         'Otros',
  'LIMPIEZA':                       'Otros'
};

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

/* ------------------------------------------------------------------ *
 * 7. Recorrida del HRBP                                                *
 *                                                                      *
 * El check de la visita semanal. Está ordenado como transcurre la       *
 * visita, no por tema: primero lo que se ve antes de que nadie sepa     *
 * que llegaste, después la gente, después el gerente, y al final el     *
 * cierre. Ese orden importa: si arrancás por la oficina del gerente,    *
 * el resto de la visita ya es la versión que él te quiere mostrar.      *
 *                                                                      *
 * `clave: true` marca lo que no debería quedar sin hacer nunca.         *
 * ------------------------------------------------------------------ */
const RECORRIDA_HRBP = [
  {
    id: 'previo',
    nombre: 'Antes de entrar',
    ayuda: 'Diez minutos de preparación cambian la calidad de toda la visita.',
    items: [
      { id: 'pendientes', clave: true, texto: 'Repasé los compromisos pendientes de la visita anterior',
        ayuda: 'Si no se revisan, el plan de acción se convierte en una lista de deseos.' },
      { id: 'numeros', clave: true, texto: 'Miré los números del mes antes de entrar',
        ayuda: 'Ausentismo, rotación y horas extras. Entrar sabiendo qué preguntar.' },
      { id: 'novedades', texto: 'Revisé ingresos, egresos y licencias desde la última visita' }
    ]
  },
  {
    id: 'piso',
    nombre: 'Recorrida del salón',
    ayuda: 'Antes de reunirte con nadie. Lo que se ve sin avisar es el dato más honesto de la visita.',
    items: [
      { id: 'dotacionTurno', clave: true, texto: 'Conté la gente en el piso y la comparé con la que debía estar',
        ayuda: 'La diferencia entre la dotación planificada y la real del turno explica media visita.' },
      { id: 'uniforme', texto: 'Uniforme, credencial y presentación del equipo' },
      { id: 'clima', clave: true, texto: 'Observé el clima: cómo se tratan entre ellos y cómo atienden',
        ayuda: 'Se mira, no se pregunta. El trato entre compañeros delante de un cliente dice más que una encuesta.' },
      { id: 'condiciones', texto: 'Condiciones de trabajo: iluminación, temperatura, sillas, orden del depósito' },
      { id: 'cartelera', texto: 'Cartelera y comunicación interna al día' },
      { id: 'seguridad', clave: true, texto: 'Seguridad e higiene: matafuegos vigentes, salidas libres, botiquín, señalética',
        ayuda: 'Es lo primero que pregunta un inspector y lo último que mira una visita apurada.' }
    ]
  },
  {
    id: 'gente',
    nombre: 'Con la gente',
    ayuda: 'La visita existe para esto. Si te fuiste sin hablar con nadie del piso, no fuiste.',
    items: [
      { id: 'colaborador', clave: true, texto: 'Hablé a solas con al menos un colaborador que no eligió el gerente',
        ayuda: 'Elegirlo vos, en el piso, y sin el gerente cerca. Es la única fuente no filtrada que tenés.' },
      { id: 'ingresos', clave: true, texto: 'Pregunté a los ingresos recientes cómo fue su inducción',
        ayuda: 'Si tienen uniforme, usuario, capacitación y quién les explicó la caja. La mayoría de las bajas tempranas se decide en las primeras dos semanas.' },
      { id: 'liquidacion', texto: 'Escuché reclamos de recibo, horas extras o liquidación',
        ayuda: 'Un error de liquidación sin resolver es la razón más barata de perder a alguien.' },
      { id: 'riesgoSalida', texto: 'Identifiqué a quién veo en riesgo de irse y por qué' },
      { id: 'reconocimiento', texto: 'Reconocí en persona algo bien hecho',
        ayuda: 'Concreto y a la persona. La visita de RRHH no puede ser solo la que viene a marcar lo que falta.' }
    ]
  },
  {
    id: 'gerente',
    nombre: 'Con el Gerente de Tienda',
    ayuda: 'Después de recorrer, no antes: así la conversación arranca sobre hechos.',
    items: [
      { id: 'planAnterior', clave: true, texto: 'Repasamos el plan de acción de la visita anterior, punto por punto' },
      { id: 'cobertura', clave: true, texto: 'Revisamos la cobertura de turnos y francos del mes que viene',
        ayuda: 'Es lo que evita las horas extras del mes siguiente. Se planifica antes, no se explica después.' },
      { id: 'vacaciones', texto: 'Vacaciones planificadas y cómo se cubren' },
      { id: 'bajoDesempeno', texto: 'Personas por debajo de lo esperado: qué está haciendo el gerente al respecto' },
      { id: 'sucesion', texto: 'Quién cubre al gerente si falta, y quién viene atrás de cada posición clave' },
      { id: 'sanciones', texto: 'Sanciones aplicadas: notificadas, firmadas y archivadas' },
      { id: 'necesidades', texto: 'Qué necesita de RRHH que hoy no está teniendo',
        ayuda: 'Preguntarlo explícitamente. Es la parte de "business partner" que suele quedar afuera.' }
    ]
  },
  {
    id: 'administrativo',
    nombre: 'Cumplimiento y legajos',
    ayuda: 'Lo aburrido que solo aparece cuando ya es un problema.',
    items: [
      { id: 'legajos', texto: 'Legajos completos: documentación, altas y firmas al día' },
      { id: 'certificados', texto: 'Certificados médicos presentados y cargados' },
      { id: 'capacitaciones', texto: 'Capacitaciones obligatorias con registro de asistencia' },
      { id: 'art', texto: 'Exámenes periódicos y trámites de ART sin pendientes' }
    ]
  },
  {
    id: 'cierre',
    nombre: 'Cierre de la visita',
    ayuda: 'Nunca irse sin devolución: sin esto la visita es una auditoría, no un acompañamiento.',
    items: [
      { id: 'devolucion', clave: true, texto: 'Le di devolución al gerente antes de irme, con lo bueno y lo que hay que corregir' },
      { id: 'compromisos', clave: true, texto: 'Acordamos compromisos concretos, con responsable y fecha',
        ayuda: 'Dos o tres. Diez compromisos es ninguno.' },
      { id: 'proxima', texto: 'Quedó acordado cuándo es la próxima visita' }
    ]
  }
];

const ESTADOS_CHECK = [
  { id: '',    nombre: '—' },
  { id: 'ok',  nombre: 'Hecho' },
  { id: 'no',  nombre: 'No pude' },
  { id: 'na',  nombre: 'No aplica' }
];

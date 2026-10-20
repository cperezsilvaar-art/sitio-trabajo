/* ============ CHECK LIST DE RRHH OPERACIONES — FARMATODO ============
 *
 * El instrumento corporativo con el que se audita una tienda: 30 puntos en
 * cuatro categorías, cada uno con su criterio de aprobación explícito.
 *
 * El criterio importa tanto como el punto. "Uniformes" no se aprueba con
 * buena voluntad: se aprueba si el 98% de la gente observada cumple. Tenerlo
 * a la vista al marcar es lo que hace que dos personas evalúen igual.
 *
 * Los puntos marcados "No aplica" salen del numerador y del denominador, para
 * no castigar a una tienda por algo que no le corresponde.
 */

const ESTADOS_CHECKLIST = [
  { id: '',           nombre: 'Sin evaluar', chip: '' },
  { id: 'aprobado',   nombre: 'Aprobado',    chip: 'verde',  puntua: true,  suma: true },
  { id: 'noAprobado', nombre: 'No aprobado', chip: 'rojo',   puntua: true,  suma: false },
  { id: 'noAplica',   nombre: 'No aplica',   chip: 'azul',   puntua: false, suma: false }
];

const ESTADOS_CHECKLIST_POR_ID = ESTADOS_CHECKLIST.reduce((a, e) => (a[e.id] = e, a), {});

const CHECKLIST_RRHH = [
  { id: 'gente', nombre: 'Compromiso con Nuestra Gente', subs: [
    { id: 'imagenCorporativaEInterna', nombre: 'Imagen Corporativa e Interna', puntos: [
      { n: 1, id: 'p1', titulo: 'Uniformes según nivel de cargo',
        detalle: 'Completos, limpios, zapatos negros, cinturón (negra, marrón o azul marino), batas blancas, limpias y planchadas (según imagen corporativa y código de vestimenta).',
        criterio: 'De la población observada el 98% debe cumplir con el requerimiento; de no ser así el punto es NO APROBADO.' },
      { n: 2, id: 'p2', titulo: 'Uso de carnets, portacarnets, tiras e identificadores',
        detalle: 'Dotación, correcto uso y buen estado.',
        criterio: 'De la población observada el 98% debe cumplir con el requerimiento; de no ser así el punto es NO APROBADO. En caso de faltar carnet y tiras y no haber sido reportado de manera inmediata al notificarlo el colaborador, el punto será NO APROBADO.' },
      { n: 3, id: 'p3', titulo: 'Oficinas de supervisores',
        detalle: 'Estado de la mesada y mobiliario, sillas en buen estado y limpias, carpetas en buen estado, mantener imagen corporativa (orden y limpieza). Botiquín de primeros auxilios (en buen estado y con los suministros necesarios).',
        criterio: 'De existir un artículo o valoración mencionada que no esté en condiciones óptimas, el punto es NO APROBADO.' },
      { n: 4, id: 'p4', titulo: 'Casilleros',
        detalle: 'Suficientes, limpios, ordenados, identificados con la imagen corporativa (estandarizada) y en buen estado.',
        criterio: 'De existir un artículo o valoración mencionada que no esté en condiciones óptimas, el punto es NO APROBADO.' },
      { n: 5, id: 'p5', titulo: 'Áreas comunes',
        detalle: 'Cuarto de limpieza (carrito, coleto, cepillo y palas limpios y en buen estado, espacio despejado), escaleras internas (pintura y condición de peldaños, pasamanos limpios y en buen estado), paredes de áreas comunes limpias y en buen estado, cuarto de cestas y suministros (limpio y ordenado). Iluminación interna adecuada.',
        criterio: 'De existir un artículo o valoración mencionada que no esté en condiciones óptimas, el punto es NO APROBADO.' },
      { n: 6, id: 'p6', titulo: 'Comedor',
        detalle: 'Electrodomésticos completos, utensilios de cocina limpios y en buen estado (TV, nevera, microondas, cafetera, filtro de agua y otros). Iluminación adecuada.',
        criterio: 'De existir un artículo o valoración mencionada que no esté en condiciones óptimas, el punto es NO APROBADO.' },
      { n: 7, id: 'p7', titulo: 'Baños (internos y externos) y vestuario',
        detalle: 'Limpios (piezas sanitarias sin manchas y en buen estado), ordenados, duchas despejadas, cortinas de baño en buen estado, perchero de baño, jabón líquido, papel higiénico, papel secante, espejos y puertas limpias. Griferías y cerraduras en buen estado (sin goteras). Iluminación adecuada.',
        criterio: 'De existir un artículo o valoración mencionada que no esté en condiciones óptimas, el punto es NO APROBADO.' },
      { n: 8, id: 'p8', titulo: 'Carteleras corporativas',
        detalle: 'Contenido actualizado y en buen estado.',
        criterio: 'De existir un artículo o valoración mencionada que no esté en condiciones óptimas, el punto es NO APROBADO.' },
      { n: 9, id: 'p9', titulo: 'Imagen',
        detalle: 'Validar que el material de ambientación de imágenes corporativas se encuentre en buen estado y actualizado (valores, misión/visión y conductas de servicio).',
        criterio: 'De existir un artículo o valoración mencionada que no esté en condiciones óptimas, el punto es NO APROBADO.' },
    ] },
    { id: 'climaLaboral', nombre: 'Clima Laboral', puntos: [
      { n: 11, id: 'p11', titulo: 'Plan de acción de clima',
        detalle: 'Contar con el plan que responda a las necesidades de los colaboradores (con vigencia del año en curso), discutido con supervisores y colaboradores. Ubicado en la carpeta de Clima y Desarrollo, junto a evidencias de ejecución.',
        criterio: 'Plan diseñado y en ejecución, publicado en la carpeta de Clima y Desarrollo. De no cumplirse, el punto es NO APROBADO.' },
      { n: 12, id: 'p12', titulo: 'Actividades de integración',
        detalle: 'Incluye cumpleaños del mes, aniversario de tienda, actividades deportivas y recreativas, cine foro, festividades y eventos, etc. (mínimo 70% de la plantilla).',
        criterio: 'Registro en cartelera y en carpeta de Clima y Desarrollo, lista de asistencia y fotos con fecha de ejecución. De no cumplirse, el punto es NO APROBADO.' },
      { n: 13, id: 'p13', titulo: 'Soy el Mejor',
        detalle: '100% ejecutado el programa según la metodología indicada, cartelera actualizada al cierre del primer mes del trimestre siguiente (foto del ganador).',
        criterio: 'Foto del ganador y matriz de evaluación. De no cumplirse, el punto es NO APROBADO.' },
    ] },
  ] },
  { id: 'desarrollo', nombre: 'Desarrollo Organizacional', subs: [
    { id: 'desarrolloYCapacitacion', nombre: 'Desarrollo y Capacitación', puntos: [
      { n: 14, id: 'p14', titulo: 'Gestión de Desarrollo y Desempeño (GDDD)',
        detalle: 'Sesiones realizadas según cada fase, garantizando feedback de calibración con el equipo supervisorio. En la herramienta de GDDD deben estar las competencias a trabajar de cada supervisor y el documento anexo (al finalizar la fase de planificación).',
        criterio: 'Sesiones de GDDD según la fase desarrollada, publicadas en la carpeta de Clima y Desarrollo (cumplir de acuerdo al mes que corresponda: octubre/febrero/agosto), verificado a través de indagación con el supervisor. De no cumplirse, el punto es NO APROBADO. Revisión de acuerdo al avance de este proceso en operaciones.' },
      { n: 15, id: 'p15', titulo: 'Plan de Desarrollo Individual (PDI)',
        detalle: 'Garantizar la elaboración, discusión y ejecución del plan dirigido al personal en desarrollo y de alto potencial.',
        criterio: 'PDI plasmado y discutido con el colaborador (verificado a través de indagación con el colaborador), publicado en la carpeta de Clima y Desarrollo. De no cumplirse, el punto es NO APROBADO.' },
      { n: 16, id: 'p16', titulo: 'Plan de inducción',
        detalle: 'Cumplimiento del programa (Inicio 2.0, Farmacia Escuela y Plan de Entrenamiento) de nuevos ingresos y promociones. Cumplimiento al 100%.',
        criterio: 'Revisión de la data del plan de inducción, con un margen de 10 días para cerrar cada proceso. De no cumplirse, el punto es NO APROBADO.' },
      { n: 17, id: 'p17', titulo: 'Cumplimiento de plan de formación al cargo, Escuela de Servicio, Escuela de Excelencia y Escuela Comercial',
        detalle: 'Garantizar la participación de los colaboradores en las formaciones.',
        criterio: 'Revisión del último estatus enviado a la fecha, con 90% de participación mínima. De no cumplirse, el punto es NO APROBADO.' },
    ] },
  ] },
  { id: 'operativa', nombre: 'Excelencia Operativa', subs: [
    { id: 'controlDeGastos', nombre: 'Control de Gastos', puntos: [
      { n: 18, id: 'p18', titulo: 'Plantilla de la tienda',
        detalle: 'Con base en el presupuesto establecido e identificado en la revisión del Headcount, comparar jornadas reales vs. estimadas. Cumplir con el presupuesto por cargo según el dimensionamiento e identificar cantidad de vacantes (menor al 5% de la plantilla).',
        criterio: 'Revisión de diferencia entre pase o vacante por tienda, dimensionamiento de cargos de acuerdo a lo estimado y lo real. De no cumplirse, el punto es NO APROBADO.' },
      { n: 19, id: 'p19', titulo: 'Egreso de personal',
        detalle: 'Mayor al 5% de la plantilla en los últimos 30 días (revisión del indicador de rotación de tiendas y culminación de contrato de eventuales).',
        criterio: 'Revisión de egresos generados en el último período de 30 días. De no cumplirse, el punto es NO APROBADO.' },
      { n: 20, id: 'p20', titulo: 'Relación de Jornadas (RJ)',
        detalle: 'Desarrollo y actualización de la herramienta. Entendimiento del impacto y accionar del lider de la farmacia.',
        criterio: 'Actualizada y correcta la información a la fecha según criterio del supervisor de la farmacia y estrctura o dinámica de implementación. De no cumplirse, el punto es NO APROBADO.' },
      { n: 21, id: 'p21', titulo: 'Índice de Ausentismo (Justificado e Injustificado)',
        detalle: 'Menor a 2 faltas (basado en los últimos 30 días).',
        criterio: 'Revisión de faltas en el último período de 30 días. De no cumplirse, el punto es NO APROBADO.' },
    ] },
    { id: 'eficienciaOperativa', nombre: 'Eficiencia Operativa', puntos: [
      { n: 22, id: 'p22', titulo: 'ADT',
        detalle: 'Última versión, publicado y en funcionamiento (validar si efectivamente se cumple). Publicación de días libres de acuerdo a la rotación de la plantilla, jornada que corresponda por colaborador, hora de descanso de acuerdo a la LCT. Entrevista a los colaboradores para conocer el funcionamiento.',
        criterio: 'Publicación en cartelera y, ante la indagación con el colaborador, no generar ninguna alerta. De no cumplirse, el punto es NO APROBADO.',
        nota: 'Pendiente de definición operativa (ver conversación con RRHH).' },
      { n: 23, id: 'p23', titulo: 'Reunión mensual con equipo de trabajo',
        detalle: 'Minuta y lista de asistencia de la reunión del mes, con 70% de participación de la plantilla activa.',
        criterio: 'Publicación de minuta y asistencia en la carpeta de Clima y Desarrollo. De no cumplirse, el punto es NO APROBADO.' },
      { n: 24, id: 'p24', titulo: 'El personal de tienda cuenta con las herramientas de trabajo necesarias y en buen estado',
        detalle: 'sillas, bancos de 2 peldaños, fajas de seguridad, escalera de depósito, PIN PAD, Hand Held, etiquetadora, EPP o cualquier otra herramienta requerida para su trabajo.',
        criterio: 'De existir un artículo o valoración mencionada que no esté en condiciones óptimas, el punto es NO APROBADO. En caso de daño o falta de alguna herramienta no reportada de manera inmediata, el punto será NO APROBADO.',
        nota: 'Pendiente de definición operativa (ver conversación con RRHH).' },
      { n: 25, id: 'p25', titulo: 'Reunión diaria de piso de venta',
        detalle: 'Verificar a través de la indagación y/o ejecución el cumplimiento de ambas actividades.',
        criterio: 'Desarrollo hasta el día de la visita, actualizado en la herramienta digitalizada, verificado a través de indagación con el colaborador sobre su efectividad y desarrollo. De no haber 3 checklists en sistema, el punto es NO APROBADO.' },
    ] },
    { id: 'riesgo', nombre: 'Riesgo', puntos: [
      { n: 26, id: 'p26', titulo: 'Carpeta de SHA',
        detalle: 'Actualizada según el requerimiento y lo establecido por la compañía dentro del programa de seguridad e higiene laboral.',
        criterio: 'De existir un artículo o valoración mencionada que no esté en condiciones óptimas y/o actualizado, el punto es NO APROBADO.',
        nota: 'Pendiente de definición operativa (ver conversación con RRHH).' },
      { n: 27, id: 'p27', titulo: 'Horario de Trabajo',
        detalle: 'Actualizado, publicado y visible.',
        criterio: 'Publicación del horario en el lugar dispuesto. De no estar publicado, el punto es NO APROBADO.' },
      { n: 28, id: 'p28', titulo: 'Inspecciones',
        detalle: 'Revisión de inspecciones previas a la visita; solicitar acta y validar los hallazgos encontrados y su solución en el tiempo estipulado (validar el reporte al área de apoyo).',
        criterio: 'De contar con hallazgos no solucionados dentro del tiempo estipulado por el inspector, el punto queda NO APROBADO.' },
    ] },
    { id: 'controlDeAsistenciaWeb', nombre: 'Control de Asistencia Web', puntos: [
      { n: 29, id: 'p29', titulo: 'Incidencias en nómina',
        detalle: 'Registro oportuno de cierre de nómina, vacaciones y novedades. Corregir dirección. Carga de incidencias en tiempo y forma.',
        criterio: 'Revisión de los registros indicados en el período de los últimos 30 días; de existir incidencias en los reportes mencionados, el punto es NO APROBADO.' },
    ] },
  ] },
  { id: 'servicio', nombre: 'Cultura de Servicio', subs: [
    { id: 'conductasDeServicio', nombre: 'Conductas de Servicio', puntos: [
      { n: 30, id: 'p30', titulo: 'Carpeta de colaboradores',
        detalle: '(Mínimo revisar 2 colaboradores por supervisor) Evaluación del checklist de 5 conductas de servicio y checklist de planogramas.',
        criterio: 'Revisión de los últimos 30 días, donde ambos soportes estén actualizados, verificado a través de indagación con el colaborador sobre su efectividad y desarrollo. De no haber los soportes requeridos, el punto es NO APROBADO.' },
      { n: 31, id: 'p31', titulo: 'Atención al cliente',
        detalle: 'Durante la visita, indagar y observar el conocimiento y ejecución de las conductas de servicio.',
        criterio: 'Ingreso a la herramienta junto al supervisor y revisión de los resultados del CSAT de tienda; si el resultado está por debajo de 90,5%, el punto es NO APROBADO.' },
    ] },
  ] },
];


const CHECKLIST_PUNTOS = CHECKLIST_RRHH.flatMap(c =>
  c.subs.flatMap(s => s.puntos.map(p =>
    Object.assign({ categoria: c.id, categoriaNombre: c.nombre,
                    sub: s.id, subNombre: s.nombre }, p))));

/* Lo que el checklist corporativo pide al cerrar la visita. */
const CIERRE_CHECKLIST = [
  { id: 'relevantes', nombre: 'Puntos relevantes de la visita',
    ayuda: 'Lo que hay que contar de esta visita, más allá del puntaje.' },
  { id: 'compromisos', nombre: 'Compromisos que asume el supervisor',
    ayuda: 'Sobre las oportunidades detectadas. Cada uno debería terminar en el plan de acción.' }
];

/**
 * Puntaje de la visita, con la misma regla de la planilla: el porcentaje se
 * calcula solo sobre los puntos aprobados o no aprobados. Lo marcado "no
 * aplica" sale del numerador y del denominador.
 *
 * @param checks  { p1: 'aprobado', p2: 'noAplica', … }
 */
function evaluarChecklist(checks) {
  const marcas = checks || {};
  const estado = p => marcas[p.id] || '';
  const cuenta = puntos => {
    const aplicables = puntos.filter(p => (ESTADOS_CHECKLIST_POR_ID[estado(p)] || {}).puntua);
    const aprobados = aplicables.filter(p => estado(p) === 'aprobado');
    return {
      total: puntos.length,
      aplicables: aplicables.length,
      aprobados: aprobados.length,
      noAprobados: aplicables.length - aprobados.length,
      noAplica: puntos.filter(p => estado(p) === 'noAplica').length,
      sinEvaluar: puntos.filter(p => !estado(p)).length,
      pct: aplicables.length ? aprobados.length / aplicables.length : null
    };
  };

  const porSub = [];
  const porCategoria = CHECKLIST_RRHH.map(c => {
    const subs = c.subs.map(s => {
      const r = Object.assign({ id: s.id, nombre: s.nombre, categoria: c.id }, cuenta(s.puntos));
      porSub.push(r);
      return r;
    });
    return Object.assign({ id: c.id, nombre: c.nombre, subs },
                         cuenta(c.subs.flatMap(s => s.puntos)));
  });

  const total = cuenta(CHECKLIST_PUNTOS);

  /* Con qué quedarse: dónde duele y dónde se está firme. Solo entre lo que se
     evaluó, para que una categoría sin tocar no aparezca como la peor. */
  const conDato = xs => xs.filter(x => x.aplicables > 0);
  const peor = xs => conDato(xs).sort((a, b) => a.pct - b.pct)[0] || null;
  const mejor = xs => conDato(xs).sort((a, b) => b.pct - a.pct)[0] || null;

  return {
    total, porCategoria, porSub,
    categoriaMasAfectada: peor(porCategoria),
    categoriaMasPositiva: mejor(porCategoria),
    subMasAfectada: peor(porSub),
    subMasPositiva: mejor(porSub),
    /* Lo que hay que arreglar, en el orden en que conviene mirarlo. */
    noAprobados: CHECKLIST_PUNTOS.filter(p => estado(p) === 'noAprobado'),
    sinEvaluar: CHECKLIST_PUNTOS.filter(p => !estado(p))
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CHECKLIST_RRHH, CHECKLIST_PUNTOS, ESTADOS_CHECKLIST, ESTADOS_CHECKLIST_POR_ID,
    CIERRE_CHECKLIST, evaluarChecklist
  };
}

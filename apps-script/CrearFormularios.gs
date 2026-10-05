/**
 * CrearFormularios.gs — arma los tres buzones de los Gerentes de Tienda.
 *
 * Esto se corre **una sola vez** y no se publica nada: no es una aplicación
 * web, no hay que implementar, no hay URL que configurar. Se pega, se aprieta
 * Ejecutar, se autoriza, y quedan creados los tres formularios con todas sus
 * preguntas, sus opciones y su mensaje de confirmación, más una planilla de
 * respuestas con las tres pestañas adentro.
 *
 * Los links aparecen al final, en la hoja «Links» de esa planilla y también en
 * el registro de ejecución.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  Cómo se corre
 * ──────────────────────────────────────────────────────────────────────────
 *
 *  1. Entrá a script.google.com con tu cuenta de Farmatodo → Nuevo proyecto.
 *  2. Borrá todo lo que diga el editor y pegá este archivo entero.
 *  3. Arriba, en el desplegable de funciones, elegí `crearLosTresBuzones`.
 *  4. Ejecutar. Google te va a pedir autorizar: aceptá. Si aparece «Google no
 *     verificó esta aplicación», entrá en Configuración avanzada → Ir a (tu
 *     proyecto): es tu propio script creando formularios en tu propio Drive.
 *  5. Cuando termina, abajo salen los tres links. Listo.
 *
 * Si lo corrés dos veces te crea tres formularios nuevos, no pisa los
 * anteriores. Si te equivocaste, borrá los de Drive y volvé a correrlo.
 */

/* Las doce tiendas del Área 3. Los flotantes no están: no son una tienda y
   ningún gerente carga por ellos. */
var TIENDAS = [
  'Botánico', 'Devoto', 'La Nobleza', 'Mark', 'Olivos', 'Olleros',
  'Parque Chacabuco', 'Rivadavia', 'San Martín Center', 'Scalabrini',
  'Villa Devoto', 'Villa del Parque'
];

/* Los quince conceptos de reclamo. **Este orden y este texto son los que el
   panel empareja por nombre**: si se cambia una palabra, esa fila entra como
   «Otro» y se pierde el concepto. */
var CONCEPTOS_RECLAMO = [
  'Horas extras no liquidadas',
  'Adicional nocturno',
  'Feriado trabajado',
  'Presentismo descontado',
  'Francos no compensados',
  'Vacaciones o plus vacacional',
  'SAC / aguinaldo',
  'Descuento indebido (faltante de caja u otro)',
  'Categoría de convenio',
  'Antigüedad mal computada',
  'Aumento de convenio no aplicado',
  'Asignaciones familiares',
  'Obra social o ART',
  'Uniforme o elementos de trabajo',
  'Otro'
];

/* Los tipos de licencia del parte de ausentes. **El ART va aparte de la
   enfermedad** y no es un detalle de redacción: el accidente de trabajo lo
   cubre la aseguradora y no corre por los plazos del art. 208 de la LCT. */
var TIPOS_LICENCIA = [
  'Enfermedad con certificado',
  'Accidente de trabajo (ART)',
  'No vino y no avisó',
  'Enfermedad de un familiar a cargo',
  'Licencia por paternidad',
  'Licencia por maternidad',
  'Vacaciones',
  'Otro motivo'
];

var MOTIVOS_HORAS = [
  'Afluencia de público',
  'Cubrir una licencia',
  'Inventario o tarea puntual',
  'Otro motivo'
];

/** Lo único que hay que ejecutar. */
function crearLosTresBuzones() {
  var planilla = SpreadsheetApp.create('Respuestas — Buzones Área 3');
  /* La configuración regional decide cómo se copian las fechas. Sin esto, una
     planilla en formato de Estados Unidos escribe 10/5/2026 para el 5 de
     octubre, y al pegarla en el panel todo octubre entra como mayo sin que
     nada falle a la vista. */
  planilla.setSpreadsheetLocale('es_AR');

  var links = [['Formulario', 'Link para los gerentes', 'Link para editarlo']];

  links.push(crearReclamos(planilla));
  links.push(crearAusencias(planilla));
  links.push(crearHorasExtras(planilla));

  var hoja = planilla.getSheets()[0];
  hoja.setName('Links');
  hoja.getRange(1, 1, links.length, 3).setValues(links);
  hoja.getRange(1, 1, 1, 3).setFontWeight('bold');
  hoja.setColumnWidth(1, 220).setColumnWidth(2, 420).setColumnWidth(3, 420);

  Logger.log('Listo. Los links quedaron en la hoja «Links» de:');
  Logger.log(planilla.getUrl());
  links.slice(1).forEach(function (f) { Logger.log(f[0] + ' → ' + f[1]); });
}

/* ------------------------------------------------------------------ *
 * 1. Reclamos de sueldo                                               *
 * ------------------------------------------------------------------ */
function crearReclamos(planilla) {
  var f = FormApp.create('Reclamos de sueldo — Área 3');
  prepararFormulario(f, planilla,
    'Para avisarle a RRHH que a alguien de tu equipo le pagaron mal. Lo llenás ' +
    'en un minuto y queda registrado con su fecha. Si llegó una carta documento ' +
    'o una intimación, no uses este formulario: llamá a RRHH.',
    'Listo, quedó registrado con su fecha. Si hace falta algo más, te escribo.');

  /* La pregunta de quién carga **no puede decir «nombre»**: el panel busca al
     colaborador por esa palabra y gana la primera columna que coincide, así que
     se llevaría el nombre del gerente al lugar del empleado. */
  texto(f, 'Tu nombre', true);
  opciones(f, 'Tienda', TIENDAS, true);
  texto(f, 'Apellido y nombre del colaborador', true);
  /* Se pide pero no se exige: está cargado en 139 de 141 personas del padrón y
     exigirlo haría que inventen uno. */
  texto(f, 'DNI del colaborador', false);
  opciones(f, '¿Qué le pagaron mal?', CONCEPTOS_RECLAMO, true);
  texto(f, '¿De qué período?', true);
  texto(f, 'Monto aproximado', false);
  parrafo(f, 'Contalo en dos renglones', true);

  return ['Reclamos de sueldo', f.getPublishedUrl(), f.getEditUrl()];
}

/* ------------------------------------------------------------------ *
 * 2. Ausencias del día                                                *
 * ------------------------------------------------------------------ */
function crearAusencias(planilla) {
  var f = FormApp.create('Ausencias del día — Área 3');
  prepararFormulario(f, planilla,
    'Para avisarle a RRHH que alguien de tu equipo no vino. Llenalo el mismo ' +
    'día, aunque todavía no sepas hasta cuándo falta ni tengas el certificado ' +
    'en la mano: eso se completa después.',
    'Listo, gracias por avisar. Si después conseguís la fecha de alta o el ' +
    'certificado, cargá otra respuesta con los datos completos.');

  opciones(f, 'Tu tienda', TIENDAS, true);
  texto(f, 'Gerente que avisa', true);
  texto(f, 'Apellido y nombre del colaborador', true);
  texto(f, 'DNI del colaborador', false);
  opciones(f, 'Tipo de licencia', TIPOS_LICENCIA, true);
  fecha(f, '¿Desde qué día no viene?', true);
  /* **No obligatoria**: una ART recién abierta no tiene alta, y pedir una fecha
     que nadie sabe se contesta inventándola. Sin fecha de fin la licencia entra
     igual, abierta, y el panel la pone arriba de todo pidiendo el dato. */
  fecha(f, '¿Hasta qué día? (si ya lo sabés)', false);
  /* «Sí» es lo único que el panel toma como certificado presentado: las otras
     dos dejan la ausencia pidiendo el papel, que es el único estado que dice
     qué hacer hoy. Un «Sí, lo tengo acá» no serviría. */
  opciones(f, '¿Te dejó el certificado?', ['Sí', 'No', 'Todavía no'], true);
  parrafo(f, 'Observaciones', false);

  return ['Ausencias del día', f.getPublishedUrl(), f.getEditUrl()];
}

/* ------------------------------------------------------------------ *
 * 3. Horas extras                                                     *
 * ------------------------------------------------------------------ */
function crearHorasExtras(planilla) {
  var f = FormApp.create('Horas extras — Área 3');
  prepararFormulario(f, planilla,
    'Para pedirle a RRHH autorización de horas extras. Cargalo antes de que se ' +
    'hagan: hay topes por persona y por mes, y una vez hechas no se pueden ' +
    'deshacer. Te contesto por el mismo canal de siempre.',
    /* El renglón más importante de los tres formularios: sin esto el gerente
       lee «respuesta enviada» como «aprobado» y las horas se hacen igual. */
    'Listo. ESTO ES UN PEDIDO, NO UNA AUTORIZACIÓN: esperá la respuesta de RRHH ' +
    'antes de darle las horas a nadie.');

  opciones(f, 'Tu tienda', TIENDAS, true);
  texto(f, 'Gerente que solicita', true);
  texto(f, 'Apellido y nombre de quien haría las horas', true);
  texto(f, 'DNI de quien haría las horas', false);
  opciones(f, 'Motivo de las horas extras', MOTIVOS_HORAS, true);
  texto(f, 'Si es para cubrir una licencia, de quién', false);
  texto(f, 'Cantidad de horas solicitadas', true);
  fecha(f, '¿Qué día se harían?', true);
  parrafo(f, 'Algo más que RRHH tenga que saber', false);

  return ['Horas extras', f.getPublishedUrl(), f.getEditUrl()];
}

/* ------------------------------------------------------------------ *
 * Lo que comparten los tres                                           *
 * ------------------------------------------------------------------ */
function prepararFormulario(f, planilla, descripcion, confirmacion) {
  f.setDescription(descripcion);
  f.setConfirmationMessage(confirmacion);
  /* **Sin iniciar sesión y sin pedir el mail**: los gerentes no tienen mail
     corporativo, así que cualquier cosa que pida cuenta hace que no lo usen.
     Por eso cada formulario pregunta a mano quién carga. */
  try { f.setRequireLogin(false); } catch (err) { /* cuenta sin dominio */ }
  f.setCollectEmail(false);
  /* Responden varias veces: un gerente carga más de un reclamo por semana y
     puede faltarle más de uno el mismo día. */
  f.setLimitOneResponsePerUser(false);
  f.setAllowResponseEdits(false);
  f.setProgressBar(false);
  f.setDestination(FormApp.DestinationType.SPREADSHEET, planilla.getId());
}

function texto(f, titulo, obligatoria) {
  f.addTextItem().setTitle(titulo).setRequired(!!obligatoria);
}

function parrafo(f, titulo, obligatoria) {
  f.addParagraphTextItem().setTitle(titulo).setRequired(!!obligatoria);
}

function fecha(f, titulo, obligatoria) {
  f.addDateItem().setTitle(titulo).setRequired(!!obligatoria);
}

/* Opción múltiple y no desplegable: en un teléfono un desplegable obliga a
   scrollear a ciegas adentro de una ventanita, y los conceptos de reclamo son
   quince. La opción múltiple los muestra todos y se elige con un toque. */
function opciones(f, titulo, lista, obligatoria) {
  f.addMultipleChoiceItem().setTitle(titulo)
    .setChoiceValues(lista).setRequired(!!obligatoria);
}

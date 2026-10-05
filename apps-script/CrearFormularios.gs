/**
 * CrearFormularios.gs — arma el buzón único de los Gerentes de Tienda.
 *
 * **Un solo formulario y un solo link.** El gerente entra, dice qué viene a
 * avisar y el formulario lo lleva a la sección que corresponde: un reclamo de
 * sueldo, una ausencia del día o un pedido de horas extras.
 *
 * Esto se corre **una sola vez** y no se publica nada: no es una aplicación
 * web, no hay que implementar, no hay URL que configurar. Se pega, se aprieta
 * Ejecutar, se autoriza, y queda el formulario armado con todas sus preguntas,
 * sus opciones y su mensaje de confirmación, más la planilla de respuestas con
 * la configuración regional en Argentina.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  Cómo se corre
 * ──────────────────────────────────────────────────────────────────────────
 *
 *  1. Entrá a script.google.com con tu cuenta de Farmatodo → Nuevo proyecto.
 *  2. Borrá todo lo que diga el editor y pegá este archivo entero.
 *  3. Arriba, en el desplegable de funciones, elegí `crearElBuzon`.
 *  4. Ejecutar. Google te va a pedir autorizar: aceptá. Si aparece «Google no
 *     verificó esta aplicación», entrá en Configuración avanzada → Ir a (tu
 *     proyecto): es tu propio script creando un formulario en tu propio Drive.
 *  5. Cuando termina, el link sale abajo, en el registro de ejecución.
 *
 * Correrlo dos veces crea un formulario nuevo, no pisa el anterior.
 *
 * ──────────────────────────────────────────────────────────────────────────
 *  Por qué las preguntas dicen exactamente lo que dicen
 * ──────────────────────────────────────────────────────────────────────────
 *
 * La planilla de respuestas se pega al pie de Presentismo en el panel, y el
 * panel ubica cada columna **por lo que dice su encabezado**, quedándose con la
 * primera que coincide. Con las tres cosas en un mismo formulario eso deja de
 * ser una formalidad:
 *
 * - **La persona se pregunta UNA sola vez, antes de la bifurcación.** Si cada
 *   sección tuviera su propio «Apellido y nombre…», habría tres columnas con
 *   ese encabezado y el panel se quedaría con la primera — que para una
 *   ausencia estaría vacía, y entonces ninguna ausencia caería en nadie. Es
 *   además el diseño correcto: las tres cosas son sobre una persona.
 * - **La sección de ausencias va antes que la de horas extras**, porque «Si es
 *   para cubrir a alguien» y el motivo de las horas no pueden ganarle a «Tipo
 *   de licencia».
 * - **La pregunta de quién avisa no puede decir «nombre»**: se llevaría el
 *   nombre del gerente al lugar del colaborador.
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

/* Los tipos de licencia. **El ART va aparte de la enfermedad** y no es un
   detalle de redacción: el accidente de trabajo lo cubre la aseguradora y no
   corre por los plazos del art. 208 de la LCT, así que meterlo en enfermedad
   inculpable mostraría un vencimiento de licencia paga que no existe. */
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
  'Cubrir a alguien que falta',
  'Inventario o tarea puntual',
  'Otro'
];

/** Lo único que hay que ejecutar. */
function crearElBuzon() {
  var f = FormApp.create('RRHH Área 3 — avisos de tienda');
  f.setDescription(
    'Para avisarle a RRHH de tu equipo: un error en el sueldo de alguien, una ' +
    'ausencia del día o un pedido de horas extras. Elegís qué venís a avisar y ' +
    'el formulario te lleva a las preguntas que corresponden.');

  /* Sin iniciar sesión y sin pedir el mail: los gerentes no tienen mail
     corporativo, así que cualquier cosa que pida cuenta hace que no lo usen.
     Por eso el formulario pregunta a mano quién carga. */
  try { f.setRequireLogin(false); } catch (err) { /* cuenta sin dominio */ }
  f.setCollectEmail(false);
  f.setLimitOneResponsePerUser(false);
  f.setAllowResponseEdits(false);
  f.setProgressBar(true);

  /* ---------- Lo que vale para las tres cosas, antes de bifurcar ---------- */
  opciones(f, 'Tu tienda', TIENDAS, true);
  texto(f, 'Gerente que avisa', true);
  texto(f, 'Apellido y nombre del colaborador', true);
  /* Se pide pero no se exige: está cargado en 139 de 141 personas del padrón,
     así que sirve para no confundir homónimos, pero exigirlo haría que
     inventen uno. */
  texto(f, 'DNI del colaborador', false)
    .setHelpText('Si lo tenés a mano. Sirve para no confundirlo con un homónimo.');

  /* La pregunta que bifurca. Se agrega acá —antes de las secciones— para que
     quede en la primera página, y sus opciones se enganchan al final, cuando
     las secciones ya existen. */
  var cual = f.addMultipleChoiceItem()
    .setTitle('¿Qué venís a avisar?')
    .setRequired(true);

  /* ---------- 1. Ausencia del día ----------
     Va primera de las tres secciones a propósito: «Tipo de licencia» tiene que
     ganarle a cualquier otra pregunta que diga «licencia» o «motivo». */
  var pAusencia = f.addPageBreakItem()
    .setTitle('Alguien no vino')
    .setHelpText('Cargalo el mismo día, aunque todavía no sepas hasta cuándo ' +
                 'falta ni tengas el certificado en la mano.');
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

  /* ---------- 2. Reclamo de sueldo ---------- */
  var pReclamo = f.addPageBreakItem()
    .setTitle('A alguien le pagaron mal')
    .setHelpText('Si llegó una carta documento o una intimación, no uses el ' +
                 'formulario: llamá a RRHH.');
  opciones(f, '¿Qué le pagaron mal?', CONCEPTOS_RECLAMO, true);
  texto(f, '¿De qué período?', true)
    .setHelpText('Sin esto Nómina no sabe qué liquidación revisar.');
  texto(f, 'Monto aproximado', false);
  parrafo(f, 'Contalo en dos renglones', true);

  /* ---------- 3. Horas extras ---------- */
  var pHoras = f.addPageBreakItem()
    .setTitle('Necesito autorización de horas extras')
    .setHelpText('Cargalo antes de que se hagan: hay topes por persona y por ' +
                 'mes, y una vez hechas no se pueden deshacer.');
  /* Ni «motivo» ni «licencia» en estos dos títulos: las dos palabras son las
     que el panel usa para encontrar el tipo de licencia de una ausencia. */
  opciones(f, '¿Por qué hacen falta?', MOTIVOS_HORAS, true);
  texto(f, 'Si es para cubrir a alguien, a quién', false);
  texto(f, 'Cantidad de horas solicitadas', true);
  fecha(f, '¿Qué día se harían?', true);
  parrafo(f, 'Algo más que RRHH tenga que saber', false);

  /* Cada sección termina mandando: sin esto, al terminar una el formulario
     sigue con la siguiente y le pide al gerente las preguntas de las otras. */
  pAusencia.setGoToPage(FormApp.PageNavigationType.SUBMIT);
  pReclamo.setGoToPage(FormApp.PageNavigationType.SUBMIT);
  pHoras.setGoToPage(FormApp.PageNavigationType.SUBMIT);

  cual.setChoices([
    cual.createChoice('Alguien no vino', pAusencia),
    cual.createChoice('A alguien le pagaron mal', pReclamo),
    cual.createChoice('Necesito autorización de horas extras', pHoras)
  ]);

  /* El mensaje de confirmación lo leen los tres, así que tiene que servir para
     el que acaba de pedir horas extras: **sin ese renglón el gerente lee
     «respuesta enviada» como «aprobado» y las horas se hacen igual**. */
  f.setConfirmationMessage(
    'Listo, quedó registrado con su fecha.\n\n' +
    'Si pediste horas extras, ojo: ESO ES UN PEDIDO, NO UNA AUTORIZACIÓN. ' +
    'Esperá la respuesta de RRHH antes de dárselas a nadie.');

  /* La configuración regional decide cómo se copian las fechas. Sin esto, una
     planilla en formato de Estados Unidos escribe 10/5/2026 para el 5 de
     octubre, y al pegarla en el panel todo octubre entra como mayo sin que
     nada falle a la vista. */
  var planilla = SpreadsheetApp.create('Respuestas — RRHH Área 3');
  planilla.setSpreadsheetLocale('es_AR');
  f.setDestination(FormApp.DestinationType.SPREADSHEET, planilla.getId());

  Logger.log('LINK PARA LOS GERENTES:  ' + f.getPublishedUrl());
  Logger.log('Para editarlo:           ' + f.getEditUrl());
  Logger.log('Planilla de respuestas:  ' + planilla.getUrl());
}

/* ------------------------------------------------------------------ *
 * Ayudas                                                              *
 * ------------------------------------------------------------------ */
function texto(f, titulo, obligatoria) {
  return f.addTextItem().setTitle(titulo).setRequired(!!obligatoria);
}

function parrafo(f, titulo, obligatoria) {
  return f.addParagraphTextItem().setTitle(titulo).setRequired(!!obligatoria);
}

function fecha(f, titulo, obligatoria) {
  return f.addDateItem().setTitle(titulo).setRequired(!!obligatoria);
}

/* Opción múltiple y no desplegable: en un teléfono un desplegable obliga a
   scrollear a ciegas adentro de una ventanita, y los conceptos de reclamo son
   quince. La opción múltiple los muestra todos y se elige con un toque. */
function opciones(f, titulo, lista, obligatoria) {
  return f.addMultipleChoiceItem().setTitle(titulo)
    .setChoiceValues(lista).setRequired(!!obligatoria);
}

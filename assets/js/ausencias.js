/*
 * ausencias.js — Ausencias con certificado médico y los plazos de la LCT.
 *
 * Distinto de las otras dos cosas que el panel ya guarda:
 *
 *   - `c.novedades` son los días que trajo la liquidación del mes. Es el pasado
 *     agregado, sirve para el ausentismo del período.
 *   - `c.licencias` son las especiales del art. 25 del CCT 414/05 —estudio,
 *     matrimonio, fallecimiento— que tienen tope anual y se cuentan por año.
 *   - `c.ausencias`, que vive acá, es la persona que hoy no está: desde cuándo,
 *     hasta cuándo dice el certificado, y qué pasa cuando esa fecha llega.
 *
 * La pregunta que responde es la del lunes a la mañana: a quién tengo que
 * esperar hoy, a quién le vence el certificado esta semana, y hasta cuándo le
 * tengo que guardar el puesto si la cosa se estira.
 *
 * ADVERTENCIA: lo que calcula es una orientación sobre la ley general, no un
 * dictamen. Los plazos reales dependen del caso —recidivas, accidentes de
 * trabajo, maternidad, excedencia— y esos no se resuelven con una tabla.
 */

/* ------------------------------------------------------------------ *
 * 1. Licencia paga por enfermedad inculpable — LCT art. 208            *
 * ------------------------------------------------------------------ */

/**
 * Meses de licencia **paga** que corresponden por enfermedad o accidente
 * inculpable. La antigüedad parte en dos y las cargas de familia duplican.
 *
 * Art. 208 LCT: hasta 5 años de antigüedad, 3 meses; con 5 o más, 6 meses.
 * Si el trabajador tiene cargas de familia, esos plazos se duplican.
 */
const LICENCIA_ENFERMEDAD = [
  { hastaAnios: 5,       sinCargas: 3, conCargas: 6,  texto: 'menos de 5 años de antigüedad' },
  { hastaAnios: Infinity, sinCargas: 6, conCargas: 12, texto: '5 años o más de antigüedad' }
];

/** Art. 211 LCT: vencida la licencia paga, el puesto se reserva un año. */
const RESERVA_PUESTO_MESES = 12;

/**
 * Si la persona tiene cargas de familia declaradas.
 *
 * El campo se carga desde un desplegable de tres estados —sin definir, sí, no—
 * y llega como texto. Un `!!c.cargasFamilia` a secas daría verdadero para la
 * cadena `'no'`, que es justo el caso en que los plazos NO se duplican.
 */
function tieneCargasFamilia(colaborador) {
  const v = (colaborador || {}).cargasFamilia;
  return v === true || v === 'si' || v === 'sí';
}

/**
 * Qué le corresponde a una persona por una ausencia por enfermedad.
 *
 * @param {number|null} anios antigüedad en años al momento de la ausencia
 * @param {boolean} cargasFamilia si tiene cargas de familia declaradas
 * @returns {{mesesPagos:number, tramo:string, reservaMeses:number,
 *            totalMeses:number, articulo:string}}
 */
function plazosEnfermedad(anios, cargasFamilia) {
  const a = (anios === null || anios === undefined || isNaN(anios)) ? 0 : Number(anios);
  const tramo = LICENCIA_ENFERMEDAD.find(x => a < x.hastaAnios) ||
                LICENCIA_ENFERMEDAD[LICENCIA_ENFERMEDAD.length - 1];
  const mesesPagos = cargasFamilia ? tramo.conCargas : tramo.sinCargas;
  return {
    mesesPagos,
    tramo: tramo.texto,
    reservaMeses: RESERVA_PUESTO_MESES,
    totalMeses: mesesPagos + RESERVA_PUESTO_MESES,
    articulo: 'LCT art. 208 (licencia paga) y art. 211 (reserva del puesto)'
  };
}

/* ------------------------------------------------------------------ *
 * 2. Una ausencia concreta                                             *
 * ------------------------------------------------------------------ */

const MOTIVOS_AUSENCIA_LARGA = [
  { id: 'enfermedad',   nombre: 'Enfermedad inculpable', conPlazos: true },
  { id: 'accidenteTrabajo', nombre: 'Accidente de trabajo (ART)', conPlazos: false },
  { id: 'maternidad',   nombre: 'Licencia por maternidad', conPlazos: false },
  { id: 'paternidad',   nombre: 'Licencia por paternidad', conPlazos: false },
  { id: 'familiarEnfermo', nombre: 'Enfermedad de familiar a cargo', conPlazos: false },
  { id: 'otra',         nombre: 'Otra', conPlazos: false }
];

const _diaHoy = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const _dias = (desde, hasta) => {
  if (!desde || !hasta) return null;
  const a = new Date(desde + 'T00:00:00'), b = new Date(hasta + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
};

/* Las fechas que salen en el texto de la situación se leen en pantalla: van en
   es-AR como el resto del panel, no en ISO. */
const _fecha = f => {
  if (!f) return '';
  const [a, m, d] = String(f).split('-');
  return (d && m && a) ? `${d}/${m}/${a}` : String(f);
};

const _sumarMeses = (fecha, meses) => {
  if (!fecha) return '';
  const d = new Date(fecha + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const dia = d.getDate();
  d.setMonth(d.getMonth() + meses);
  /* Si el mes destino es más corto —31 de enero más un mes— el Date se pasa al
     mes siguiente. Se vuelve al último día del mes que corresponde. */
  if (d.getDate() < dia) d.setDate(0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/** Si la persona ya trajo el certificado que respalda la ausencia. */
function tieneCertificado(a) {
  const v = (a || {}).certificado;
  return v === true || v === 'si' || v === 'sí';
}

/**
 * En qué situación está una ausencia hoy.
 *
 * @returns {{clase:string, texto:string, diasParaVencer:number|null,
 *            diasLlevados:number|null, tono:string}}
 */
function estadoDeAusencia(a, hoy) {
  const h = hoy || _diaHoy();
  const x = a || {};
  if (x.reincorporado) {
    return { clase: 'cerrada', texto: 'Se reincorporó' + (x.fechaReincorporacion ? ' el ' + _fecha(x.fechaReincorporacion) : ''),
             diasParaVencer: null, diasLlevados: _dias(x.desde, x.fechaReincorporacion || x.hasta), tono: 'verde' };
  }
  if (!x.desde) {
    return { clase: 'sinFecha', texto: 'Sin fecha de inicio', diasParaVencer: null, diasLlevados: null, tono: 'ambar' };
  }
  if (x.desde > h) {
    return { clase: 'porEmpezar', texto: 'Empieza el ' + _fecha(x.desde),
             diasParaVencer: null, diasLlevados: null, tono: 'azul' };
  }
  /* Inclusivo, igual que `diasDeAusencia`: el día que arranca la licencia la
     persona tampoco fue. Con la cuenta exclusiva la fila decía «3 días» en la
     columna y «2 días» en la situación, una al lado de la otra. */
  const llevados = (_dias(x.desde, h) || 0) + 1;

  /* Sin papel, la falta no está justificada, sea cual sea la licencia que la
     persona invoque. Va antes que cualquier otra lectura porque es la única
     que cambia lo que hay que hacer: reclamar el certificado. Mientras tanto
     la ausencia se cuenta, pero como pendiente. */
  if (!tieneCertificado(x)) {
    return { clase: 'pendienteJustificar',
             texto: llevados > 0 ? `Pendiente de justificar · ${llevados} día${llevados === 1 ? '' : 's'}`
                                 : 'Pendiente de justificar',
             diasParaVencer: null, diasLlevados: llevados, tono: 'rojo' };
  }

  if (!x.hasta) {
    return { clase: 'sinAlta', texto: 'Sin fecha de alta en el certificado',
             diasParaVencer: null, diasLlevados: llevados, tono: 'ambar' };
  }
  const faltan = _dias(h, x.hasta);
  if (faltan < 0) {
    return { clase: 'vencida', texto: `El certificado venció hace ${-faltan} día${-faltan === 1 ? '' : 's'}`,
             diasParaVencer: faltan, diasLlevados: llevados, tono: 'rojo' };
  }
  if (faltan === 0) {
    return { clase: 'vence', texto: 'El certificado termina hoy: mañana vuelve o trae uno nuevo',
             diasParaVencer: 0, diasLlevados: llevados, tono: 'rojo' };
  }
  if (faltan <= 3) {
    return { clase: 'porVencer', texto: `Vuelve en ${faltan} día${faltan === 1 ? '' : 's'}`,
             diasParaVencer: faltan, diasLlevados: llevados, tono: 'ambar' };
  }
  return { clase: 'enCurso', texto: `Vuelve el ${_fecha(x.hasta)}`, diasParaVencer: faltan,
           diasLlevados: llevados, tono: 'azul' };
}

/**
 * Los plazos de la ley aplicados a una ausencia concreta, con las fechas en
 * las que se agota cada tramo. Solo para lo que la ley trata como enfermedad
 * inculpable: el accidente de trabajo lo cubre la ART y la maternidad tiene
 * su propio régimen.
 */
function cobertura(ausencia, colaborador, anios) {
  const a = ausencia || {}, c = colaborador || {};
  const motivo = MOTIVOS_AUSENCIA_LARGA.find(m => m.id === a.motivo);
  if (!motivo || !motivo.conPlazos) {
    return { aplica: false, motivo: motivo ? motivo.nombre : '' };
  }
  const p = plazosEnfermedad(anios, tieneCargasFamilia(c));
  const finPago = _sumarMeses(a.desde, p.mesesPagos);
  const finReserva = _sumarMeses(finPago, p.reservaMeses);
  const hoy = _diaHoy();
  return {
    aplica: true,
    cargasFamilia: tieneCargasFamilia(c),
    mesesPagos: p.mesesPagos,
    tramo: p.tramo,
    reservaMeses: p.reservaMeses,
    articulo: p.articulo,
    finPago, finReserva,
    /* Para avisar antes de que se agote, no cuando ya pasó. */
    diasParaFinPago: finPago ? _dias(hoy, finPago) : null,
    enReserva: !!(finPago && hoy > finPago)
  };
}

/* ------------------------------------------------------------------ *
 * 3. El historial de una persona                                       *
 * ------------------------------------------------------------------ */

/**
 * Días que una ausencia lleva efectivamente transcurridos.
 *
 * No cuenta lo que todavía no pasó: un certificado hasta el 20 no son días de
 * ausencia el día 16. Cuenta los dos extremos, porque el día que arranca la
 * licencia la persona tampoco fue.
 */
function diasDeAusencia(a, hoy) {
  const h = hoy || _diaHoy();
  const x = a || {};
  if (!x.desde) return 0;
  const fin = _finComputable(x, h);
  if (!fin || fin < x.desde) return 0;
  return (_dias(x.desde, fin) || 0) + 1;
}

const _finComputable = (x, h) => {
  if (x.reincorporado) {
    /* Se reincorporó el 20 quiere decir que el 20 ya trabajó: el último día de
       ausencia es el anterior. */
    const r = x.fechaReincorporacion;
    return r ? _diaMas(r, -1) : (x.hasta && x.hasta < h ? x.hasta : h);
  }
  return (x.hasta && x.hasta < h) ? x.hasta : h;
};

const _diaMas = (fecha, n) => {
  const d = new Date(fecha + 'T00:00:00');
  if (isNaN(d.getTime())) return fecha;
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

/**
 * El historial de ausencias de una persona, repartido mes a mes.
 *
 * Una licencia del 25/08 al 05/09 son siete días de agosto y cinco de
 * septiembre. Imputarla entera al mes en que arrancó infla un mes y vacía el
 * otro, que es justo lo que se mira cuando se compara contra la liquidación.
 *
 * @returns {{periodos:string[], porMes:object, porMotivo:object, total:number,
 *            abiertas:number, sinJustificar:number}}
 */
function ausenciasPorMes(colaborador, hoy) {
  const h = hoy || _diaHoy();
  const out = { periodos: [], porMes: {}, porMotivo: {}, total: 0,
                abiertas: 0, sinJustificar: 0 };

  ((colaborador || {}).ausencias || []).forEach(a => {
    if (!a.reincorporado) {
      out.abiertas++;
      if (!tieneCertificado(a)) out.sinJustificar++;
    }
    if (!a.desde) return;
    const fin = _finComputable(a, h);
    if (!fin || fin < a.desde) return;

    const motivo = a.motivo || 'otra';
    /* Se recorre día por día en vez de calcular solapamientos: son tramos de
       semanas o meses, y un tope protege de una fecha cargada con un año mal
       tipeado. */
    let d = a.desde;
    for (let i = 0; i < 1500 && d <= fin; i++) {
      const per = d.slice(0, 7);
      if (!out.porMes[per]) out.porMes[per] = { total: 0, motivos: {} };
      out.porMes[per].total++;
      out.porMes[per].motivos[motivo] = (out.porMes[per].motivos[motivo] || 0) + 1;
      out.porMotivo[motivo] = (out.porMotivo[motivo] || 0) + 1;
      out.total++;
      d = _diaMas(d, 1);
    }
  });

  out.periodos = Object.keys(out.porMes).sort().reverse();
  return out;
}

/* ------------------------------------------------------------------ *
 * 4. Lo que hay que mirar hoy                                          *
 * ------------------------------------------------------------------ */

/**
 * Recorre todo el padrón y devuelve las ausencias que piden una acción: la que
 * venció, la que vence hoy, la que vence en los próximos días y la que no tiene
 * fecha de alta. Ordenadas por urgencia, que es como se miran.
 *
 * @param {object} estado el estado del panel
 * @param {string} hoy fecha ISO
 * @param {number} avisarDias con cuántos días de anticipación avisar
 */
function alertasDeAusencias(estado, hoy, avisarDias) {
  const h = hoy || _diaHoy();
  const margen = avisarDias === undefined ? 3 : avisarDias;
  const out = [];

  (estado.sucursales || []).forEach(s => {
    (s.colaboradores || []).forEach(c => {
      (c.ausencias || []).forEach(a => {
        if (a.reincorporado) return;
        const est = estadoDeAusencia(a, h);
        const urge = est.clase === 'vencida' || est.clase === 'vence' ||
                     est.clase === 'sinAlta' || est.clase === 'pendienteJustificar' ||
                     (est.clase === 'porVencer' && est.diasParaVencer <= margen);
        if (!urge) return;
        out.push({
          colaboradorId: c.id, nombre: c.nombre, sucursalId: s.id,
          sucursal: s.nombre || s.codigo,
          ausencia: a, estado: est,
          orden: est.clase === 'pendienteJustificar' ? 0
               : est.clase === 'vencida' ? 1 : est.clase === 'vence' ? 2
               : est.clase === 'sinAlta' ? 3 : 4 + (est.diasParaVencer || 0)
        });
      });
    });
  });

  return out.sort((a, b) => a.orden - b.orden);
}

/** Quién está ausente hoy, para no contarlo en el piso del día. */
function ausentesHoy(estado, hoy) {
  const h = hoy || _diaHoy();
  const out = [];
  (estado.sucursales || []).forEach(s => {
    (s.colaboradores || []).forEach(c => {
      (c.ausencias || []).forEach(a => {
        if (a.reincorporado || !a.desde) return;
        if (a.desde <= h && (!a.hasta || a.hasta >= h)) {
          out.push({ colaboradorId: c.id, nombre: c.nombre, sucursalId: s.id, ausencia: a });
        }
      });
    });
  });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LICENCIA_ENFERMEDAD, RESERVA_PUESTO_MESES, plazosEnfermedad, tieneCargasFamilia,
    MOTIVOS_AUSENCIA_LARGA, estadoDeAusencia, cobertura, tieneCertificado,
    diasDeAusencia, ausenciasPorMes,
    alertasDeAusencias, ausentesHoy
  };
}

/* ============ El formulario de recepción de ausencias ==================== *
 *
 * Las ausencias entran por un formulario de Google que completan los gerentes
 * —«Recepción de ausencias por certificados, apercibimientos y vacaciones»— y
 * salen como una planilla de respuestas. Esto la lee.
 *
 * **La planilla no fue pensada para medir.** El certificado se carga en un solo
 * campo de texto libre que pide patología, fecha de inicio y días de reposo, y
 * en la práctica la mitad de las respuestas trae solo la patología: «MIGRAÑA»,
 * «dolor de espalda». De las que traen duración, la mayoría la escribe en horas
 * —«(24) HORAS»— y no en días.
 *
 * Por eso esto **parsea lo que puede y dice lo que no pudo**, en vez de
 * completar con supuestos. Una ausencia sin duración se guarda igual: que la
 * persona faltó es un hecho, y cuántos días faltó es otro dato. El que falta se
 * cuenta aparte y la pantalla lo muestra, porque un porcentaje de ausentismo
 * calculado sobre la mitad de los certificados no es un porcentaje bajo: es un
 * porcentaje falso.
 */

/* Cuántos días dura un certificado que no dice cuánto dura.
 *
 * El coordinador decidió tomarlos como **un día**, y los propios datos lo
 * respaldan: de los 66 certificados del Área 3 que sí declaran duración, 30 son
 * de un día y 54 de uno o dos. Suponer un día es la lectura más conservadora —
 * la que menos infla el ausentismo— y es la única que permite tener un número.
 *
 * Lo que no se hace es **olvidar que es un supuesto**: la ausencia queda con
 * `diasSupuestos: true` y todo lo que la cuenta separa los días medidos de los
 * supuestos. El día que el formulario pida la duración en un campo aparte, el
 * supuesto se apaga solo para las nuevas y las viejas siguen marcadas. */
const DIAS_SIN_DURACION = 1;

/** Qué es cada columna del formulario, por lo que dice su encabezado. */
const COLUMNAS_FORMULARIO_AUSENCIAS = [
  { campo: 'marca',    claves: ['marca temporal'] },
  { campo: 'periodo',  claves: ['mes y ano en curso'] },
  { campo: 'nombre',   claves: ['apellido y nombre'] },
  { campo: 'tienda',   claves: ['tienda'] },
  { campo: 'cuil',     claves: ['cuil'] },
  { campo: 'tipo',     claves: ['que novedad'] },
  { campo: 'detalle',  claves: ['patologia'] },
  { campo: 'apercibimiento', claves: ['fecha del apercibimiento'] },
  { campo: 'parto',    claves: ['fecha probable de parto'] },
  { campo: 'desdeAnses', claves: ['inicio de la licencia abonada'] },
  { campo: 'hastaAnses', claves: ['fin de la licencia abonada'] },
  { campo: 'casamiento', claves: ['fecha de casamiento'] }
];

/* Lo que el formulario ofrece elegir, mapeado a los motivos del panel. Las
   vacaciones se importan pero **no son ausentismo**: son tiempo planificado y
   contarlas infla el número con algo que no es un problema. */
const TIPOS_FORMULARIO = [
  { clave: 'certificado',  motivo: 'enfermedad',  ausentismo: true },
  { clave: 'vacacion',     motivo: 'vacaciones',  ausentismo: false },
  { clave: 'embarazo',     motivo: 'maternidad',  ausentismo: false },
  { clave: 'fallecimiento', motivo: 'otra',       ausentismo: false },
  { clave: 'apercibimiento', motivo: null,        ausentismo: false }
];

const _sinTildesMay = s => String(s || '').normalize('NFD')
  .replace(/[̀-ͯ]/g, '').toUpperCase();

/** A qué motivo del panel corresponde lo que eligieron en el formulario. */
function motivoDeFormulario(texto) {
  const t = _sinTildesMay(texto).toLowerCase();
  return TIPOS_FORMULARIO.find(x => t.indexOf(x.clave) >= 0) || null;
}

/**
 * Saca del texto libre del certificado lo que se pueda: día de inicio,
 * duración y patología. Devuelve `null` en lo que no está, nunca un supuesto.
 *
 * El año es opcional —«08/03», «18-03»— porque el formulario lo omite seguido;
 * cuando falta se toma el de la respuesta, que es cuando se cargó.
 */
function leerCertificado(texto, anioRef) {
  const t = String(texto || '').trim();
  if (!t) return { dias: null, desde: null, patologia: '' };

  /* La duración: primero días, después horas. «(24) HORAS» es un día, no
     veinticuatro: es como lo escribe la mitad de los gerentes. */
  let dias = null;
  const mD = t.match(/(\d{1,3})\s*d[ií]as?\b/i);
  if (mD) {
    dias = parseInt(mD[1], 10);
  } else {
    const mH = t.match(/\(?\s*(\d{1,3})\s*\)?\s*h(?:s|rs|oras?)?\b/i);
    if (mH) dias = Math.max(1, Math.ceil(parseInt(mH[1], 10) / 24));
  }

  /* La fecha: dd/mm, dd-mm-aa o dd-mm-aaaa. Se descarta lo que no sea una
     fecha posible, para no leer «24 HORAS» como un 24 de algo. */
  let desde = null;
  const mF = t.match(/\b(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?\b/);
  if (mF) {
    const d = +mF[1], m = +mF[2];
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      let a = mF[3] ? +mF[3] : (anioRef || new Date().getFullYear());
      if (a < 100) a += 2000;
      desde = `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  /* La patología es lo que queda sacando números y separadores. Va al campo
     diagnóstico de la ausencia, que ya existe. */
  const patologia = t.replace(/\(?\s*\d{1,3}\s*\)?\s*(h(s|rs|oras?)?|d[ií]as?)\b/gi, ' ')
    .replace(/\b\d{1,2}[/\-.]\d{1,2}([/\-.]\d{2,4})?\b/g, ' ')
    .replace(/\b(fecha de inicio|tiempo de reposo|patologia|reposo|inicio)\b\s*:?/gi, ' ')
    .replace(/[\s,;/|-]+/g, ' ').trim();

  return { dias, desde, patologia };
}

/** El CUIL que escribieron, sin lo que le agrega Excel al guardarlo como número. */
function cuilDelFormulario(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  /* Excel guarda el CUIL como número y al exportarlo le queda un `.0`, que al
     sacar los no-dígitos se convierte en un cero de más al final. */
  if (d.length === 12 && d.endsWith('0')) return d.slice(0, 11);
  return d.length === 11 ? d : '';
}

/* El formulario pide el CUIL y una cuarta parte de las respuestas trae el DNI.
   No es un error que valga la pena pelear: el DNI identifica igual de bien y el
   padrón lo tiene. De las 193 filas del Área 3, 47 traen un número de 7 u 8
   dígitos, y leerlo como documento en vez de descartarlo ubica 22 ausencias que
   antes dependían de que el nombre estuviera bien escrito. */
function documentoDelFormulario(v) {
  const d = String(v == null ? '' : v).replace(/\D/g, '');
  /* Excel guarda el número como tal y al exportarlo le deja un `.0`, que al
     sacar los no-dígitos queda como un cero de más al final. Se prueban las dos
     lecturas porque un DNI que termina en 0 es perfectamente posible. */
  const formas = d.length > 1 && d.endsWith('0') ? [d, d.slice(0, -1)] : [d];
  const out = { cuil: '', dni: '' };
  formas.forEach(x => {
    if (!out.cuil && x.length === 11) out.cuil = x;
    if (!out.dni && x.length >= 7 && x.length <= 8) out.dni = x;
  });
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Object.assign(module.exports || {}, {
    COLUMNAS_FORMULARIO_AUSENCIAS, TIPOS_FORMULARIO, DIAS_SIN_DURACION,
    motivoDeFormulario, leerCertificado, cuilDelFormulario, documentoDelFormulario
  });
}

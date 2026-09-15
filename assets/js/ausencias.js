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
    return { clase: 'cerrada', texto: 'Se reincorporó' + (x.fechaReincorporacion ? ' el ' + x.fechaReincorporacion : ''),
             diasParaVencer: null, diasLlevados: _dias(x.desde, x.fechaReincorporacion || x.hasta), tono: 'verde' };
  }
  if (!x.desde) {
    return { clase: 'sinFecha', texto: 'Sin fecha de inicio', diasParaVencer: null, diasLlevados: null, tono: 'ambar' };
  }
  if (x.desde > h) {
    return { clase: 'porEmpezar', texto: 'Empieza el ' + x.desde,
             diasParaVencer: null, diasLlevados: null, tono: 'azul' };
  }
  const llevados = _dias(x.desde, h);
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
  return { clase: 'enCurso', texto: `Vuelve el ${x.hasta}`, diasParaVencer: faltan,
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
 * 3. Lo que hay que mirar hoy                                          *
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
                     est.clase === 'sinAlta' ||
                     (est.clase === 'porVencer' && est.diasParaVencer <= margen);
        if (!urge) return;
        out.push({
          colaboradorId: c.id, nombre: c.nombre, sucursalId: s.id,
          sucursal: s.nombre || s.codigo,
          ausencia: a, estado: est,
          orden: est.clase === 'vencida' ? 0 : est.clase === 'vence' ? 1
               : est.clase === 'sinAlta' ? 2 : 3 + (est.diasParaVencer || 0)
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
    MOTIVOS_AUSENCIA_LARGA, estadoDeAusencia, cobertura,
    alertasDeAusencias, ausentesHoy
  };
}

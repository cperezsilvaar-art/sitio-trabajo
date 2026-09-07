/*
 * presentismo.js — Parte diario de ausencias y presentismo por turno.
 *
 * El parte es por sucursal y por día. Cada ausencia dice a qué turno pertenece,
 * el motivo, y si el colaborador avisó: esa última distinción es la que separa
 * el ausentismo gestionable del que no lo es.
 *
 * El presentismo del día sale de comparar los ausentes contra la dotación
 * esperada de cada turno, que se carga una vez por sucursal.
 */

const TURNOS = [
  { id: 'manana',     nombre: 'Mañana',     desde: '08:00', hasta: '16:00' },
  { id: 'intermedio', nombre: 'Intermedio', desde: '10:00', hasta: '19:00' },
  { id: 'noche',      nombre: 'Noche',      desde: '16:00', hasta: '23:00' }
];

const TURNOS_POR_ID = TURNOS.reduce((m, t) => { m[t.id] = t; return m; }, {});

/* Motivos del parte diario. `gestionable` marca los que la tienda y RRHH
   pueden incidir; el resto son licencias y hechos de fuerza mayor. */
const MOTIVOS_AUSENCIA = [
  { id: 'enfermedad',    nombre: 'Enfermedad',                gestionable: true },
  { id: 'accidente',     nombre: 'Accidente o ART',           gestionable: false },
  { id: 'famEnfermo',    nombre: 'Enfermedad de familiar',    gestionable: true },
  { id: 'tramite',       nombre: 'Trámite personal',          gestionable: true },
  { id: 'estudio',       nombre: 'Estudio o examen',          gestionable: false },
  { id: 'personal',      nombre: 'Tema personal',             gestionable: true },
  { id: 'transporte',    nombre: 'Problema de transporte',    gestionable: true },
  { id: 'sinAviso',      nombre: 'No se presentó ni avisó',   gestionable: true },
  { id: 'licencia',      nombre: 'Licencia (vacaciones, matrimonio, etc.)', gestionable: false },
  { id: 'suspension',    nombre: 'Suspensión',                gestionable: true },
  { id: 'otro',          nombre: 'Otro',                      gestionable: true }
];

const MOTIVOS_POR_ID = MOTIVOS_AUSENCIA.reduce((m, x) => { m[x.id] = x; return m; }, {});

const AVISOS = [
  { id: 'previo',    nombre: 'Avisó con anticipación' },
  { id: 'mismoDia',  nombre: 'Avisó el mismo día' },
  { id: 'tarde',     nombre: 'Avisó después de su horario' },
  { id: 'no',        nombre: 'No avisó' }
];

const AVISOS_POR_ID = AVISOS.reduce((m, x) => { m[x.id] = x; return m; }, {});

/* Motivos por los que se genera una hora extra. La lista es cerrada a
   propósito: si todo entra en "otro", el acumulado no explica nada. */
const MOTIVOS_HORAS = [
  { id: 'afluencia',    nombre: 'Afluencia de público' },
  { id: 'ausencia',     nombre: 'Cubrir una ausencia' },
  { id: 'promoBancaria',nombre: 'Promoción bancaria' },
  { id: 'inventario',   nombre: 'Inventario' }
];

const MOTIVOS_HORAS_POR_ID = MOTIVOS_HORAS.reduce((m, x) => { m[x.id] = x; return m; }, {});

/** El día anterior a una fecha ISO: las horas extras se piden al día siguiente. */
function diaAnterior(fecha) {
  const d = new Date(String(fecha || '') + 'T12:00:00');
  if (isNaN(d)) return fecha;
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/* -------------------------- turnos por sucursal ----------------------- */

/**
 * Turnos por defecto de una sucursal, derivados de su horario de atención.
 * El cierre del turno noche sigue al cierre del local; las tiendas que solo
 * abren de 10 a 18 no tienen turnos de mañana ni de noche.
 * Es un punto de partida editable, no una definición.
 */
function turnosPorDefecto(sucursal) {
  const horario = String((sucursal && sucursal.horario) || '');
  const cierres = (horario.match(/(\d{1,2}):(\d{2})/g) || []);
  const ultimo = cierres.length ? cierres[cierres.length - 1] : '';
  const soloTarde = /10:00 a 18:00/.test(horario) && !/08:00/.test(horario);

  const cierreNoche = /24:00/.test(horario) ? '24:00'
    : /23:00/.test(horario) ? '23:00'
    : /22:00/.test(horario) ? '22:00'
    : /21:00/.test(horario) ? '21:00'
    : (ultimo || '23:00');

  if (soloTarde) {
    return {
      manana:     { activo: false, desde: '08:00', hasta: '16:00', dotacion: '' },
      intermedio: { activo: true,  desde: '10:00', hasta: '18:00', dotacion: '' },
      noche:      { activo: false, desde: '16:00', hasta: cierreNoche, dotacion: '' }
    };
  }
  return {
    manana:     { activo: true, desde: '08:00', hasta: '16:00', dotacion: '' },
    intermedio: { activo: true, desde: '10:00', hasta: '19:00', dotacion: '' },
    noche:      { activo: true, desde: '16:00', hasta: cierreNoche, dotacion: '' }
  };
}

/** Primer turno activo de la sucursal: el que se propone al cargar una ausencia. */
function turnoSugerido(sucursal) {
  const t = (sucursal && sucursal.turnos) || {};
  const hallado = TURNOS.find(x => !t[x.id] || t[x.id].activo !== false);
  return (hallado || TURNOS[0]).id;
}

/** Dotación esperada del día: la suma de los turnos activos. */
function dotacionDelDia(sucursal) {
  const t = (sucursal && sucursal.turnos) || {};
  return TURNOS.reduce((s, x) => {
    const cfg = t[x.id];
    return s + (cfg && cfg.activo !== false ? num(cfg.dotacion) : 0);
  }, 0);
}

/* ---------------------------- cálculo del parte ------------------------ */

/**
 * Presentismo de un parte diario.
 * @param {object} parte     { ausencias: [...] }
 * @param {object} sucursal  con sus turnos y dotaciones
 */
function calcularParte(parte, sucursal) {
  const ausencias = (parte && parte.ausencias) || [];
  const turnos = (sucursal && sucursal.turnos) || {};

  const porTurno = TURNOS.map(t => {
    const cfg = turnos[t.id] || {};
    const activo = cfg.activo !== false;
    const dotacion = activo ? num(cfg.dotacion) : 0;
    const ausentes = ausencias.filter(a => a.turno === t.id).length;
    return {
      id: t.id, nombre: t.nombre, activo, dotacion, ausentes,
      presentes: Math.max(0, dotacion - ausentes),
      presentismo: dotacion > 0 ? Math.max(0, dotacion - ausentes) / dotacion : null,
      horario: `${cfg.desde || t.desde} a ${cfg.hasta || t.hasta}`
    };
  });

  const extras = (parte && parte.horasExtras) || [];
  const horas = extras.reduce((s, h) => s + num(h.horas), 0);
  const horasPorMotivo = {};
  extras.forEach(h => { horasPorMotivo[h.motivo] = (horasPorMotivo[h.motivo] || 0) + num(h.horas); });

  const dotacion = porTurno.reduce((s, t) => s + t.dotacion, 0);
  const ausentes = ausencias.length;
  const sinAviso = ausencias.filter(a => a.aviso === 'no').length;
  const gestionables = ausencias.filter(a => (MOTIVOS_POR_ID[a.motivo] || {}).gestionable).length;

  return {
    porTurno, dotacion, ausentes,
    presentes: Math.max(0, dotacion - ausentes),
    presentismo: dotacion > 0 ? Math.max(0, dotacion - ausentes) / dotacion : null,
    sinAviso, gestionables,
    ausencias,
    horas, horasPorMotivo, personasConHoras: extras.length
  };
}

/** Consolidado de un día para toda el área. */
function consolidarDia(partes, sucursales, fecha) {
  const delDia = (partes || []).filter(p => p.fecha === fecha);
  const filas = (sucursales || []).map(s => {
    const parte = delDia.find(p => p.sucursalId === s.id) || null;
    const c = calcularParte(parte, s);
    return { sucursal: s, parte, calc: c, reportado: !!parte };
  });

  const suma = k => filas.reduce((a, f) => a + num(f.calc[k]), 0);
  const dotacion = suma('dotacion');
  const ausentes = suma('ausentes');

  return {
    fecha, filas,
    dotacion, ausentes,
    presentes: Math.max(0, dotacion - ausentes),
    presentismo: dotacion > 0 ? Math.max(0, dotacion - ausentes) / dotacion : null,
    sinAviso: suma('sinAviso'),
    gestionables: suma('gestionables'),
    horas: suma('horas'),
    reportaron: filas.filter(f => f.reportado).length,
    faltanReportar: filas.filter(f => !f.reportado).map(f => f.sucursal)
  };
}

/**
 * Acumulado de un mes por sucursal: es lo que alimenta el ausentismo mensual
 * de la visita, contando días-persona de ausencia.
 */
function acumuladoMes(partes, sucursalId, periodo) {
  const propios = (partes || []).filter(p =>
    p.sucursalId === sucursalId && String(p.fecha || '').slice(0, 7) === periodo);

  const dias = {};
  let total = 0, sinAviso = 0, gestionables = 0;
  const porMotivo = {};

  let horas = 0;
  const horasPorMotivo = {};
  const horasPorPersona = {};
  const diasConHoras = {};

  propios.forEach(p => {
    dias[p.fecha] = true;
    (p.ausencias || []).forEach(a => {
      total++;
      if (a.aviso === 'no') sinAviso++;
      if ((MOTIVOS_POR_ID[a.motivo] || {}).gestionable) gestionables++;
      porMotivo[a.motivo] = (porMotivo[a.motivo] || 0) + 1;
    });
    (p.horasExtras || []).forEach(h => {
      const q = num(h.horas);
      if (!q) return;
      horas += q;
      diasConHoras[p.fecha] = true;
      horasPorMotivo[h.motivo] = (horasPorMotivo[h.motivo] || 0) + q;
      const k = String(h.colaborador || 'Sin identificar').trim() || 'Sin identificar';
      horasPorPersona[k] = (horasPorPersona[k] || 0) + q;
    });
  });

  return {
    periodo, partes: propios.length, diasConParte: Object.keys(dias).length,
    diasAusencia: total, sinAviso, gestionables, porMotivo,
    horas, horasPorMotivo, horasPorPersona,
    diasConHoras: Object.keys(diasConHoras).length
  };
}

/**
 * Horas extras del mes para toda el área: por sucursal y consolidado.
 * Sirve para anticipar el mes en curso en lugar de enterarse con la
 * liquidación, que es de lo que se trata pedirlas todos los días.
 */
function acumuladoHorasArea(partes, sucursales, periodo) {
  const filas = (sucursales || []).map(s => {
    const a = acumuladoMes(partes, s.id, periodo);
    return {
      sucursal: s,
      horas: a.horas,
      porMotivo: a.horasPorMotivo,
      porPersona: a.horasPorPersona,
      personas: Object.keys(a.horasPorPersona).length,
      diasConHoras: a.diasConHoras,
      diasConParte: a.diasConParte
    };
  });

  const total = filas.reduce((s, f) => s + f.horas, 0);
  const porMotivo = {};
  filas.forEach(f => {
    MOTIVOS_HORAS.forEach(m => {
      if (f.porMotivo[m.id]) porMotivo[m.id] = (porMotivo[m.id] || 0) + f.porMotivo[m.id];
    });
  });

  /* Proyección simple del cierre de mes: el ritmo diario observado llevado
     a los días del mes. Es una anticipación, no un pronóstico. */
  const diasDelMes = (() => {
    const [a, m] = String(periodo || '').split('-').map(Number);
    return (a && m) ? new Date(a, m, 0).getDate() : 30;
  })();
  const diasCubiertos = Math.max.apply(null, [0].concat(filas.map(f => f.diasConParte)));
  /* Con menos de una semana cargada la extrapolación dice más de la muestra
     que del mes, así que directamente no se muestra. */
  const proyectable = diasCubiertos >= 5;
  const proyeccion = proyectable ? (total / diasCubiertos) * diasDelMes : null;

  return {
    periodo, filas, total, porMotivo,
    personas: filas.reduce((s, f) => s + f.personas, 0),
    diasCubiertos, diasDelMes, proyectable, proyeccion
  };
}

/** Mensaje para el grupo de WhatsApp, con el link del formulario. */
function mensajeWhatsApp(config, fecha) {
  const f = (() => {
    if (!fecha) return '';
    const [a, m, d] = fecha.split('-');
    return `${d}/${m}/${a}`;
  })();
  const ayer = (() => {
    const x = diaAnterior(fecha);
    if (!x) return '';
    const [a2, m2, d2] = x.split('-');
    return `(${d2}/${m2})`;
  })();
  const link = String((config && config.linkParteDiario) || '').trim();
  return [
    `Buen día. Parte diario de asistencia — ${f}`,
    '',
    'Por favor completen el formulario antes de las 10:00, aunque no tengan novedades:',
    link || '[falta cargar el link del formulario en Configuración]',
    '',
    'Si hubo una ausencia, poner el nombre del colaborador, el turno, el motivo y si avisó o no.',
    'Si el equipo está completo, marcar "sin novedad".',
    '',
    `Y las horas extras de ayer ${ayer}: quién las hizo, cuántas y por qué`,
    '(afluencia de público, cubrir una ausencia, promoción bancaria o inventario).',
    '',
    (config && config.coordinador) || ''
  ].filter(x => x !== null).join('\n');
}

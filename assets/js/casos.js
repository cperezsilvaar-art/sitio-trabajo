/* ===================== CASOS EN SEGUIMIENTO ==============================
 *
 * Las situaciones que el coordinador sigue de cerca porque no se resuelven
 * solas: un desempeño que no levanta, un ausentismo que ya no es un resfrío,
 * un intercambio con el estudio jurídico.
 *
 * **Se sigue la situación, no se etiqueta a la persona.** El nombre no es
 * casual. Un listado de «empleados complejos» es una lista de adjetivos sobre
 * gente con nombre y apellido guardada en una herramienta de la empresa: no
 * dice qué hacer, envejece mal y en un juicio se lee como prueba de un
 * prejuicio. Un caso, en cambio, tiene fecha de apertura, un próximo paso y
 * una fecha de cierre — y cuando se resuelve, se cierra.
 *
 * Por eso lo que se escribe acá son **hechos y acciones** —qué pasó, cuándo,
 * qué sigue y quién lo lleva— y no calificaciones. El desempeño ya se evalúa
 * en el 9-box y el ausentismo ya se mide: esas señales se **leen** desde acá y
 * no se vuelven a tipear.
 *
 * **La documentación no va acá.** Certificados, informes médicos, cartas
 * documento e intercambios con el estudio viven en el legajo y en el estudio.
 * El panel guarda que el caso existe, en qué estado está y qué sigue: con eso
 * alcanza para no perderle el rastro, y evita que una historia clínica termine
 * en el almacenamiento de un navegador.
 */

const TIPOS_CASO = [
  { id: 'desempeno',  nombre: 'Desempeño',
    ayuda: 'No alcanza lo esperado y hay un plan de mejora en curso.' },
  { id: 'ausentismo', nombre: 'Ausentismo reiterado',
    ayuda: 'Faltas repetidas o una licencia que se extiende más de lo previsto.' },
  { id: 'conducta',   nombre: 'Conducta o disciplina',
    ayuda: 'Incumplimientos, sanciones aplicadas, conflicto con el equipo.' },
  { id: 'salud',      nombre: 'Salud y reincorporación',
    ayuda: 'Licencia larga, control médico, reubicación o tareas livianas.' },
  { id: 'legal',      nombre: 'Intercambio legal',
    ayuda: 'Carta documento, intimación o expediente con el estudio jurídico.' },
  { id: 'otro',       nombre: 'Otro',
    ayuda: 'Cualquier situación que necesite seguimiento y no entre en las de arriba.' }
];

/* Tres estados y ninguno más. «En seguimiento» y «abierto» serían el mismo
   estado con dos nombres; lo que de verdad cambia la lectura es si la pelota
   está de este lado o del de un tercero —el estudio, una junta médica, el
   colaborador que tiene que contestar—. */
const ESTADOS_CASO = [
  { id: 'abierto',   nombre: 'Abierto',   tono: 'ambar',
    ayuda: 'La próxima acción es tuya.' },
  { id: 'esperando', nombre: 'Esperando', tono: 'azul',
    ayuda: 'Depende de un tercero: el estudio, un control médico, una respuesta.' },
  { id: 'cerrado',   nombre: 'Cerrado',   tono: 'verde',
    ayuda: 'Se resolvió. Queda en el historial de la persona.' }
];

const RIESGOS_CASO = [
  { id: 'medio', nombre: 'Medio', tono: 'azul' },
  { id: 'alto',  nombre: 'Alto',  tono: 'ambar' },
  { id: 'critico', nombre: 'Crítico', tono: 'rojo' }
];

/* Un caso abierto que hace tres semanas que no se toca ya no se está
   siguiendo: se está olvidando. Es el mismo criterio que el de los pendientes
   de la agenda, con el plazo un poco más largo porque estos se mueven por
   terceros. */
const DIAS_CASO_SIN_MOVIMIENTO = 21;

function casoNuevo(datos) {
  const d = datos || {};
  return {
    id: (typeof uid === 'function' ? uid() : 'c' + Date.now() + Math.random().toString(36).slice(2, 7)),
    tipo: d.tipo || 'otro',
    estado: d.estado || 'abierto',
    riesgo: d.riesgo || 'medio',
    abiertoEl: d.abiertoEl || (typeof _diaHoy === 'function' ? _diaHoy() : ''),
    cerradoEl: '',
    /* Una línea, en tus palabras, de qué está pasando. No el expediente. */
    resumen: d.resumen || '',
    responsable: d.responsable || '',
    proximoPaso: d.proximoPaso || '',
    proximoPasoEl: d.proximoPasoEl || '',
    hitos: []
  };
}

/** La última fecha en que el caso se movió: su hito más nuevo, o su apertura. */
function ultimoMovimiento(caso) {
  const h = (caso.hitos || []).map(x => x.fecha).filter(Boolean).sort();
  return h.length ? h[h.length - 1] : (caso.abiertoEl || '');
}

/**
 * Qué le pasa a un caso hoy: si pide algo y por qué.
 *
 * Devuelve `{ clase, texto, tono }`. El orden importa — es el mismo que usa la
 * pantalla para ordenar— y arranca por lo único que dice qué hacer hoy.
 */
function estadoDeCaso(caso, hoy) {
  const h = hoy || (typeof _diaHoy === 'function' ? _diaHoy() : '');
  const c = caso || {};
  if (c.estado === 'cerrado') {
    return { clase: 'cerrado', texto: 'Cerrado' + (c.cerradoEl ? ' el ' + c.cerradoEl : ''),
             tono: 'verde', pide: false };
  }
  if (c.proximoPaso && c.proximoPasoEl && c.proximoPasoEl < h) {
    return { clase: 'vencido', texto: 'El próximo paso venció', tono: 'rojo', pide: true };
  }
  if (!c.proximoPaso) {
    return { clase: 'sinPaso', texto: 'Sin próximo paso definido', tono: 'rojo', pide: true };
  }
  const quieto = _diasEntre(ultimoMovimiento(c), h);
  if (quieto !== null && quieto >= DIAS_CASO_SIN_MOVIMIENTO) {
    return { clase: 'quieto', texto: `Sin movimiento hace ${quieto} días`, tono: 'ambar', pide: true };
  }
  if (c.proximoPasoEl === h) {
    return { clase: 'hoy', texto: 'El próximo paso es hoy', tono: 'ambar', pide: true };
  }
  if (c.estado === 'esperando') {
    return { clase: 'esperando', texto: 'Esperando a un tercero', tono: 'azul', pide: false };
  }
  return { clase: 'enCurso', texto: c.proximoPasoEl ? 'Próximo paso el ' + c.proximoPasoEl : 'En curso',
           tono: 'azul', pide: false };
}

/**
 * Todos los casos del área, con la persona y la tienda al lado, ordenados por
 * lo que pide atención primero.
 */
function casosDelArea(estado, hoy) {
  const h = hoy || (typeof _diaHoy === 'function' ? _diaHoy() : '');
  const out = [];
  ((estado || {}).sucursales || []).forEach(s => {
    (s.colaboradores || []).forEach(c => {
      (c.casos || []).forEach(k => {
        const est = estadoDeCaso(k, h);
        out.push({
          caso: k, colaboradorId: c.id, nombre: c.nombre,
          sucursalId: s.id, sucursal: s.nombre || s.codigo,
          estado: est,
          orden: est.clase === 'vencido' ? 0 : est.clase === 'sinPaso' ? 1
               : est.clase === 'hoy' ? 2 : est.clase === 'quieto' ? 3
               : est.clase === 'esperando' ? 4 : est.clase === 'cerrado' ? 6 : 5
        });
      });
    });
  });
  return out.sort((a, b) => a.orden - b.orden ||
    String(a.caso.proximoPasoEl || '9').localeCompare(String(b.caso.proximoPasoEl || '9')));
}

/**
 * Las señales que el panel **ya calcula** sobre esta persona, para no pedir que
 * se tipeen: su cuadrante del 9-box, sus días de ausencia del período, sus
 * reclamos abiertos, sus sanciones y si hoy tiene una licencia sin cerrar.
 *
 * Es lo que convierte la pantalla en algo más que una lista de nombres: al
 * abrir un caso de desempeño ya se ve si además falta, y al revés.
 */
function senalesDe(estado, colaboradorId, sucursalId, hoy) {
  const e = estado || {};
  const c = (e.sucursales || []).flatMap(s => s.colaboradores || [])
    .find(x => x.id === colaboradorId);
  if (!c) return null;

  const cuadrante = (typeof cuadranteDe === 'function' && c.potencial && c.desempeno)
    ? cuadranteDe(c.potencial, c.desempeno) : null;

  let aus = null;
  if (typeof ausentismoDe === 'function') {
    const a = ausentismoDe(e, colaboradorId, sucursalId, hoy);
    if (a && a.persona) aus = a.persona;
  }
  const licenciaAbierta = (c.ausencias || []).some(a =>
    !a.reincorporado && a.desde && a.desde <= (hoy || '9999') &&
    (!a.hasta || a.hasta >= (hoy || '')));

  const reclamos = (e.reclamos || []).filter(r =>
    r.colaboradorId === colaboradorId && r.estado !== 'Cerrado').length;

  return {
    cuadrante,
    /* El 9-box marca «Riesgo» al que no alcanza lo esperado y no se proyecta:
       es exactamente el bajo desempeño con bajo potencial, y ya está calculado. */
    enRiesgo9Box: !!cuadrante && cuadrante.nombre === 'Riesgo',
    ausentismo: aus,
    licenciaAbierta,
    reclamosAbiertos: reclamos,
    sanciones: (c.sanciones || []).length,
    entrenando: (c.entrenamientos || []).some(x => x.estado !== 'cerrado')
  };
}

/** Un resumen del conjunto, para el encabezado de la pantalla. */
function resumenDeCasos(lista) {
  const abiertos = lista.filter(x => x.caso.estado !== 'cerrado');
  return {
    total: lista.length,
    abiertos: abiertos.length,
    piden: abiertos.filter(x => x.estado.pide).length,
    criticos: abiertos.filter(x => x.caso.riesgo === 'critico').length,
    porTipo: TIPOS_CASO.map(t => ({
      ...t, cuantos: abiertos.filter(x => x.caso.tipo === t.id).length
    })).filter(t => t.cuantos)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TIPOS_CASO, ESTADOS_CASO, RIESGOS_CASO, DIAS_CASO_SIN_MOVIMIENTO,
    casoNuevo, estadoDeCaso, casosDelArea, senalesDe, resumenDeCasos,
    ultimoMovimiento
  };
}

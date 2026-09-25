/*
 * indicadores.js — Los números de RRHH del área, todos derivados del padrón.
 *
 * El panel ya tenía indicadores en cinco pantallas, cada uno contestando la
 * pregunta de esa pantalla. Lo que no tenía era la foto del área como
 * organización: cómo está armado el plantel, cuánta gente nueva hay, si cada
 * tienda tiene cubiertos los puestos que no pueden faltar. Eso es lo que se
 * mira antes de una reunión con Operaciones, y es lo que McKinsey llama
 * planificar capacidades en vez de headcount.
 *
 * **Todo lo de acá sale del padrón y de nada más.** No depende de que haya una
 * visita cargada, ni una estadística del mes, ni el RDV. Es a propósito: un
 * tablero que necesita tres cargas previas es un tablero que nadie mira.
 *
 * Lo que necesita historia —rotación, ausentismo, evolución del FTE— **no está
 * acá**: se calcula donde vive el dato y se lista aparte, en
 * `loQueFaltaParaMedir()`, que dice qué hay que cargar para que aparezca. Un
 * indicador que promete un número y devuelve un guión durante seis meses es
 * peor que no ofrecerlo.
 */

/* Las bandas de antigüedad. Son ordenadas, no categorías sueltas: por eso en
   pantalla llevan una rampa de un solo tono y no colores distintos. Los cortes
   son los del oficio —el primer año, los tres años, la década— y no cuartiles,
   que se mueven con el plantel y no se pueden explicar en una oración. */
const BANDAS_ANTIGUEDAD = [
  { id: 'nuevo',   nombre: 'Menos de 1 año', desde: 0,  hasta: 1,
    lectura: 'Todavía aprendiendo la tienda' },
  { id: 'uno',     nombre: 'De 1 a 3 años',  desde: 1,  hasta: 3,
    lectura: 'Ya autónomos en el piso' },
  { id: 'tres',    nombre: 'De 3 a 5 años',  desde: 3,  hasta: 5,
    lectura: 'Candidatos naturales a Senior' },
  { id: 'cinco',   nombre: 'De 5 a 10 años', desde: 5,  hasta: 10,
    lectura: 'El sostén del plantel' },
  { id: 'decada',  nombre: '10 años o más',  desde: 10, hasta: Infinity,
    lectura: 'La memoria de la tienda' }
];

/* Los puestos que, si faltan, la tienda tiene un problema hoy. El director
   técnico es el único que además es una exigencia legal: sin él la farmacia no
   abre. Los otros dos son de conducción. */
const PUESTOS_CLAVE = [
  { id: 'dt', nombre: 'Director técnico',
    porque: 'Sin director técnico la farmacia no puede abrir.',
    es: c => /DIRECTOR TECNICO|^DT\b/i.test(c.nivelCargo || c.cargo || '') },
  { id: 'gerente', nombre: 'Gerente de tienda',
    porque: 'Es quien conduce el piso y con quien se hace la visita.',
    es: c => /GERENTE DE TIENDA/i.test(c.nivelCargo || c.cargo || '') },
  { id: 'senior', nombre: 'APV Senior',
    porque: 'Es quien cubre al gerente y el escalón previo a conducir.',
    es: c => /APV SENIOR|VENTA SENIOR/i.test(c.nivelCargo || c.cargo || '') }
];

/** Los activos de una lista, que es sobre quienes se cuenta todo acá. */
const _activos = lista => (lista || []).filter(c => c && c.activo !== false);

/**
 * Cómo se reparte el plantel por antigüedad. Devuelve una banda por fila, con
 * cuántos y qué proporción, más cuántos no tienen la fecha cargada.
 */
function antiguedadPorBanda(personas, campo) {
  const gente = _activos(personas);
  const k = campo || 'fechaIngreso';
  const anios = gente.map(c => antiguedadAnios(c[k])).filter(x => x !== null);
  const filas = BANDAS_ANTIGUEDAD.map(b => {
    const n = anios.filter(a => a >= b.desde && a < b.hasta).length;
    return Object.assign({ personas: n, parte: anios.length ? n / anios.length : 0 }, b);
  });
  return {
    filas, base: anios.length, sinFecha: gente.length - anios.length,
    promedio: anios.length ? anios.reduce((a, b) => a + b, 0) / anios.length : null
  };
}

/**
 * La estructura del plantel por nivel de cargo, de mayor a menor.
 * Es la pirámide: cuánta base, cuántos Senior, cuántos conduciendo.
 */
function estructuraDelPlantel(personas) {
  const gente = _activos(personas);
  const cuenta = {};
  gente.forEach(c => {
    const k = (c.nivelCargo || c.cargo || '').trim() || 'Sin nivel cargado';
    cuenta[k] = (cuenta[k] || 0) + 1;
  });
  return Object.entries(cuenta)
    .map(([nivel, n]) => ({ nivel, personas: n, parte: gente.length ? n / gente.length : 0 }))
    .sort((a, b) => b.personas - a.personas);
}

/**
 * Qué puesto clave le falta a cada tienda. Los flotantes quedan afuera: no son
 * una tienda y no tienen que tener ni director técnico ni gerente.
 */
function cobertura(estado) {
  const tiendas = (estado.sucursales || []).filter(s => s.tipo !== 'staff');
  const filas = tiendas.map(s => {
    const gente = _activos(s.colaboradores);
    const por = {};
    PUESTOS_CLAVE.forEach(p => { por[p.id] = gente.filter(p.es).length; });
    return {
      id: s.id, sucursal: s.nombre || s.codigo, personas: gente.length, por,
      /* Una tienda sin nadie cargado no es una tienda descubierta: es una
         tienda sin padrón, que es otro problema y se dice distinto. */
      sinPadron: gente.length === 0,
      faltan: gente.length ? PUESTOS_CLAVE.filter(p => !por[p.id]).map(p => p.nombre) : []
    };
  });
  const resumen = PUESTOS_CLAVE.map(p => {
    const conPadron = filas.filter(f => !f.sinPadron);
    const cubiertas = conPadron.filter(f => f.por[p.id]).length;
    return Object.assign({ cubiertas, tiendas: conPadron.length,
      parte: conPadron.length ? cubiertas / conPadron.length : null }, p);
  });
  return { filas, resumen, sinPadron: filas.filter(f => f.sinPadron) };
}

/**
 * Los indicadores del área, todos juntos.
 * `hoyISO` solo para poder fijar el día en las pruebas.
 */
function indicadoresDelArea(estado, hoyISO) {
  const e = estado || {};
  const todas = (e.sucursales || []).flatMap(s => s.colaboradores || []);
  const gente = _activos(todas);

  return {
    composicion: composicionDe(todas, hoyISO),
    /* Dos antigüedades y no una: las farmacias del área se compraron, así que
       mucha gente tiene años reconocidos en su farmacia y poco tiempo bajo
       Farmatodo. Mostrar una sola de las dos cuenta media historia. */
    antiguedad: antiguedadPorBanda(todas, 'fechaIngreso'),
    antiguedadFTD: antiguedadPorBanda(todas, 'fechaIngresoFTD'),
    estructura: estructuraDelPlantel(todas),
    cobertura: cobertura(e),
    /* Los tres que necesitan historia. Devuelven null mientras no haya con
       qué, y la pantalla los lista como pendientes; en cuanto hay un dato,
       aparecen como indicador. Nunca las dos cosas ni ninguna. */
    rotacion: rotacionDelArea(e, hoyISO),
    ausentismo: ausentismoDelArea(e, hoyISO),
    reclamos: reclamosDelArea(e, hoyISO),
    parciales: gente.filter(c => jornadaDeVinculo(c).fte === 0.5).length,
    /* `.noPresencial` y no `esNoPresencial(c)` a secas: devuelve un objeto con
       el motivo adentro, y un objeto siempre es verdadero. Sin el campo, el
       tablero decía que las 136 personas del área tienen bloqueo de título. */
    noPresenciales: gente.filter(c => esNoPresencial(c).noPresencial).length
  };
}

/**
 * Los indicadores que el panel va a poder calcular y hoy no, con qué hay que
 * cargar para que aparezcan. Solo se listan los que todavía no tienen con qué:
 * el que ya se puede calcular sale de la lista solo.
 */
/**
 * El ausentismo de una persona y el de su tienda, sacados del **mismo** cálculo
 * que el del área. Es un buscador, no una cuenta nueva: dos funciones que
 * cuentan lo mismo terminan dando números distintos el día que una cambia, y
 * acá los tres niveles se miran uno al lado del otro.
 */
function ausentismoDe(estado, colaboradorId, sucursalId, hastaISO) {
  const pa = participacionDeAusencias(estado, null, hastaISO);
  const t = pa.tiendas.find(x => x.id === sucursalId) || null;
  const g = t ? (t.gente.find(x => x.id === colaboradorId) || null) : null;
  return { area: pa, tienda: t, persona: g };
}

function loQueFaltaParaMedir(estado, hoyISO) {
  const e = estado || {};
  /* Cada renglón pregunta por **su propio cálculo**, no por si existe el dato
     suelto. Así no puede pasar lo de antes: que el renglón desapareciera de
     acá porque había una baja cargada, sin que apareciera ningún número en su
     lugar. Si el indicador da null, está pendiente; si da número, no. */
  return [
    { id: 'rotacion', nombre: 'Rotación anualizada',
      que: 'Cuánta gente se fue en los últimos doce meses sobre la dotación media, separando renuncias de despidos.',
      necesita: 'Bajas cargadas en la ficha de cada persona.',
      donde: '#/movimientos/bajas', listo: !!rotacionDelArea(e, hoyISO) },
    { id: 'ausentismo', nombre: 'Ausentismo',
      que: 'Días de ausencia sobre días-persona, y cuánto FTE se pierde por eso.',
      necesita: 'Ausencias anotadas con su certificado.',
      donde: '#/diario', listo: !!ausentismoDelArea(e, hoyISO) },
    { id: 'reclamos', nombre: 'Reclamos y cuánto tardan',
      que: 'Cuántos hay abiertos, cuánto tarda en promedio cerrarlos y cuál es el más viejo sin resolver.',
      necesita: 'Reclamos cargados.',
      donde: '#/reclamos', listo: !!reclamosDelArea(e, hoyISO) }
  ];
}

/* El cumplimiento del check list, la distribución del 9-box y el costo sobre
   venta **no se prometen acá**: ya viven donde se cargan —la visita de cada
   tienda y la estadística del mes— y repetirlos en este tablero sería el sexto
   lugar con los mismos números. Lo que sí corresponde es decir dónde están. */
const DONDE_VIVEN_LOS_OTROS = [
  { nombre: 'Cumplimiento del check list', donde: '#/sucursales',
    texto: 'En la visita de cada tienda, con sus 30 puntos y el semáforo.' },
  { nombre: 'Distribución del 9-box', donde: '#/sucursales',
    texto: 'En la solapa Talento y 9-box de la visita.' },
  { nombre: 'Costo laboral sobre venta', donde: '#/estadistica',
    texto: 'En la estadística del mes, con el objetivo y el techo de alerta.' }
];

/* ------------------------ Los que necesitan historia ---------------------- *
 *
 * Éstos también se calculan acá, pero solo dan número cuando hay con qué. La
 * regla que los ordena: **un indicador o está implementado y aparece cuando el
 * dato existe, o no se promete**. La primera versión de esta pantalla los
 * listaba como «ya viene» y, al cargar la primera baja, el renglón desaparecía
 * de la lista sin que apareciera nada en su lugar. Eso es peor que el guión que
 * la lista venía a evitar.
 */

/** Los mismos días del mes, `n` meses atrás. */
function _mesesAtras(iso, n) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1 - n, d)).toISOString().slice(0, 10);
}

function _diasEntreISO(a, b) {
  const ok = x => /^\d{4}-\d{2}-\d{2}$/.test(String(x));
  if (!ok(a) || !ok(b)) return null;
  const d = x => Date.UTC(...x.split('-').map(Number).map((n, i) => i === 1 ? n - 1 : n));
  return Math.round((d(b) - d(a)) / 86400000);
}

/**
 * Rotación de los últimos doce meses: bajas del período sobre la dotación
 * media. Separa renuncias de despidos porque **no son el mismo problema**: una
 * se previene con condiciones de trabajo y la otra es una decisión propia.
 *
 * La dotación media es aproximada —los activos de hoy más la mitad de los que
 * se fueron— porque el panel guarda el plantel de hoy y no la foto de cada mes.
 * La pantalla lo dice: un promedio inventado sobre una serie que no existe
 * sería peor que un número aproximado y anunciado como tal.
 */
/**
 * Desde cuándo miden los indicadores del área.
 *
 * Es el corte del año fiscal que fija el coordinador (`parametros.mideDesde`).
 * La ventana natural de cada indicador —doce meses para la rotación, tres para
 * la participación de ausencias— **no puede arrancar antes**: atrás no hay
 * historia completa y una tasa sobre una serie incompleta es una tasa falsa.
 *
 * Devuelve también `recortada`, para que la pantalla pueda decir que está
 * midiendo un período más corto que el habitual en vez de mostrar un número
 * que se lee como si fuera anual.
 */
function ventanaDeMedicion(estado, desdeNatural, hasta) {
  const corte = (((estado || {}).config || {}).parametros || {}).mideDesde || '';
  const desde = corte && corte > desdeNatural ? corte : desdeNatural;
  return {
    desde, corte,
    recortada: !!corte && corte > desdeNatural,
    dias: Math.max(1, (_diasEntreISO(desde, hasta) || 0) + 1)
  };
}

function rotacionDelArea(estado, hoyISO) {
  const hoy = hoyISO || _diaHoy();
  const v = ventanaDeMedicion(estado, _mesesAtras(hoy, 12), hoy);
  const desde = v.desde;
  const gente = ((estado || {}).sucursales || []).flatMap(s => s.colaboradores || []);
  const conBaja = gente.filter(c => c.baja && c.baja.fecha);
  if (!conBaja.length) return null;

  const delPeriodo = conBaja
    .filter(c => c.baja.fecha >= desde && c.baja.fecha <= hoy)
    .map(c => ({ fecha: c.baja.fecha, grupo: c.baja.grupo || 'Otros',
                 nombre: c.nombre, motivo: c.baja.motivo || '' }));

  const porGrupo = {};
  delPeriodo.forEach(b => { porGrupo[b.grupo] = (porGrupo[b.grupo] || 0) + 1; });
  const activos = gente.filter(c => c.activo !== false).length;
  const media = activos + delPeriodo.length / 2;

  return {
    desde, hasta: hoy, bajas: delPeriodo.length,
    /* Cuántos días cubre de verdad: con el corte del año fiscal recién puesto
       la ventana puede ser de un mes, y una tasa de un mes leída como anual
       exagera. La pantalla lo dice con esto. */
    dias: v.dias, recortada: v.recortada, corte: v.corte,
    tasa: media > 0 ? delPeriodo.length / media : null,
    porGrupo,
    renuncias: porGrupo['Renuncias'] || 0,
    despidos: porGrupo['Despidos'] || 0,
    media,
    ultimas: delPeriodo.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5)
  };
}

/**
 * Ausentismo de los últimos doce meses: días de ausencia sobre días-persona.
 * Cuenta solo lo que ya pasó, como `diasDeAusencia()`, así que una licencia
 * abierta suma hasta hoy y no hasta el alta prevista.
 */
function ausentismoDelArea(estado, hoyISO) {
  const hoy = hoyISO || _diaHoy();
  const v = ventanaDeMedicion(estado, _mesesAtras(hoy, 12), hoy);
  const desde = v.desde;
  const gente = ((estado || {}).sucursales || []).flatMap(s => s.colaboradores || []);
  if (!gente.some(c => (c.ausencias || []).length)) return null;

  let dias = 0;
  const quienes = new Set();
  const porMotivo = {};
  gente.forEach(c => (c.ausencias || []).forEach(a => {
    if (!a.desde || a.desde < desde) return;
    const d = diasDeAusencia(a, hoy);
    if (!d) return;
    dias += d;
    quienes.add(c.id);
    const k = a.motivo || 'sin motivo';
    porMotivo[k] = (porMotivo[k] || 0) + d;
  }));
  if (!dias) return null;

  const activos = gente.filter(c => c.activo !== false).length;
  /* Los días-persona son los de la ventana real, no un año entero: con el
     corte puesto este mes, dividir por 365 daría una tasa diez veces menor de
     la que el período muestra. */
  const diasPersona = activos * v.dias;
  return {
    desde, hasta: hoy, dias, personas: quienes.size,
    diasVentana: v.dias, recortada: v.recortada, corte: v.corte,
    tasa: diasPersona > 0 ? dias / diasPersona : null,
    /* Cuánto trabajo no se prestó, en la unidad en la que se piensa la
       dotación: los días perdidos sobre el período de una persona. */
    fte: dias / v.dias,
    porMotivo
  };
}

/** Reclamos: cuántos hay abiertos y cuánto tardan en cerrarse. */
function reclamosDelArea(estado, hoyISO) {
  const hoy = hoyISO || _diaHoy();
  const todos = ((estado || {}).reclamos || []);
  if (!todos.length) return null;
  const cerrado = r => ((typeof ESTADOS_RECLAMO_POR_ID !== 'undefined'
    && ESTADOS_RECLAMO_POR_ID[r.estado]) || {}).cerrado;
  const abiertos = todos.filter(r => !cerrado(r));
  const demoras = todos.filter(r => cerrado(r) && r.fecha && r.fechaCierre)
    .map(r => _diasEntreISO(r.fecha, r.fechaCierre)).filter(x => x !== null);
  const viejos = abiertos.map(r => _diasEntreISO(r.fecha, hoy))
    .filter(x => x !== null).sort((a, b) => b - a);
  return {
    total: todos.length, abiertos: abiertos.length,
    cerrados: todos.length - abiertos.length,
    demora: demoras.length ? demoras.reduce((a, b) => a + b, 0) / demoras.length : null,
    masViejo: viejos.length ? viejos[0] : null
  };
}

/* ---------------- Participación del ausentismo, en tres niveles ------------
 *
 * La pregunta no es solo «cuánto ausentismo tiene el área» sino **de dónde
 * sale**: qué tiendas aportan la mayor parte y, adentro de una tienda, quiénes.
 * Es lo que convierte un número en una conversación con un gerente.
 *
 * Se cuenta en **días** en los tres niveles, y cada uno trae además su
 * **tasa**: días de ausencia sobre plantel por días de la ventana. La de cada
 * tienda va sobre su propio plantel y no sobre el del área, porque si no una
 * tienda de seis y una de veinte se leerían con la misma vara. Los certificados
 * que no declaran duración se toman como un día, y `diasSupuestos` y
 * `parteSupuesta` dicen qué parte del total viene de ese supuesto.
 *
 * Las **vacaciones no cuentan**: son tiempo planificado y meterlas adentro
 * infla el número con algo que no es un problema.
 */
function participacionDeAusencias(estado, desdeISO, hastaISO) {
  const e = estado || {};
  const hasta = hastaISO || _diaHoy();
  const v = ventanaDeMedicion(e, desdeISO || _mesesAtras(hasta, 3), hasta);
  const desde = v.desde;

  /* El largo de la ventana es el denominador de la tasa: los días de ausencia
     de una persona sobre los días que tuvo el período. */
  const ventana = v.dias;

  const cuenta = () => ({ eventos: 0, dias: 0, diasSupuestos: 0,
                          medidos: 0, supuestos: 0, personas: new Set() });
  const area = cuenta();
  const tiendas = [];
  let plantel = 0;

  (e.sucursales || []).forEach(s => {
    const t = Object.assign({ id: s.id, sucursal: s.nombre || s.codigo, gente: [] }, cuenta());
    const activos = (s.colaboradores || []).filter(c => c.activo !== false).length;
    t.plantel = activos;
    plantel += activos;
    (s.colaboradores || []).forEach(c => {
      const suyas = (c.ausencias || []).filter(a => {
        if (a.cuentaAusentismo === false) return false;
        if (a.motivo === 'vacaciones') return false;
        return a.desde && a.desde >= desde && a.desde <= hasta;
      });
      if (!suyas.length) return;
      const d = suyas.reduce((n, a) => n + (diasDeAusencia(a, hasta) || 0), 0);
      /* Cuántos de esos días salen del papel y cuántos del supuesto de un día:
         el total se lee distinto según de dónde venga. */
      const sup = suyas.filter(a => a.diasSupuestos)
        .reduce((n, a) => n + (diasDeAusencia(a, hasta) || 0), 0);
      const nSup = suyas.filter(a => a.diasSupuestos).length;
      t.gente.push({ id: c.id, nombre: c.nombre, eventos: suyas.length,
                     dias: d, diasSupuestos: sup,
                     medidos: suyas.length - nSup, supuestos: nSup,
                     tasa: d / ventana });
      t.eventos += suyas.length; t.dias += d; t.diasSupuestos += sup;
      t.medidos += suyas.length - nSup; t.supuestos += nSup;
      t.personas.add(c.id);
    });
    if (!t.eventos) return;
    /* Adentro de la tienda, el que más falta primero: es con quien empieza la
       conversación del gerente. */
    /* Se ordena y se reparte por días, igual que las tiendas sobre el área:
       mezclar eventos en un nivel y días en el otro hace que los porcentajes
       de arriba y los de abajo no hablen de lo mismo. */
    t.gente.sort((a, b) => b.dias - a.dias || b.eventos - a.eventos);
    t.gente.forEach(g => { g.parteDeLaTienda = t.dias ? g.dias / t.dias : 0; });
    tiendas.push(t);
    area.eventos += t.eventos; area.dias += t.dias;
    area.diasSupuestos += t.diasSupuestos;
    area.medidos += t.medidos; area.supuestos += t.supuestos;
    t.personas.forEach(x => area.personas.add(x));
  });

  tiendas.sort((a, b) => b.dias - a.dias || b.eventos - a.eventos);
  tiendas.forEach(t => {
    t.parteDelArea = area.dias ? t.dias / area.dias : 0;
    t.personas = t.personas.size;
    /* La tasa de la tienda va sobre su propio plantel, no sobre el del área:
       si no, una tienda chica con mucha ausencia parecería sana. */
    t.tasa = t.plantel ? t.dias / (t.plantel * ventana) : null;
  });

  return {
    desde, hasta, ventana, plantel,
    /* El corte del año fiscal recortó la ventana: la pantalla lo dice para que
       nadie lea tres meses donde hay veinticinco días. */
    recortada: v.recortada, corte: v.corte,
    eventos: area.eventos, dias: area.dias,
    diasSupuestos: area.diasSupuestos,
    medidos: area.medidos, supuestos: area.supuestos,
    personas: area.personas.size,
    /* El porcentaje del área: días de ausencia sobre días-persona del período.
       Se puede dar porque los certificados sin duración se toman como un día;
       `parteSupuesta` dice cuánto del total viene de ese supuesto, para que el
       número nunca se lea como si estuviera todo medido. */
    tasa: plantel ? area.dias / (plantel * ventana) : null,
    parteSupuesta: area.dias ? area.diasSupuestos / area.dias : null,
    tiendas
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BANDAS_ANTIGUEDAD, PUESTOS_CLAVE,
    antiguedadPorBanda, estructuraDelPlantel, cobertura,
    indicadoresDelArea, loQueFaltaParaMedir,
    rotacionDelArea, ausentismoDelArea, reclamosDelArea, DONDE_VIVEN_LOS_OTROS,
    participacionDeAusencias, ausentismoDe, ventanaDeMedicion
  };
}

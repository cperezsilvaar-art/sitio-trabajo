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
function loQueFaltaParaMedir(estado) {
  const e = estado || {};
  const gente = (e.sucursales || []).flatMap(s => s.colaboradores || []);
  const hay = {
    bajas: gente.filter(c => c.baja).length,
    ausencias: gente.reduce((n, c) => n + (c.ausencias || []).length, 0),
    visitas: (e.visitas || []).length,
    evaluados: gente.filter(c => c.desempeno && c.potencial).length,
    reclamos: (e.reclamos || []).length
  };
  return [
    { id: 'rotacion', nombre: 'Rotación anualizada',
      que: 'Cuánta gente se fue en los últimos doce meses sobre la dotación media, separando renuncias de despidos.',
      necesita: 'Bajas cargadas en la ficha de cada persona.',
      donde: '#/movimientos/bajas', listo: hay.bajas > 0, tiene: hay.bajas },
    { id: 'ausentismo', nombre: 'Ausentismo',
      que: 'Días de ausencia sobre días de vínculo, y cuánto FTE se pierde por eso.',
      necesita: 'Ausencias anotadas con su certificado.',
      donde: '#/diario', listo: hay.ausencias > 0, tiene: hay.ausencias },
    { id: 'checklist', nombre: 'Cumplimiento del check list',
      que: 'Qué porcentaje de los 30 puntos aprueba cada tienda y cuáles fallan siempre.',
      necesita: 'Visitas registradas con su check list.',
      donde: '#/sucursales', listo: hay.visitas > 0, tiene: hay.visitas },
    { id: 'talento', nombre: 'Distribución del 9-box',
      que: 'Cuánta gente hay en cada cuadrante y cuántos quedan sin evaluar.',
      necesita: 'Desempeño y potencial cargados en la visita.',
      donde: '#/sucursales', listo: hay.evaluados > 0, tiene: hay.evaluados },
    { id: 'reclamos', nombre: 'Reclamos y cuánto tardan',
      que: 'Cuántos se abren por mes, de qué tipo y cuántos días tardan en cerrarse.',
      necesita: 'Reclamos cargados.',
      donde: '#/reclamos', listo: hay.reclamos > 0, tiene: hay.reclamos },
    { id: 'costo', nombre: 'Costo laboral sobre venta',
      que: 'El costo del mes cerrado contra la venta neta, con el objetivo y el techo de alerta.',
      necesita: 'La estadística del mes, con costos y venta.',
      donde: '#/estadistica', listo: false, tiene: 0 }
  ];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BANDAS_ANTIGUEDAD, PUESTOS_CLAVE,
    antiguedadPorBanda, estructuraDelPlantel, cobertura,
    indicadoresDelArea, loQueFaltaParaMedir
  };
}

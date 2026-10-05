/*
 * reclamos.js — Registro de reclamos y consultas de los colaboradores.
 *
 * Lo que la gente le plantea al coordinador cuando va a la tienda: una hora
 * extra que no se pagó, un adicional nocturno que falta, una categoría que no
 * corresponde. Se dice de palabra, en el pasillo, y se pierde.
 *
 * Un reclamo NO es parte de la visita: se abre en una visita pero vive hasta
 * que se resuelve, y casi nunca se resuelve el mismo día. Por eso se guarda
 * aparte, con su propio estado y su propio reloj.
 *
 * El reloj importa: un reclamo salarial sin respuesta no se apaga solo, se
 * convierte en un telegrama. Lo que rompe la confianza no suele ser el "no":
 * es el silencio.
 */

/* Los reclamos que aparecen de verdad en una farmacia. La lista es cerrada
   para poder contarlos: si todo cae en "otro", no se puede ver el patrón. */
const TIPOS_RECLAMO = [
  { id: 'horasExtras',   nombre: 'Horas extras no liquidadas',        grupo: 'Liquidación' },
  { id: 'nocturno',      nombre: 'Adicional nocturno',                grupo: 'Liquidación' },
  { id: 'feriado',       nombre: 'Feriado trabajado',                 grupo: 'Liquidación' },
  { id: 'presentismo',   nombre: 'Presentismo descontado',            grupo: 'Liquidación' },
  { id: 'francos',       nombre: 'Francos no compensados',            grupo: 'Liquidación' },
  { id: 'vacaciones',    nombre: 'Vacaciones o plus vacacional',      grupo: 'Liquidación' },
  { id: 'sac',           nombre: 'SAC / aguinaldo',                   grupo: 'Liquidación' },
  { id: 'descuento',     nombre: 'Descuento indebido (faltante de caja u otro)', grupo: 'Liquidación' },
  { id: 'categoria',     nombre: 'Categoría de convenio',             grupo: 'Encuadre' },
  { id: 'antiguedad',    nombre: 'Antigüedad mal computada',          grupo: 'Encuadre' },
  { id: 'aumento',       nombre: 'Aumento de convenio no aplicado',   grupo: 'Encuadre' },
  { id: 'asignaciones',  nombre: 'Asignaciones familiares',           grupo: 'Encuadre' },
  { id: 'obraSocial',    nombre: 'Obra social o ART',                 grupo: 'Beneficios' },
  { id: 'uniforme',      nombre: 'Uniforme o elementos de trabajo',   grupo: 'Beneficios' },
  { id: 'otro',          nombre: 'Otro',                              grupo: 'Otros' }
];

const TIPOS_RECLAMO_POR_ID = TIPOS_RECLAMO.reduce((m, x) => { m[x.id] = x; return m; }, {});

/* El estado dice en qué punto del circuito está, y `cerrado` si ya terminó.
   "Procede" todavía está abierto: se cierra cuando el ajuste está pagado. */
const ESTADOS_RECLAMO = [
  { id: 'abierto',    nombre: 'Recibido',                   cerrado: false },
  { id: 'analisis',   nombre: 'En análisis',                cerrado: false },
  { id: 'nomina',     nombre: 'Escalado a Nómina',          cerrado: false },
  { id: 'faltaInfo',  nombre: 'Falta información',          cerrado: false },
  { id: 'procede',    nombre: 'Procede: se ajusta',         cerrado: false },
  { id: 'ajustado',   nombre: 'Ajustado y pagado',          cerrado: true },
  { id: 'sinLugar',   nombre: 'No procede, ya se explicó',  cerrado: true }
];

const ESTADOS_RECLAMO_POR_ID = ESTADOS_RECLAMO.reduce((m, x) => { m[x.id] = x; return m; }, {});

const A_CARGO_RECLAMO = [
  { id: 'rrhh',        nombre: 'RRHH' },
  { id: 'nomina',      nombre: 'Nómina / Liquidaciones' },
  { id: 'tienda',      nombre: 'Gerente de Tienda' },
  { id: 'operaciones', nombre: 'Operaciones' }
];

/** Días que lleva abierto un reclamo. */
function diasDeReclamo(r, hasta) {
  if (!r || !r.fecha) return null;
  const fin = (ESTADOS_RECLAMO_POR_ID[r.estado] || {}).cerrado && r.fechaCierre
    ? r.fechaCierre : (hasta || new Date().toISOString().slice(0, 10));
  const d = Math.round((new Date(fin) - new Date(r.fecha)) / 86400000);
  return isNaN(d) ? null : Math.max(0, d);
}

/**
 * Semáforo por antigüedad del reclamo.
 *
 * Los cortes son de gestión, no legales: a los siete días el colaborador
 * espera una respuesta, a los quince ya está preguntando a otros, y al mes
 * dejó de preguntar, que es la señal peor.
 */
function semaforoReclamo(r) {
  const est = ESTADOS_RECLAMO_POR_ID[r.estado] || {};
  if (est.cerrado) return { clave: 'cerrado', tono: '', texto: est.nombre };
  const d = diasDeReclamo(r);
  if (d === null) return { clave: 'sd', tono: 'ambar', texto: 'sin fecha' };
  if (d <= 7)  return { clave: 'nuevo',   tono: 'verde', texto: `hace ${d} día${d === 1 ? '' : 's'}` };
  if (d <= 15) return { clave: 'demora',  tono: 'ambar', texto: `hace ${d} días` };
  return { clave: 'critico', tono: 'rojo', texto: `hace ${d} días` };
}

/** Consolidado de una lista de reclamos. */
function resumirReclamos(lista) {
  const todos = lista || [];
  const abiertos = todos.filter(r => !(ESTADOS_RECLAMO_POR_ID[r.estado] || {}).cerrado);
  const cerrados = todos.filter(r => (ESTADOS_RECLAMO_POR_ID[r.estado] || {}).cerrado);

  const porTipo = {};
  todos.forEach(r => { porTipo[r.tipo] = (porTipo[r.tipo] || 0) + 1; });

  const porEstado = {};
  todos.forEach(r => { porEstado[r.estado] = (porEstado[r.estado] || 0) + 1; });

  const criticos = abiertos.filter(r => semaforoReclamo(r).clave === 'critico');
  const sinRespuesta = abiertos.filter(r => !String(r.respuesta || '').trim());
  const monto = abiertos.reduce((a, r) => a + (parseFloat(String(r.monto).replace(',', '.')) || 0), 0);

  /* El tipo que más se repite es el dato que sirve: tres reclamos por el mismo
     concepto en la misma tienda no son tres reclamos, son un error de proceso. */
  const top = Object.keys(porTipo)
    .map(t => ({ tipo: t, n: porTipo[t], nombre: (TIPOS_RECLAMO_POR_ID[t] || {}).nombre || t }))
    .sort((a, b) => b.n - a.n)[0] || null;

  const cerradosConFecha = cerrados.filter(r => r.fecha && r.fechaCierre);
  const demoraPromedio = cerradosConFecha.length
    ? cerradosConFecha.reduce((a, r) => a + diasDeReclamo(r), 0) / cerradosConFecha.length
    : null;

  return {
    total: todos.length,
    abiertos, cerrados,
    criticos, sinRespuesta,
    porTipo, porEstado, top,
    montoAbierto: monto,
    demoraPromedio,
    resueltosAFavor: cerrados.filter(r => r.estado === 'ajustado').length
  };
}

/** Patrones que conviene mirar: mismo tipo repetido en la misma sucursal. */
function patronesDeReclamos(lista, sucursales) {
  const porSuc = {};
  (lista || []).forEach(r => {
    const k = r.sucursalId + '|' + r.tipo;
    (porSuc[k] || (porSuc[k] = [])).push(r);
  });
  return Object.keys(porSuc)
    .filter(k => porSuc[k].length >= 2)
    .map(k => {
      const [sucursalId, tipo] = k.split('|');
      const suc = (sucursales || []).find(s => s.id === sucursalId);
      return {
        sucursal: suc ? (suc.nombre || suc.codigo) : 'Sin sucursal',
        tipo: (TIPOS_RECLAMO_POR_ID[tipo] || {}).nombre || tipo,
        casos: porSuc[k].length,
        personas: porSuc[k].map(r => r.colaborador).filter((x, i, a) => x && a.indexOf(x) === i)
      };
    })
    .sort((a, b) => b.casos - a.casos);
}

/* ===================================================================== *
 *  Lo que manda el anexo de los gerentes
 * ===================================================================== *
 *
 * El anexo (`anexo-gerentes.html`) no tiene servidor y no lo va a tener: el
 * panel es un archivo que abre en el navegador del coordinador. Así que el dato
 * viaja por donde ya viajaba —un mensaje— y lo único que cambió es que ahora
 * llega ordenado. Lo que molestaba no era el WhatsApp: era recibir «cris
 * fulanito de tal cobró mal».
 *
 * El formato es una línea por dato con la clave adelante. Se lee bien en el
 * chat, que es la mitad del punto —si el mensaje fuera un bloque cifrado, el
 * gerente no sabría qué está mandando— y se parsea sin ambigüedad.
 *
 * La primera línea es la marca, y es también por donde se parte cuando se pegan
 * varios de una: el coordinador junta los de la mañana y los pega todos juntos.
 */

const MARCA_ANEXO = '#RRHH3';

/* Las tres ramas del anexo y dónde cae cada una. `RECLAMO` es un reclamo;
   `LEGAL` y `SITUACION` son casos, porque una carta documento y un desempeño
   que no levanta son seguimientos y no un pedido de plata. El gerente no tiene
   por qué saber que del lado del panel viven en dos lugares. */
const RAMAS_ANEXO = {
  RECLAMO:   { destino: 'reclamo', nombre: 'Reclamo de liquidación' },
  LEGAL:     { destino: 'caso', tipoCaso: 'legal', nombre: 'Carta documento o intimación' },
  SITUACION: { destino: 'caso', nombre: 'Situación para seguir' }
};

/** Sin acentos y en mayúsculas, para comparar lo que alguien escribió a mano. */
function _llanoAnexo(x) {
  return String(x == null ? '' : x).normalize('NFD')
    .replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

/**
 * Los reportes que vengan adentro de un texto pegado.
 *
 * Devuelve `{ reportes[], sobras }`: lo que no arrancó con la marca se cuenta
 * en `sobras` en vez de hacerse pasar por un reporte. Pegar la conversación
 * entera, con los «hola Cris» del medio, tiene que funcionar.
 */
function leerReportesDeGerentes(texto) {
  const crudo = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n');

  /* WhatsApp escribe en negrita con asteriscos y, si en vez de copiar el
     mensaje se exporta el chat, le pone «[2/10/26, 15:30] Juan Gómez: » a cada
     línea. Las dos cosas se sacan antes de mirar el contenido: el gerente no
     tiene que saber de qué manera copiar. */
  const lineas = crudo.split('\n').map(l => l
    .replace(/^\s*\[[^\]]{4,40}\]\s*[^:]{1,60}:\s*/, '')
    .replace(/\*/g, '')
    .trim());

  const reportes = [];
  let actual = null;
  let sobras = 0;

  lineas.forEach(linea => {
    const marca = linea.match(new RegExp('^' + MARCA_ANEXO + '\\s+([A-Z]+)\\s*$', 'i'));
    if (marca) {
      const rama = marca[1].toUpperCase();
      actual = { rama, campos: {}, valida: !!RAMAS_ANEXO[rama], crudo: linea };
      reportes.push(actual);
      return;
    }
    if (!linea) return;
    if (!actual) { sobras++; return; }

    const par = linea.match(/^([^:]{2,30}):\s*(.*)$/);
    /* Una línea que no tiene la forma `Clave: valor` no es un dato del aviso:
       es el «hola cris, te mando esto» del medio. Se cuenta como sobra —para
       poder decir cuánto se ignoró— pero se conserva en el crudo, que es lo
       que se le muestra cuando algo no entró. */
    if (!par) { actual.crudo += '\n' + linea; sobras++; return; }
    /* «Fecha de llegada» y «Período» se normalizan a `fechadellegada` y
       `periodo`: sin acentos, sin espacios y en minúsculas. La clave
       la escribe la plantilla, pero un acento perdido en el camino no tiene
       por qué costar una fila. */
    const clave = _llanoAnexo(par[1]).replace(/[^A-Z]/g, '').toLowerCase();
    actual.campos[clave] = par[2].trim();
    actual.crudo += '\n' + linea;
  });

  return { reportes, sobras };
}

/**
 * El tipo de reclamo que corresponde a lo que el anexo escribió.
 *
 * Compara contra `TIPOS_RECLAMO`, que es la única lista: el anexo se genera
 * desde ahí, así que lo normal es que coincida exacto. Si no coincide —porque
 * la lista cambió después de repartir el link— cae en `otro` en vez de
 * perderse, y el nombre original queda escrito en el detalle. Que el reclamo
 * exista importa más que su etiqueta.
 */
function tipoDeReclamoPorNombre(nombre) {
  const q = _llanoAnexo(nombre);
  if (!q) return '';
  const exacto = TIPOS_RECLAMO.find(t => _llanoAnexo(t.nombre) === q);
  if (exacto) return exacto.id;
  const parcial = TIPOS_RECLAMO.find(t => _llanoAnexo(t.nombre).indexOf(q) === 0);
  return parcial ? parcial.id : 'otro';
}

/** Lo mismo para los tipos de caso. */
function tipoDeCasoPorNombre(nombre) {
  const q = _llanoAnexo(nombre);
  if (!q || typeof TIPOS_CASO === 'undefined') return 'otro';
  const exacto = TIPOS_CASO.find(t => _llanoAnexo(t.nombre) === q);
  return exacto ? exacto.id : 'otro';
}

/* ===================================================================== *
 *  Leer el WhatsApp que llegó
 * ===================================================================== *
 *
 * El coordinador decidió seguir recibiendo los avisos como siempre y cargarlos
 * él. Eso tiene un costo que el anexo no tenía: lo que queda registrado es su
 * reconstrucción y no la palabra del gerente, y para el reclamo que termina en
 * un telegrama «lo informó Juan Gómez el 02/10» no es la misma prueba que
 * «Christian anotó que alguien le dijo».
 *
 * Se arregla barato: **que pegue el mensaje tal como llegó**. Queda textual, y
 * de paso el panel lo lee y propone el concepto y la persona.
 *
 * **Propone, no decide.** El que confirma es el coordinador, porque un mensaje
 * de WhatsApp es prosa y adivinar mal el concepto ensucia justamente el número
 * que se le va a llevar a Nómina.
 */

/**
 * Las palabras con las que cada concepto aparece escrito en un WhatsApp.
 *
 * No reemplaza a `TIPOS_RECLAMO`: la completa. Los `id` son los de esa lista
 * —si uno no coincide, el chequeo de abajo lo grita— y lo que se agrega acá es
 * cómo lo escribe un gerente apurado, que no es el nombre formal del concepto:
 * nadie tipea «Adicional nocturno», tipea «el nocturno».
 */
const PALABRAS_DE_RECLAMO = {
  horasExtras:  ['hora extra', 'horas extra', 'extras', 'he al 50', 'he al 100', 'hs extra'],
  nocturno:     ['nocturno', 'nocturnidad', 'turno noche'],
  feriado:      ['feriado', 'feriados'],
  presentismo:  ['presentismo', 'presentisimo'],
  francos:      ['franco', 'francos', 'dia franco'],
  vacaciones:   ['vacacion', 'vacaciones', 'plus vacacional'],
  sac:          ['aguinaldo', 'sac', 'medio aguinaldo'],
  descuento:    ['descuento', 'descontaron', 'descontado', 'faltante', 'faltante de caja'],
  categoria:    ['categoria', 'recategorizacion', 'encuadre'],
  antiguedad:   ['antiguedad', 'años de antiguedad'],
  aumento:      ['aumento', 'paritaria', 'escala', 'basico nuevo'],
  asignaciones: ['asignacion', 'asignaciones', 'salario familiar', 'anses', 'suaf'],
  obraSocial:   ['obra social', 'osfarm', 'aseguradora', 'art'],
  uniforme:     ['uniforme', 'chaqueta', 'calzado', 'zapatos', 'ambo']
};

/* Un `id` que no esté en `TIPOS_RECLAMO` sería una palabra que nunca propone
   nada, y nadie se enteraría. Se grita al cargar. */
Object.keys(PALABRAS_DE_RECLAMO).forEach(id => {
  if (!TIPOS_RECLAMO_POR_ID[id]) {
    console.error('PALABRAS_DE_RECLAMO tiene un concepto que no existe en TIPOS_RECLAMO:', id);
  }
});

const _MESES_RECLAMO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                        'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Lo que se puede sacar de un mensaje pegado, para proponérselo.
 *
 * Devuelve `{ tipo, periodo, monto, detalle, pistas[] }`. `pistas` dice **por
 * qué** propuso cada cosa: sin eso el coordinador tiene que confiar a ciegas en
 * una adivinanza, y una adivinanza sin su motivo al lado se acepta de apuro.
 *
 * El nombre de la persona **no lo resuelve esta función**: lo hace
 * `buscadorDePadron()` desde `store.js`, que es el único emparejamiento del
 * panel. Acá no se escribe un segundo criterio.
 */
function leerMensajeDeReclamo(texto) {
  const crudo = String(texto == null ? '' : texto).replace(/\r\n?/g, '\n').trim();
  const out = { tipo: '', periodo: '', monto: '', detalle: crudo, pistas: [] };
  if (!crudo) return out;

  /* Si pegó la conversación exportada, cada línea trae «[2/10, 15:30] Juan: ».
     Se saca para leer, pero **el detalle guarda el crudo**: lo que el gerente
     escribió, con su hora y su nombre, es parte de la prueba. */
  const plano = _llanoAnexo(crudo.split('\n')
    .map(l => l.replace(/^\s*\[[^\]]{4,40}\]\s*[^:]{1,60}:\s*/, ''))
    .join(' ')).toLowerCase();

  /* El concepto: la palabra más larga que aparezca gana. «hora extra» tiene que
     ganarle a «extras» cuando están las dos, porque es la más específica. */
  let mejor = null;
  Object.keys(PALABRAS_DE_RECLAMO).forEach(id => {
    PALABRAS_DE_RECLAMO[id].forEach(p => {
      /* Con borde de palabra: «art» no puede salir de «cuarto» ni «sac» de
         «sacaron», que es exactamente el falso positivo que haría que un
         reclamo de francos se cuente como aguinaldo. */
      const re = new RegExp('(^|[^a-z0-9])' + p.replace(/ /g, '[ -]?') + '([^a-z0-9]|$)');
      if (re.test(plano) && (!mejor || p.length > mejor.palabra.length)) {
        mejor = { id, palabra: p };
      }
    });
  });
  if (mejor) {
    out.tipo = mejor.id;
    out.pistas.push(`el concepto sale de «${mejor.palabra}»`);
  }

  /* El período: un mes escrito con nombre, o 09/2026. */
  const conNombre = _MESES_RECLAMO.findIndex(m => plano.indexOf(m) >= 0);
  const anio = (plano.match(/\b(20\d\d)\b/) || [])[1] || '';
  if (conNombre >= 0) {
    out.periodo = _MESES_RECLAMO[conNombre] + (anio ? ' ' + anio : '');
    out.pistas.push(`el período sale de «${_MESES_RECLAMO[conNombre]}»`);
  } else {
    const numerico = plano.match(/\b(0?[1-9]|1[0-2])\s*\/\s*(20\d\d)\b/);
    if (numerico) {
      out.periodo = _MESES_RECLAMO[Number(numerico[1]) - 1] + ' ' + numerico[2];
      out.pistas.push(`el período sale de «${numerico[0]}»`);
    }
  }

  /* El monto: solo si viene con signo de pesos o la palabra. Un número suelto
     puede ser una cantidad de horas o un día del mes, y meterlo como plata
     inventa una cifra que después se suma en el reporte de Nómina. */
  const plata = crudo.match(/\$\s*([\d.,]+)|([\d.,]{4,})\s*pesos/i);
  if (plata) {
    const bruto = (plata[1] || plata[2] || '').replace(/\./g, '').replace(',', '.');
    if (bruto && !isNaN(parseFloat(bruto))) {
      out.monto = String(parseFloat(bruto));
      out.pistas.push(`el monto sale de «${plata[0].trim()}»`);
    }
  }

  return out;
}

/* ===================================================================== *
 *  De dónde vienen los reclamos
 * ===================================================================== *
 *
 * Esto es lo que se lleva a una reunión con Nómina, y la razón por la que el
 * coordinador quiso el anexo: **un reclamo suelto es un trámite; el mismo
 * concepto repetido es un proceso roto.**
 *
 * `patronesDeReclamos()` ya miraba una parte —mismo tipo repetido en la misma
 * sucursal— y se queda, porque contesta «qué tienda mirar». Lo que faltaba es
 * la otra mitad, que es la que cambia de quién es el problema:
 *
 * - un concepto que aparece en **varias tiendas** es de **Nómina**: así se
 *   liquida en todas partes, y no son cinco errores sueltos;
 * - un concepto concentrado en **una tienda** es de **esa tienda**: cómo carga
 *   o cómo comunica;
 * - un concepto que vuelve en **períodos distintos** no se corrigió, y eso es
 *   peor que su cantidad;
 * - y un concepto donde la mayoría **no procede** no es un problema de
 *   liquidación sino **de explicación**: la gente no entiende su recibo. Ese es
 *   el que más se malinterpreta, porque «no procede» se lee como «reclamo
 *   infundado» cuando en realidad dice que alguien no pudo leer su propio
 *   recibo y nadie se lo explicó.
 */

/* Cuántas tiendas distintas hacen que un concepto deje de ser de una tienda y
   pase a ser del proceso. Con dos todavía puede ser casualidad; con tres ya es
   cómo se liquida. No es un umbral estadístico: es cuándo conviene sentarse con
   Nómina en vez de con un gerente. */
const TIENDAS_PARA_SER_DE_NOMINA = 3;

/** El período de liquidación al que apunta un reclamo. */
function periodoReclamado(r, parametros) {
  /* `periodoAfectado` es texto libre —«septiembre 2026»— porque lo escribe
     quien carga. Se intenta leer, y si no se entiende se cae en la fecha en que
     se planteó, que siempre está. Nunca se inventa: el que no se pudo ubicar
     se cuenta aparte en vez de ensuciar un período ajeno. */
  const t = _llanoAnexo(r && r.periodoAfectado).toLowerCase();
  const mes = _MESES_RECLAMO.findIndex(m => t.indexOf(m) >= 0);
  const anio = (t.match(/\b(20\d\d)\b/) || [])[1];
  if (mes >= 0 && anio) return `${anio}-${String(mes + 1).padStart(2, '0')}`;
  if (r && /^\d{4}-\d{2}-\d{2}$/.test(String(r.fecha || '')) &&
      typeof periodoDeFecha === 'function') {
    return periodoDeFecha(r.fecha, parametros);
  }
  return '';
}

/**
 * El origen de los reclamos: por concepto y por tienda, con el veredicto.
 *
 * `{ total, monto, porConcepto[], porTienda[], cerrados, procedieron,
 *    noProcedieron, diasPromedio, periodos[] }`
 *
 * Los porcentajes se calculan **sobre los cerrados** y la pantalla dice
 * cuántos siguen abiertos: «el 70% no procedió» con la mitad sin resolver no es
 * un 70%. Es la misma regla que los días supuestos del ausentismo.
 */
function origenDeReclamos(estado, lista, parametros) {
  const e = estado || {};
  const todos = (lista || e.reclamos || []).slice();
  const cerrado = r => (ESTADOS_RECLAMO_POR_ID[r.estado] || {}).cerrado;
  const plata = r => {
    const n = parseFloat(String(r.monto == null ? '' : r.monto).replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };
  const nombreSuc = id => {
    const s = (e.sucursales || []).find(x => x.id === id);
    return s ? (s.nombre || s.codigo) : 'Sin tienda';
  };

  const porConcepto = [];
  const porTienda = [];
  const periodos = new Set();

  TIPOS_RECLAMO.forEach(t => {
    const suyos = todos.filter(r => r.tipo === t.id);
    if (!suyos.length) return;
    const tiendas = [...new Set(suyos.map(r => r.sucursalId).filter(Boolean))];
    const peris = [...new Set(suyos.map(r => periodoReclamado(r, parametros)).filter(Boolean))].sort();
    peris.forEach(p => periodos.add(p));
    const cerr = suyos.filter(cerrado);
    const proc = cerr.filter(r => r.estado === 'ajustado');
    const noProc = cerr.filter(r => r.estado === 'sinLugar');

    /* El veredicto. El orden importa: lo de Nómina primero porque es lo que se
       escala, y «no se corrigió» gana sobre todo lo demás porque un concepto
       que vuelve es peor que uno más grande que pasó una vez. */
    let de = 'pocos', porque = 'son casos sueltos, todavía no hay patrón';
    if (peris.length >= 2 && suyos.length >= 2) {
      de = 'sinCorregir';
      porque = `volvió en ${peris.length} períodos: la primera vez no se corrigió`;
    } else if (tiendas.length >= TIENDAS_PARA_SER_DE_NOMINA) {
      de = 'nomina';
      porque = `aparece en ${tiendas.length} tiendas: no son ${suyos.length} errores, es cómo se liquida`;
    } else if (tiendas.length === 1 && suyos.length >= 2) {
      de = 'tienda';
      porque = `los ${suyos.length} son de ${nombreSuc(tiendas[0])}: mirá cómo se carga ahí`;
    }
    /* La explicación gana sobre el resto cuando hay con qué afirmarlo: si la
       mayoría de los resueltos no procedía, la liquidación estaba bien y lo que
       falló fue que nadie supo leer el recibo. */
    if (cerr.length >= 2 && noProc.length > cerr.length / 2) {
      de = 'explicacion';
      porque = `${noProc.length} de ${cerr.length} resueltos no procedían: ` +
               'la liquidación estaba bien y lo que falta es explicar el recibo';
    }

    porConcepto.push({
      tipo: t.id, nombre: t.nombre, grupo: t.grupo,
      casos: suyos.length, tiendas: tiendas.length,
      nombresTiendas: tiendas.map(nombreSuc),
      periodos: peris, monto: suyos.reduce((a, r) => a + plata(r), 0),
      abiertos: suyos.length - cerr.length,
      procedieron: proc.length, noProcedieron: noProc.length,
      de, porque
    });
  });

  (e.sucursales || []).forEach(s => {
    const suyos = todos.filter(r => r.sucursalId === s.id);
    if (!suyos.length) return;
    const cerr = suyos.filter(cerrado);
    const dias = cerr.map(r => typeof diasDeReclamo === 'function'
      ? diasDeReclamo(r, r.fechaCierre || undefined) : null).filter(x => x != null);
    porTienda.push({
      sucursalId: s.id, sucursal: s.nombre || s.codigo,
      casos: suyos.length, abiertos: suyos.length - cerr.length,
      monto: suyos.reduce((a, r) => a + plata(r), 0),
      conceptos: [...new Set(suyos.map(r => (TIPOS_RECLAMO_POR_ID[r.tipo] || {}).nombre || r.tipo))],
      procedieron: cerr.filter(r => r.estado === 'ajustado').length,
      noProcedieron: cerr.filter(r => r.estado === 'sinLugar').length,
      diasPromedio: dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null,
      personas: [...new Set(suyos.map(r => r.colaborador).filter(Boolean))]
    });
  });

  const cerr = todos.filter(cerrado);
  const dias = cerr.map(r => typeof diasDeReclamo === 'function'
    ? diasDeReclamo(r, r.fechaCierre || undefined) : null).filter(x => x != null);

  return {
    total: todos.length,
    monto: todos.reduce((a, r) => a + plata(r), 0),
    cerrados: cerr.length,
    abiertos: todos.length - cerr.length,
    procedieron: cerr.filter(r => r.estado === 'ajustado').length,
    noProcedieron: cerr.filter(r => r.estado === 'sinLugar').length,
    diasPromedio: dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null,
    periodos: [...periodos].sort(),
    /* Lo que se escala primero arriba: no se corrigió, después Nómina. */
    porConcepto: porConcepto.sort((a, b) => {
      const peso = x => ({ sinCorregir: 0, nomina: 1, explicacion: 2, tienda: 3, pocos: 4 })[x.de];
      return peso(a) - peso(b) || b.casos - a.casos;
    }),
    porTienda: porTienda.sort((a, b) => b.casos - a.casos)
  };
}

/* Cómo se lee cada veredicto y de quién es el problema. */
const DE_QUIEN_ES = {
  sinCorregir: { nombre: 'No se corrigió', tono: 'rojo',  quien: 'Nómina' },
  nomina:      { nombre: 'Es de Nómina',   tono: 'rojo',  quien: 'Nómina' },
  explicacion: { nombre: 'Falta explicar', tono: 'ambar', quien: 'RRHH y el gerente' },
  tienda:      { nombre: 'Es de la tienda', tono: 'ambar', quien: 'el Gerente de Tienda' },
  pocos:       { nombre: 'Casos sueltos',  tono: '',      quien: '—' }
};

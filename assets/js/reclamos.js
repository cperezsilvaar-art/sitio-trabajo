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
    /* «Legajo/DNI» y «Período» se normalizan a `legajo` y `periodo`: la clave
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

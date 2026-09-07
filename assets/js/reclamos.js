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

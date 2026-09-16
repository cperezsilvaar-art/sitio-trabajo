/* ===================== REPORTE DIARIO DE OPERACIÓN =====================
 *
 * La estadística mensual mide el mes que cerró. Este módulo mide el día que
 * pasó, que es la única escala en la que todavía se puede hacer algo: si hoy
 * faltaron tres personas en una tienda de ocho, la decisión es de hoy a la
 * mañana, no del informe del mes que viene.
 *
 * Las fórmulas son deliberadamente simples —división de enteros, sin
 * prorrateos— porque el dato de entrada es un llamado telefónico, no una
 * liquidación. La precisión fina se paga al cierre del mes.
 */

/* Formateo local en es-AR: los mensajes del día se leen en el teléfono, no en
   una planilla, y "25.0%" ahí se lee como un error de tipeo. */
const _pctDia = (n, d = 1) =>
  (Number(n) * 100).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';

/** Suma segura de un campo numérico cargado a mano (viene como texto). */
function _num(v) {
  if (v === '' || v === null || v === undefined) return 0;
  const n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

/**
 * KPIs del día para una sucursal.
 *
 * @param d   carga del día para esa sucursal
 * @param par parámetros de configuración (jornada, umbrales)
 */
function calcularDiarioSucursal(d, par) {
  const p = Object.assign({}, PARAMETROS_DEFECTO, par || {});
  const dato = d || {};

  const planificados = _num(dato.planificados);
  const ausentes = Array.isArray(dato.ausentes) ? dato.ausentes.length : 0;
  /* Los presentes se deducen: en la tienda se cuenta quién falta, no quién
     vino. Si el gerente carga los presentes a mano, ese número manda. */
  const presentes = dato.presentes === '' || dato.presentes === undefined || dato.presentes === null
    ? Math.max(0, planificados - ausentes)
    : _num(dato.presentes);
  const minimo = _num(dato.minimo);
  const horasExtras = _num(dato.horasExtras);
  const horasOrdinarias = dato.horasOrdinarias === '' || dato.horasOrdinarias === undefined || dato.horasOrdinarias === null
    ? planificados * p.horasJornada
    : _num(dato.horasOrdinarias);
  const novedades = Array.isArray(dato.novedades) ? dato.novedades.length : 0;

  const controlables = (dato.ausentes || []).filter(a => {
    const m = MOTIVOS_AUSENCIA_DIA.find(x => x.id === a.motivo);
    return m && m.grupo === 'controlable';
  }).length;

  return {
    planificados, presentes, ausentes, minimo, horasExtras, horasOrdinarias,
    novedades, controlables,
    /* Tasa de ausentismo diario = ausentes / dotación planificada */
    pctAusentismo: planificados ? ausentes / planificados : null,
    /* Proporción de horas extras = extras / ordinarias planificadas */
    pctExtras: horasOrdinarias ? horasExtras / horasOrdinarias : null,
    /* FTE real del día = planificados − ausentes + extras/jornada */
    fteReal: planificados ? planificados - ausentes + horasExtras / p.horasJornada : null,
    /* Índice de cobertura = presentes / mínimo requerido para operar */
    cobertura: minimo ? presentes / minimo : null,
    faltanParaMinimo: minimo ? Math.max(0, minimo - presentes) : 0
  };
}

/**
 * Consolida el día de toda el área.
 *
 * Devuelve una fila por sucursal cargada más el total. Las sucursales sin
 * carga quedan aparte: un día sin reportar no es un día sin ausencias, y
 * mezclarlos daría un ausentismo optimista.
 */
/**
 * Cuánta gente tenía turno en una tienda ese día, según el padrón.
 *
 * La carga manual del día —planificados, mínimo, ausentes tienda por tienda—
 * se eliminó: sin reloj de fichadas dependía de que alguien la completara
 * todas las mañanas, y no se completaba. Los presentes se deducen de lo que el
 * panel ya sabe: la dotación de piso menos quien tiene una ausencia abierta en
 * esa fecha. Quien no cubre turno —bloqueo de título, no presencial— nunca
 * entra, igual que en el resto del panel.
 */
function presentesDelPadron(sucursal, fecha) {
  /* `_diaHoy` viene de ausencias.js, que carga antes. No se redeclara: con
     `const` en el mismo ámbito global la página no arranca. */
  const f = fecha || _diaHoy();
  return ((sucursal || {}).colaboradores || []).filter(c => {
    if (c.activo === false) return false;
    if (typeof esNoPresencial === 'function' && esNoPresencial(c).noPresencial) return false;
    return !(c.ausencias || []).some(a =>
      !a.reincorporado && a.desde && a.desde <= f && (!a.hasta || a.hasta >= f));
  }).length;
}

function calcularDiario(dia, sucursales, par) {
  const p = Object.assign({}, PARAMETROS_DEFECTO, par || {});
  const carga = (dia && dia.sucursales) || {};
  const ventas = (dia && dia.venta) || {};

  const filas = [];
  const sinCargar = [];

  (sucursales || []).forEach(s => {
    const d = carga[s.id];
    const cargada = d && (String(d.planificados || '').trim() !== '' ||
                          (d.ausentes || []).length || _num(d.horasExtras));
    if (!cargada) { sinCargar.push(s); return; }
    const k = calcularDiarioSucursal(d, p);
    filas.push({ sucursal: s, dato: d, k, venta: ventas[s.id] || null });
  });

  const t = {
    planificados: 0, presentes: 0, ausentes: 0, minimo: 0,
    horasExtras: 0, horasOrdinarias: 0, novedades: 0, controlables: 0,
    presentesConMinimo: 0, conMinimo: 0, bajoMinimo: 0
  };
  filas.forEach(f => {
    t.planificados += f.k.planificados;
    t.presentes += f.k.presentes;
    t.ausentes += f.k.ausentes;
    t.horasExtras += f.k.horasExtras;
    t.horasOrdinarias += f.k.horasOrdinarias;
    t.novedades += f.k.novedades;
    t.controlables += f.k.controlables;
    /* La cobertura solo suma sobre las tiendas que tienen mínimo definido.
       Dividir los presentes de doce tiendas por el mínimo de una daba 2.825%. */
    if (f.k.minimo) {
      t.conMinimo++;
      t.minimo += f.k.minimo;
      t.presentesConMinimo += f.k.presentes;
      if (f.k.cobertura < 1) t.bajoMinimo++;
    }
  });

  t.pctAusentismo = t.planificados ? t.ausentes / t.planificados : null;
  t.pctExtras = t.horasOrdinarias ? t.horasExtras / t.horasOrdinarias : null;
  t.fteReal = t.planificados ? t.planificados - t.ausentes + t.horasExtras / p.horasJornada : null;
  t.cobertura = t.minimo ? t.presentesConMinimo / t.minimo : null;

  /* Venta del día: sirve para leer la cobertura contra lo que efectivamente
     había que atender. Una tienda al 80% de cobertura en un día flojo no es
     el mismo problema que al 80% en un día de promoción bancaria.

     Va sobre su propia lista y no sobre `filas`, que son las tiendas con el
     presentismo cargado. El RDV llega entero todas las mañanas y el
     presentismo se carga tienda por tienda a lo largo del día: atarlos
     mostraba la venta de dos sucursales cuando estaban importadas las once.
     `k` viene solo cuando esa tienda además reportó su gente, que es lo único
     que hace falta para la venta por persona presente. */
  const filasVenta = [];
  (sucursales || []).forEach(s => {
    const v = ventas[s.id];
    if (!v) return;
    filasVenta.push({ sucursal: s, venta: v, k: { presentes: presentesDelPadron(s, dia && dia.fecha) } });
  });

  const venta = { ayer: 0, metaHoy: 0, mes: 0, requerido: 0, transacciones: 0, conDato: 0,
                  presentes: 0, ayerConPresentismo: 0, tiendasConAmbos: 0 };
  filasVenta.forEach(f => {
    venta.conDato++;
    venta.ayer += _num(f.venta.ayer);
    venta.metaHoy += _num(f.venta.metaHoy);
    venta.mes += _num(f.venta.mes);
    venta.requerido += _num(f.venta.requerido);
    venta.transacciones += _num(f.venta.transAyer);
    /* La venta por persona presente se arma con las dos puntas del mismo
       subconjunto. El RDV llega completo y el presentismo se carga tienda por
       tienda, así que dividir la venta de once tiendas por los presentes de
       dos da un número que no es de nadie: se suman solo las que tienen las
       dos cosas. */
    if (f.k.presentes) {
      venta.tiendasConAmbos++;
      venta.presentes += f.k.presentes;
      venta.ayerConPresentismo += _num(f.venta.ayer);
    }
  });
  /* Dos lecturas distintas: la del día se compara contra la meta del día, la
     del mes contra lo requerido acumulado. Mezclarlas da un desvío falso del
     80%, que es lo que pasa si se enfrenta la venta de ayer al requerido del
     mes entero. */
  venta.indexDia = venta.metaHoy ? venta.ayer / venta.metaHoy - 1 : null;
  venta.indexMes = venta.requerido ? venta.mes / venta.requerido - 1 : null;

  return { filas, filasVenta, sinCargar, total: t, venta, par: p };
}

/**
 * Qué hay que mirar hoy. Devuelve alertas ordenadas por gravedad: primero lo
 * que impide operar, después lo que cuesta plata, al final lo que conviene
 * corregir antes de que se vuelva costumbre.
 */
function alertasDiarias(calc) {
  const p = calc.par;
  const A = [];
  const nom = s => (s.nombre && s.nombre.trim()) ? s.nombre.trim() : s.codigo;

  calc.filas.forEach(f => {
    const k = f.k;
    if (k.cobertura !== null && k.cobertura < 1) {
      A.push({
        nivel: 'critico', sucursal: nom(f.sucursal),
        titulo: 'Cobertura por debajo del mínimo',
        texto: `${nom(f.sucursal)} operó con ${k.presentes} persona${k.presentes === 1 ? '' : 's'} ` +
               `sobre un mínimo de ${k.minimo}: falta${k.faltanParaMinimo === 1 ? '' : 'n'} ${k.faltanParaMinimo}.`
      });
    } else if (k.cobertura !== null && k.presentes - k.minimo <= 1) {
      /* El umbral no es un porcentaje: es cuántas personas de colchón quedan.
         En una tienda de tres, una sola persona de más ya es el límite. */
      A.push({
        nivel: 'atencion', sucursal: nom(f.sucursal),
        titulo: 'Cobertura al límite',
        texto: `${nom(f.sucursal)} cubrió el mínimo con ${k.presentes - k.minimo === 0 ? 'lo justo' : 'una sola persona de colchón'} ` +
               `(${k.presentes} sobre ${k.minimo}). Una ausencia más y no abre en condiciones.`
      });
    }
    if (k.pctAusentismo !== null && k.pctAusentismo > p.umbralAusentismo * 2) {
      A.push({
        nivel: k.pctAusentismo > 0.20 ? 'critico' : 'atencion', sucursal: nom(f.sucursal),
        titulo: 'Ausentismo del día alto',
        texto: `${nom(f.sucursal)}: ${k.ausentes} de ${k.planificados} (${_pctDia(k.pctAusentismo)})` +
               (k.controlables
                 ? `, de ${k.controlables === 1 ? 'las cuales 1 es evitable' : `las cuales ${k.controlables} son evitables`}.`
                 : '.')
      });
    }
    if (k.pctExtras !== null && k.pctExtras > p.umbralHorasExtras) {
      A.push({
        nivel: 'atencion', sucursal: nom(f.sucursal),
        titulo: 'Horas extras por encima del umbral',
        texto: `${nom(f.sucursal)}: ${k.horasExtras} hs sobre ${k.horasOrdinarias} planificadas ` +
               `(${_pctDia(k.pctExtras)})` +
               (f.dato.motivoExtras
                 ? ` por ${(MOTIVOS_EXTRAS.find(m => m.id === f.dato.motivoExtras) || {}).nombre.toLowerCase()}.`
                 : ', sin motivo cargado.')
      });
    }
    (f.dato.novedades || []).forEach(n => {
      const t = TIPOS_NOVEDAD_DIA.find(x => x.id === n.tipo);
      A.push({
        nivel: 'critico', sucursal: nom(f.sucursal),
        titulo: 'Vacante a cubrir',
        texto: `${nom(f.sucursal)}: ${t ? t.nombre.toLowerCase() : 'novedad'} de ${n.nombre || 'sin nombre'}.` +
               ` Queda una posición para cubrir.`
      });
    });
  });

  if (calc.sinCargar.length) {
    A.push({
      nivel: 'dato', sucursal: '',
      titulo: 'Sucursales sin reportar',
      texto: `${calc.sinCargar.length} sucursal${calc.sinCargar.length === 1 ? '' : 'es'} sin carga del día: ` +
             calc.sinCargar.map(nom).join(', ') + '. Los indicadores son sobre las que sí reportaron.'
    });
  }

  const orden = { critico: 0, atencion: 1, dato: 2 };
  return A.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

/**
 * Acciones para mañana. Se derivan de las alertas, no se inventan: cada una
 * responde a un desvío concreto del día.
 */
function accionesDiarias(calc) {
  const p = calc.par;
  const acc = [];
  const nom = s => (s.nombre && s.nombre.trim()) ? s.nombre.trim() : s.codigo;

  const bajoMinimo = calc.filas.filter(f => f.k.cobertura !== null && f.k.cobertura < 1);
  if (bajoMinimo.length) {
    acc.push(`Cubrir el turno de ${bajoMinimo.map(f => nom(f.sucursal)).join(', ')} antes de la apertura: ` +
             `mover gente de una sucursal cercana o de la lista de flotantes, en ese orden. ` +
             `Autorizar horas extras solo si no hay traslado posible.`);
  }

  const evitables = calc.filas.filter(f => f.k.controlables > 0);
  if (evitables.length) {
    acc.push(`Llamar hoy mismo a quienes faltaron sin justificar en ${evitables.map(f => nom(f.sucursal)).join(', ')}. ` +
             `La falta sin aviso que no se conversa el mismo día se repite.`);
  }

  const extras = calc.filas.filter(f => f.k.pctExtras !== null && f.k.pctExtras > p.umbralHorasExtras);
  const porAusencia = extras.filter(f => f.dato.motivoExtras === 'ausencia');
  if (porAusencia.length) {
    acc.push(`Revisar la grilla de ${porAusencia.map(f => nom(f.sucursal)).join(', ')}: ` +
             `las horas extras se están usando para tapar ausencias, que es la forma más cara de cubrirlas.`);
  } else if (extras.length) {
    acc.push(`Chequear la grilla horaria de ${extras.map(f => nom(f.sucursal)).join(', ')} ` +
             `antes de autorizar más horas extras.`);
  }

  const vacantes = calc.filas.filter(f => (f.dato.novedades || []).length);
  if (vacantes.length) {
    const n = calc.total.novedades;
    acc.push(`Abrir la búsqueda de ${n === 1 ? 'la vacante' : `las ${n} vacantes`} ` +
             `de ${vacantes.map(f => nom(f.sucursal)).join(', ')} y definir quién cubre mientras tanto.`);
  }

  if (calc.sinCargar.length >= 3) {
    acc.push(`Pedir el reporte del día a las ${calc.sinCargar.length} sucursales que no lo mandaron: ` +
             `sin ese dato el indicador del área queda incompleto.`);
  }

  if (!acc.length) {
    acc.push('Sin desvíos que exijan acción: sostener la grilla como está y usar el día para lo planificado.');
  }
  return acc.slice(0, 4);
}

/* =========================== IMPORTADOR RDV ===========================
 *
 * El Reporte Diario de Ventas (RDV) que llega todas las mañanas trae, por
 * tienda, la venta de ayer, la de la semana, la del mes, lo requerido para
 * llegar al objetivo y las transacciones. Se pega la hoja "RDV Operaciones"
 * y se cruza contra el padrón por nombre de tienda.
 */

/** Encabezados de la hoja de operaciones, normalizados. */
const COLUMNAS_RDV = {
  AREA: 'area', TIENDA: 'tienda', AYER: 'ayer', SEMANA: 'semana', MES: 'mes',
  REQUERIDO: 'requerido', INDEX: 'index', METAHOY: 'metaHoy',
  TRANSAYER: 'transAyer', TRANSMES: 'transMes', FORMATO: 'formato', CAPA: 'capa'
};

function _claveRdv(s) {
  return String(s || '').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/** Convierte "36.542.309,64", "36542309.64" o "" en número. */
function _numeroRdv(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  let limpio = s.replace(/[^\d,.\-]/g, '');
  if (!limpio) return null;
  /* Si tiene ambos separadores, el último es el decimal. */
  const coma = limpio.lastIndexOf(','), punto = limpio.lastIndexOf('.');
  if (coma > -1 && punto > -1) {
    limpio = coma > punto
      ? limpio.replace(/\./g, '').replace(',', '.')
      : limpio.replace(/,/g, '');
  } else if (coma > -1) {
    /* Una coma sola: decimal si deja 1 o 2 dígitos, si no es separador de miles. */
    limpio = (limpio.length - coma - 1) <= 2 ? limpio.replace(',', '.') : limpio.replace(/,/g, '');
  }
  const n = Number(limpio);
  return isNaN(n) ? null : n;
}

/**
 * Interpreta el bloque pegado del RDV.
 *
 * Acepta el pegado directo de Excel (columnas separadas por tabulaciones) y
 * busca la fila de encabezados en cualquier parte del texto, porque la hoja
 * trae el título del reporte y filas vacías arriba.
 */
function interpretarRDV(texto, areaFiltro) {
  /* Por filasPegadas: el RDV trae los títulos de bloque con saltos adentro. */
  const lineas = filasPegadas(texto, '\t');
  if (!lineas.length) return { filas: [], error: 'No se pegó nada.' };

  const partir = f => f;

  let iCab = -1, cab = null;
  for (let i = 0; i < lineas.length && i < 20; i++) {
    const celdas = partir(lineas[i]).map(_claveRdv);
    if (celdas.includes('TIENDA') && (celdas.includes('AYER') || celdas.includes('MES'))) {
      iCab = i; cab = celdas; break;
    }
  }
  if (iCab < 0) {
    return { filas: [], error: 'No se encontró la fila de encabezados. ' +
      'Copiá desde la fila que dice “Área … Tienda … Ayer … Mes”, incluyéndola.' };
  }

  /* La hoja repite el mismo juego de columnas en varios bloques a lo ancho.
     Nos quedamos con el primero, que es el de tiendas. */
  const idx = {};
  Object.keys(COLUMNAS_RDV).forEach(k => {
    const i = cab.indexOf(k);
    if (i >= 0) idx[COLUMNAS_RDV[k]] = i;
  });
  if (idx.tienda === undefined) return { filas: [], error: 'La columna “Tienda” no aparece.' };

  const filas = [];
  for (let i = iCab + 1; i < lineas.length; i++) {
    const c = partir(lineas[i]);
    const tienda = (c[idx.tienda] || '').trim();
    if (!tienda) continue;
    if (/^total/i.test(tienda)) continue;

    const area = idx.area !== undefined ? (c[idx.area] || '').trim() : '';
    if (areaFiltro && area && String(area) !== String(areaFiltro)) continue;

    const f = { tienda, clave: _claveRdv(tienda), area };
    ['ayer', 'semana', 'mes', 'requerido', 'index', 'metaHoy', 'transAyer', 'transMes']
      .forEach(k => { if (idx[k] !== undefined) f[k] = _numeroRdv(c[idx[k]]); });
    if (f.ayer === null && f.mes === null) continue;
    filas.push(f);
  }

  return { filas, error: filas.length ? null : 'Se encontró el encabezado pero ninguna fila con venta.' };
}

/** Nombres del RDV que no coinciden literalmente con los del padrón. */
const ALIAS_RDV = {
  SANMARTIN: 'SMCENTER',
  VILLADELPARQUEII: 'VILLADELPARQUE',
  '25DEMAYONOBLEZA': 'LANOBLEZA'
};

/** Cruza una fila del RDV contra el padrón de sucursales. */
function sucursalDeRDV(fila, sucursales) {
  const buscada = ALIAS_RDV[fila.clave] || fila.clave;
  const cand = (sucursales || []).map(s => ({
    s,
    porCodigo: _claveRdv(s.codigo),
    porNombre: _claveRdv(s.nombre),
    porRvd: _claveRdv(s.rvd)
  }));
  let hit = cand.find(x => x.porCodigo === buscada || x.porNombre === buscada || (x.porRvd && x.porRvd === buscada));
  if (hit) return hit.s;
  /* Último intento: que uno contenga al otro (VILLADEVOTO vs DEVOTO no debe
     colisionar, así que se exige que el más corto tenga al menos 6 letras y
     que haya un solo candidato). */
  const parciales = cand.filter(x =>
    (buscada.length >= 6 && (x.porCodigo.startsWith(buscada) || buscada.startsWith(x.porCodigo))) ||
    (buscada.length >= 6 && x.porNombre && (x.porNombre.startsWith(buscada) || buscada.startsWith(x.porNombre))));
  return parciales.length === 1 ? parciales[0].s : null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcularDiarioSucursal, calcularDiario, alertasDiarias, accionesDiarias,
    interpretarRDV, sucursalDeRDV, ALIAS_RDV
  };
}

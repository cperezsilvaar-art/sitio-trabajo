/*
 * modelo.js — Motor de cálculo.
 *
 * Convención de FTE (la que usa la hoja DOT de TD01 y la que acordamos):
 *   "Días trabajados" = días de VÍNCULO laboral en el mes, no días presentes.
 *   Una posición cubierta todo el mes aporta 30 días; un alta o una baja
 *   aportan los días efectivos de ese mes. El ausentismo se descuenta aparte,
 *   de modo que no se computa dos veces.
 *
 *   FTE Real = (días de vínculo / 30) - (días ausentes / 30) + (horas extras / 200)
 */

/* ---------------------------- utilidades ---------------------------- */
const num = v => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return isFinite(n) ? n : 0;
};

const redondear = (n, d = 2) => {
  const f = Math.pow(10, d);
  return Math.round((num(n) + Number.EPSILON) * f) / f;
};

/* --------------------------- FTE y costos --------------------------- */

/**
 * Calcula FTE y costo laboral de una fila de posición.
 * @param {object} fila  { rol, heads, diasAltas, diasBajas, diasAusentes,
 *                         horasExtras, sueldoBruto, costoHE, bonos, cargasManual }
 * @param {object} par   parámetros (diasMes, horasMes, factorCargas)
 */
function calcularPosicion(fila, par) {
  const p = Object.assign({}, PARAMETROS_DEFECTO, par || {});
  const heads = num(fila.heads);

  // Días de vínculo: dotación estable + prorrateo de altas y bajas del mes.
  const diasEstables = heads * p.diasMes;
  const diasAltas = num(fila.diasAltas);
  const diasBajas = num(fila.diasBajas);
  const diasTrabajados = diasEstables + diasAltas + diasBajas;

  const diasAusentes = num(fila.diasAusentes);
  const horasExtras = num(fila.horasExtras);

  const fteVinculo   = diasTrabajados / p.diasMes;
  const fteAusencias = -(diasAusentes / p.diasMes);
  const fteExtras    = horasExtras / p.horasMes;
  const fteReal      = fteVinculo + fteAusencias + fteExtras;

  // Costo laboral
  const sueldoBruto = num(fila.sueldoBruto);
  const costoHE     = num(fila.costoHE);
  const bonos       = num(fila.bonos);
  const baseCargas  = sueldoBruto + costoHE + bonos;
  const cargas = fila.cargasManual !== '' && fila.cargasManual !== null && fila.cargasManual !== undefined
    ? num(fila.cargasManual)
    : baseCargas * (p.factorCargas - 1);
  const costoTotal = sueldoBruto + costoHE + bonos + cargas;
  const costoPorFte = fteReal > 0 ? costoTotal / fteReal : null;

  // Horas extras como % de las horas teóricas de la posición
  const horasTeoricas = heads * p.horasMes;
  const ratioExtras = horasTeoricas > 0 ? horasExtras / horasTeoricas : null;

  // Ausentismo de la posición sobre días de vínculo
  const ratioAusentismo = diasTrabajados > 0 ? diasAusentes / diasTrabajados : null;

  return {
    rol: fila.rol,
    heads,
    diasAltas, diasBajas, diasTrabajados,
    diasAusentes, horasExtras,
    fteVinculo, fteAusencias, fteExtras, fteReal,
    sueldoBruto, costoHE, bonos, cargas, costoTotal, costoPorFte,
    ratioExtras, ratioAusentismo,
    // Brecha de cobertura: FTE Real contra la dotación equivalente que surge de
    // los días de vínculo. Negativa = se perdió cobertura por ausencias más de
    // lo que se recuperó con horas extras.
    brechaFte: fteReal - fteVinculo
  };
}

/** Suma la matriz completa de posiciones de una visita. */
function calcularMatriz(posiciones, par) {
  const filas = (posiciones || []).map(f => calcularPosicion(f, par));
  const acc = (k) => filas.reduce((s, f) => s + num(f[k]), 0);

  const total = {
    rol: 'TOTAL',
    heads: acc('heads'),
    diasAltas: acc('diasAltas'),
    diasBajas: acc('diasBajas'),
    diasTrabajados: acc('diasTrabajados'),
    diasAusentes: acc('diasAusentes'),
    horasExtras: acc('horasExtras'),
    fteReal: acc('fteReal'),
    sueldoBruto: acc('sueldoBruto'),
    costoHE: acc('costoHE'),
    bonos: acc('bonos'),
    cargas: acc('cargas'),
    costoTotal: acc('costoTotal')
  };
  total.costoPorFte = total.fteReal > 0 ? total.costoTotal / total.fteReal : null;
  total.fteVinculo = total.diasTrabajados / (par && par.diasMes ? par.diasMes : PARAMETROS_DEFECTO.diasMes);
  total.brechaFte = total.fteReal - total.fteVinculo;

  const p = Object.assign({}, PARAMETROS_DEFECTO, par || {});
  const horasTeoricas = total.heads * p.horasMes;
  total.ratioExtras = horasTeoricas > 0 ? total.horasExtras / horasTeoricas : null;
  total.ratioAusentismo = total.diasTrabajados > 0 ? total.diasAusentes / total.diasTrabajados : null;

  return { filas, total };
}

/* --------------------------- Ausentismo ----------------------------- */

/**
 * Consolida el detalle de ausentismo por concepto.
 *
 * Si todavía no se cargó la apertura por concepto, se toman los días ausentes
 * de la matriz de FTE: así el porcentaje del panel refleja lo que realmente se
 * relevó, en lugar de mostrar cero. El flag `sinApertura` avisa que falta el
 * detalle.
 *
 * @param {object} detalle  { '085': 12, '071': 30, ... } días por código
 * @param {number} diasDisponibles  total de días de vínculo del mes
 * @param {number} diasMatriz  días ausentes cargados en la matriz de FTE
 */
function calcularAusentismo(detalle, diasDisponibles, diasMatriz) {
  detalle = detalle || {};
  const base = num(diasDisponibles);
  const grupos = AUSENTISMO_GRUPOS.map(g => {
    const conceptos = g.conceptos.map(c => {
      const dias = num(detalle[c.cod]);
      return { cod: c.cod, nombre: c.nombre, inactivo: !!c.inactivo, dias,
               pct: base > 0 ? dias / base : null };
    });
    const dias = conceptos.reduce((s, c) => s + c.dias, 0);
    return { id: g.id, nombre: g.nombre, ayuda: g.ayuda, conceptos, dias, pct: base > 0 ? dias / base : null };
  });

  const detallados = grupos.reduce((s, g) => s + g.dias, 0);

  /* Gestionable es exactamente lo controlable: lo que la tienda y RRHH pueden
     bajar. Las licencias legales y la enfermedad comprobada no entran, por más
     que pesen en la cobertura. */
  const gestionable = grupos
    .filter(g => g.id === 'controlable')
    .reduce((s, g) => s + g.dias, 0);

  /* Días que el colaborador no percibe de la empresa. Es un dato de costo,
     independiente de si la ausencia se podía evitar. */
  const inactivos = grupos.reduce((s, g) =>
    s + g.conceptos.filter(c => c.inactivo).reduce((a, c) => a + c.dias, 0), 0);

  const sinApertura = detallados === 0 && num(diasMatriz) > 0;
  const totalDias = sinApertura ? num(diasMatriz) : detallados;

  return {
    grupos,
    diasDisponibles: base,
    diasDetallados: detallados,
    diasMatriz: num(diasMatriz),
    sinApertura,
    totalDias,
    pctTotal: base > 0 ? totalDias / base : null,
    diasGestionables: gestionable,
    pctGestionable: base > 0 ? gestionable / base : null,
    diasInactivos: inactivos,
    pctInactivo: base > 0 ? inactivos / base : null
  };
}

/* ------------------------- Rotación y bajas ------------------------- */

/**
 * Rotación del mes según la planilla ESTADISTICA (5) de TD01.
 *   dotación promedio = (dotación anterior + nueva dotación) / 2
 *   rotación mensual  = bajas / dotación promedio
 *   proyección anual  = rotación mensual x 12
 */
function calcularRotacion(rot) {
  rot = rot || {};
  const anterior  = num(rot.dotacionAnterior);
  const altasExt  = num(rot.altasExternas);
  const altasInt  = num(rot.altasInternas);
  const bajasExt  = num(rot.bajasExternas);
  const bajasInt  = num(rot.bajasInternas);

  const nueva = anterior + altasExt + altasInt - bajasExt - bajasInt;
  const promedio = (anterior + nueva) / 2;
  const bajas = bajasExt + bajasInt;

  const mensual = promedio > 0 ? bajas / promedio : null;

  return {
    anterior, altasExt, altasInt, bajasExt, bajasInt, bajas,
    nueva,
    promedio,
    variacion: anterior > 0 ? (nueva - anterior) / anterior : null,
    mensual,
    proyeccionAnual: mensual === null ? null : mensual * 12
  };
}

/** Agrupa las bajas registradas por categoría (renuncia / despido / otros). */
function agruparBajas(movimientos) {
  const bajas = (movimientos || []).filter(m => m.tipo === 'baja');
  const grupos = MOTIVOS_BAJA.map(g => ({
    id: g.id,
    nombre: g.nombre,
    casos: bajas.filter(b => b.categoria === g.id).length
  }));
  const total = bajas.length;
  grupos.forEach(g => { g.pct = total > 0 ? g.casos / total : null; });
  return { grupos, total };
}

/* ----------------- Dotación óptima vs. venta (Selma) ---------------- */

/**
 * Reproduce el modelo de la planilla de dotación:
 *   costo laboral real   = brutos x factor de cargas
 *   % costo / venta      = costo laboral real / venta neta
 *   costo por empleado   = costo laboral real / empleados
 *   dotación óptima      = (venta x benchmark) / costo por empleado
 *   ahorro / inversión   = costo óptimo - costo real
 */
function calcularDotacionOptima({ tipo, empleados, costoLaboralReal, venta, ventaRed }, par) {
  const p = Object.assign({}, PARAMETROS_DEFECTO, par || {});
  const emp = num(empleados);
  const costo = num(costoLaboralReal);
  const v = num(venta);

  if (tipo === 'staff') {
    const base = num(ventaRed);
    const pct = base > 0 ? costo / base : null;
    return {
      tipo: 'staff',
      costoReal: costo,
      pctCostoVenta: pct,
      benchmark: p.benchmarkStaff,
      dotacionOptima: null,
      diferencia: null,
      semaforo: pct === null
        ? { clave: 'sd', icono: '⚪', texto: 'Sin venta de red cargada' }
        : (pct > p.benchmarkStaff
            ? { clave: 'reducir', icono: '🔴', texto: 'Staff sobredimensionado' }
            : { clave: 'optima', icono: '✅', texto: 'Staff dentro del benchmark' })
    };
  }

  if (!v || !emp || !costo) {
    return {
      tipo: 'venta', costoReal: costo, pctCostoVenta: null,
      benchmark: p.benchmarkCostoVenta, alerta: p.alertaCostoVenta,
      dotacionOptima: null, dotacionMaxima: null, diferencia: null, costoOptimo: null, ahorro: null,
      semaforo: semaforoDotacion(null), banda: evaluarCostoVenta(null, p)
    };
  }

  const costoPorEmpleado = costo / emp;
  const dotacionOptima = Math.round((v * p.benchmarkCostoVenta) / costoPorEmpleado);
  const dotacionMaxima = Math.floor((v * p.alertaCostoVenta) / costoPorEmpleado);
  const diferencia = dotacionOptima - emp;
  const costoOptimo = dotacionOptima * costoPorEmpleado;
  const pct = costo / v;

  return {
    tipo: 'venta',
    costoReal: costo,
    pctCostoVenta: pct,
    benchmark: p.benchmarkCostoVenta,
    alerta: p.alertaCostoVenta,
    costoPorEmpleado,
    dotacionOptima,
    dotacionMaxima,          // dotación que la venta sostiene antes del techo de alerta
    diferencia,
    costoOptimo,
    ahorro: costoOptimo - costo,
    semaforo: semaforoDotacion(diferencia),
    banda: evaluarCostoVenta(pct, p)
  };
}

/**
 * Productividad: 6 tickets por hora por cada 6 horas trabajadas.
 * Un cumplimiento por encima del 100% sugiere que la tienda vende más de lo
 * que su dotación puede sostener; por debajo, sobra cobertura.
 */
function calcularProductividad({ tickets, horasTrabajadas }, par) {
  const p = Object.assign({}, PARAMETROS_DEFECTO, par || {});
  const t = num(tickets), h = num(horasTrabajadas);
  if (!t || !h) return null;
  const real = t / h;
  return {
    ticketsHora: real,
    objetivo: p.ticketsHoraObjetivo,
    cumplimiento: real / p.ticketsHoraObjetivo
  };
}

/* ---------------------------- Sucesión ------------------------------ */

/**
 * Heat map 9-box del toolkit de sucesión: criticidad (1-3) x escasez (1-3).
 * Se considera crítica toda posición con criticidad >= 2,5 o
 * criticidad >= 2 combinada con escasez alta.
 */
function evaluarSucesion(items) {
  const lista = (items || []).map(it => {
    const criticidad = num(it.criticidad);
    const escasez = num(it.escasez);
    const candidatos = it.candidatos || [];
    const listos = candidatos.filter(c => c.readiness === 'lt1').length;
    const critica = criticidad >= 2.5 || (criticidad >= 2 && escasez >= 3);
    return {
      ...it,
      criticidad, escasez, candidatos,
      candidatosTotal: candidatos.length,
      candidatosListos: listos,
      critica,
      conPlan: candidatos.length > 0,
      riesgo: critica && candidatos.length === 0
        ? 'alto'
        : (critica && listos === 0 ? 'medio' : 'bajo')
    };
  });

  const criticas = lista.filter(i => i.critica);
  return {
    lista,
    posicionesCriticas: criticas.length,
    criticasConPlan: criticas.filter(i => i.conPlan).length,
    promedioCandidatos: criticas.length
      ? criticas.reduce((s, i) => s + i.candidatosTotal, 0) / criticas.length
      : 0,
    candidatosListos: lista.reduce((s, i) => s + i.candidatosListos, 0),
    enRiesgo: lista.filter(i => i.riesgo === 'alto')
  };
}

/* ------------------------ Diagnóstico automático -------------------- */

/* Formateo local en es-AR, para que el diagnóstico automático use la misma
   coma decimal que el resto del reporte. */
const _pct = (n, d = 2) =>
  (num(n) * 100).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const _n = (v, d = 2) =>
  num(v).toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });

/**
 * Genera hallazgos automáticos a partir de las métricas de la visita.
 * No reemplaza el criterio del coordinador: es el piso del análisis.
 */
function generarHallazgos(v, par) {
  const p = Object.assign({}, PARAMETROS_DEFECTO, par || {});
  const out = [];
  const m = calcularMatriz(v.posiciones, p);
  const aus = calcularAusentismo(v.ausentismo && v.ausentismo.detalle, m.total.diasTrabajados, m.total.diasAusentes);
  const rot = calcularRotacion(v.rotacion);

  if (aus.pctTotal !== null && aus.pctTotal > p.umbralAusentismo) {
    out.push(`Ausentismo total del ${_pct(aus.pctTotal)}, por encima del umbral de referencia del ${_pct(p.umbralAusentismo, 0)}.` +
      (aus.sinApertura
        ? ' Falta la apertura por concepto para separar los días gestionables de los que no lo son.'
        : ` De esos días, ${aus.diasGestionables} son gestionables (${_pct(aus.pctGestionable)} de la base).`));
  }
  if (m.total.ratioExtras !== null && m.total.ratioExtras > p.umbralHorasExtras) {
    out.push(`Las horas extras equivalen al ${_pct(m.total.ratioExtras)} de las horas teóricas de la dotación (${m.total.horasExtras} hs), ` +
      `es decir ${_n(m.total.horasExtras / p.horasMes)} FTE comprados por sobretiempo.`);
  }
  if (m.total.brechaFte < -0.5) {
    out.push(`La tienda opera con ${_n(Math.abs(m.total.brechaFte))} FTE por debajo de su dotación equivalente ` +
      `(${_n(m.total.fteVinculo)} personas contratadas / ${_n(m.total.fteReal)} FTE efectivos).`);
  }

  m.filas.forEach(f => {
    if (f.heads > 0 && f.ratioAusentismo !== null && f.ratioAusentismo > p.umbralAusentismo * 2) {
      out.push(`${f.rol}: ausentismo del ${_pct(f.ratioAusentismo)}, más del doble del umbral. Requiere revisión individual de casos.`);
    }
    if (f.heads > 0 && f.ratioExtras !== null && f.ratioExtras > p.umbralHorasExtras * 2) {
      out.push(`${f.rol}: ${f.horasExtras} hs extras (${_pct(f.ratioExtras)} de sus horas teóricas). Verificar si es un déficit estructural de dotación.`);
    }
  });

  const dot = calcularDotacionOptima({
    tipo: 'venta', empleados: m.total.heads, costoLaboralReal: m.total.costoTotal,
    venta: v.comercial && v.comercial.venta
  }, p);
  if (dot.pctCostoVenta !== null) {
    if (dot.banda.zona === 'alerta') {
      const causas = [];
      if (m.total.ratioExtras !== null && m.total.ratioExtras > p.umbralHorasExtras) {
        causas.push(`las horas extras representan el ${_pct(m.total.ratioExtras)} de las horas teóricas`);
      }
      if (m.total.heads > dot.dotacionMaxima) {
        causas.push(`la venta sostiene hasta ${dot.dotacionMaxima} personas antes del techo y la tienda tiene ${m.total.heads}`);
      }
      out.push(`Costo laboral en ${_pct(dot.pctCostoVenta)} de la venta, por encima del techo de alerta del ${_pct(p.alertaCostoVenta, 0)}. ` +
        (causas.length ? `En esta tienda: ${causas.join('; ')}. ` : '') +
        'Revisar si es sobreestructura, caída de ventas o un modelo operativo costoso.');
    } else if (dot.banda.zona === 'atencion') {
      out.push(`Costo laboral en ${_pct(dot.pctCostoVenta)} de la venta: por encima del objetivo del ${_pct(p.benchmarkCostoVenta, 0)} ` +
        `pero por debajo del techo de alerta del ${_pct(p.alertaCostoVenta, 0)}.`);
    }
  }

  if (rot.proyeccionAnual !== null && rot.proyeccionAnual > 0.30) {
    out.push(`Rotación mensual del ${_pct(rot.mensual)}, que proyectada al año da ${_pct(rot.proyeccionAnual, 1)}. Revisar causas de egreso.`);
  }
  if ((v.sanciones || []).length >= 3) {
    out.push(`${v.sanciones.length} sanciones registradas en el período. Analizar concentración por sector y por motivo.`);
  }

  const suc = evaluarSucesion(v.sucesion);
  if (suc.enRiesgo.length) {
    out.push(`${suc.enRiesgo.length} posición/es crítica/s sin candidato de sucesión identificado: ${suc.enRiesgo.map(i => i.posicion).join(', ')}.`);
  }

  return out;
}

/* ------------------------- Recorrida del HRBP ----------------------- */

/**
 * Avance de la recorrida de una visita.
 *
 * Lo que no aplica no cuenta en contra: el porcentaje se calcula sobre lo que
 * correspondía hacer, no sobre la lista entera. Los puntos marcados como clave
 * se siguen aparte, porque son los que no deberían quedar sin hacer.
 */
function evaluarRecorrida(recorrida) {
  const checks = (recorrida && recorrida.checks) || {};
  const bloques = RECORRIDA_HRBP.map(b => {
    const items = b.items.map(i => ({
      id: b.id + '_' + i.id,
      texto: i.texto, ayuda: i.ayuda, clave: !!i.clave,
      estado: checks[b.id + '_' + i.id] || ''
    }));
    const aplica = items.filter(i => i.estado !== 'na');
    const hechos = items.filter(i => i.estado === 'ok');
    return {
      id: b.id, nombre: b.nombre, ayuda: b.ayuda, items,
      total: items.length, aplican: aplica.length, hechos: hechos.length,
      pct: aplica.length ? hechos.length / aplica.length : null
    };
  });

  const todos = bloques.reduce((a, b) => a.concat(b.items), []);
  const aplican = todos.filter(i => i.estado !== 'na');
  const hechos = todos.filter(i => i.estado === 'ok');
  const sinHacer = todos.filter(i => i.estado === 'no');
  const sinResponder = todos.filter(i => !i.estado);
  const clavesPendientes = todos.filter(i => i.clave && i.estado !== 'ok' && i.estado !== 'na');

  return {
    bloques, total: todos.length,
    aplican: aplican.length, hechos: hechos.length,
    sinHacer, sinResponder, clavesPendientes,
    pct: aplican.length ? hechos.length / aplican.length : null,
    completa: !sinResponder.length
  };
}

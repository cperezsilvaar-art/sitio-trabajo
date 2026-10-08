/*
 * vacaciones.js — La planificación de la licencia anual ordinaria.
 *
 * Tres cosas distintas, y conviene no confundirlas nunca:
 *
 *   el DERECHO       cuántos días le tocan este ciclo. Sale de `vacacionesDe()`
 *                    (art. 24 del CCT) y de los días que quedaron del ciclo
 *                    anterior, que el panel no puede deducir y se cargan a mano.
 *   lo PLANIFICADO   cuándo los toma. **Son ausencias con motivo `vacaciones`**,
 *                    las mismas que ya vivían en `c.ausencias`: no hay una
 *                    segunda lista de tramos. Dos listas de lo mismo terminan
 *                    diciendo cosas distintas, y acá además una de las dos ya
 *                    la llenan el libro de novedades y el formulario.
 *   la COBERTURA     con cuánta gente queda la tienda el día que alguien sale.
 *                    Es lo único que la planilla de Excel no puede contestar y
 *                    es la razón de esta pantalla.
 *
 * **La antigüedad se mide al 31 de diciembre del año del ciclo**, no al día de
 * hoy: lo dice el último párrafo del art. 150 de la LCT, y es lo que hace que
 * quien entró el 12/12/2022 tenga 4 años para el ciclo 2026 y no 3. Medirla
 * contra hoy le daría 17 días a alguien que tiene derecho a 26.
 */

/* El ciclo: el año cuya antigüedad manda, y la ventana en la que se gozan.
   La LCT (art. 154) las ubica entre el 1 de octubre y el 30 de abril; el área
   viene planificando desde julio, así que los meses son un parámetro y no una
   constante. */
const VACACIONES_DEFECTO = { anio: 0, mesDesde: 7, mesHasta: 4 };

const _vacPad = n => String(n).padStart(2, '0');
const _vacFinDeMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

/** Los días de un tramo, contando los dos extremos: del 1 al 17 son 17 días. */
function diasDeTramo(desde, hasta) {
  const d = _dias(desde, hasta);
  return d === null ? 0 : d + 1;
}

/**
 * El ciclo que se está planificando.
 *
 * Con `mesDesde` mayor que `mesHasta` la ventana cruza el año —julio de 2026 a
 * abril de 2027—, que es el caso normal. Con los dos adentro del mismo año
 * también funciona, por lo mismo que el período de liquidación: es el caso
 * general escrito una vez.
 */
function cicloDeVacaciones(parametros) {
  const p = Object.assign({}, VACACIONES_DEFECTO, parametros || {});
  const anio = Number(p.anio) || new Date().getFullYear();
  const mesD = Math.min(12, Math.max(1, Number(p.mesDesde) || 7));
  const mesH = Math.min(12, Math.max(1, Number(p.mesHasta) || 4));
  const anioH = mesH < mesD ? anio + 1 : anio;

  const meses = [];
  let a = anio, m = mesD;
  for (let i = 0; i < 24; i++) {
    meses.push(`${a}-${_vacPad(m)}`);
    if (a === anioH && m === mesH) break;
    m++; if (m > 12) { m = 1; a++; }
  }
  return {
    anio,
    cierreAntiguedad: `${anio}-12-31`,
    desde: `${anio}-${_vacPad(mesD)}-01`,
    hasta: `${anioH}-${_vacPad(mesH)}-${_vacPad(_vacFinDeMes(anioH, mesH))}`,
    meses
  };
}

const MESES_VAC = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «Julio 2026 – Abril 2027», para el encabezado. */
function nombreDeCiclo(ciclo) {
  if (!ciclo || !ciclo.meses.length) return '';
  const nom = iso => {
    const [a, m] = iso.split('-');
    const n = MESES_VAC[Number(m) - 1] || '';
    return n ? n.charAt(0).toUpperCase() + n.slice(1) + ' ' + a : iso;
  };
  const primero = nom(ciclo.meses[0]);
  const ultimo = nom(ciclo.meses[ciclo.meses.length - 1]);
  return primero === ultimo ? primero : `${primero} – ${ultimo}`;
}

/** Los años cumplidos al 31/12 del año del ciclo, que es lo que fija los días. */
function antiguedadParaVacaciones(c, ciclo) {
  const ingreso = (c && (c.fechaIngreso || c.fechaIngresoFTD)) || '';
  if (!ingreso || !ciclo) return 0;
  return Math.floor(Math.max(0, _aniosEntre(ingreso, ciclo.cierreAntiguedad)));
}

/**
 * Cuántos días le corresponden y cuántos arrastra.
 *
 * `pendientes` es el mapa `c.vacacionesPendientes`, indexado por el año del
 * ciclo: los días que la liquidación del año anterior dejó sin gozar. El panel
 * no los puede deducir —no guarda la foto de cada cierre— así que se cargan a
 * mano y se quedan anotados contra su ciclo, no sueltos.
 */
function derechoDeVacaciones(c, ciclo) {
  const anios = antiguedadParaVacaciones(c, ciclo);
  const legales = (c && c.fechaIngreso) || (c && c.fechaIngresoFTD)
    ? vacacionesDe(anios).dias : 0;
  const pend = Number(((c || {}).vacacionesPendientes || {})[String(ciclo.anio)]) || 0;
  return { anios, legales, pendienteAnterior: pend, total: legales + pend };
}

/**
 * Los tramos del ciclo. **No son una lista propia**: son las ausencias con
 * motivo `vacaciones`, filtradas por el ciclo en el que arrancan.
 *
 * Un tramo pertenece al ciclo en el que **empieza**, aunque termine afuera: la
 * salida es la que el gerente acuerda y la que ocupa el lugar en el calendario
 * de la tienda.
 */
function tramosDeVacaciones(c, ciclo) {
  return ((c && c.ausencias) || [])
    .filter(a => a.motivo === 'vacaciones' && a.desde &&
                 a.desde >= ciclo.desde && a.desde <= ciclo.hasta)
    .map(a => ({
      id: a.id,
      desde: a.desde,
      hasta: a.hasta || '',
      dias: a.hasta ? diasDeTramo(a.desde, a.hasta) : 0,
      sinRetorno: !a.hasta,
      /* El libro de novedades ubica sus licencias al principio del mes porque
         dice cuántos días se pagaron y no cuáles. Esos días están medidos, las
         fechas no: el tramo entra igual pero no se muestra como si alguien
         hubiera acordado esa salida. */
      fechasSupuestas: !!a.fechasSupuestas
    }))
    .sort((x, y) => x.desde.localeCompare(y.desde));
}

/**
 * La fila de una persona en el cuadro: derecho, lo planificado, lo ya tomado
 * y el saldo.
 *
 * **Planificado y tomado son dos números y no uno.** Lo planificado es todo el
 * ciclo —incluido lo que todavía no pasó— y es contra lo que se mide el saldo:
 * la pregunta de la planificación es «cuántos días me quedan por ubicar». Lo
 * tomado es lo que ya transcurrió, y sirve para otra cosa: saber si el año se
 * le está yendo a alguien sin haber salido.
 */
function filaDeVacaciones(c, ciclo, hoy) {
  const h = hoy || _diaHoy();
  const d = derechoDeVacaciones(c, ciclo);
  const tramos = tramosDeVacaciones(c, ciclo);
  const planificados = tramos.reduce((a, t) => a + t.dias, 0);
  const tomados = tramos.reduce((a, t) => {
    if (!t.hasta || t.desde > h) return a;
    return a + diasDeTramo(t.desde, t.hasta < h ? t.hasta : h);
  }, 0);
  return Object.assign({
    id: c.id, nombre: c.nombre || '', cargo: c.cargo || '', posicion: c.posicion || '',
    fechaIngreso: c.fechaIngreso || c.fechaIngresoFTD || '',
    fte: jornadaDeVinculo(c).fte,
    tramos, planificados, tomados,
    saldo: d.total - planificados,
    sinPlanificar: planificados === 0,
    supuestos: tramos.some(t => t.fechasSupuestas),
    sinRetorno: tramos.some(t => t.sinRetorno)
  }, d);
}

/**
 * El cuadro de una tienda.
 *
 * Mira **el plantel que cubre turno**: `sigueEnElPlantel()` saca a las bajas
 * —a quien se fue no se le planifican vacaciones— y `esNoPresencial()` saca al
 * bloqueo de título, que no ocupa un lugar en el calendario del piso. Es la
 * misma lista que cuenta la dotación, a propósito: planificar sobre una
 * dotación y medir la cobertura sobre otra es la grieta de siempre.
 */
function planDeVacaciones(sucursal, ciclo, hoy) {
  const gente = ((sucursal || {}).colaboradores || [])
    .filter(c => sigueEnElPlantel(c) && !esNoPresencial(c).noPresencial);
  const filas = gente.map(c => filaDeVacaciones(c, ciclo, hoy))
    .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
  const sum = k => filas.reduce((a, f) => a + f[k], 0);
  return {
    sucursalId: (sucursal || {}).id || '',
    nombre: (sucursal || {}).nombre || '',
    filas,
    personas: filas.length,
    legales: sum('legales'),
    pendienteAnterior: sum('pendienteAnterior'),
    total: sum('total'),
    planificados: sum('planificados'),
    tomados: sum('tomados'),
    saldo: sum('saldo'),
    sinPlanificar: filas.filter(f => f.sinPlanificar).length
  };
}

/**
 * Con cuánta gente queda el piso cada día del ciclo.
 *
 * **Se calcula día por día y se informa el peor día de cada mes.** Por mes no
 * alcanza: dos personas afuera la misma semana y dos en semanas distintas dan
 * el mismo total mensual y son dos situaciones opuestas, y esa es exactamente
 * la pregunta que la planilla no contesta.
 *
 * El piso se compara contra `minimoTurno` —con cuánta gente abre la tienda en
 * condiciones—, que es un campo de la ficha de la sucursal. Sin ese número no
 * se marca nada en rojo: inventar un mínimo sería peor que no tenerlo.
 */
function coberturaDeVacaciones(sucursal, ciclo) {
  const s = sucursal || {};
  const gente = (s.colaboradores || [])
    .filter(c => sigueEnElPlantel(c) && !esNoPresencial(c).noPresencial);
  const dotacion = gente.reduce((a, c) => a + jornadaDeVinculo(c).fte, 0);
  const minimo = Number(s.minimoTurno) || 0;

  const fuera = [];
  gente.forEach(c => {
    tramosDeVacaciones(c, ciclo).forEach(t => {
      if (!t.hasta) return;
      fuera.push({ desde: t.desde, hasta: t.hasta, fte: jornadaDeVinculo(c).fte,
                   nombre: c.nombre || '', id: c.id });
    });
  });

  const meses = ciclo.meses.map(mes => {
    const [a, m] = mes.split('-').map(Number);
    const ultimo = _vacFinDeMes(a, m);
    let peorFte = 0, peorDia = '', salen = [];
    for (let d = 1; d <= ultimo; d++) {
      const iso = `${a}-${_vacPad(m)}-${_vacPad(d)}`;
      const hoyFuera = fuera.filter(f => f.desde <= iso && f.hasta >= iso);
      const fte = hoyFuera.reduce((x, f) => x + f.fte, 0);
      if (fte > peorFte) { peorFte = fte; peorDia = iso; salen = hoyFuera.slice(); }
    }
    const piso = dotacion - peorFte;
    return {
      mes, fteFuera: peorFte, peorDia, salen,
      piso,
      /* Sin mínimo cargado no hay veredicto: `bajoMinimo` queda en falso y la
         pantalla dice que falta el dato en vez de pintar un rojo inventado. */
      bajoMinimo: minimo > 0 && piso < minimo,
      /* Quién sale en el mes, aunque no sea el peor día: es lo que se mira
         para mover una salida una semana. */
      salidas: fuera.filter(f => f.desde.slice(0, 7) === mes)
    };
  });

  return { dotacion, minimo, meses,
           mesesBajoMinimo: meses.filter(x => x.bajoMinimo).length };
}

/** El cuadro de toda el área, una fila por tienda. */
function vacacionesDelArea(estado, ciclo, hoy) {
  const e = estado || {};
  const tiendas = (e.sucursales || []).map(s => {
    const plan = planDeVacaciones(s, ciclo, hoy);
    const cob = coberturaDeVacaciones(s, ciclo);
    return Object.assign(plan, { cobertura: cob, codigo: s.codigo || '', tipo: s.tipo || 'venta' });
  }).filter(t => t.personas > 0);
  const sum = k => tiendas.reduce((a, t) => a + t[k], 0);
  return {
    tiendas: tiendas.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')),
    personas: sum('personas'),
    total: sum('total'),
    planificados: sum('planificados'),
    tomados: sum('tomados'),
    saldo: sum('saldo'),
    sinPlanificar: sum('sinPlanificar'),
    mesesBajoMinimo: tiendas.reduce((a, t) => a + t.cobertura.mesesBajoMinimo, 0)
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VACACIONES_DEFECTO, cicloDeVacaciones, nombreDeCiclo, diasDeTramo,
    antiguedadParaVacaciones, derechoDeVacaciones, tramosDeVacaciones,
    filaDeVacaciones, planDeVacaciones, coberturaDeVacaciones, vacacionesDelArea
  };
}

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
   La LCT (art. 154) las ubica entre el 1 de octubre y el 30 de abril, que es
   la ventana que usa el área, pero la planilla del coordinador venía
   planificando desde julio: los meses son un parámetro y no una constante, y
   lo que cae antes de la ventana no se pierde —ver `tramosFueraDeVentana()`—. */
const VACACIONES_DEFECTO = { anio: 0, mesDesde: 10, mesHasta: 4 };

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
 * Las vacaciones de la misma persona que arrancaron **antes de la ventana**.
 *
 * La planilla del área planificaba desde julio y la ventana del panel arranca
 * en octubre, así que hay salidas reales que caen afuera. **No se tiran y no
 * se suman al saldo**: cuál ciclo pagó una salida de julio no se puede deducir
 * —podría ser el arrastre del ciclo anterior o un adelanto de éste— y
 * adivinarlo le descontaría días a alguien que todavía los tiene. Se nombran
 * en la fila, que es lo que el panel hace siempre con lo que no sabe.
 */
function tramosFueraDeVentana(c, ciclo) {
  const desdeAnio = `${ciclo.anio}-01-01`;
  return ((c && c.ausencias) || [])
    .filter(a => a.motivo === 'vacaciones' && a.desde &&
                 a.desde >= desdeAnio && a.desde < ciclo.desde)
    .map(a => ({ id: a.id, desde: a.desde, hasta: a.hasta || '',
                 dias: a.hasta ? diasDeTramo(a.desde, a.hasta) : 0 }))
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
  const antes = tramosFueraDeVentana(c, ciclo);
  return Object.assign({
    id: c.id, nombre: c.nombre || '', cargo: c.cargo || '', posicion: c.posicion || '',
    /* El casillero con el que se cuenta la cobertura, que para el laboratorio
       no es su posición. La fila lo lleva para que la tira del calendario
       sume por el mismo criterio que la tabla de arriba. */
    posicionCobertura: posicionDeCobertura(c),
    laboratorio: esDeLaboratorio(c),
    antes, diasAntes: antes.reduce((a, t) => a + t.dias, 0),
    fechaIngreso: c.fechaIngreso || c.fechaIngresoFTD || '',
    fte: jornadaDeVinculo(c).fte,
    tramos, planificados, tomados,
    saldo: d.total - planificados,
    sinPlanificar: planificados === 0 && !antes.length,
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
    diasAntes: sum('diasAntes'),
    conTramosAntes: filas.filter(f => f.antes.length).length,
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
                   posicion: posicionDeCobertura(c),
                   nombre: c.nombre || '', id: c.id });
    });
  });

  /* **La dotación también se cuenta por posición, en personas y no en FTE.**
     «Te quedás sin dos APV» es una pregunta sobre cabezas que cubren un turno:
     dos farmacéuticos de media jornada son un FTE y son dos personas, y el que
     se va de vacaciones deja un turno sin cubrir, no medio. El FTE sigue
     contestando la otra pregunta —cuánto turno queda en total— y por eso van
     los dos. */
  const posiciones = {};
  gente.forEach(c => {
    /* `posicionDeCobertura()` y no `c.posicion`: el laboratorio cuenta en su
       propio casillero y no en APV. Si no, los ocho del laboratorio de Olivos
       hacen que la tienda parezca tener diez APV y que nunca quede corta. */
    const k = posicionDeCobertura(c);
    posiciones[k] = (posiciones[k] || 0) + 1;
  });

  const meses = ciclo.meses.map(mes => {
    const [a, m] = mes.split('-').map(Number);
    const ultimo = _vacFinDeMes(a, m);
    let peorFte = 0, peorDia = '', salen = [];
    /* Por posición se guarda el peor día de cada una, que no tiene por qué ser
       el mismo que el peor del total: el día que se van tres personas puede ser
       uno y el día que se van los dos APV, otro. */
    const porPos = {};
    Object.keys(posiciones).forEach(k => {
      porPos[k] = { posicion: k, dotacion: posiciones[k], fuera: 0, quedan: posiciones[k],
                    peorDia: '', nombres: [] };
    });

    for (let d = 1; d <= ultimo; d++) {
      const iso = `${a}-${_vacPad(m)}-${_vacPad(d)}`;
      const hoyFuera = fuera.filter(f => f.desde <= iso && f.hasta >= iso);
      const fte = hoyFuera.reduce((x, f) => x + f.fte, 0);
      if (fte > peorFte) { peorFte = fte; peorDia = iso; salen = hoyFuera.slice(); }

      const cuenta = {};
      hoyFuera.forEach(f => {
        (cuenta[f.posicion] || (cuenta[f.posicion] = [])).push(f.nombre);
      });
      Object.keys(cuenta).forEach(k => {
        const p = porPos[k];
        if (!p || cuenta[k].length <= p.fuera) return;
        p.fuera = cuenta[k].length;
        p.quedan = p.dotacion - p.fuera;
        p.peorDia = iso;
        p.nombres = cuenta[k].slice();
      });
    }

    const piso = dotacion - peorFte;
    const posicionesEnRiesgo = Object.values(porPos)
      /* Dos umbrales y no uno. **Que una posición quede en cero es categórico**
         —ese día no hay ningún APV en el piso— y no depende de ningún mínimo
         configurado. Que se vaya la mitad o más es un aviso: todavía queda
         alguien, pero la tienda opera distinto y conviene verlo antes de
         firmar el calendario. */
      .filter(p => p.fuera > 0 && (p.quedan === 0 || p.fuera * 2 >= p.dotacion))
      .map(p => Object.assign({}, p, { nivel: p.quedan === 0 ? 'rojo' : 'ambar' }))
      .sort((x, y) => (x.quedan - y.quedan) || (y.fuera - x.fuera));

    return {
      mes, fteFuera: peorFte, peorDia, salen,
      piso,
      porPosicion: Object.values(porPos).sort((x, y) => x.quedan - y.quedan),
      posicionesEnRiesgo,
      sinNadie: posicionesEnRiesgo.filter(p => p.quedan === 0),
      /* Sin mínimo cargado no hay veredicto: `bajoMinimo` queda en falso y la
         pantalla dice que falta el dato en vez de pintar un rojo inventado. */
      bajoMinimo: minimo > 0 && piso < minimo,
      /* Quién sale en el mes, aunque no sea el peor día: es lo que se mira
         para mover una salida una semana. */
      salidas: fuera.filter(f => f.desde.slice(0, 7) === mes)
    };
  });

  return { dotacion, minimo, meses, posiciones,
           mesesBajoMinimo: meses.filter(x => x.bajoMinimo).length,
           mesesSinPosicion: meses.filter(x => x.sinNadie.length).length,
           /* La lista plana que lee la pantalla y el aviso del alta: un renglón
              por mes y posición, lo más grave primero. */
           avisos: meses.flatMap(x => x.posicionesEnRiesgo.map(p =>
             Object.assign({ mes: x.mes }, p)))
             .sort((x, y) => (x.quedan - y.quedan) || x.mes.localeCompare(y.mes)) };
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
    mesesBajoMinimo: tiendas.reduce((a, t) => a + t.cobertura.mesesBajoMinimo, 0),
    sinPosicion: tiendas.reduce((a, t) => a + t.cobertura.mesesSinPosicion, 0)
  };
}

/* ================= La planilla de planificación ===================== *
 *
 * El área la lleva en Excel, con **una hoja por tienda** y diez pares de
 * columnas SALIDA/RETORNO. Pegar hoja por hoja es lo que ya salió mal con el
 * libro de novedades —catorce pegadas y una en la tienda equivocada que no se
 * nota hasta el cierre—, así que acá se pega **una tabla plana con una fila
 * por tramo**: la misma forma que el libro, el parte y el formulario.
 *
 * Quien no tiene ninguna salida planificada entra igual, con las dos fechas
 * vacías: su fila sirve para cargar los días que arrastra del ciclo anterior,
 * que es un dato que el panel no puede deducir.
 */
const COLUMNAS_PLAN_VACACIONES = [
  { campo: 'tienda',   claves: ['tienda', 'sucursal'] },
  { campo: 'nombre',   claves: ['apellido y nombre', 'colaborador', 'nombre'] },
  { campo: 'cuil',     claves: ['cuil', 'dni', 'documento'] },
  { campo: 'ingreso',  claves: ['ingreso'] },
  { campo: 'pendiente', claves: ['pend'] },
  { campo: 'desde',    claves: ['salida', 'desde'] },
  /* **El retorno es el día que vuelve, no el último de licencia.** Así lo
     escribe la planilla —sale el 26/10 y retorna el 12/11, que son 17 días— y
     así lo entiende el gerente. El panel guarda el último día, como cualquier
     otra licencia, y la conversión se hace acá, en un solo lugar. */
  { campo: 'retorno',  claves: ['retorno', 'regreso', 'vuelve'] }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VACACIONES_DEFECTO, cicloDeVacaciones, nombreDeCiclo, diasDeTramo,
    antiguedadParaVacaciones, derechoDeVacaciones, tramosDeVacaciones,
    filaDeVacaciones, planDeVacaciones, coberturaDeVacaciones, vacacionesDelArea,
    tramosFueraDeVentana, COLUMNAS_PLAN_VACACIONES
  };
}

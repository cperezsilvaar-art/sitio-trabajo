/* ================================ AGENDA ================================
 *
 * La agenda de trabajo del coordinador: lo que tiene que hacer, lo que está
 * esperando que le respondan, y lo que le informaron y no se puede olvidar.
 *
 * No es un tablón de anuncios ni una lista de tareas genérica. Lo que se anota
 * acá casi siempre tiene una fecha —"los adelantos se piden hasta el 14",
 * "llamar a Ana el jueves"— y a las cuatro de la tarde del 13 lo único que
 * importa es saber qué vence mañana. Por eso el módulo está armado alrededor
 * de las fechas: se escribe la línea como uno la diría y el panel le saca la
 * fecha. Si hubiera que elegirla en un calendario, no se anotaría.
 */

/** En qué estado está cada cosa que se lleva. */
const ESTADOS_AGENDA = [
  { id: 'pendiente', nombre: 'Pendiente',  icono: '○', ayuda: 'Es mío y todavía no lo hice.' },
  { id: 'esperando', nombre: 'Esperando',  icono: '⏳', ayuda: 'Ya lo pedí; la pelota está del otro lado.' },
  { id: 'hecho',     nombre: 'Hecho',      icono: '✓', ayuda: 'Cerrado.', cerrado: true }
];

const ESTADOS_AGENDA_POR_ID = ESTADOS_AGENDA.reduce((a, e) => (a[e.id] = e, a), {});

/** De qué es. Sirve para filtrar y para saber a quién reclamarle. */
const TEMAS_AGENDA = [
  { id: 'pagos',     nombre: 'Pagos y beneficios', icono: '💰' },
  { id: 'convenio',  nombre: 'Convenio y normativa', icono: '📋' },
  { id: 'operacion', nombre: 'Operación de tienda', icono: '🏪' },
  { id: 'gente',     nombre: 'Gente', icono: '👥' },
  { id: 'formacion', nombre: 'Formación', icono: '🎓' },
  { id: 'seguimiento', nombre: 'Seguimiento de visita', icono: '📍' },
  { id: 'otros',     nombre: 'Otros', icono: '📌' }
];

const TEMAS_AGENDA_POR_ID = TEMAS_AGENDA.reduce((a, t) => (a[t.id] = t, a), {});

const MESES_ES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12
};

const DIAS_ES = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6
};

/** Sin tildes y en minúscula, para poder buscar palabras clave. */
function _sinTildes(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function _iso(anio, mes, dia) {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  if (d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
  return d.toISOString().slice(0, 10);
}

function _sumarDias(iso, n) {
  return new Date(new Date(iso).getTime() + n * 864e5).toISOString().slice(0, 10);
}

/**
 * Palabras que suelen acompañar a una fecha y dicen qué pasa ese día. Se usan
 * para etiquetar el hito sin que haya que escribirlo.
 */
const PISTAS_HITO = [
  { re: /hasta el|plazo|fecha limite|ultimo dia|vence|cierre de/, que: 'Último día' },
  { re: /se abonar|se pagar|se acredit|sera abonad|seran abonad|se liquidar|pago el|abonad/, que: 'Pago' },
  { re: /se proyecta liquidar|estimad|previst/, que: 'Pago estimado' },
  { re: /a partir del|desde el|comienza|arranca|inicia/, que: 'Arranca' },
  { re: /reunion|capacitacion|curso|taller|inventario|visita/, que: 'Evento' },
  { re: /llamar|hablar|escribir|mandar|enviar|pedir|reclamar|responder|revisar|firmar|cargar|subir|armar|preparar|cerrar|coordinar|agendar|entregar|confirmar/, que: 'Hacer' }
];

/**
 * Extrae las fechas de un texto escrito como uno lo diría.
 *
 * Reconoce "9 de septiembre", "14/09", "17-09-2026", "14 y 17 de septiembre",
 * y las formas de todos los días: "hoy", "mañana", "el lunes", "el lunes que
 * viene", "en 3 días".
 *
 * Cuando no hay año —que es lo habitual— usa el de la fecha de referencia, y si
 * eso deja la fecha más de tres meses en el pasado la pasa al año siguiente: un
 * apunte de diciembre que dice "5 de enero" habla del enero que viene.
 */
function fechasDeTexto(texto, refISO) {
  const crudo = String(texto || '');
  const plano = _sinTildes(crudo);
  const ref = refISO || new Date().toISOString().slice(0, 10);
  const anioRef = Number(ref.slice(0, 4));
  const hallazgos = [];

  /* Separadores de cláusula. Hacen falta porque una sola línea puede llevar dos
     fechas con sentidos opuestos: "las solicitudes se piden hasta el 14 y se
     abonan el 17". Mirando la línea entera, el 17 quedaba como "último día". */
  const CORTE = /[,;:]|\sy\s|\spero\s|\smientras\s/g;

  const registrar = (iso, inicio, fin) => {
    if (!iso) return;
    const desde = Math.max(0, plano.lastIndexOf('\n', inicio) + 1);
    const cierre = plano.indexOf('\n', fin);
    const hastaLinea = cierre === -1 ? crudo.length : cierre;
    const linea = crudo.slice(desde, hastaLinea).trim();

    let iniClausula = desde, finClausula = hastaLinea;
    CORTE.lastIndex = desde;
    let c;
    while ((c = CORTE.exec(plano)) !== null && c.index < hastaLinea) {
      if (c.index + c[0].length <= inicio) iniClausula = c.index + c[0].length;
      else if (c.index >= fin) { finClausula = c.index; break; }
    }
    const clausula = _sinTildes(crudo.slice(iniClausula, finClausula));
    const pista = PISTAS_HITO.find(p => p.re.test(clausula)) ||
                  PISTAS_HITO.find(p => p.re.test(_sinTildes(linea)));
    const que = pista ? pista.que : 'Fecha';

    /* La misma fecha puede ser dos cosas distintas —el 14 es el último día para
       pedir adelantos y también el pago de la variable de Dermo—, así que se
       repite por concepto y no solo por día. */
    if (hallazgos.some(h => h.fecha === iso && h.que === que)) return;
    hallazgos.push({
      fecha: iso, que,
      contexto: linea.replace(/\s+/g, ' ').slice(0, 160),
      /* Se recuerda de qué parte del texto salió, para no anotar dos veces el
         mismo hecho cuando la frase lo dice de dos formas: "se abona mañana,
         9 de septiembre" es una fecha, no dos. */
      _desde: iniClausula, _hasta: finClausula
    });
  };

  /** ¿Esta parte del texto ya produjo una fecha? */
  const clausulaYaUsada = (ini, fin) =>
    hallazgos.some(h => h._desde < fin && ini < h._hasta);

  const ajustarAnio = (mes, dia) => {
    let iso = _iso(anioRef, mes, dia);
    if (!iso) return null;
    const limite = new Date(ref);
    limite.setUTCMonth(limite.getUTCMonth() - 3);
    if (new Date(iso) < limite) iso = _iso(anioRef + 1, mes, dia);
    return iso;
  };

  /* "12 de agosto de 2026", "9 de septiembre" y "14 y 17 de septiembre" */
  const nombreMes = Object.keys(MESES_ES).join('|');
  const reTexto = new RegExp(
    '(\\d{1,2})(?:\\s*(?:,|y|al|a)\\s*(\\d{1,2}))?\\s+de\\s+(' + nombreMes + ')' +
    '(?:\\s+de(?:l)?\\s+(\\d{4}))?', 'g');
  let m;
  while ((m = reTexto.exec(plano)) !== null) {
    const mes = MESES_ES[m[3]];
    const anio = m[4] ? Number(m[4]) : null;
    [m[1], m[2]].filter(Boolean).forEach(d => {
      const dia = Number(d);
      registrar(anio ? _iso(anio, mes, dia) : ajustarAnio(mes, dia), m.index, m.index + m[0].length);
    });
  }

  /* "14/09", "17-09-2026", "17/09/26" */
  const reNumero = /(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/g;
  while ((m = reNumero.exec(plano)) !== null) {
    const dia = Number(m[1]), mes = Number(m[2]);
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) continue;
    let anio = m[3] ? Number(m[3]) : null;
    if (anio !== null && anio < 100) anio += 2000;
    registrar(anio ? _iso(anio, mes, dia) : ajustarAnio(mes, dia), m.index, m.index + m[0].length);
  }

  /* "hoy", "mañana", "pasado mañana" */
  const relativos = [
    { re: /\bhoy\b/g, dias: 0 },
    { re: /\bpasado manana\b/g, dias: 2 },
    { re: /\bmanana\b/g, dias: 1 }
  ];
  /* "Se abonará mañana, 9 de septiembre" nombra una sola fecha de dos maneras.
     Cuando el relativo viene pegado a una fecha explícita —eso es una
     aposición, no dos hechos— se queda la explícita, que es la que después se
     puede verificar contra el calendario. */
  const nombreMesRe = Object.keys(MESES_ES).join('|');
  const reAposicion = new RegExp(
    '^[\\s,;:.\u2014-]*(?:\\d{1,2}\\s+de\\s+(?:' + nombreMesRe + ')|\\d{1,2}[/-]\\d{1,2})');

  relativos.forEach(r => {
    r.re.lastIndex = 0;
    let x;
    while ((x = r.re.exec(plano)) !== null) {
      const fin = x.index + x[0].length;
      if (reAposicion.test(plano.slice(fin, fin + 30))) continue;
      if (clausulaYaUsada(x.index, fin)) continue;
      registrar(_sumarDias(ref, r.dias), x.index, fin);
    }
  });

  /* "en 3 días", "en dos semanas" */
  const reEn = /\ben\s+(\d{1,3})\s+(dias?|semanas?)\b/g;
  while ((m = reEn.exec(plano)) !== null) {
    if (clausulaYaUsada(m.index, m.index + m[0].length)) continue;
    const n = Number(m[1]) * (/semana/.test(m[2]) ? 7 : 1);
    registrar(_sumarDias(ref, n), m.index, m.index + m[0].length);
  }

  /* "el lunes", "el lunes que viene", "el próximo martes" */
  const nombreDia = Object.keys(DIAS_ES).join('|');
  const reDia = new RegExp(
    '\\b(?:el\\s+|este\\s+|proximo\\s+)?(' + nombreDia + ')(\\s+que\\s+viene|\\s+proximo)?\\b', 'g');
  while ((m = reDia.exec(plano)) !== null) {
    if (clausulaYaUsada(m.index, m.index + m[0].length)) continue;
    const objetivo = DIAS_ES[m[1]];
    const hoyDia = new Date(ref).getUTCDay();
    /* "el lunes" dicho un lunes es el lunes que viene, no hoy. Y "el lunes que
       viene" se toma como el mismo día: en el uso corriente son lo mismo, y
       adelantar una fecha molesta menos que atrasarla. */
    const delta = (objetivo - hoyDia + 7) % 7 || 7;
    registrar(_sumarDias(ref, delta), m.index, m.index + m[0].length);
  }

  return hallazgos
    .map(h => ({ fecha: h.fecha, que: h.que, contexto: h.contexto }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Tema probable, para no obligar a elegirlo en un menú. */
function temaDeTexto(texto) {
  const t = _sinTildes(texto);
  if (/sueldo|pago|abonar|adelanto|comision|compensacion variable|bono|aguinaldo|liquidac|nubi|acredit|recibo/.test(t)) return 'pagos';
  if (/paritaria|convenio|escala|licencia|ley |decreto|articulo|sindicat|gremio/.test(t)) return 'convenio';
  if (/inventario|promocion|feriado|horario|apertura|cierre de tienda|campana|quiebre/.test(t)) return 'operacion';
  if (/capacitacion|curso|taller|certificac|formacion|induccion|e-learning/.test(t)) return 'formacion';
  if (/visita|recorrida|sucursal|tienda .*(visit|recorr)/.test(t)) return 'seguimiento';
  if (/ingreso|egreso|renuncia|traslado|cumpleanos|reconocimiento|bienvenid|entrevista|busqueda/.test(t)) return 'gente';
  return 'otros';
}

/** Estado probable: si la línea dice que se le pidió algo a alguien, se espera. */
function estadoDeTexto(texto) {
  const t = _sinTildes(texto);
  return /\b(pedi|solicite|mande|escribi|consulte|reclame|espero|quedaron en|me van a|estan viendo)\b/.test(t)
    ? 'esperando' : 'pendiente';
}

/* ------------------------------------------------------------------ *
 * Novedades que hay que pasar a la liquidación                         *
 * ------------------------------------------------------------------ *
 * Distinto de `c.novedades`, que es lo que la liquidación **devolvió** ya
 * cerrado. Esto es lo de antes: las cosas que van apareciendo durante el mes
 * —un franco trabajado, un faltante de caja, unas horas extras, un adelanto—
 * y que hay que acordarse de pasar antes del cierre.
 *
 * Aparecen de a una, sueltas, en un mail o en un WhatsApp de un gerente, y el
 * problema real no es anotarlas: es tenerlas todas juntas el día del cierre.
 * Por eso no son una pantalla nueva sino una marca sobre la agenda, que ya es
 * donde caen cuando se pegan.
 */

/** El día del mes en que cierran las novedades, si no se configuró otro. */
const CIERRE_NOVEDADES_POR_DEFECTO = 25;

/**
 * Las palabras que delatan una novedad de liquidación. Son los conceptos de la
 * planilla de Nómina, no una lista de sinónimos: si aparece uno de estos, lo
 * que se está anotando termina en un recibo de sueldo.
 */
const PALABRAS_LIQUIDACION =
  /\bhoras? extras?\b|\bhs\.? ?extras?\b|\bhe ?(50|100)\b|nocturn|feriado trabajado|franco trabajado|\badelanto\b|faltante de caja|faltante de cajero|dia del gremio|dias? de examen|\bmudanza\b|licencia por fallecimiento|\bplus\b|\bviatico|\bpresentismo\b|\bembargo\b|cambio de turno|\bsac\b|aguinaldo|reintegro/;

/**
 * A qué período de liquidación entra algo anotado hoy.
 *
 * Pasado el cierre, lo que aparece ya no llega a este mes y va al siguiente.
 * Meterlo igual en el mes en curso es peor que no marcarlo: el día del cierre
 * aparecería en la lista algo que Nómina no va a tomar.
 */
function periodoDeLiquidacion(fechaISO, diaCierre) {
  const f = String(fechaISO || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return '';
  const corte = Number(diaCierre) || CIERRE_NOVEDADES_POR_DEFECTO;
  let anio = Number(f.slice(0, 4));
  let mes = Number(f.slice(5, 7));
  if (Number(f.slice(8, 10)) > corte) {
    mes += 1;
    if (mes > 12) { mes = 1; anio += 1; }
  }
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/**
 * Si el texto pegado parece una novedad para la liquidación, el período al que
 * entra; si no, cadena vacía. Se ofrece, no se impone: la marca queda visible
 * en la ficha y se saca con un clic, porque un falso positivo que no se puede
 * desmarcar ensucia el parte del cierre.
 */
function liquidacionDeTexto(texto, fechaRef, diaCierre) {
  return PALABRAS_LIQUIDACION.test(_sinTildes(texto))
    ? periodoDeLiquidacion(fechaRef || new Date().toISOString().slice(0, 10), diaCierre)
    : '';
}

/** El período en curso y cuántos días faltan para el cierre. */
function cierreDeNovedades(hoyISO, diaCierre) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const corte = Number(diaCierre) || CIERRE_NOVEDADES_POR_DEFECTO;
  const periodo = periodoDeLiquidacion(hoy, corte);
  /* El cierre del período en curso: si hoy ya pasó el corte, el que viene es
     el del mes siguiente, que es justamente el período que devolvió la cuenta
     de arriba. */
  const [anio, mes] = periodo.split('-').map(Number);
  const ultimo = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const dia = Math.min(corte, ultimo);
  const fecha = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return {
    periodo,
    fecha,
    dias: Math.round((new Date(fecha + 'T00:00:00') - new Date(hoy + 'T00:00:00')) / 864e5),
    diaCierre: corte
  };
}

/** Las novedades anotadas para un período, las abiertas primero. */
function novedadesDeLiquidacion(items, periodo) {
  return (items || [])
    .filter(i => i.liquidacion && (!periodo || i.liquidacion === periodo))
    .sort((a, b) => {
      const ca = (ESTADOS_AGENDA_POR_ID[a.estado] || {}).cerrado ? 1 : 0;
      const cb = (ESTADOS_AGENDA_POR_ID[b.estado] || {}).cerrado ? 1 : 0;
      return ca - cb || String(a.fecha || '').localeCompare(String(b.fecha || ''));
    });
}

/** '2026-09' se lee «septiembre de 2026». En pantalla nunca va el ISO. */
function nombreDePeriodo(periodo) {
  const p = String(periodo || '');
  if (!/^\d{4}-\d{2}$/.test(p)) return p || 'sin período';
  const nombres = Object.keys(MESES_ES).filter(k => k !== 'setiembre');
  const mes = nombres.find(k => MESES_ES[k] === Number(p.slice(5, 7)));
  return mes ? `${mes} de ${p.slice(0, 4)}` : p;
}

/** Los períodos que tienen algo anotado, del más nuevo al más viejo. */
function periodosDeLiquidacion(items) {
  const set = {};
  (items || []).forEach(i => { if (i.liquidacion) set[i.liquidacion] = true; });
  return Object.keys(set).sort().reverse();
}

/** Título: la primera línea con texto, sin emojis ni viñetas. */
function tituloDeTexto(texto) {
  const linea = String(texto || '').split('\n')
    .map(l => l.replace(/^[\s•\-*|]+/, '').trim())
    .find(l => l.replace(/[^\p{L}\p{N}]/gu, '').length >= 4);
  if (!linea) return '';
  return linea
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s*\|\s*/g, ' · ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

/**
 * Cuándo cae cada cosa respecto de hoy. Lo que ya está hecho no vence: se
 * saca del camino aunque su fecha haya pasado.
 */
function estadoItem(item, hoyISO) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const dias = f => Math.round((new Date(f) - new Date(hoy)) / 864e5);

  if ((ESTADOS_AGENDA_POR_ID[item.estado] || {}).cerrado) {
    return { clase: 'hecho', texto: 'Hecho', proximo: null, dias: null, vencido: false };
  }

  const hitos = (item.hitos || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!hitos.length) {
    return { clase: 'sinFecha', texto: 'Sin fecha', proximo: null, dias: null, vencido: false };
  }

  const futuros = hitos.filter(h => h.fecha >= hoy);
  const proximo = futuros[0] || null;
  if (!proximo) {
    const ultimo = hitos[hitos.length - 1];
    const d = dias(ultimo.fecha);
    return {
      clase: 'vencido',
      texto: d === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(d)} días`,
      proximo: null, dias: d, vencido: true
    };
  }
  const d = dias(proximo.fecha);
  const texto = d === 0 ? `${proximo.que}: hoy`
              : d === 1 ? `${proximo.que}: mañana`
              : `${proximo.que}: en ${d} días`;
  return {
    clase: d <= 1 ? 'urgente' : d <= 7 ? 'semana' : 'adelante',
    texto, proximo, dias: d, vencido: false
  };
}

/** La agenda repartida en los cajones en que se la mira. */
function repartirAgenda(items, hoyISO) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const con = (items || []).map(i => ({ item: i, estado: estadoItem(i, hoy) }));
  const de = clase => con.filter(x => x.estado.clase === clase)
    .sort((a, b) => (a.estado.dias ?? 0) - (b.estado.dias ?? 0));

  return {
    total: con.length,
    vencidas: de('vencido'),
    urgentes: de('urgente'),
    semana: de('semana'),
    adelante: de('adelante'),
    sinFecha: de('sinFecha'),
    hechas: de('hecho'),
    abiertas: con.filter(x => x.estado.clase !== 'hecho'),
    esperando: con.filter(x => x.item.estado === 'esperando' && x.estado.clase !== 'hecho'),
    /* Las fechas —no los apuntes— de los próximos siete días: un apunte con
       tres fechas ocupa tres renglones en la agenda de la semana. */
    agenda: (items || [])
      .filter(i => !(ESTADOS_AGENDA_POR_ID[i.estado] || {}).cerrado)
      .flatMap(i => (i.hitos || []).map(h => ({
        item: i, hito: h,
        dias: Math.round((new Date(h.fecha) - new Date(hoy)) / 864e5)
      })))
      .filter(x => x.dias >= -30 && x.dias <= 7)
      .sort((a, b) => a.dias - b.dias)
  };
}

/**
 * El apunte listo para reenviar. Se manda por WhatsApp, así que va sin
 * encabezado y con las fechas al final, que es lo que después preguntan.
 */
function textoParaTiendas(item, hoyISO) {
  const tema = TEMAS_AGENDA_POR_ID[item.tema] || TEMAS_AGENDA_POR_ID.otros;
  const L = [`${tema.icono} ${(item.titulo || tema.nombre).toUpperCase()}`, ''];
  if (String(item.detalle || '').trim()) {
    L.push(String(item.detalle).trim());
    L.push('');
  }
  const hitos = (item.hitos || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (hitos.length) {
    L.push('Fechas:');
    hitos.forEach(h => {
      const p = h.fecha.split('-');
      L.push(`  · ${p[2]}/${p[1]} — ${h.que}`);
    });
    L.push('');
  }
  const e = estadoItem(item, hoyISO);
  if (e.clase === 'urgente' && e.proximo) {
    const p = e.proximo.fecha.split('-');
    L.push(e.dias === 0 ? `⚠ Es hoy (${p[2]}/${p[1]}).` : `⚠ Es mañana (${p[2]}/${p[1]}).`);
  }
  return L.join('\n').trim();
}

/* ---------------- Lo que quedó pendiente, junto en la agenda ----------------
 *
 * Un proceso de baja empieza el día que la persona deja de venir y sigue
 * quince días más, en cinco lugares distintos. Lo mismo la ausencia sin
 * certificado, el reclamo sin cerrar, el traspaso sin autorizar. Cada cosa
 * está bien guardada en su pantalla, pero ninguna de esas pantallas es la que
 * se abre a la mañana para ver qué hay que hacer: esa es la agenda.
 *
 * Esto **no copia nada**. Lee dónde vive cada cosa y arma la lista; el tilde
 * se sigue poniendo en su lugar. Copiarlo a `e.agenda` daría dos casillas para
 * lo mismo, y a la semana una diría una cosa y la otra, otra.
 */

/** Días entre dos fechas ISO, o null si falta alguna. */
function _diasDesde(iso, hoyISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  const a = Date.UTC(...iso.split('-').map(Number).map((n, i) => i === 1 ? n - 1 : n));
  const h = hoyISO || _diaHoy();
  const b = Date.UTC(...h.split('-').map(Number).map((n, i) => i === 1 ? n - 1 : n));
  return Math.round((b - a) / 86400000);
}

/* Cuántos días puede quedar algo abierto antes de que pase de «en curso» a
   «esto se te está yendo». No es un plazo legal: es el punto en que el
   coordinador ya no se acuerda solo. */
const DIAS_PARA_INSISTIR = 15;

/**
 * Todo lo que quedó a medias en el área, de dónde vive cada cosa.
 * Devuelve grupos `{ id, titulo, ruta, items[] }`, sin los grupos vacíos.
 * Cada ítem: `{ que, quien, detalle, desde, dias, ruta, tono }`.
 */
function pendientesDelArea(estado, hoyISO) {
  const hoy = hoyISO || _diaHoy();
  const e = estado || {};
  const grupos = [];
  const tono = d => d === null ? '' : d >= DIAS_PARA_INSISTIR ? 'rojo' : 'ambar';

  /* 0. Los casos en seguimiento que piden algo. Van primero porque son los
        que tienen a alguien esperando del otro lado —un estudio, una junta
        médica— y los que peor envejecen si se los suelta. */
  if (typeof casosDelArea === 'function') {
    const casos = casosDelArea(e, hoy)
      .filter(x => x.estado.pide)
      .map(x => {
        const dias = _diasDesde(x.caso.abiertoEl, hoy);
        return {
          que: `${x.nombre} — ${x.estado.texto.toLowerCase()}`,
          quien: x.sucursal,
          detalle: x.caso.proximoPaso
            ? `próximo paso: ${x.caso.proximoPaso}`
            : (x.caso.resumen || 'sin próximo paso definido'),
          desde: x.caso.abiertoEl, dias, tono: x.caso.riesgo === 'critico' ? 'rojo' : tono(dias),
          ruta: '#/casos'
        };
      });
    if (casos.length) grupos.push({
      id: 'casos', titulo: 'Casos que piden algo', ruta: '#/casos', items: casos
    });
  }

  /* 1. Los trámites de una baja. El que se olvida aparece solo semanas
        después: alguien que conserva accesos, un recibo liquidado de más. */
  const bajas = [];
  (e.sucursales || []).forEach(s => (s.colaboradores || []).forEach(c => {
    if (!c.baja) return;
    const est = estadoTramitesBaja(c.baja);
    if (!est.pendiente || est.completa) return;
    const dias = _diasDesde(c.baja.fecha, hoy);
    bajas.push({
      que: `Baja de ${c.nombre}`,
      quien: s.nombre || s.codigo,
      detalle: `faltan ${est.faltan.length} de ${est.total}: ` +
               est.faltan.map(x => x.nombre).join(' · '),
      desde: c.baja.fecha, dias, tono: tono(dias),
      ruta: '#/movimientos/bajas'
    });
  }));
  if (bajas.length) grupos.push({
    id: 'bajas', titulo: 'Trámites de baja sin terminar',
    ruta: '#/movimientos/bajas', items: bajas
  });

  /* 2. Ausencias que piden algo hoy: casi siempre, reclamar el certificado. */
  const aus = (typeof alertasDeAusencias === 'function' ? alertasDeAusencias(e, hoy) : [])
    .map(a => {
      const dias = _diasDesde(a.ausencia.desde, hoy);
      return {
        que: a.nombre, quien: a.sucursal, detalle: a.estado.texto || '',
        desde: a.ausencia.desde, dias,
        tono: a.estado.clase === 'pendienteJustificar' ? tono(dias) : 'ambar',
        ruta: `#/diario/${a.colaboradorId}`
      };
    });
  if (aus.length) grupos.push({
    id: 'ausencias', titulo: 'Ausencias que piden algo', ruta: '#/diario', items: aus
  });

  /* 3. Reclamos abiertos: son de plata y el que los hizo está esperando. */
  const rec = (e.reclamos || [])
    .filter(r => !((typeof ESTADOS_RECLAMO_POR_ID !== 'undefined'
                    && ESTADOS_RECLAMO_POR_ID[r.estado]) || {}).cerrado)
    .map(r => {
      const s = (e.sucursales || []).find(x => x.id === r.sucursalId);
      const dias = _diasDesde(r.fecha, hoy);
      return {
        que: r.colaborador || 'Sin nombre', quien: s ? (s.nombre || s.codigo) : '',
        detalle: r.detalle || r.tipo || '', desde: r.fecha, dias, tono: tono(dias),
        ruta: r.sucursalId ? `#/reclamos/${r.sucursalId}` : '#/reclamos'
      };
    });
  if (rec.length) grupos.push({
    id: 'reclamos', titulo: 'Reclamos abiertos', ruta: '#/reclamos', items: rec
  });

  /* 4. Traspasos y modificaciones esperando tu visto bueno. Los autorizados
        con vigencia futura no van: ésos se aplican solos el día que toca. */
  const movs = [];
  (e.sucursales || []).forEach(s => (s.colaboradores || []).forEach(c => {
    (c.movimientos || []).forEach(m => {
      if (m.estado !== 'pendiente') return;
      const dias = _diasDesde(m.fecha, hoy);
      movs.push({
        que: c.nombre, quien: s.nombre || s.codigo,
        detalle: (typeof esTraspaso === 'function' && esTraspaso(m.tipo))
          ? 'traspaso de sucursal sin autorizar' : 'modificación de puesto sin autorizar',
        desde: m.fecha, dias, tono: tono(dias), ruta: '#/movimientos'
      });
    });
  }));
  if (movs.length) grupos.push({
    id: 'movimientos', titulo: 'Movimientos sin autorizar',
    ruta: '#/movimientos', items: movs
  });

  /* 5. Desarrollo: el mes que se fue sin la conversación con el gerente es
        justo el que no se recupera. */
  const dev = (typeof alertasDeDesarrollo === 'function' ? alertasDeDesarrollo(e, hoy) : [])
    .map(a => ({
      que: a.fila.colaborador ? a.fila.colaborador.nombre : 'Sin nombre',
      quien: a.fila.sucursal ? (a.fila.sucursal.nombre || a.fila.sucursal.codigo) : '',
      detalle: a.texto, desde: '', dias: null, tono: a.tono,
      ruta: `#/desarrollo/${a.fila.colaborador ? a.fila.colaborador.id : ''}`
    }));
  if (dev.length) grupos.push({
    id: 'desarrollo', titulo: 'Desarrollo al rol de Senior',
    ruta: '#/desarrollo', items: dev
  });

  /* 6. Lo que quedó comprometido en una visita y sigue sin cumplirse. */
  const plan = [];
  (e.sucursales || []).forEach(s => {
    const visitas = (e.visitas || []).filter(v => v.sucursalId === s.id);
    const ultima = visitas.slice().sort((a, b) =>
      String(b.fecha || '').localeCompare(String(a.fecha || '')))[0];
    if (!ultima) return;
    ((ultima.diagnostico || {}).plan || []).forEach(x => {
      if (x.estado === 'Cumplido' || !String(x.compromiso || '').trim()) return;
      const dias = _diasDesde(x.plazo || ultima.fecha, hoy);
      plan.push({
        que: x.compromiso.trim(), quien: s.nombre || s.codigo,
        detalle: x.responsable ? `a cargo de ${x.responsable}` : '',
        desde: x.plazo || ultima.fecha, dias,
        tono: x.plazo && dias > 0 ? 'rojo' : tono(dias),
        ruta: `#/visita/${ultima.id}/diagnostico`
      });
    });
  });
  if (plan.length) grupos.push({
    id: 'plan', titulo: 'Compromisos de la última visita',
    ruta: '#/sucursales', items: plan
  });

  /* Lo más viejo primero, adentro de cada grupo: es lo que más urge. */
  grupos.forEach(g => g.items.sort((a, b) => (b.dias || 0) - (a.dias || 0)));
  return grupos;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ESTADOS_AGENDA, ESTADOS_AGENDA_POR_ID, TEMAS_AGENDA, TEMAS_AGENDA_POR_ID,
    fechasDeTexto, temaDeTexto, estadoDeTexto, tituloDeTexto,
    estadoItem, repartirAgenda, textoParaTiendas,
    pendientesDelArea, DIAS_PARA_INSISTIR
  };
}

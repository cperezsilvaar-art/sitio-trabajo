/* ============================== CARTELERA ==============================
 *
 * Lo que le informan al coordinador y tiene que llegar a las tiendas: fechas
 * de pago, ventanas de adelantos, cambios de convenio, campañas.
 *
 * No es un cuaderno de notas. Casi todo lo que llega por este canal tiene una
 * fecha que vence —"los adelantos se piden hasta el 14"—, y lo único que
 * importa el 13 a la tarde es saber que vence mañana. Por eso el aviso se pega
 * tal como llegó y el módulo le extrae las fechas: si hubiera que cargarlas a
 * mano, no se cargarían.
 */

const CATEGORIAS_AVISO = [
  { id: 'pagos',    nombre: 'Pagos y beneficios', icono: '💰',
    ayuda: 'Sueldos, variables, comisiones, adelantos, bonos.' },
  { id: 'convenio', nombre: 'Convenio y normativa', icono: '📋',
    ayuda: 'Paritarias, escalas, licencias, cambios de la ley.' },
  { id: 'operacion', nombre: 'Operación de tienda', icono: '🏪',
    ayuda: 'Inventarios, promociones bancarias, horarios especiales, feriados.' },
  { id: 'gente',    nombre: 'Gente', icono: '👥',
    ayuda: 'Ingresos, egresos, traslados, reconocimientos.' },
  { id: 'formacion', nombre: 'Formación', icono: '🎓',
    ayuda: 'Capacitaciones, certificaciones, cursos obligatorios.' },
  { id: 'otros',    nombre: 'Otros', icono: '📢', ayuda: '' }
];

const CATEGORIAS_AVISO_POR_ID = CATEGORIAS_AVISO.reduce((a, c) => (a[c.id] = c, a), {});

const MESES_ES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12
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

/**
 * Palabras que suelen acompañar a una fecha y dicen qué pasa ese día. Se usan
 * para etiquetar el hito sin que el usuario tenga que escribirlo.
 */
const PISTAS_HITO = [
  { re: /hasta el|plazo|fecha limite|ultimo dia|vence|cierre de/, que: 'Último día' },
  { re: /se abonar|se pagar|se acredit|sera abonad|seran abonad|se liquidar|pago el|abonad/, que: 'Pago' },
  { re: /se proyecta liquidar|estimad|previst/, que: 'Pago estimado' },
  { re: /a partir del|desde el|comienza|arranca|inicia/, que: 'Arranca' },
  { re: /reunion|capacitacion|curso|taller|inventario/, que: 'Evento' }
];

/**
 * Extrae las fechas de un aviso pegado tal como llegó.
 *
 * Reconoce "9 de septiembre", "14/09", "17-09-2026" y "14 y 17 de septiembre".
 * Cuando no hay año —que es lo habitual en un mensaje interno— usa el del día
 * de publicación, y si eso deja la fecha más de tres meses en el pasado la
 * pasa al año siguiente: un aviso de diciembre que dice "5 de enero" habla del
 * enero que viene, no del que pasó.
 *
 * @param texto     el aviso completo
 * @param refISO    fecha de referencia (por defecto, hoy)
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

    /* La cláusula que contiene la fecha: entre el corte anterior y el siguiente. */
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
      contexto: linea.replace(/\s+/g, ' ').slice(0, 160)
    });
  };

  const ajustarAnio = (mes, dia) => {
    let iso = _iso(anioRef, mes, dia);
    if (!iso) return null;
    /* Tres meses de tolerancia hacia atrás: un aviso puede referirse a algo
       que ya pasó ("se pagó el 5"), pero no a algo de hace medio año. */
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

  return hallazgos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Categoría probable, para no obligar a elegirla en el menú. */
function categoriaDeTexto(texto) {
  const t = _sinTildes(texto);
  if (/sueldo|pago|abonar|adelanto|comision|compensacion variable|bono|aguinaldo|liquidac|nubi|acredit/.test(t)) return 'pagos';
  if (/paritaria|convenio|escala|licencia|ley |decreto|art\.|articulo/.test(t)) return 'convenio';
  if (/inventario|promocion|feriado|horario|apertura|cierre de tienda|campana/.test(t)) return 'operacion';
  if (/capacitacion|curso|taller|certificac|formacion|e-learning/.test(t)) return 'formacion';
  if (/ingreso|egreso|traslado|cumpleanos|reconocimiento|bienvenid/.test(t)) return 'gente';
  return 'otros';
}

/** Título sugerido: la primera línea con texto, sin emojis ni viñetas. */
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
 * Estado de un aviso respecto de hoy: qué hito viene, en cuántos días, y si ya
 * no queda nada por delante.
 */
function estadoAviso(aviso, hoyISO) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const hitos = (aviso.hitos || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  const dias = f => Math.round((new Date(f) - new Date(hoy)) / 864e5);

  const futuros = hitos.filter(h => h.fecha >= hoy);
  const proximo = futuros[0] || null;
  const ultimo = hitos[hitos.length - 1] || null;

  if (!hitos.length) {
    return { clase: 'sinFecha', texto: 'Sin fecha', proximo: null, dias: null, vencido: false };
  }
  if (!proximo) {
    return { clase: 'vencido', texto: `Terminó el ${ultimo.fecha}`, proximo: null,
             dias: dias(ultimo.fecha), vencido: true };
  }
  const d = dias(proximo.fecha);
  const texto = d === 0 ? `${proximo.que}: hoy`
              : d === 1 ? `${proximo.que}: mañana`
              : `${proximo.que}: en ${d} días`;
  return {
    clase: d <= 1 ? 'urgente' : d <= 3 ? 'proximo' : 'vigente',
    texto, proximo, dias: d, vencido: false
  };
}

/** Lo que hay que mirar de la cartelera, para el panel y el reporte del día. */
function resumirCartelera(avisos, hoyISO) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const con = (avisos || []).map(a => ({ aviso: a, estado: estadoAviso(a, hoy) }));
  return {
    total: con.length,
    urgentes: con.filter(x => x.estado.clase === 'urgente'),
    proximos: con.filter(x => x.estado.clase === 'proximo'),
    vigentes: con.filter(x => !x.estado.vencido),
    vencidos: con.filter(x => x.estado.vencido),
    /* La agenda de la semana lista fechas, no avisos: un mismo aviso puede
       tener el pago el 9, el vencimiento de adelantos el 14 y el pago de esos
       adelantos el 17, y las tres cosas hay que decirlas por separado. */
    agenda: (avisos || []).flatMap(a =>
        (a.hitos || []).map(h => ({
          aviso: a, hito: h,
          dias: Math.round((new Date(h.fecha) - new Date(hoy)) / 864e5)
        })))
      .filter(x => x.dias >= 0 && x.dias <= 7)
      .sort((a, b) => a.dias - b.dias || String(a.hito.que).localeCompare(String(b.hito.que)))
  };
}

/**
 * El aviso listo para reenviar a los gerentes. Se manda por WhatsApp, así que
 * va sin encabezado de reporte y con las fechas al final, que es lo que
 * después preguntan.
 */
function textoParaTiendas(aviso, hoyISO) {
  const cat = CATEGORIAS_AVISO_POR_ID[aviso.categoria] || CATEGORIAS_AVISO_POR_ID.otros;
  const L = [`${cat.icono} ${(aviso.titulo || cat.nombre).toUpperCase()}`, ''];
  if (String(aviso.cuerpo || '').trim()) {
    L.push(String(aviso.cuerpo).trim());
    L.push('');
  }
  const hitos = (aviso.hitos || []).slice().sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (hitos.length) {
    L.push('Fechas:');
    hitos.forEach(h => {
      const [a, m, d] = h.fecha.split('-');
      L.push(`  · ${d}/${m} — ${h.que}`);
    });
    L.push('');
  }
  const e = estadoAviso(aviso, hoyISO);
  if (e.clase === 'urgente' && e.proximo) {
    const [a, m, d] = e.proximo.fecha.split('-');
    L.push(e.dias === 0 ? `⚠ Es hoy (${d}/${m}).` : `⚠ Es mañana (${d}/${m}).`);
  }
  return L.join('\n').trim();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CATEGORIAS_AVISO, CATEGORIAS_AVISO_POR_ID, fechasDeTexto, categoriaDeTexto,
    tituloDeTexto, estadoAviso, resumirCartelera, textoParaTiendas
  };
}

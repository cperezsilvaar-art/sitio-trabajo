/*
 * novedades.js — Lectura del parte de novedades de liquidación de sueldos.
 *
 * Es la planilla que Nómina arma todos los meses, una hoja por sucursal, con
 * una fila por persona. Trae tres cosas que el panel necesita y que hasta ahora
 * se cargaban a mano: quién está en cada tienda, cuántas horas extras hizo cada
 * uno, y los días de ausencia abiertos por concepto.
 *
 * Lo que NO trae es la posición de cada persona. Se asigna una vez en la solapa
 * de Talento y de ahí en más los meses siguientes la conservan.
 */

/* Encabezados que se reconocen. La comparación es sin acentos, sin espacios y
   en mayúsculas, así que aguanta las variantes de tipeo entre hojas. */
const COLUMNAS_NOVEDADES = {
  MES: 'mes',
  TIENDA: 'tienda',
  SECTOR: 'sector',
  LEGAJO: 'legajo',
  CUIL: 'cuil',
  APELLIDO: 'apellido',
  NOMBRE: 'nombre',
  HORASNOCTURNAS: 'nocturnas',
  'HORASEXTRAS50%': 'he50',
  'HORASEXTRAS100%': 'he100',
  TURNO: 'turno',
  FERIADOTRABAJADO: 'feriado',
  DIADELGREMIO: 'gremio',
  DIASEXAMEN: 'examen',
  DIASENFERMEDAD: 'enfermedad',
  DIASDEVACACIONES: 'vacaciones',
  DIASDEAUSENCIANOJUSTIFICADA: 'noJustificada',
  DIASDEAUSENCIANOJUSTIF: 'noJustificada',
  AUSENCIAPORFALLECIMIENTO: 'fallecimiento',
  MUDANZA: 'mudanza',
  FALTANTEDECAJERO: 'faltanteCaja',
  OBSERVACIONES: 'obs',

  /* Cómo viene el libro desde 2026. Los rótulos cambiaron —las licencias
     pasaron a llamarse «LIC. …»— y aparecieron cinco conceptos que antes no
     estaban. Los nombres viejos quedan arriba porque los meses ya cargados se
     leyeron con ellos y un libro guardado tiene que seguir entrando igual. */
  RAZONSOCIAL: 'razonSocial',
  AREA: 'area',
  COLABORADOR: 'colaborador',
  LICEFERMEDAD: 'enfermedad',     // la errata está en la planilla
  LICENFERMEDAD: 'enfermedad',
  LICART: 'art',
  LICEXAMEN: 'examen',
  LICVACACIONES: 'vacaciones',
  LICMUDANZA: 'mudanza',
  LICFALLECIMIENTO: 'fallecimiento',
  LICMATRIMONIO: 'matrimonio',
  LICNACIMIENTO: 'nacimiento',
  LICMATERNIDAD: 'maternidad',
  RESERVADEPUESTO: 'reserva'
};

/* Cada novedad de ausencia cae en un concepto del tablero de estadísticas.
   Los códigos son los de TD01, los mismos que usa la solapa de Ausentismo. */
/* Los conceptos de ausencia del libro.
 *
 * `cod` es el de la planilla TD01 y **está vacío en los que TD01 no tiene**:
 * esos no se imputan a un código y se cuentan igual, que es mejor que
 * inventarles uno. `ausentismo: false` marca lo que no es ausentismo aunque
 * sea una ausencia —tiempo planificado o una licencia que no habla de la
 * gestión—, la misma regla que `TIPOS_FORMULARIO` y `diasDeAusenciaEntre()`.
 */
const MAPA_AUSENCIAS = [
  { campo: 'enfermedad',    cod: '085', nombre: 'Enfermedad' },
  { campo: 'art',           cod: '',    nombre: 'ART' },
  { campo: 'vacaciones',    cod: '071', nombre: 'Vacaciones',              ausentismo: false },
  { campo: 'noJustificada', cod: '081', nombre: 'Ausente sin aviso' },
  { campo: 'fallecimiento', cod: '052', nombre: 'Fallecimiento 1er grado', ausentismo: false },
  { campo: 'matrimonio',    cod: '',    nombre: 'Matrimonio',              ausentismo: false },
  { campo: 'nacimiento',    cod: '',    nombre: 'Nacimiento',              ausentismo: false },
  { campo: 'maternidad',    cod: '',    nombre: 'Maternidad',              ausentismo: false },
  { campo: 'mudanza',       cod: '054', nombre: 'Mudanza' },
  /* Reserva de puesto es el art. 211: la licencia paga se agotó y la persona
     sigue sin venir. Cuenta como turno que no se cubre, que es lo que la
     dotación necesita saber. */
  { campo: 'reserva',       cod: '',    nombre: 'Reserva de puesto' },
  /* La planilla no distingue examen secundario de universitario; se imputa al
     universitario, que es el caso corriente. Los dos son no controlables, así
     que la lectura del mes no cambia. */
  { campo: 'examen',        cod: '056', nombre: 'Examen universitario' }
];

/** Si ese concepto suma al ausentismo. Por defecto sí. */
const cuentaComoAusentismo = campo => {
  const m = MAPA_AUSENCIAS.find(x => x.campo === campo);
  return !!m && m.ausentismo !== false;
};

const CAMPOS_NOVEDAD = ['nocturnas', 'he50', 'he100', 'feriado', 'gremio', 'examen',
                        'enfermedad', 'art', 'vacaciones', 'noJustificada', 'fallecimiento',
                        'matrimonio', 'nacimiento', 'maternidad', 'mudanza', 'reserva'];

const _norm = t => String(t == null ? '' : t)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9%]/g, '');

/** Dígitos de un valor, tolerando el CUIL escrito con guiones. */
function soloDigitos(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

function esCuil(v) {
  const d = soloDigitos(v);
  return d.length === 10 || d.length === 11;
}

/** Número tolerante: acepta "1.234,56", "$ 1.234", "-", vacío. */
function numeroNovedad(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let t = String(v == null ? '' : v).trim().replace(/\$/g, '').replace(/\s/g, '');
  if (!t || t === '-' || t === '—') return 0;
  t = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t) ? t.replace(/\./g, '').replace(',', '.')
                                             : t.replace(',', '.');
  const n = parseFloat(t);
  return isFinite(n) ? n : 0;
}

/**
 * Interpreta lo que se copia de una hoja del libro de novedades.
 *
 * Dos cuidados que vienen del archivo real:
 *  - En algunas hojas el bloque de identidad quedó corrido una columna a la
 *    izquierda (el legajo cayó bajo el encabezado TIENDA). Las columnas de
 *    novedades no están corridas. Por eso la identidad se ubica por contenido,
 *    fila por fila, y las novedades por su encabezado.
 *  - Alguna hoja repite un encabezado (dos "HORAS NOCTURNAS"); se toma la
 *    primera aparición de cada campo.
 */
function interpretarNovedades(crudo) {
  /* Por filasPegadas y no por \n: los encabezados del libro de novedades
     también traen saltos de línea adentro de la celda. */
  const lineas = filasPegadas(crudo);
  if (lineas.length < 2) return { filas: [], avisos: ['No hay filas para leer.'], tienda: '', mes: '' };

  const partir = f => f;

  /* El encabezado es la primera línea que nombra CUIL o APELLIDO: así se puede
     pegar con o sin las filas de título que a veces trae la hoja. */
  const iEnc = lineas.findIndex(l => {
    const c = partir(l).map(_norm);
    return c.includes('CUIL') || c.includes('APELLIDO');
  });
  if (iEnc < 0) return { filas: [], avisos: ['No se encontró la fila de encabezados (CUIL, APELLIDO, …).'], tienda: '', mes: '' };

  const enc = partir(lineas[iEnc]).map(_norm);
  const col = {};
  enc.forEach((e, i) => {
    const campo = COLUMNAS_NOVEDADES[e];
    if (campo && col[campo] === undefined) col[campo] = i;
  });

  const avisos = [];
  const filas = [];
  let sinCuil = 0, corridas = 0;
  let tienda = '', mes = '';

  lineas.slice(iEnc + 1).forEach(l => {
    const c = partir(l);
    const iCuil = c.findIndex(esCuil);
    if (iCuil < 0) { if (c.some(x => x)) sinCuil++; return; }
    if (iCuil !== col.cuil) corridas++;

    const txt = i => (i >= 0 && i < c.length && c[i] != null) ? String(c[i]).trim() : '';
    const nov = k => col[k] === undefined ? 0 : numeroNovedad(c[col[k]]);

    /* Con la columna COLABORADOR el nombre viene entero y en su lugar; sin
       ella, el apellido y el nombre son las dos celdas que siguen al CUIL. */
    const unaSolaColumna = col.colaborador !== undefined;
    const fila = {
      cuil: soloDigitos(c[iCuil]),
      colaborador: unaSolaColumna ? txt(col.colaborador) : '',
      apellido: unaSolaColumna ? '' : txt(iCuil + 1),
      nombre: unaSolaColumna ? '' : txt(iCuil + 2),
      legajo: col.legajo === undefined ? '' : txt(unaSolaColumna ? col.legajo : iCuil - 1),
      sector: col.sector === undefined ? '' : txt(iCuil - 1),
      /* La tienda y el área van por fila y no por hoja: el libro entero viene
         en una sola pestaña y cada fila dice a dónde pertenece. */
      tienda: col.tienda === undefined ? '' : txt(col.tienda),
      area: col.area === undefined ? '' : txt(col.area),
      obs: txt(col.obs)
    };
    CAMPOS_NOVEDAD.forEach(k => { fila[k] = nov(k); });

    /* La tienda solo se cree cuando la fila no viene corrida: en las corridas
       esa columna quedó ocupada por el legajo. */
    if (!tienda && col.tienda !== undefined && iCuil === col.cuil) tienda = txt(col.tienda);
    if (!mes && col.mes !== undefined) mes = txt(col.mes);

    if (fila.colaborador || fila.apellido || fila.nombre) filas.push(fila);
  });

  if (sinCuil) avisos.push(`${sinCuil} fila${sinCuil === 1 ? '' : 's'} sin CUIL reconocible que quedaron afuera.`);
  if (corridas) {
    avisos.push(`${corridas} fila${corridas === 1 ? '' : 's'} venían corridas una columna respecto del encabezado; ` +
                'se leyeron igual tomando el CUIL como referencia.');
  }
  if (!filas.length) avisos.push('No se reconoció ninguna persona: revisá que estén las columnas CUIL y COLABORADOR (o APELLIDO y NOMBRE).');

  return { filas, avisos, tienda, mes };
}

/** Totales de una tanda de novedades, para mostrar antes y después de importar. */
function resumirNovedades(filas) {
  const t = { personas: (filas || []).length };
  CAMPOS_NOVEDAD.forEach(k => { t[k] = 0; });
  (filas || []).forEach(f => CAMPOS_NOVEDAD.forEach(k => { t[k] += numeroNovedad(f[k]); }));
  t.horasExtras = t.he50 + t.he100;
  t.diasAusencia = MAPA_AUSENCIAS.reduce((s, m) => s + t[m.campo], 0);
  return t;
}

/** Días de ausencia de una novedad, abiertos por código del tablero. */
function ausenciasPorCodigo(novedad) {
  const d = {};
  MAPA_AUSENCIAS.forEach(m => {
    if (!m.cod) return;   // TD01 no tiene código para este concepto
    const v = numeroNovedad((novedad || {})[m.campo]);
    if (v) d[m.cod] = (d[m.cod] || 0) + v;
  });
  return d;
}

/* Nombre presentable a partir del apellido y el nombre de la planilla, que
   vienen en mayúsculas y a veces con espacios de más. */
function nombreDePlanilla(fila) {
  const limpiar = t => String(t || '').replace(/\s+/g, ' ').trim();
  /* El libro de 2026 trae una sola columna COLABORADOR con el nombre entero;
     el viejo traía apellido y nombre separados. Se respeta lo que venga en vez
     de partir el completo por el primer espacio, que rompe los apellidos
     compuestos —«URBINA LEGUA KEYLA»— y son varios en el área. */
  if (limpiar(fila.colaborador)) return limpiar(fila.colaborador);
  return [limpiar(fila.apellido), limpiar(fila.nombre)].filter(Boolean).join(', ');
}
